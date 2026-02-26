import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AwardDto } from './dto/spend.dto';
import { AwardCoreError } from '@/utils/errors/award-core.error';
import { WalletService, WalletSnapshot } from './wallet.service';
import { AwardService } from '@/award/award.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService,
    private readonly awardService: AwardService
  ) {}

  @Post('spend')
  @ApiOperation({
    summary: 'Spend (debit) tokens from user wallet',
  })
  @ApiBody({ type: AwardDto })
  @ApiResponse({
    status: 201,
    description: 'Tokens successfully spent',
  })
  @ApiResponse({
    status: 400,
    description: 'AwardCoreError / validation error',
  })
  async spend(
    @Body() body:AwardDto) {
    try {
      return await this.awardService.spend(body.uid, body.amount, body.label);
    } catch (e) {
      if (e instanceof AwardCoreError) {
        return { error: e.code, message: e.message };
      }
      throw e;
    }
  }

  @Get(':uid')
  @ApiOperation({
    summary: 'Get wallet snapshot (address, balance, last 10 transactions)',
  })
  @ApiParam({
    name: 'uid',
    description: 'UID user',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet snapshot'
  })
  async getWallet(@Param('uid') uuid: string): Promise<WalletSnapshot> {
   return await this.walletService.getWalletSnapshot(uuid);
  }
}
