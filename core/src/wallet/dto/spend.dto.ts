import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AwardDto {
  @IsInt()
  @Min(1, { message: 'Amount must be greater than 0' })
  amount!: bigint;

  @IsOptional()
  @IsString()
  label?: string;
}
