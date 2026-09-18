import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { EngagementType } from '@b2b-ops/shared';

export class CreateEngagementLogDto {
  @IsEnum(EngagementType)
  type!: EngagementType;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  issuesRaised?: string;
}
