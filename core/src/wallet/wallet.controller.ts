import { Body, Controller, Get, Post } from '@nestjs/common';
import { AwardDto } from './dto/spend.dto';
import { AwardCoreError } from '@/utils/errors/award-core.error';
import { WalletService, WalletSnapshot } from './wallet.service';
import { AwardService } from '@/award/award.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { GetUser } from '@/auth/decorators/get-user.decorator';

@Controller('wallet')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly awardService: AwardService
  ) {}

  @ApiBearerAuth()
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
  async spend(@Body() body: AwardDto) {
    try {
      return await this.awardService.spend(body.uid, body.amount, body.label);
    } catch (e) {
      if (e instanceof AwardCoreError) {
        return { error: e.code, message: e.message };
      }
      throw e;
    }
  }

  @ApiBearerAuth()
  @Get()
  @ApiOperation({
    summary: 'Get wallet snapshot (address, balance, last 10 transactions)',
  })
  @ApiResponse({
    status: 200,
    description: 'Wallet snapshot',
  })
  async getWallet(@GetUser('sub') uid: string): Promise<WalletSnapshot> {
    return await this.walletService.getWalletSnapshot(uid);
  }
}
