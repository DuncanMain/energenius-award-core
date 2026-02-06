import { Injectable } from '@nestjs/common';
import { parseUnits } from 'ethers';
import { PrismaService } from '../prisma/prisma.service';
import { ChainService } from '../chain/chain.service';
import { TxLogRepository } from './repositories/tx-log.repository';
import { UserWalletRepository } from '@/wallet/user-wallet.repository';
import { deriveAddress } from '@/utils/wallet';
import { AwardCoreError } from '@/utils/errors/award-core.error';
import { AwardRepository } from './award.repository';
import { AwardTableService } from './award-table.service';

@Injectable()
export class AwardService {
  constructor(
    private prisma: PrismaService,
    private chainService: ChainService,
    private awardTableService: AwardTableService,
    private userWalletRepo: UserWalletRepository,
    private userAwardRepo: AwardRepository,
    private txLogRepo: TxLogRepository
  ) {}

  /**
   * DAJE NAGRADU KORISNIKU
   *
   * Business logika:
   * 1. Validacija input-a
   * 2. Provjera da li nagrada postoji
   * 3. Provjera maxCount limita
   * 4. Blockchain transakcija
   * 5. Update baze podataka
   */
  async awardEvent(
    uid: string,
    eventId: string,
    opts?: { timestamp?: string; source?: string }
  ) {
    // 1. VALIDACIJA
    let eventTimestamp: Date | null = null;

    if (opts?.timestamp) {
      const d = new Date(opts.timestamp);
      if (isNaN(d.getTime())) {
        throw new AwardCoreError('VALIDATION_ERROR', 'Invalid timestamp');
      }
      eventTimestamp = d;
    }

    if (!uid || uid.trim() === '') {
      throw new AwardCoreError('VALIDATION_ERROR', 'uid is required');
    }
    if (!eventId || eventId.trim() === '') {
      throw new AwardCoreError('VALIDATION_ERROR', 'eventId is required');
    }

    // 2. PROVJERA DA LI NAGRADA POSTOJI
    const rule = this.awardTableService.getAwardRuleById(eventId);
    if (!rule) {
      throw new AwardCoreError('UNKNOWN_ACTION', `Unknown eventId: ${eventId}`);
    }

    const address = deriveAddress(uid);
    const amountWei = BigInt(parseUnits(rule.encAmount, 18).toString());
    const chainId = this.chainService.getChainId();

    // 3. DATABASE TRANSACTION SA BUSINESS LOGIKOM
    return await this.prisma.$transaction(async tx => {
      // Osiguraj da wallet postoji
      await tx.userWallet.upsert({
        where: { uid },
        update: {},
        create: { uid, address },
      });

      // Osiguraj da award counter postoji
      await this.userAwardRepo.upsertInTransaction(uid, eventId, tx);

      // Provjeri count (Prisma ima implicit lock u transakciji)
      const userAward = await this.userAwardRepo.findByUidAndEventIdWithLock(
        uid,
        eventId,
        tx
      );

      const currentCount = userAward?.count ?? 0;
      const maxCount = Number(rule.maxCount);
      const unlimited = maxCount === 0;

      // 4. PROVJERA MAXCOUNT LIMITA
      if (!unlimited && currentCount >= maxCount) {
        throw new AwardCoreError(
          'MAXCOUNT_EXCEEDED',
          'maxCount reached for this award'
        );
      }

      // 5. BLOCKCHAIN TRANSAKCIJA
      const txHash = await this.chainService.award(address, amountWei);

      // 6. UPDATE BAZE
      await this.userAwardRepo.incrementCountInTransaction(uid, eventId, tx);

      await this.txLogRepo.createInTransaction(
        {
          uid,
          address,
          type: 'award',
          eventId,
          label: rule.title,
          amount: amountWei.toString(),
          txHash,
          chainId: 80002,
          eventTimestamp,
          source: opts?.source ?? null,
        },
        tx
      );

      // 7. RETURN RESULT
      const newBalanceWei = await this.chainService.balanceOf(address);

      return {
        txHash,
        address,
        newBalanceWei: newBalanceWei.toString(),
      };
    });
  }

  /**
   * POTROŠI TOKENE
   *
   * Business logika:
   * 1. Validacija input-a
   * 2. Provjera balansa PRIJE blockchain-a
   * 3. Blockchain spend transakcija
   * 4. Update baze podataka
   */
  async spend(uid: string, amountEnc: string, label?: string) {
    // 1. VALIDACIJA
    if (!uid || uid.trim() === '') {
      throw new AwardCoreError('VALIDATION_ERROR', 'uid is required');
    }
    if (!amountEnc || amountEnc.trim() === '') {
      throw new AwardCoreError('VALIDATION_ERROR', 'amount is required');
    }

    const amountWei = BigInt(parseUnits(amountEnc, 18).toString());
    if (amountWei <= 0n) {
      throw new AwardCoreError('VALIDATION_ERROR', 'amount must be > 0');
    }

    const address = deriveAddress(uid);
    const chainId = this.chainService.getChainId();

    // Osiguraj da wallet postoji
    await this.userWalletRepo.upsert(uid, address);

    // 2. KRITIČNO: Provjeri balans PRIJE blockchain-a
    const bal = await this.chainService.balanceOf(address);
    if (bal < amountWei) {
      throw new AwardCoreError('INSUFFICIENT_BALANCE', 'insufficient balance');
    }

    // 3. DATABASE TRANSACTION
    return await this.prisma.$transaction(async tx => {
      // Blockchain spend transakcija
      const txHash = await this.chainService.spend(address, amountWei);

      // Snimi tx_log
      await this.txLogRepo.createInTransaction(
        {
          uid,
          address,
          type: 'spend',
          eventId: null,
          label: label ?? null,
          amount: amountWei.toString(),
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
   * DOSTUPNE NAGRADE ZA KORISNIKA
   *
   * Business logika:
   * 1. Izvuci sve user awards iz baze
   * 2. Uporedi sa award-table.json
   * 3. Izračunaj remaining i isAvailable
   */
  async getAvailableAwardsForUser(uid: string) {
    if (!uid || uid.trim() === '') {
      throw new Error('uid is required');
    }

    const address = deriveAddress(uid);

    // Osiguraj da wallet postoji
    await this.userWalletRepo.upsert(uid, address);

    // Izvuci count-ove iz baze (Repository sloj)
    const userAwards = await this.userAwardRepo.findAllByUid(uid);

    const counts = new Map<string, number>();
    for (const ua of userAwards) {
      counts.set(ua.eventId, ua.count);
    }

    const rules = this.awardTableService.listAwardRules();

    // Business logika za izračunavanje dostupnosti
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
