import { PrismaService } from '@/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { AwardRule } from '../award-table.service';
import { AwardRuleId } from '@prisma/client';

type AwardRuleInput = {
  id: AwardRuleId;
  title: string;
  encAmount: string;
  maxCount: number;
};

@Injectable()
export class AwardRuleRepository {
  constructor(private prisma: PrismaService) {}

  async findAll(): Promise<AwardRule[]> {
    return this.prisma.awardRule.findMany();
  }

  async findById(id: AwardRuleId): Promise<AwardRule | null> {
    return this.prisma.awardRule.findUnique({
      where: { id },
    });
  }

  async upsert(rule: AwardRuleInput): Promise<AwardRule> {
    return this.prisma.awardRule.upsert({
      where: { id: rule.id },
      update: rule,
      create: rule,
    });
  }
}