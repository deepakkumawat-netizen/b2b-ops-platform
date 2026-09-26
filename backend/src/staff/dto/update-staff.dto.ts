import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { StaffRole } from '@b2b-ops/shared';

export class UpdateStaffDto {
  @IsOptional()
  @IsEnum(StaffRole)
  role?: StaffRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
