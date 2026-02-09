import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AwardService} from './award.service';
import { EventDto } from './dto/event.dto';
import { AwardCoreError } from '@/utils/errors/award-core.error';
import { AwardRule, AwardTableService } from './award-table.service';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('award')
export class AwardController {
  constructor(private readonly awardService: AwardService,
    private readonly  awardTableService:AwardTableService
  ) {}


  @ApiOperation({ summary: 'Award tokens for a specific event to a user' })
  @ApiBody({ type: EventDto })
  @ApiResponse({ status: 201, description: 'Award granted successfully.' })
  @ApiResponse({ status: 400, description: 'AwardCoreError / Validation error.' })
  @Post('event')
  async awardEvent(
    @Body()
    body: EventDto
  ) {
    try {
      return await this.awardService.awardEvent(body.uid, body.eventId, {
        timestamp: body.timestamp,
        source: body.source,
      });
    } catch (e) {
      if (e instanceof AwardCoreError) {
        return { error: e.code, message: e.message };
      }
      throw e;
    }
  }

  
  @Get('/')
  @ApiOperation({ summary: 'List all award rules' })
  @ApiResponse({ status: 200, description: 'List of all award rules' })
  async awardsAll(): Promise<AwardRule[]> {
    return await this.awardTableService.listAwardRules();
  }

  @Get('available/:uid')
  @ApiOperation({ summary: 'Get available awards for a specific user' })
  @ApiParam({ name: 'uid', description: 'UID korisnika' })
  @ApiResponse({ status: 200, description: 'List of available awards for the user' })
  async getAvailable(@Param('uid') uid: string) {
    return await this.awardService.getAvailableAwardsForUser(uid);
  }
}
