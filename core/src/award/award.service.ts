import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { formatUnits, parseUnits } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { ChainService } from '../chain/chain.service';
import { TxLogRepository } from './repositories/tx-log.repository';
import { UserWalletRepository } from '@/wallet/user-wallet.repository';
import { deriveAddress } from '@/utils/wallet';
import { AwardRepository } from './award.repository';
import { AwardTableService } from './award-table.service';
import { ConfigService } from '@nestjs/config';
import { AwardRuleId } from '@prisma/client';

@Injectable()
export class AwardService {
  constructor(
    private prisma: PrismaService,
    private chainService: ChainService,
    private awardTableService: AwardTableService,
    private userWalletRepo: UserWalletRepository,
    private userAwardRepo: AwardRepository,
    private txLogRepo: TxLogRepository,
    private configService: ConfigService
  ) {}

  async awardEvent(
    uid: string,
    eventId: string,
    opts?: { timestamp?: string; source?: string }
  ) {
    let eventTimestamp: Date | null = null;

    const rule = await this.awardTableService.getAwardRuleById(eventId);
    if (!rule) {
      throw new NotFoundException(`Unknown eventId: ${eventId}`);
    }

    const address = deriveAddress(uid);
    const amountWei = parseUnits(rule.rewardAmount.toString(), 18);

    return await this.prisma.$transaction(async tx => {
      await tx.userWallet.upsert({
        where: { uid },
        update: {},
        create: { uid, address },
      });

      const maxDay = rule.maxPerDay;
      if (maxDay > 0) {
        const todayCount = await this.txLogRepo.countTodayByUidAndAwardRuleId(
          uid,
          eventId,
          tx
        );
        if (todayCount >= maxDay) {
          throw new ForbiddenException(
            'maxPerDay reached for this award today'
          );
        }
      }

      const existingAward =
        await this.userAwardRepo.findByUidAndEventIdWithLock(uid, rule.id, tx);
      const currentCount = existingAward?.count ?? 0;
      const maxUser = rule.maxPerUser;
      const unlimited = maxUser === 0;

      if (!unlimited && currentCount >= maxUser) {
        throw new ForbiddenException('maxPerUser reached for this award');
      }

      await this.userAwardRepo.upsertInTransaction(uid, rule.id, tx);

      const txHash = await this.chainService.award(address, amountWei);
      const chainId = Number(this.configService.get<string>('CHAIN_ID'));

      await this.userAwardRepo.incrementCountInTransaction(uid, rule.id, tx);

      await this.txLogRepo.createInTransaction(
        {
          uid,
          address,
          type: 'award',
          eventId,
          label: rule.eventId,
          amount: rule.rewardAmount.toString(),
          txHash,
          chainId,
          eventTimestamp,
          source: opts?.source ?? null,
        },
        tx
      );

      const newBalanceWei = await this.chainService.balanceOf(address);

      return {
        txHash,
        awarde_amount: rule.rewardAmount.toString(),
        new_balance: formatUnits(newBalanceWei, 18),
      };
    });
  }
  async spend(uid: AwardRuleId, amountEnc: bigint, label?: string) {
    const address = deriveAddress(uid);
    const chainId = this.chainService.getChainId();

    await this.userWalletRepo.upsert(uid, address);

    const amountWei = parseUnits(amountEnc.toString(), 18);
    const balanceWei = await this.chainService.balanceOf(address);

    if (balanceWei < amountWei) {
      const balanceEnc = formatUnits(balanceWei, 18);
      throw new BadRequestException(
        `Insufficient balance: have ${balanceEnc} ENC, need ${amountEnc} ENC`
      );
    }

    return await this.prisma.$transaction(async tx => {
      const amountWei = BigInt(parseUnits(amountEnc.toString(), 18).toString());
      const txHash = await this.chainService.spend(address, amountWei);

      await this.txLogRepo.createInTransaction(
        {
          uid,
          address,
          type: 'spend',
          eventId: null,
          label: label ?? null,
          amount: amountEnc.toString(),
          txHash,
          chainId,
        },
        tx
      );

      const newBalanceWei = await this.chainService.balanceOf(address);

      return {
        tx_hash: txHash,
        address,
        new_balance_wei: newBalanceWei.toString(),
      };
    });
  }

  async getAvailableAwardsForUser(uid: string) {
    try {
      const address = deriveAddress(uid);

      const userAwards = await this.userAwardRepo.findAllByUid(uid);

      if (!userAwards) {
        await this.userWalletRepo.create(uid, address);
      }

      const counts = new Map<string, number>();
      for (const ua of userAwards) {
        counts.set(ua.awardRuleId, ua.count);
      }

      const rules = await this.awardTableService.listAwardRules();

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const todayLogs = await this.txLogRepo.findTodayByUid(uid, startOfDay);
      const todayCounts = new Map<string, number>();

      for (const log of todayLogs) {
        if (log.eventId) {
          todayCounts.set(log.eventId, (todayCounts.get(log.eventId) ?? 0) + 1);
        }
      }

      return rules.map(rule => {
        const awardedCount = counts.get(rule.id) ?? 0;
        const todayCount = todayCounts.get(rule.id) ?? 0;

        const maxUser = rule.maxPerUser;
        const maxDay = rule.maxPerDay;

        const userLimitOk = maxUser === 0 || awardedCount < maxUser;
        const dayLimitOk = maxDay === 0 || todayCount < maxDay;

        const remaining = maxUser === 0 ? null : maxUser - awardedCount;

        return {
          id: rule.id,
          event_id: rule.eventId,
          source: rule.source,
          reward_amount: rule.rewardAmount,
          max_per_user: rule.maxPerUser,
          max_per_day: rule.maxPerDay,
          awarded_count: awardedCount,
          today_count: todayCount,
          remaining,
          is_available: userLimitOk && dayLimitOk,
        };
      });
    } catch (err) {
      throw new InternalServerErrorException(
        'Failed to get available awards for user',
        err.message
      );
    }
  }
}
