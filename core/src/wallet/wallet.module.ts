import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ChainModule } from '@/chain/chain.module';
import { WalletController } from './wallet.controller';
import { UserWalletRepository } from './user-wallet.repository';
import { AwardModule } from '@/award/award.module';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [ChainModule,AwardModule,PrismaModule],
  providers: [WalletService,UserWalletRepository],
  exports: [WalletService,UserWalletRepository],
  controllers: [WalletController],
})
export class WalletModule {}
