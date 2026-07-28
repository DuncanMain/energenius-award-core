import { parseUnits } from 'ethers';
import { ChainReconciliationService } from './chain-reconciliation.service';

describe('ChainReconciliationService', () => {
  let service: ChainReconciliationService;

  const tx: any = {
    $queryRaw: jest.fn(),
    chainSyncCursor: { findUnique: jest.fn(), upsert: jest.fn() },
    txLog: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
    chainOperation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    userWallet: { findFirst: jest.fn() },
    userAward: { upsert: jest.fn() },
  };
  const prisma: any = {
    $transaction: jest.fn(),
    chainOperation: { updateMany: jest.fn() },
  };
  const chain: any = {
    getChainId: jest.fn().mockReturnValue(31337),
    getBlockNumber: jest.fn(),
    getContractAddress: jest.fn().mockReturnValue('0xcontract'),
    treasury: jest.fn(),
    transferEvents: jest.fn(),
    getTransactionReceipt: jest.fn(),
  };
  const config: any = { get: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((cb: any) => cb(tx));
    config.get.mockImplementation(
      (key: string) =>
        (
          ({
            CHAIN_CONFIRMATIONS: '5',
            CHAIN_SYNC_CHUNK_SIZE: '1000',
            CHAIN_SYNC_START_BLOCK: '0',
          }) as Record<string, string>
        )[key]
    );
    tx.chainOperation.findMany.mockResolvedValue([]);
    service = new ChainReconciliationService(prisma, chain, config);
  });

  describe('reapStaleOperations (H5)', () => {
    it('fails RESERVED ops with no txHash older than the TTL', async () => {
      prisma.chainOperation.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.reapStaleOperations();

      expect(result).toEqual({ reaped: 3 });
      const arg = prisma.chainOperation.updateMany.mock.calls[0][0];
      expect(arg.where).toMatchObject({ status: 'RESERVED', txHash: null });
      expect(arg.where.createdAt.lt).toBeInstanceOf(Date);
      expect(arg.data.status).toBe('FAILED');
    });
  });

  describe('syncOnce', () => {
    it('skips when another instance holds the advisory lock (H3)', async () => {
      tx.$queryRaw.mockResolvedValue([{ locked: false }]);

      const result = await service.syncOnce();

      expect(result).toEqual({
        skipped: true,
        reason: 'locked-by-another-instance',
      });
      expect(chain.getBlockNumber).not.toHaveBeenCalled();
    });

    it('processes a chunk and advances the cursor when it is the leader', async () => {
      tx.$queryRaw.mockResolvedValue([{ locked: true }]);
      chain.getBlockNumber.mockResolvedValue(100);
      tx.chainSyncCursor.findUnique.mockResolvedValue(null);
      chain.treasury.mockResolvedValue('0xtreasury');
      chain.transferEvents.mockResolvedValue([]);

      const result = await service.syncOnce();

      // safeHead = 100 - 5 = 95; fromBlock = 0 (no cursor); toBlock = min(95, 999) = 95
      expect(result).toEqual({ fromBlock: 0, toBlock: 95, processed: 0 });
      expect(tx.chainSyncCursor.upsert).toHaveBeenCalledTimes(1);
    });

    it('reconciles a transfer keyed by logIndex (H4)', async () => {
      tx.$queryRaw.mockResolvedValue([{ locked: true }]);
      chain.getBlockNumber.mockResolvedValue(100);
      tx.chainSyncCursor.findUnique.mockResolvedValue(null);
      chain.treasury.mockResolvedValue('0xTREASURY');
      chain.transferEvents.mockResolvedValue([
        {
          args: {
            from: '0xTREASURY',
            to: '0xuser',
            value: parseUnits('2', 18),
          },
          transactionHash: '0xhash',
          index: 3,
          blockNumber: 50,
          blockHash: '0xblock',
        },
      ]);
      tx.userWallet.findFirst.mockResolvedValue({ uid: 'u1' });
      tx.chainOperation.findUnique.mockResolvedValue(null);
      tx.txLog.findFirst.mockResolvedValue(null);

      await service.syncOnce();

      // the lookup must include logIndex so batched Transfer logs don't collapse
      expect(tx.txLog.findFirst).toHaveBeenCalledWith({
        where: { chainId: 31337, txHash: '0xhash', logIndex: 3 },
      });
      expect(tx.txLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ logIndex: 3, type: 'award' }),
        })
      );
    });
  });
});
