import { Module } from '@nestjs/common';
import { ChainModule } from '@/chain/chain.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ChainReconciliationService } from './chain-reconciliation.service';

@Module({
  imports: [ChainModule, PrismaModule],
  providers: [ChainReconciliationService],
  exports: [ChainReconciliationService],
})
export class ReconciliationModule {}
