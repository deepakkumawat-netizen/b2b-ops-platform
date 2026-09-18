import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PhaseTaskStatus } from '@b2b-ops/shared';

export class UpdatePhaseTaskDto {
  @IsEnum(PhaseTaskStatus)
  status!: PhaseTaskStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
