import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { PrismaService } from '@/prisma/prisma.service';
import { ChainService } from '@/chain/chain.service';

describe('AdminService.transactions — tx_log ∪ chain_operations', () => {
  let service: AdminService;
  const prisma = {
    txLog: { findMany: jest.fn() },
    chainOperation: { findMany: jest.fn() },
  };
  const chain = {};

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChainService, useValue: chain },
      ],
    }).compile();
    service = moduleRef.get<AdminService>(AdminService);
  });

  it('lists every tx_log row plus only chain_operations without a tx_log (deduped)', async () => {
    const now = new Date('2026-03-09T09:57:00.000Z');

    // 1st txLog.findMany → the "linked" lookup (chainOperationIds already in tx_log)
    // 2nd txLog.findMany → the actual ledger rows
    prisma.txLog.findMany
      .mockResolvedValueOnce([{ chainOperationId: 'op-confirmed' }])
      .mockResolvedValueOnce([
        {
          id: 1,
          createdAt: now,
          type: 'award',
          uid: 'u1',
          address: '0xa',
          amount: '3',
          status: 'CONFIRMED',
          txHash: '0xh1',
          eventId: 'first_login',
          source: 'Nexus',
          label: null,
          chainId: 80002,
          confirmedAt: now,
          reason: null,
          adminSubject: null,
          chainOperationId: 'op-confirmed',
        },
        {
          id: 2,
          createdAt: now,
          type: 'spend',
          uid: 'u2',
          address: '0xb',
          amount: '1',
          status: 'CONFIRMED',
          txHash: '0xh2',
          eventId: null,
          source: null,
          label: 'buy',
          chainId: 80002,
          confirmedAt: now,
          reason: null,
          adminSubject: null,
          chainOperationId: null,
        },
      ]);

    // chain_operations: the DB query already excludes the confirmed op; only the in-flight one returns
    prisma.chainOperation.findMany.mockResolvedValue([
      {
        id: 'op-pending',
        createdAt: now,
        type: 'award',
        uid: 'u3',
        address: '0xc',
        amount: '2',
        status: 'RESERVED',
        txHash: null,
        eventId: 'watch_video',
        source: 'Education Hub',
        label: null,
        chainId: 80002,
        confirmedAt: null,
        reason: null,
        adminSubject: null,
        componentIdentity: 'comp-1',
      },
    ]);

    const res: any = await service.transactions({
      page: 1,
      pageSize: 25,
      sort: 'createdAt',
      order: 'desc',
    } as any);

    // 2 tx_log + 1 in-flight op, no duplicate of the confirmed op
    expect(res.total).toBe(3);
    expect(res.items).toHaveLength(3);

    // dedup wiring: chain_operations query excludes the linked op id
    const opArg = prisma.chainOperation.findMany.mock.calls[0][0];
    expect(JSON.stringify(opArg.where)).toContain('op-confirmed');

    // both origins present, tagged
    const origins = res.items.map((i: any) => i.origin).sort();
    expect(origins).toEqual(['chain_operation', 'tx_log', 'tx_log']);

    // tx_log rows expose no componentIdentity; the chain_operation row keeps it
    const txItems = res.items.filter((i: any) => i.origin === 'tx_log');
    expect(txItems.every((i: any) => i.componentIdentity === null)).toBe(true);
    const opItem = res.items.find((i: any) => i.origin === 'chain_operation');
    expect(opItem.componentIdentity).toBe('comp-1');
  });

  it('returns empty (not an error) when both stores are empty', async () => {
    prisma.txLog.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    prisma.chainOperation.findMany.mockResolvedValue([]);

    const res: any = await service.transactions({
      page: 1,
      pageSize: 25,
      sort: 'createdAt',
      order: 'desc',
    } as any);

    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });
});
