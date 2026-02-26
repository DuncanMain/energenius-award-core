import { Injectable } from '@nestjs/common';
import { AwardRuleRepository } from './repositories/award-rule.repository';

export interface AwardRule {
  id: string;
  title: string;
  encAmount: string;
  maxCount: number;
}

@Injectable()
export class AwardTableService {
  constructor(private readonly repo: AwardRuleRepository) {}

  async listAwardRules(): Promise<AwardRule[]> {
    return this.repo.findAll();
  }

  getAwardRuleById(id: string): Promise<AwardRule | null> {
    return this.repo.findById(id as any);
  }
}
