import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { ChainModule } from '@/chain/chain.module';

@Module({
  imports: [ChainModule],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
