import { IsEmail, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TrainingMode } from '@b2b-ops/shared';

export class CreateSchoolDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  ownerName?: string;

  @IsOptional()
  @IsString()
  ownerDesignation?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  productProgram?: string;

  @IsOptional()
  @IsString()
  gradeFrom?: string;

  @IsOptional()
  @IsString()
  gradeTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  workshopsCommitted?: number;

  @IsOptional()
  @IsEnum(TrainingMode)
  trainingMode?: TrainingMode;

  @IsOptional()
  @IsString()
  specialCommitments?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalStudents?: number;

  @IsOptional()
  @IsString()
  assignedAccountManagerId?: string;

  @IsOptional()
  @IsString()
  assignedSalesRepId?: string;
}
