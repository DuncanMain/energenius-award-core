import { Injectable } from '@nestjs/common';
import { AwardRuleRepository } from './repositories/award-rule.repository';
import { AwardRule } from '@prisma/client';

@Injectable()
export class AwardTableService {
  constructor(private readonly repo: AwardRuleRepository) {}

  async listAwardRules(): Promise<AwardRule[]> {
    return this.repo.findAll();
  }

  async getAwardRuleByEventId(eventId: string): Promise<AwardRule | null> {
    return this.repo.findByEventId(eventId);
  }

  async getAwardRuleById(id: string): Promise<AwardRule | null> {
    return this.repo.findById(id);
  }
}
