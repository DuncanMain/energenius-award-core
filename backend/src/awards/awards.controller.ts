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
import { AwardsService } from './awards.service';

@ApiTags('awards')
@Controller()
export class AwardsController {
  constructor(private readonly awardsService: AwardsService) {}

  private validateAuth(authorization: string | undefined, required: boolean = false): void {
    if (!required) {
      return; // Optional auth for GET endpoints
    }

    if (!authorization) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const token = authorization.replace('Bearer ', '').trim();
    if (token !== 'demo-1234') {
      throw new UnauthorizedException('Invalid API key');
    }
  }

  @Post('awardevent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Award ENcoins for an event' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        uid: { type: 'string', example: 'user123' },
        eventId: { type: 'string', example: 'first_login' },
        Labels: { type: 'string', example: '[]' },
        sessionId: { type: 'string', example: 'from nexus' },
        timestamp: { type: 'string', example: '2025-11-10T18:47:00+01:00' },
        source: { type: 'string', example: 'ENPlay' },
      },
      required: ['uid', 'eventId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Award granted successfully' })
  @ApiResponse({ status: 404, description: 'Unknown action' })
  @ApiBearerAuth('api-key')
  async awardEvent(
    @Body() body: { uid: string; eventId: string; Labels?: string; sessionId?: string; timestamp?: string; source?: string },
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth, true);
    return this.awardsService.awardEvent(body.uid, body.eventId);
  }

  @Post('spend')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Spend ENcoins (debit)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        uid: { type: 'string', example: 'user123' },
        amount: { type: 'number', example: 10 },
        label: { type: 'string', example: 'marketplace_item' },
      },
      required: ['uid', 'amount'],
    },
  })
  @ApiResponse({ status: 201, description: 'Spend successful' })
  @ApiResponse({ status: 409, description: 'Insufficient balance' })
  @ApiBearerAuth('api-key')
  async spend(
    @Body() body: { uid: string; amount: number; label?: string },
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth, true);
    return this.awardsService.spend(body.uid, body.amount, body.label);
  }

  @Get('awards')
  @ApiOperation({ summary: 'Get rewardable events' })
  @ApiResponse({ status: 200, description: 'Awards retrieved successfully' })
  async getAwards(@Headers('authorization') auth: string) {
    this.validateAuth(auth, false);
    return this.awardsService.getAwards();
  }

  @Get('awards/:uid')
  @ApiOperation({ summary: 'Get awards snapshot' })
  @ApiParam({ name: 'uid', description: 'User ID', example: 'user123' })
  @ApiResponse({ status: 200, description: 'Awards retrieved successfully' })
  @ApiResponse({ status: 409, description: 'UID does not exist' })
  async getUserAwards(
    @Param('uid') uid: string,
    @Headers('authorization') auth: string,
  ) {
    this.validateAuth(auth, false);
    return this.awardsService.getUserAwards(uid);
  }
}

