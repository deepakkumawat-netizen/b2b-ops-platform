import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { StaffRole } from '@b2b-ops/shared';

export class SignupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(StaffRole)
  role!: StaffRole;
}
