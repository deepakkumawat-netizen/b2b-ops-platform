import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AddHolidayDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must look like 2026-10-05' })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string;
}
