import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AwardRule } from '@prisma/client';

type AwardRuleInput = {
  eventId: string;
  source: string;
  relativeValue: number;
  rewardAmount: number;
  maxPerUser: number;
  maxPerDay: number;
};

@Injectable()
export class AwardRuleRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<AwardRule[]> {
    return this.prisma.awardRule.findMany();
  }

  async findById(id: string): Promise<AwardRule | null> {
    return this.prisma.awardRule.findUnique({
      where: { id },
    });
  }

  async findByEventId(eventId: string): Promise<AwardRule | null> {
    return this.prisma.awardRule.findFirst({
      where: { eventId },
    });
  }

  async upsert(rule: AwardRuleInput & { id: string }): Promise<AwardRule> {
    return this.prisma.awardRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule,
    });
  }
}