import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsString, IsOptional } from 'class-validator';

export class EventDto {
  @IsString()
  uid: string;

  @ApiProperty({name:"event_id"})
  @IsString()
  @Expose({ name: 'event_id' })
  eventId: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  source?: string;
}
