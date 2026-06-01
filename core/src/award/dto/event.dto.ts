import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, IsOptional } from 'class-validator';

export class EventDto {
  @ApiProperty({ name: 'event_id' })
  @IsString()
  @Expose({ name: 'event_id' })
  eventId!: string;

  @ApiProperty({ name: 'target_user_id' })
  @IsString()
  @Expose({ name: 'target_user_id' })
  targetUserId!: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
