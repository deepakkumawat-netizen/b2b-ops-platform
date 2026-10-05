import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RequestWorkshopDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  topic!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  targetGrades?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must look like 2026-10-05' })
  date!: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'time must look like 11:00' })
  time!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
