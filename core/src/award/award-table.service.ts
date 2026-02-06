import { Injectable, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface AwardRule {
  id: string;
  title: string;
  encAmount: string; // whole tokens as string, e.g. "10"
  maxCount: number; // 0 = unlimited
}

@Injectable()
export class AwardTableService implements OnModuleInit {
  private rules: AwardRule[] = [];

  onModuleInit() {
    this.loadAwardTable();
  }

  /**
   * Učitava award-table.json fajl sa svim mogućim nagradama
   */
  private loadAwardTable(): void {
    const awardTablePath = path.resolve(process.cwd(), 'award-table.json');
    const raw = fs.readFileSync(awardTablePath, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error('award-table.json must be a JSON array');
    }

    // Minimalna validacija
    for (const r of parsed) {
      if (!r || typeof r !== 'object') {
        throw new Error('Invalid rule object');
      }
      if (typeof r.id !== 'string' || r.id.trim() === '') {
        throw new Error('Rule.id required');
      }
      if (typeof r.title !== 'string') {
        throw new Error(`Rule.title missing for ${r.id}`);
      }
      if (typeof r.encAmount !== 'string') {
        throw new Error(`Rule.encAmount missing for ${r.id}`);
      }
      if (typeof r.maxCount !== 'number') {
        throw new Error(`Rule.maxCount missing for ${r.id}`);
      }
    }

    this.rules = parsed as AwardRule[];
  }

  listAwardRules(): AwardRule[] {
    return this.rules;
  }

  /**
   * Nalazi specifičnu nagradu po ID-u
   */
  getAwardRuleById(id: string): AwardRule | undefined {
    return this.rules.find(r => r.id === id);
  }
}
