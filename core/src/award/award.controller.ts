import { Controller, Post, Body, Get, Param, HttpCode } from '@nestjs/common';
import { AwardService } from './award.service';
import { EventDto } from './dto/event.dto';
import { AwardTableService } from './award-table.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { AwardRule } from '@prisma/client';

@Controller('award')
export class AwardController {
  constructor(
    private readonly awardService: AwardService,
    private readonly awardTableService: AwardTableService
  ) {}

  @ApiOperation({ summary: 'Award tokens for a specific event to a user' })
  @ApiBody({ type: EventDto })
  @ApiResponse({ status: 201, description: 'Award granted successfully.' })
  @ApiResponse({
    status: 400,
    description: 'AwardCoreError / Validation error.',
  })
  @ApiBearerAuth()
  @Post('event')
  @ApiResponse({
    status: 400,
    description: 'AwardCoreError / Validation error.',
  })
  @HttpCode(201)
  @ApiResponse({
    status: 201,
    description: 'Award granted successfully.',
    schema: {
      properties: {
        txHash: { type: 'string' },
        awardedAmount: { type: 'string' },
        newBalance: { type: 'string' },
      },
    },
  })
  async awardEvent(
    @Body()
    body: EventDto
  ) {
    return await this.awardService.awardEvent(body.uid, body.eventId, {
      timestamp: body.timestamp,
      source: body.source,
    });
  }

  @ApiBearerAuth()
  @Get('/')
  @ApiOperation({ summary: 'List all award rules' })
  @ApiResponse({ status: 200, description: 'List of all award rules' })
  async awardsAll(): Promise<AwardRule[]> {
    return await this.awardTableService.listAwardRules();
  }

  @ApiBearerAuth()
  @Get('available/:uid')
  @ApiOperation({ summary: 'Get available awards for a specific user' })
  @ApiParam({ name: 'uid', description: 'UID user' })
  @ApiResponse({
    status: 200,
    description: 'List of available awards for the user',
  })
  async getAvailable(@Param('uid') uid: string) {
    return await this.awardService.getAvailableAwardsForUser(uid);
  }
}
