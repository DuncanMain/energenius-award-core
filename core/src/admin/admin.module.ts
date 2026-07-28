import { Module } from '@nestjs/common';
import { ChainModule } from '@/chain/chain.module';
import { PrismaModule } from '@/prisma/prisma.module';
import { ReconciliationModule } from '@/reconciliation/reconciliation.module';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@Module({
  imports: [ChainModule, PrismaModule, ReconciliationModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminBootstrapService, AdminService],
})
export class AdminModule {}
