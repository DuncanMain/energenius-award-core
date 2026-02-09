import { Injectable } from '@nestjs/common';
import { AwardRuleRepository } from './repositories/award-rule.repository';

export interface AwardRule {
  id: string;
  title: string;
  encAmount: string;
  maxCount: number;
}

@Injectable()
export class AwardTableService{

  constructor(private readonly repo: AwardRuleRepository) {}
  /**
   * Učitava iz baze podatke sa svim mogućim nagradama
   */
  async listAwardRules(): Promise<AwardRule[]> {
    return this.repo.findAll();
  }
  /**
   * Nalazi specifičnu nagradu po ID-u
   */
  getAwardRuleById(id: string): Promise<AwardRule | null> {
    return this.repo.findById(id as any);
  }
}
