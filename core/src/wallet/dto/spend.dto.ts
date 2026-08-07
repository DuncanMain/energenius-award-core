import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class AwardDto {
  // JSON carries an integer; class-validator keeps it a `number` (it does NOT coerce to bigint).
  // The controller converts to bigint before AwardService.spend, whose math is bigint-only.
  @IsInt()
  @Min(1, { message: 'Amount must be greater than 0' })
  amount!: number;

  @IsOptional()
  @IsString()
  label?: string;
}
