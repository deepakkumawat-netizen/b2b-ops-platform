import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RequestWorkshopChangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** One or two days the school prefers, as YYYY-MM-DD. */
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { each: true, message: 'Each preferred date must be a date like 2026-10-05' })
  preferredDates!: string[];
}
