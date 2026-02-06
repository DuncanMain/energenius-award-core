import { Module } from '@nestjs/common';
import { AwardService } from './award.service';
import { AwardController } from './award.controller';
import { ChainModule } from '@/chain/chain.module';
import { AwardTableService } from './award-table.service';
import { AwardRepository } from './award.repository';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule, ChainModule],
  providers: [AwardService, AwardTableService, AwardRepository],
  controllers: [AwardController],
  exports: [AwardService, AwardTableService, AwardRepository],
})
export class AwardModule {}
