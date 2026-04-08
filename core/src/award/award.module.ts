import { Module } from '@nestjs/common';
import { AwardService } from './award.service';
import { AwardController } from './award.controller';
import { ChainModule } from '@/chain/chain.module';
import { AwardTableService } from './award-table.service';
import { AwardRepository } from './award.repository';
import { PrismaModule } from '@/prisma/prisma.module';
import { AwardRuleRepository } from './repositories/award-rule.repository';
import { TxLogRepository } from './repositories/tx-log.repository';
import { ConfigModule } from '@nestjs/config';
import { UserWalletRepository } from '@/wallet/user-wallet.repository';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [PrismaModule, ChainModule, ConfigModule, AuthModule],
  providers: [
    AwardService,
    AwardTableService,
    UserWalletRepository,
    AwardRepository,
    TxLogRepository,
    AwardRuleRepository,
  ],
  controllers: [AwardController],
  exports: [
    AwardService,
    AwardTableService,
    UserWalletRepository,
    AwardRepository,
    TxLogRepository,
    AwardRuleRepository,
  ],
})
export class AwardModule {}
