import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AwardRuleId, Prisma } from '@prisma/client';

@Injectable()
export class AwardRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Pronađi award count za korisnika i eventId
   */
  async findByUidAndEventId(uid: string, eventId: AwardRuleId) {
    return this.prisma.userAward.findUnique({
      where: {
        uid_eventId: { uid, eventId },
      },
    });
  }

  /**
   * Pronađi sve awards za korisnika
   */
  async findAllByUid(uid: string) {
    return this.prisma.userAward.findMany({
      where: { uid },
    });
  }

  /**
   * Kreiraj ili ignoriši (upsert sa default count = 0)
   */
  async upsert(uid: string, eventId: AwardRuleId) {
    return this.prisma.userAward.upsert({
      where: { uid_eventId: { uid, eventId } },
      update: {},
      create: { uid, eventId, count: 0 },
    });
  }

  /**
   * Uvećaj count za 1 (increment)
   */
  async incrementCount(uid: string, eventId: AwardRuleId) {
    return this.prisma.userAward.update({
      where: { uid_eventId: { uid, eventId } },
      data: { count: { increment: 1 } },
    });
  }

  /**
   * Pronađi award count SA LOCK-om (za transakcije)
   * Koristi se unutar Prisma.$transaction()
   */
  async findByUidAndEventIdWithLock(
    uid: string,
    eventId: AwardRuleId,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.findUnique({
      where: { uid_eventId: { uid, eventId } },
    });
  }

  /**
   * Upsert unutar transakcije
   */
  async upsertInTransaction(
    uid: string,
    eventId: AwardRuleId,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.upsert({
      where: { uid_eventId: { uid, eventId } },
      update: {},
      create: { uid, eventId, count: 0 },
    });
  }

  /**
   * Increment unutar transakcije
   */
  async incrementCountInTransaction(
    uid: string,
    eventId: AwardRuleId,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.update({
      where: { uid_eventId: { uid, eventId } },
      data: { count: { increment: 1 } },
    });
  }
}
