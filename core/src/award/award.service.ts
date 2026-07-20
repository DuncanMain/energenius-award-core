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
import { AuthService } from '@/auth/auth.service';
import {
  DAILY_TOKEN_CAP,
  EXEMPT_AWARD_EVENTS,
} from '@/utils/constants/award.constants';
import { dayjs } from '@/utils/dayjs';

@Injectable()
export class AwardService {
  constructor(
    private prisma: PrismaService,
    private chainService: ChainService,
    private awardTableService: AwardTableService,
    private userWalletRepo: UserWalletRepository,
    private userAwardRepo: AwardRepository,
    private txLogRepo: TxLogRepository,
    private configService: ConfigService,
    private readonly authService: AuthService
  ) {}

  async awardEvent(
    targetUserId: string,
    eventId: string,
    opts: {
      timestamp?: string;
      source?: string;
      componentToken: string;
      componentIdentity?: string | null;
    }
  ) {
    const uid = targetUserId;

    let eventTimestamp: Date | null = null;
    if (opts.timestamp) {
      eventTimestamp = new Date(opts.timestamp);
      if (Number.isNaN(eventTimestamp.getTime())) {
        throw new BadRequestException('timestamp must be a valid date-time');
      }
    }

    const rule = await this.awardTableService.getAwardRuleByEventId(eventId);
    if (!rule) {
      throw new NotFoundException(`Unknown eventId: ${eventId}`);
    }
    if (rule.enabled === false) {
      throw new ForbiddenException(`Award event is disabled: ${eventId}`);
    }

    if (opts.componentIdentity) {
      const policy = await this.prisma.componentSourcePolicy.upsert({
        where: { id: 'global' },
        update: {},
        create: { id: 'global', identityClaim: 'azp', enforce: false },
      });
      const matched =
        (await this.prisma.componentSourceMapping.count({
          where: {
            componentIdentity: opts.componentIdentity,
            source: rule.source,
            enabled: true,
          },
        })) > 0;
      await this.prisma.componentSourceObservation.create({
        data: {
          componentIdentity: opts.componentIdentity,
          configuredSource: rule.source,
          eventId,
          matched,
          enforced: policy.enforce,
        },
      });
      if (policy.enforce && !matched) {
        throw new ForbiddenException(
          'Authenticated component is not mapped to this award source'
        );
      }
    }

    const userValid = await this.authService.userExists(
      uid,
      opts.componentToken
    );
    if (!userValid) throw new NotFoundException(`Unknown uid: ${uid}`);

    const address = deriveAddress(uid);
    const amountWei = parseUnits(rule.rewardAmount.toString(), 18);

    const chainId = Number(this.configService.get<string>('CHAIN_ID'));
    const startOfDay = dayjs.utc().startOf('day').toDate();
    const startOfTomorrow = dayjs.utc().add(1, 'day').startOf('day').toDate();

    const operation = await this.prisma.$transaction(async tx => {
      // One decision at a time per user/day, including different event types.
      await tx.userDailyAwardLock.upsert({
        where: { uid_awardDate: { uid, awardDate: startOfDay } },
        update: {},
        create: { uid, awardDate: startOfDay },
      });
      await tx.$queryRaw`SELECT id FROM "user_daily_award_locks" WHERE uid = ${uid} AND award_date = ${startOfDay}::date FOR UPDATE`;

      await tx.userWallet.upsert({
        where: { uid },
        update: {},
        create: { uid, address },
      });

      const maxDay = rule.maxPerDay;
      if (maxDay > 0) {
        const [confirmedCount, pendingCount] = await Promise.all([
          this.txLogRepo.countTodayByUidAndAwardRuleId(uid, eventId, tx),
          tx.chainOperation.count({
            where: {
              uid,
              eventId,
              status: {
                in: ['RESERVED', 'SUBMITTED', 'RECONCILIATION_REQUIRED'],
              },
              createdAt: { gte: startOfDay, lt: startOfTomorrow },
            },
          }),
        ]);
        if (confirmedCount + pendingCount >= maxDay) {
          throw new ForbiddenException(
            'maxPerDay reached for this award today'
          );
        }
      }

      const tokenPolicy = await tx.tokenPolicy.findUnique({
        where: { id: 'global' },
      });
      const capEnabled = tokenPolicy?.capEnabled ?? true;
      const dailyCap = tokenPolicy?.dailyCap ?? DAILY_TOKEN_CAP;
      const exempt =
        rule.globalCapExempt || EXEMPT_AWARD_EVENTS.includes(rule.eventId);
      if (capEnabled && !exempt) {
        const [confirmedTotal, pending] = await Promise.all([
          this.txLogRepo.sumTodayAwardsByUid(uid, tx),
          tx.chainOperation.aggregate({
            where: {
              uid,
              type: 'AWARD',
              status: {
                in: ['RESERVED', 'SUBMITTED', 'RECONCILIATION_REQUIRED'],
              },
              createdAt: { gte: startOfDay, lt: startOfTomorrow },
            },
            _sum: { amount: true },
          }),
        ]);
        const pendingTotal = Number(pending._sum.amount ?? 0);
        if (confirmedTotal + pendingTotal + rule.rewardAmount > dailyCap) {
          throw new ForbiddenException(
            'User has earned the maximum amount of tokens for today'
          );
        }
      }

      const existingAward =
        await this.userAwardRepo.findByUidAndEventIdWithLock(uid, rule.id, tx);
      const currentCount = existingAward?.count ?? 0;
      const pendingUserCount = await tx.chainOperation.count({
        where: {
          uid,
          awardRuleId: rule.id,
          status: { in: ['RESERVED', 'SUBMITTED', 'RECONCILIATION_REQUIRED'] },
        },
      });
      const maxUser = rule.maxPerUser;
      const unlimited = maxUser === 0;

      if (!unlimited && currentCount + pendingUserCount >= maxUser) {
        throw new ForbiddenException('maxPerUser reached for this award');
      }

      await this.userAwardRepo.upsertInTransaction(uid, rule.id, tx);
      return tx.chainOperation.create({
        data: {
          uid,
          address,
          type: 'AWARD',
          awardRuleId: rule.id,
          eventId,
          label: rule.eventId,
          amount: rule.rewardAmount.toString(),
          source: opts.source ?? null,
          componentIdentity: opts.componentIdentity ?? null,
          eventTimestamp,
          chainId,
        },
      });
    });

    let txHash: string | null = null;
    try {
      // Serialises treasury nonce allocation across all core instances. This
      // transaction covers submission only, never block confirmation.
      txHash = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('energenius-treasury-signer'))`;
        const submitted = await this.chainService.submitAward(
          address,
          amountWei
        );
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: {
            status: 'SUBMITTED',
            txHash: submitted.hash,
            submittedAt: new Date(),
          },
        });
        return submitted.hash;
      });

      const receipt = await this.chainService.waitForTransaction(txHash);
      const contractLog = receipt.logs.find(
        log =>
          log.address.toLowerCase() ===
          this.chainService.getContractAddress().toLowerCase()
      );

      await this.prisma.$transaction(async tx => {
        await this.userAwardRepo.incrementCountInTransaction(uid, rule.id, tx);
        await this.txLogRepo.createInTransaction(
          {
            uid,
            address,
            type: 'award',
            eventId,
            label: rule.eventId,
            amount: rule.rewardAmount.toString(),
            txHash: txHash!,
            chainId,
            eventTimestamp,
            source: opts.source ?? null,
            blockNumber: BigInt(receipt.blockNumber),
            blockHash: receipt.blockHash,
            logIndex: contractLog?.index,
            confirmedAt: new Date(),
            chainOperationId: operation.id,
          },
          tx
        );
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      });

      const newBalanceWei = await this.chainService.balanceOf(address);
      return {
        txHash,
        awarde_amount: rule.rewardAmount.toString(),
        new_balance: formatUnits(newBalanceWei, 18),
      };
    } catch (error) {
      await this.prisma.chainOperation.update({
        where: { id: operation.id },
        data: {
          status: txHash ? 'RECONCILIATION_REQUIRED' : 'FAILED',
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
  }
  async spend(uid: string, amountEnc: bigint, label?: string) {
    const address = deriveAddress(uid);
    const chainId = this.chainService.getChainId();

    await this.userWalletRepo.upsert(uid, address);

    const amountWei = parseUnits(amountEnc.toString(), 18);
    const balanceWei = await this.chainService.balanceOf(address);

    const operation = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'energenius-spend:' + uid}))`;
      const pending = await tx.chainOperation.aggregate({
        where: {
          uid,
          type: 'SPEND',
          status: { in: ['RESERVED', 'SUBMITTED', 'RECONCILIATION_REQUIRED'] },
        },
        _sum: { amount: true },
      });
      const pendingEnc = BigInt(String(pending._sum.amount ?? 0));
      const requiredWei = parseUnits((pendingEnc + amountEnc).toString(), 18);
      if (balanceWei < requiredWei) {
        const balanceEnc = formatUnits(balanceWei, 18);
        throw new BadRequestException(
          `Insufficient balance: have ${balanceEnc} ENC, need ${amountEnc} ENC`
        );
      }
      return tx.chainOperation.create({
        data: {
          uid,
          address,
          type: 'SPEND',
          label: label ?? null,
          amount: amountEnc.toString(),
          chainId,
        },
      });
    });

    let txHash: string | null = null;
    try {
      txHash = await this.prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('energenius-treasury-signer'))`;
        const submitted = await this.chainService.submitSpend(
          address,
          amountWei
        );
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: {
            status: 'SUBMITTED',
            txHash: submitted.hash,
            submittedAt: new Date(),
          },
        });
        return submitted.hash;
      });
      const receipt = await this.chainService.waitForTransaction(txHash);
      const contractLog = receipt.logs.find(
        log =>
          log.address.toLowerCase() ===
          this.chainService.getContractAddress().toLowerCase()
      );
      await this.prisma.$transaction(async tx => {
        await this.txLogRepo.createInTransaction(
          {
            uid,
            address,
            type: 'spend',
            eventId: null,
            label: label ?? null,
            amount: amountEnc.toString(),
            txHash: txHash!,
            chainId,
            blockNumber: BigInt(receipt.blockNumber),
            blockHash: receipt.blockHash,
            logIndex: contractLog?.index,
            confirmedAt: new Date(),
            chainOperationId: operation.id,
          },
          tx
        );
        await tx.chainOperation.update({
          where: { id: operation.id },
          data: { status: 'CONFIRMED', confirmedAt: new Date() },
        });
      });
      const newBalanceWei = await this.chainService.balanceOf(address);
      return {
        tx_hash: txHash,
        address,
        new_balance_wei: newBalanceWei.toString(),
      };
    } catch (error) {
      await this.prisma.chainOperation.update({
        where: { id: operation.id },
        data: {
          status: txHash ? 'RECONCILIATION_REQUIRED' : 'FAILED',
          failureReason: error instanceof Error ? error.message : String(error),
        },
      });
      throw error;
    }
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

      const startOfDay = dayjs.utc().startOf('day').toDate();

      const todayLogs = await this.txLogRepo.findTodayByUid(uid, startOfDay);
      const todayCounts = new Map<string, number>();

      for (const log of todayLogs) {
        if (log.eventId) {
          todayCounts.set(log.eventId, (todayCounts.get(log.eventId) ?? 0) + 1);
        }
      }

      return rules.map(rule => {
        const awardedCount = counts.get(rule.id) ?? 0;
        // TxLog.eventId stores the external event identifier, not AwardRule.id.
        const todayCount = todayCounts.get(rule.eventId) ?? 0;

        const maxUser = rule.maxPerUser;
        const maxDay = rule.maxPerDay;

        const userLimitOk =
          rule.enabled !== false && (maxUser === 0 || awardedCount < maxUser);
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
    } catch (err: any) {
      throw new InternalServerErrorException(
        'Failed to get available awards for user',
        err.message
      );
    }
  }

  async recordRejectedAward(input: {
    componentIdentity?: string | null;
    targetUserId: string;
    eventId: string;
    timestamp?: string;
    error: unknown;
  }) {
    try {
      const error = input.error as any;
      await this.prisma.rejectedAwardRequest.create({
        data: {
          componentIdentity: input.componentIdentity ?? null,
          targetUserId: input.targetUserId,
          eventId: input.eventId,
          reasonCategory: error?.constructor?.name ?? 'Error',
          reasonMessage: String(
            error?.message ?? 'Award request rejected'
          ).slice(0, 1000),
          eventTimestamp:
            input.timestamp &&
            !Number.isNaN(new Date(input.timestamp).getTime())
              ? new Date(input.timestamp)
              : null,
        },
      });
    } catch {
      // Rejection telemetry must never mask the original partner-facing error.
    }
  }
}
