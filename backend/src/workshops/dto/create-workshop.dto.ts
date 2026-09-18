import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateWorkshopDto {
  @IsString()
  topic!: string;

  @IsOptional()
  @IsString()
  targetGrades?: string;

  @IsDateString()
  scheduledAt!: string;
}
