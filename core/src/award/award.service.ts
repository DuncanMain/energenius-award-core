import {
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
    eventId: AwardRuleId,
    opts?: { timestamp?: string; source?: string }
  ) {
    // 1. VALIDACIJA
    let eventTimestamp: Date | null = null;

    // 2. PROVJERA DA LI NAGRADA POSTOJI
    const rule = await this.awardTableService.getAwardRuleById(eventId);
    if (!rule) {
      throw new NotFoundException(`Unknown eventId: ${eventId}`);
    }

    const address = deriveAddress(uid);
    const amountWei = BigInt(parseUnits(rule.encAmount, 18).toString());
    // const chainId = this.chainService.getChainId();

    // 3. DATABASE TRANSACTION SA BUSINESS LOGIKOM
    return await this.prisma.$transaction(async tx => {
      // Osiguraj da wallet postoji, prvo kreiramo wallet
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
      console.log(currentCount, maxCount);
      const unlimited = maxCount === 0;

      // 4. PROVJERA MAXCOUNT LIMITA
      if (!unlimited && currentCount >= maxCount) {
        throw new ForbiddenException('maxCount reached for this award');
      }

      // 5. BLOCKCHAIN TRANSAKCIJA
      const txHash = await this.chainService.award(address, amountWei);

      const chainId = Number(this.configService.get<string>('CHAIN_ID'));

      // 6. UPDATE BAZE
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

  /**
   * POTROŠI TOKENE
   *
   * Business logika:
   * 1. Validacija input-a
   * 2. Provjera balansa PRIJE blockchain-a
   * 3. Blockchain spend transakcija
   * 4. Update baze podataka
   */
  async spend(uid: AwardRuleId, amountEnc: bigint, label?: string) {
    const address = deriveAddress(uid);
    const chainId = this.chainService.getChainId();

    // Osiguraj da wallet postoji
    await this.userWalletRepo.upsert(uid, address);

    // 2. KRITIČNO: Provjeri balans PRIJE blockchain-a
    const bal = await this.chainService.balanceOf(address);
    if (bal < amountEnc) {
      throw new AwardCoreError('INSUFFICIENT_BALANCE', 'insufficient balance');
    }

    // 3. DATABASE TRANSACTION
    return await this.prisma.$transaction(async tx => {
      // Blockchain spend transakcija
      const amountWei = BigInt(parseUnits(amountEnc.toString(), 18).toString());
      const txHash = await this.chainService.spend(address, amountWei);

      // Snimi tx_log
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
   * DOSTUPNE NAGRADE ZA KORISNIKA
   *
   * Business logika:
   * 1. Izvuci sve user awards iz baze
   * 2. Uporedi sa award-table.json
   * 3. Izračunaj remaining i isAvailable
   */
  async getAvailableAwardsForUser(uid: string) {
    const address = deriveAddress(uid);

    // Osiguraj da wallet postoji
    await this.userWalletRepo.upsert(uid, address);

    // Izvuci count-ove iz baze (Repository sloj)
    const userAwards = await this.userAwardRepo.findAllByUid(uid);

    const counts = new Map<string, number>();
    for (const ua of userAwards) {
      counts.set(ua.eventId, ua.count);
    }

    const rules = await this.awardTableService.listAwardRules();

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
