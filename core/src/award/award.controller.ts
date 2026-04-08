import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  UseGuards,
  UnauthorizedException,
  Headers,
} from '@nestjs/common';
import { AwardService } from './award.service';
import { EventDto } from './dto/event.dto';
import { AwardTableService } from './award-table.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AwardRule } from '@prisma/client';
import { IsComponentGuard } from '@/auth/guards/isComponent.guard';
import { IntrospectionGuard } from '@/auth/guards/introspectToken.guard';
import { GetUser } from '@/auth/decorators/get-user.decorator';

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
  @UseGuards(IntrospectionGuard, IsComponentGuard)
  async awardEvent(
    @Body()
    body: EventDto,
    @Headers('authorization') authorization: string
  ) {
    const componentToken = (authorization ?? '').replace('Bearer ', '');
    return await this.awardService.awardEvent(body.uid, body.eventId, {
      timestamp: body.timestamp,
      source: body.source,
      componentToken,
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
  @Get('available')
  @ApiOperation({ summary: 'Get available awards for a specific user' })
  @ApiResponse({
    status: 200,
    description: 'List of available awards for the user',
  })
  async getAvailable(@GetUser('sub') uid: string) {
    return await this.awardService.getAvailableAwardsForUser(uid);
  }
}
