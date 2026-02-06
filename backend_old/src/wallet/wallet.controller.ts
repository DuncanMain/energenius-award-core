import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';

@ApiTags('wallets')
@Controller('wallets')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  private validateAuth(authorization: string): void {
    // API key authentication disabled - skip validation
    return;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new wallet' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        uid: { type: 'string', example: 'user_123' },
        address: { type: 'string', example: '0x1234567890abcdef1234567890abcdef12345678' },
      },
      required: ['uid', 'address'],
    },
  })
  @ApiResponse({ status: 201, description: 'Wallet created successfully' })
  async createWallet(
    @Body() body: { uid: string; address: string },
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.createWallet(body.uid, body.address);
  }

  @Get(':uid')
  @ApiOperation({ summary: 'Get wallet by user ID' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user_123' })
  @ApiResponse({ status: 200, description: 'Wallet retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  async getWallet(
    @Param('uid') uid: string,
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.getWallet(uid);
  }

  @Get(':uid/balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user_123' })
  @ApiResponse({ status: 200, description: 'Balance retrieved successfully' })
  async getBalance(
    @Param('uid') uid: string,
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.getBalance(uid);
  }

  @Post(':uid/credit')
  @ApiOperation({ summary: 'Credit funds to wallet' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user_123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 100.50 },
        description: { type: 'string', example: 'Added funds' },
      },
      required: ['amount'],
    },
  })
  @ApiResponse({ status: 200, description: 'Funds credited successfully' })
  async credit(
    @Param('uid') uid: string,
    @Body() body: { amount: number; description?: string },
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.credit(uid, body.amount, body.description);
  }

  @Post(':uid/debit')
  @ApiOperation({ summary: 'Debit funds from wallet' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user_123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 50.25 },
        description: { type: 'string', example: 'Purchase' },
      },
      required: ['amount'],
    },
  })
  @ApiResponse({ status: 200, description: 'Funds debited successfully' })
  async debit(
    @Param('uid') uid: string,
    @Body() body: { amount: number; description?: string },
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.debit(uid, body.amount, body.description);
  }

  @Get(':uid/transactions')
  @ApiOperation({ summary: 'Get wallet transactions' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user_123' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async getTransactions(
    @Param('uid') uid: string,
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.getTransactions(uid);
  }

  @Post(':uid/award')
  @ApiOperation({ summary: 'Award event to wallet' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user_123' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        eventId: { type: 'string', example: 'daily_login' },
      },
      required: ['eventId'],
    },
  })
  @ApiResponse({ status: 200, description: 'Award granted successfully' })
  async awardEvent(
    @Param('uid') uid: string,
    @Body() body: { eventId: string },
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth);
    return this.walletService.awardEvent(uid, body.eventId);
  }

  @Get('awards/rules')
  @ApiOperation({ summary: 'Get all award rules' })
  @ApiResponse({ status: 200, description: 'Award rules retrieved successfully' })
  async getAwardRules(@Headers('authorization') auth: string) {
    this.validateAuth(auth);
    return this.walletService.getAwardRules();
  }
}