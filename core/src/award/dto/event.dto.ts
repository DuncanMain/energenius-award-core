import { AwardRuleId } from '@prisma/client';
import { IsString, IsOptional } from 'class-validator';

export class EventDto {
  @IsString()
  uid: string;

  @IsString()
  eventId: AwardRuleId;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  source?: string;
}