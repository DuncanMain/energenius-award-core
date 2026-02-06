import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { AwardService, AwardCoreError } from './award.service';

@Controller('awards')
export class AwardController {
  constructor(private readonly awardService: AwardService) {}

  @Post('event')
  async awardEvent(
    @Body()
    body: {
      uid: string;
      eventId: string;
      timestamp?: string;
      source?: string;
    }
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

  @Post('spend')
  async spend(@Body() body: { uid: string; amount: string; label?: string }) {
    try {
      return await this.awardService.spend(body.uid, body.amount, body.label);
    } catch (e) {
      if (e instanceof AwardCoreError) {
        return { error: e.code, message: e.message };
      }
      throw e;
    }
  }

  @Get('available/:uid')
  async getAvailable(@Param('uid') uid: string) {
    return await this.awardService.getAvailableAwardsForUser(uid);
  }
}
