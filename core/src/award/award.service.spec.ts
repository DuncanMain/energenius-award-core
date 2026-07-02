import { ForbiddenException, NotFoundException } from '@nestjs/common';
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
    userWallet: {
      upsert: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn(),
  };
  const chainService = {
    award: jest.fn(),
    balanceOf: jest.fn(),
    getChainId: jest.fn(),
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
    chainService.award.mockResolvedValue('0xaward');
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
      }),
      tx
    );
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
});
