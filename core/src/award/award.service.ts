import { Injectable } from '@nestjs/common';
import { formatUnits, parseUnits } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { ChainService } from '../chain/chain.service';
import { TxLogRepository } from './repositories/tx-log.repository';
import { UserWalletRepository } from '@/wallet/user-wallet.repository';
import { deriveAddress } from '@/utils/wallet';
import { AwardCoreError } from '@/utils/errors/award-core.error';
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

  /**
   * GIVE AWARD TO USER
   *
   * Business logic:
   * 1. Input validation
   * 2. Check if the award exists
   * 3. Check maxCount limit
   * 4. Blockchain transaction
   * 5. Update database
   */
  async awardEvent(
    uid: string,
    eventId: AwardRuleId,
    opts?: { timestamp?: string; source?: string }
  ) {
    // 1. VALIDATION
    let eventTimestamp: Date | null = null;

    // 2. CHECK IF THE AWARD EXISTS
    const rule = await this.awardTableService.getAwardRuleById(eventId);
    if (!rule) {
      throw new AwardCoreError('UNKNOWN_ACTION', `Unknown eventId: ${eventId}`);
    }

    const address = deriveAddress(uid);
    const amountWei = BigInt(parseUnits(rule.encAmount, 18).toString());
    // 5. BLOCKCHAIN TRANSACTION
    const txHash = await this.chainService.award(address, amountWei);
    // 3. DATABASE TRANSACTION WITH BUSINESS LOGIC
    return await this.prisma.$transaction(async tx => {
      // Ensure the wallet exists, create if necessary
      await tx.userWallet.upsert({
        where: { uid },
        update: {},
        create: { uid, address },
      });

      // Ensure award counter exists
      await this.userAwardRepo.upsertInTransaction(uid, eventId, tx);

      // Check count (Prisma provides implicit lock in transaction)
      const userAward = await this.userAwardRepo.findByUidAndEventIdWithLock(
        uid,
        eventId,
        tx
      );

      const currentCount = userAward?.count ?? 0;
      const maxCount = Number(rule.maxCount);
      const unlimited = maxCount === 0;

      // 4. CHECK MAXCOUNT LIMIT
      if (!unlimited && currentCount >= maxCount) {
        throw new AwardCoreError(
          'MAXCOUNT_EXCEEDED',
          'maxCount reached for this award'
        );
      }
      const chainId = Number(this.configService.get<string>('CHAIN_ID'));

      // 6. UPDATE DATABASE
      await this.userAwardRepo.incrementCountInTransaction(uid, eventId, tx);

      await this.txLogRepo.createInTransaction(
        {
          uid,
          address,
          type: 'award',
          eventId,
          label: rule.title,
          amount: rule.encAmount,
          txHash,
          chainId: chainId,
          eventTimestamp,
          source: opts?.source ?? null,
        },
        tx
      );

      // 7. RETURN RESULT
      const newBalanceWei = await this.chainService.balanceOf(address);

      return {
        txHash,
        awardedAmount: rule.encAmount, // string/number from table
        newBalance: formatUnits(newBalanceWei, 18), // "123.45" instead of wei
      };
    });
  }

  /**
   * SPEND TOKENS
   *
   * Business logic:
   * 1. Input validation
   * 2. Check balance BEFORE blockchain transaction
   * 3. Blockchain spend transaction
   * 4. Update database
   */
  async spend(uid: AwardRuleId, amountEnc: bigint, label?: string) {
    const address = deriveAddress(uid);
    const chainId = this.chainService.getChainId();

    await this.userWalletRepo.upsert(uid, address);

    const bal = await this.chainService.balanceOf(address);
    if (bal < amountEnc) {
      throw new AwardCoreError('INSUFFICIENT_BALANCE', 'insufficient balance');
    }

    return await this.prisma.$transaction(async tx => {
      // Blockchain spend transaction
      const txHash = await this.chainService.spend(address, amountEnc);

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
        txHash,
        address,
        newBalanceWei: newBalanceWei.toString(),
      };
    });
  }

  /**
   * GET AVAILABLE AWARDS FOR USER
   *
   * Business logic:
   * 1. Fetch all user awards from database
   * 2. Compare with award-table.json
   * 3. Calculate remaining and isAvailable
   */
  async getAvailableAwardsForUser(uid: string) {
    const address = deriveAddress(uid);

    // Ensure the wallet exists
    await this.userWalletRepo.upsert(uid, address);

    // Fetch counts from database (Repository layer)
    const userAwards = await this.userAwardRepo.findAllByUid(uid);

    const counts = new Map<string, number>();
    for (const ua of userAwards) {
      counts.set(ua.eventId, ua.count);
    }

    const rules = await this.awardTableService.listAwardRules();

    // Business logic for calculating availability
    return rules.map(rule => {
      const awardedCount = counts.get(rule.id) ?? 0;

      if (rule.maxCount === 0) {
        return {
          id: rule.id,
          title: rule.title,
          encAmount: rule.encAmount,
          maxCount: rule.maxCount,
          awardedCount,
          remaining: null,
          isAvailable: true,
        };
      } 

      const remaining = rule.maxCount - awardedCount;

      return {
        id: rule.id,
        title: rule.title,
        encAmount: rule.encAmount,
        maxCount: rule.maxCount,
        awardedCount,
        remaining,
        isAvailable: remaining > 0,
      };
    });
  }
}