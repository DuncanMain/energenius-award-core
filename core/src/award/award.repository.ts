import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class AwardRepository {
  constructor(private prisma: PrismaService) {}

  async findByUidAndEventId(uid: string, awardRuleId: string) {
    return this.prisma.userAward.findUnique({
      where: {
        uid_awardRuleId: { uid, awardRuleId },
      },
    });
  }
  async findAllByUid(uid: string) {
    return this.prisma.userAward.findMany({
      where: { uid },
    });
  }

  async upsert(uid: string, awardRuleId: string) {
    return this.prisma.userAward.upsert({
      where: { uid_awardRuleId: { uid, awardRuleId } },
      update: {},
      create: { uid, awardRuleId, count: 0 },
    });
  }

  async incrementCount(uid: string, awardRuleId: string) {
    return this.prisma.userAward.update({
      where: { uid_awardRuleId: { uid, awardRuleId } },
      data: { count: { increment: 1 } },
    });
  }

  async findByUidAndEventIdWithLock(
    uid: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.findUnique({
      where: { uid_awardRuleId: { uid, awardRuleId } },
    });
  }

  async upsertInTransaction(
    uid: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.upsert({
      where: { uid_awardRuleId: { uid, awardRuleId } },
      update: {},
      create: { uid, awardRuleId, count: 0 },
    });
  }

  async incrementCountInTransaction(
    uid: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.update({
      where: { uid_awardRuleId: { uid, awardRuleId } },
      data: { count: { increment: 1 } },
    });
  }


}
