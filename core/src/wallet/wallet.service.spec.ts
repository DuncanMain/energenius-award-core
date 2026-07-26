import { Test, TestingModule } from '@nestjs/testing';
import { WalletService } from './wallet.service';
import { ChainService } from '@/chain/chain.service';
import { UserWalletRepository } from './user-wallet.repository';
import { TxLogRepository } from '@/award/repositories/tx-log.repository';

describe('WalletService', () => {
  let service: WalletService;
  const chainService = { balanceOf: jest.fn() };
  const userWalletRepo = { upsert: jest.fn() };
  const txLogRepo = { findRecentByUid: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    userWalletRepo.upsert.mockResolvedValue({ uid: 'u1', address: '0xabc' });
    txLogRepo.findRecentByUid.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: ChainService, useValue: chainService },
        { provide: UserWalletRepository, useValue: userWalletRepo },
        { provide: TxLogRepository, useValue: txLogRepo },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects an empty uid', async () => {
    await expect(service.getWalletSnapshot('')).rejects.toThrow('uid is required');
  });

  it('returns the balance when the chain read succeeds', async () => {
    chainService.balanceOf.mockResolvedValue(1234n);

    const snap = await service.getWalletSnapshot('u1');

    expect(snap.balance_available).toBe(true);
    expect(snap.balance_wei).toBe('1234');
    expect(snap.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(snap.history).toEqual([]);
  });

  it('degrades gracefully (no throw) when the chain RPC is unreachable', async () => {
    // this is the /v1/wallet 500 root cause: balanceOf rejects on ECONNREFUSED
    chainService.balanceOf.mockRejectedValue(
      Object.assign(new Error('could not detect network'), { code: 'ECONNREFUSED' })
    );

    const snap = await service.getWalletSnapshot('u1');

    // snapshot still returns 200-worthy data instead of bubbling a 500
    expect(snap.balance_available).toBe(false);
    expect(snap.balance_wei).toBeNull();
    expect(snap.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(snap.history).toEqual([]);
    // the wallet row is still upserted
    expect(userWalletRepo.upsert).toHaveBeenCalledTimes(1);
  });

  it('maps recent tx logs into history', async () => {
    chainService.balanceOf.mockResolvedValue(0n);
    txLogRepo.findRecentByUid.mockResolvedValue([
      {
        type: 'AWARD',
        eventId: 'evt-1',
        label: null,
        amount: 500n,
        txHash: '0xhash',
        createdAt: new Date('2026-07-01T00:00:00Z'),
      },
    ]);

    const snap = await service.getWalletSnapshot('u1');

    expect(snap.history).toEqual([
      {
        type: 'AWARD',
        eventId: 'evt-1',
        label: null,
        amountWei: '500',
        txHash: '0xhash',
        createdAt: '2026-07-01T00:00:00.000Z',
      },
    ]);
  });
});
