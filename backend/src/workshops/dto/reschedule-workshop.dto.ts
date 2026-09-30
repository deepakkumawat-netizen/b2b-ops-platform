import { IsDateString, IsOptional, IsString } from 'class-validator';

export class RescheduleWorkshopDto {
  @IsDateString()
  scheduledAt!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
