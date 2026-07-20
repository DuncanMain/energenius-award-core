import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsEnum,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AdminPermissionEnum } from '@prisma/client';

export class PageQueryDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() eventId?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() sort = 'createdAt';
  @IsOptional() @IsIn(['asc', 'desc']) order: 'asc' | 'desc' = 'desc';
}

export class CreateAwardRuleDto {
  @IsString() @MaxLength(120) eventId!: string;
  @IsString() @MaxLength(200) displayName!: string;
  @IsString() @MaxLength(120) source!: string;
  @IsInt() @Min(1) @Max(3) relativeValue!: number;
  @IsInt() @Min(0) rewardAmount!: number;
  @IsInt() @Min(0) maxPerUser!: number;
  @IsInt() @Min(0) maxPerDay!: number;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(4000) comments?: string;
  @IsOptional() @IsBoolean() globalCapExempt?: boolean;
}

export class UpdateAwardRuleDto {
  @IsOptional() @IsString() @MaxLength(120) eventId?: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsString() @MaxLength(120) source?: string;
  @IsOptional() @IsInt() @Min(1) @Max(3) relativeValue?: number;
  @IsOptional() @IsInt() @Min(0) rewardAmount?: number;
  @IsOptional() @IsInt() @Min(0) maxPerUser?: number;
  @IsOptional() @IsInt() @Min(0) maxPerDay?: number;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsString() @MaxLength(4000) comments?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsBoolean() retired?: boolean;
  @IsOptional() @IsBoolean() globalCapExempt?: boolean;
  @IsString() @MaxLength(1000) reason!: string;
}

export class UpdateTokenPolicyDto {
  @IsBoolean() capEnabled!: boolean;
  @IsInt() @Min(0) dailyCap!: number;
  @IsArray() exemptions!: string[];
  @IsString() @MaxLength(1000) reason!: string;
}

export class CreateAdminDto {
  @IsString() @MaxLength(200) nexusSubject!: string;
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(AdminPermissionEnum, { each: true })
  permissions!: AdminPermissionEnum[];
}

export class UpdateAdminDto {
  @IsOptional() @IsString() @MaxLength(200) displayName?: string;
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermissionEnum, { each: true })
  permissions?: AdminPermissionEnum[];
  @IsString() @MaxLength(1000) reason!: string;
}

export class CreateComponentSourceMappingDto {
  @IsString() @MaxLength(300) componentIdentity!: string;
  @IsString() @MaxLength(120) source!: string;
}

export class UpdateComponentSourceMappingDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MaxLength(1000) reason!: string;
}

export class AdjustmentDto {
  @IsString() uid!: string;
  @IsIn(['CREDIT', 'DEBIT', 'CORRECTION_CREDIT', 'CORRECTION_DEBIT', 'REFUND'])
  type!: string;
  @Type(() => Number) @IsInt() @Min(1) amount!: number;
  @IsString() @MaxLength(1000) reason!: string;
  @IsOptional() @IsString() @MaxLength(300) internalReference?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) originalTxLogId?: number;
  @IsString() @MaxLength(200) idempotencyKey!: string;
  @IsString() confirmation!: string;
}
