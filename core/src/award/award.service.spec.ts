import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { parseUnits } from 'ethers';
import { AuthService } from '@/auth/auth.service';
import { ChainService } from '@/chain/chain.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UserWalletRepository } from '@/wallet/user-wallet.repository';
import { AwardRepository } from './award.repository';
import { AwardService } from './award.service';
import { AwardTableService } from './award-table.service';
import { TxLogRepository } from './repositories/tx-log.repository';

describe('AwardService', () => {
  let service: AwardService;
  const tx = {
    $queryRaw: jest.fn(),
    userWallet: {
      upsert: jest.fn(),
    },
    userDailyAwardLock: {
      upsert: jest.fn(),
    },
    chainOperation: {
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    tokenPolicy: { findUnique: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    chainOperation: {
      update: jest.fn(),
    },
  };
  const chainService = {
    award: jest.fn(),
    balanceOf: jest.fn(),
    getChainId: jest.fn(),
    submitAward: jest.fn(),
    waitForTransaction: jest.fn(),
    getContractAddress: jest.fn(),
  };
  const awardTableService = {
    getAwardRuleByEventId: jest.fn(),
    listAwardRules: jest.fn(),
  };
  const userWalletRepository = {
    create: jest.fn(),
    upsert: jest.fn(),
  };
  const userAwardRepository = {
    findByUidAndEventIdWithLock: jest.fn(),
    upsertInTransaction: jest.fn(),
    incrementCountInTransaction: jest.fn(),
    findAllByUid: jest.fn(),
  };
  const txLogRepository = {
    countTodayByUidAndAwardRuleId: jest.fn(),
    sumTodayAwardsByUid: jest.fn(),
    createInTransaction: jest.fn(),
    findTodayByUid: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const authService = {
    userExists: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(callback => callback(tx));
    configService.get.mockReturnValue('31337');
    tx.chainOperation.count.mockResolvedValue(0);
    tx.chainOperation.aggregate.mockResolvedValue({ _sum: { amount: null } });
    tx.chainOperation.create.mockResolvedValue({ id: 'operation-id' });
    tx.tokenPolicy.findUnique.mockResolvedValue(null);
    chainService.submitAward.mockResolvedValue({ hash: '0xaward' });
    chainService.waitForTransaction.mockResolvedValue({
      blockNumber: 123,
      blockHash: '0xblock',
      logs: [{ address: '0xcontract', index: 0 }],
    });
    chainService.getContractAddress.mockReturnValue('0xcontract');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChainService, useValue: chainService },
        { provide: AwardTableService, useValue: awardTableService },
        { provide: UserWalletRepository, useValue: userWalletRepository },
        { provide: AwardRepository, useValue: userAwardRepository },
        { provide: TxLogRepository, useValue: txLogRepository },
        { provide: ConfigService, useValue: configService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    service = module.get<AwardService>(AwardService);
  });

  it('awards a known event to a Nexus user through a component token', async () => {
    awardTableService.getAwardRuleByEventId.mockResolvedValue({
      id: 'rule-id',
      eventId: 'enplay_purchase_res_item',
      source: 'ENPlay',
      rewardAmount: 1,
      maxPerDay: 0,
      maxPerUser: 0,
    });
    authService.userExists.mockResolvedValue(true);
    userAwardRepository.findByUidAndEventIdWithLock.mockResolvedValue(null);
    chainService.balanceOf.mockResolvedValue(parseUnits('7', 18));

    await expect(
      service.awardEvent('nexus-user-uid', 'enplay_purchase_res_item', {
        timestamp: '2026-07-02T10:00:00.000Z',
        source: 'data-beacon-smoke',
        componentToken: 'component-token',
      })
    ).resolves.toEqual({
      txHash: '0xaward',
      awarde_amount: '1',
      new_balance: '7.0',
    });

    expect(authService.userExists).toHaveBeenCalledWith(
      'nexus-user-uid',
      'component-token'
    );
    expect(tx.userWallet.upsert).toHaveBeenCalledWith({
      where: { uid: 'nexus-user-uid' },
      update: {},
      create: {
        uid: 'nexus-user-uid',
        address: expect.any(String),
      },
    });
    expect(userAwardRepository.upsertInTransaction).toHaveBeenCalledWith(
      'nexus-user-uid',
      'rule-id',
      tx
    );
    expect(txLogRepository.createInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'nexus-user-uid',
        type: 'award',
        eventId: 'enplay_purchase_res_item',
        source: 'data-beacon-smoke',
        eventTimestamp: new Date('2026-07-02T10:00:00.000Z'),
      }),
      tx
    );
  });

  it('rejects an invalid partner event timestamp', async () => {
    await expect(
      service.awardEvent('nexus-user-uid', 'first_login', {
        timestamp: 'not-a-date',
        componentToken: 'component-token',
      })
    ).rejects.toThrow(BadRequestException);

    expect(awardTableService.getAwardRuleByEventId).not.toHaveBeenCalled();
    expect(chainService.award).not.toHaveBeenCalled();
  });

  it('rejects unknown award events before checking Nexus user existence', async () => {
    awardTableService.getAwardRuleByEventId.mockResolvedValue(null);

    await expect(
      service.awardEvent('nexus-user-uid', 'missing-event', {
        componentToken: 'component-token',
      })
    ).rejects.toThrow(NotFoundException);

    expect(authService.userExists).not.toHaveBeenCalled();
  });

  it('enforces maxPerUser limits', async () => {
    awardTableService.getAwardRuleByEventId.mockResolvedValue({
      id: 'rule-id',
      eventId: 'first_login',
      source: 'Nexus',
      rewardAmount: 1,
      maxPerDay: 0,
      maxPerUser: 1,
    });
    authService.userExists.mockResolvedValue(true);
    userAwardRepository.findByUidAndEventIdWithLock.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.awardEvent('nexus-user-uid', 'first_login', {
        componentToken: 'component-token',
      })
    ).rejects.toThrow(ForbiddenException);

    expect(chainService.award).not.toHaveBeenCalled();
  });

  it('returns available awards for the Nexus user id from introspection', async () => {
    userAwardRepository.findAllByUid.mockResolvedValue([
      { awardRuleId: 'rule-id', count: 1 },
    ]);
    awardTableService.listAwardRules.mockResolvedValue([
      {
        id: 'rule-id',
        eventId: 'first_login',
        source: 'Nexus',
        rewardAmount: 3,
        maxPerUser: 5,
        maxPerDay: 0,
      },
    ]);
    txLogRepository.findTodayByUid.mockResolvedValue([]);

    await expect(
      service.getAvailableAwardsForUser('nexus-user-uid')
    ).resolves.toEqual([
      {
        id: 'rule-id',
        event_id: 'first_login',
        source: 'Nexus',
        reward_amount: 3,
        max_per_user: 5,
        max_per_day: 0,
        awarded_count: 1,
        today_count: 0,
        remaining: 4,
        is_available: true,
      },
    ]);

    expect(userAwardRepository.findAllByUid).toHaveBeenCalledWith(
      'nexus-user-uid'
    );
  });

  it('counts today awards by external event id rather than rule uuid', async () => {
    userAwardRepository.findAllByUid.mockResolvedValue([]);
    awardTableService.listAwardRules.mockResolvedValue([
      {
        id: 'rule-uuid',
        eventId: 'daily_login_bonus',
        source: 'ENPlay',
        rewardAmount: 1,
        maxPerUser: 0,
        maxPerDay: 1,
      },
    ]);
    txLogRepository.findTodayByUid.mockResolvedValue([
      { eventId: 'daily_login_bonus' },
    ]);

    await expect(
      service.getAvailableAwardsForUser('nexus-user-uid')
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'rule-uuid',
        event_id: 'daily_login_bonus',
        today_count: 1,
        is_available: false,
      }),
    ]);
  });
});
