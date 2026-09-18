import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { RenewalStatus } from '@b2b-ops/shared';

export class UpdateRenewalCycleDto {
  @IsOptional()
  @IsDateString()
  feedbackCallDate?: string;

  @IsOptional()
  @IsString()
  feedbackSummary?: string;

  @IsOptional()
  @IsEnum(RenewalStatus)
  renewalStatus?: RenewalStatus;

  @IsOptional()
  @IsDateString()
  agreementSignedAt?: string;
}
