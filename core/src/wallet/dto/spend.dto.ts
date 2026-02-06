import { AwardRuleId } from '@prisma/client';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AwardDto {
  @IsString()
  uid: AwardRuleId;

  @IsInt()
  @Min(1, { message: 'Amount must be greater than 0' })
  amount: number;

  @IsOptional()
  @IsString()
  label?: string;
}