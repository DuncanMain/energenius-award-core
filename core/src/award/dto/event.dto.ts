import { IsString, IsOptional } from 'class-validator';

export class EventDto {
  @IsString()
  uid: string;

  @IsString()
  eventId: string;

  @IsOptional()
  @IsString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  source?: string;
}