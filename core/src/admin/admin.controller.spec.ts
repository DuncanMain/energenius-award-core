import { AdminController } from './admin.controller';

describe('AdminController.health', () => {
  it('returns degraded nullable chain fields while preserving the DB cursor', async () => {
    const chain = {
      owner: jest.fn().mockResolvedValue('0xowner'),
      treasury: jest.fn().mockRejectedValue({
        code: 19,
        message: 'Temporary internal error, trace-id: treasury-123',
      }),
      paused: jest.fn().mockResolvedValue(false),
      metadata: jest.fn().mockRejectedValue({
        status: 503,
        message: 'RPC unavailable',
      }),
      getCode: jest.fn().mockRejectedValue({ status: 500 }),
      getBlockNumber: jest.fn().mockRejectedValue({ status: 502 }),
      getChainId: jest.fn().mockReturnValue(80002),
      getContractAddress: jest.fn().mockReturnValue('0xcontract'),
      getSignerAddress: jest.fn().mockReturnValue('0xsigner'),
      balanceOf: jest.fn(),
    };
    const prisma = {
      chainSyncCursor: {
        findUnique: jest.fn().mockResolvedValue({ lastProcessedBlock: 123n }),
      },
    };
    const controller = new AdminController(
      chain as any,
      prisma as any,
      {} as any,
      {} as any
    );

    await expect(controller.health()).resolves.toMatchObject({
      contract_deployed: null,
      owner_address: '0xowner',
      signer_is_owner: false,
      treasury_address: null,
      treasury_balance_wei: null,
      paused: false,
      token: null,
      latest_block: null,
      last_reconciled_block: '123',
      rpc_status: 'DEGRADED',
    });

    const result = await controller.health();
    expect(result.rpc_errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'treasury' }),
        expect.objectContaining({ operation: 'metadata' }),
        expect.objectContaining({ operation: 'getCode' }),
        expect.objectContaining({ operation: 'getBlockNumber' }),
      ])
    );
    expect(chain.balanceOf).not.toHaveBeenCalled();
  });
});
