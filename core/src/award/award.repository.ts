import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Injectable()
export class AwardRepository {
  constructor(private prisma: PrismaService) {}

  async findByUidAndEventId(uidNew: string, awardRuleId: string) {
    return this.prisma.userAward.findUnique({
      where: {
        uidNew_awardRuleId: { 
          uidNew: uidNew, 
          awardRuleId: awardRuleId 
        },
      },
    });
  }
  async findAllByUid(uidNew: string) {
    return this.prisma.userAward.findMany({
      where: { uidNew },
    });
  }

  async upsert(uidNew: string, awardRuleId: string) {
    return this.prisma.userAward.upsert({
      where: { uidNew_awardRuleId: { uidNew, awardRuleId } },
      update: {},
      create: { uidNew, awardRuleId, count: 0 },
    });
  }

  async incrementCount(uidNew: string, awardRuleId: string) {
    return this.prisma.userAward.update({
      where: { uidNew_awardRuleId: { uidNew, awardRuleId } },
      data: { count: { increment: 1 } },
    });
  }

  async findByUidAndEventIdWithLock(
    uidNew: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.findUnique({
      where: { 
        uidNew_awardRuleId: { 
          uidNew: uidNew, 
          awardRuleId 
        } 
      },
    });
  }

  async upsertInTransaction(
    uidNew: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.upsert({
      where: { uidNew_awardRuleId: { uidNew, awardRuleId } },
      update: {},
      create: { uidNew, awardRuleId, count: 0 },
    });
  }

  async incrementCountInTransaction(
    uidNew: string,
    awardRuleId: string,
    tx: Prisma.TransactionClient
  ) {
    return tx.userAward.update({
      where: { 
        uidNew_awardRuleId: { 
          uidNew: uidNew,
          awardRuleId: awardRuleId 
        } 
      },
      data: { count: { increment: 1 } },
    });
  }
}
