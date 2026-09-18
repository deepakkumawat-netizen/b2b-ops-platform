import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { CompetitionType } from '@b2b-ops/shared';

export class CreateCompetitionDto {
  @IsString()
  name!: string;

  @IsEnum(CompetitionType)
  type!: CompetitionType;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  studentsParticipated?: number;

  @IsOptional()
  @IsBoolean()
  certificatesIssued?: boolean;

  @IsOptional()
  @IsString()
  prizesAwarded?: string;

  @IsOptional()
  @IsBoolean()
  teacherCertified?: boolean;
}
