import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
    eventId: AwardRuleId,
    opts?: { timestamp?: string; source?: string }
  ) {
    let eventTimestamp: Date | null = null;

    const rule = await this.awardTableService.getAwardRuleById(eventId);
    if (!rule) {
      throw new NotFoundException(`Unknown eventId: ${eventId}`);
    }

    const address = deriveAddress(uid);
    const amountWei = parseUnits(rule.encAmount.toString(), 18);

    return await this.prisma.$transaction(async tx => {
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
        throw new ForbiddenException('maxCount reached for this award');
      }

      // 5. BLOCKCHAIN TRANSAKCIJA
      const txHash = await this.chainService.award(address, amountWei);

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
        awardedAmount: rule.encAmount, // string/number iz tabele
        newBalance: formatUnits(newBalanceWei, 18), // "123.45" umesto wei
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
        txHash,
        address,
        newBalanceWei: newBalanceWei.toString(),
      };
    });
  }

  async getAvailableAwardsForUser(uid: string) {
    const address = deriveAddress(uid);

    await this.userWalletRepo.upsert(uid, address);

    const userAwards = await this.userAwardRepo.findAllByUid(uid);

    const counts = new Map<string, number>();
    for (const ua of userAwards) {
      counts.set(ua.eventId, ua.count);
    }

    const rules = await this.awardTableService.listAwardRules();

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