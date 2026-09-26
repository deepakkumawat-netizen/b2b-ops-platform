import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { StaffRole } from '@b2b-ops/shared';

// SUPER_ADMIN can never be self-assigned — a Super Admin grants it from the
// Staff page after approving the account.
export const SELF_SIGNUP_ROLES = [
  StaffRole.SALES,
  StaffRole.ACCOUNT_MANAGER,
  StaffRole.OPERATIONS,
  StaffRole.TRAINING,
] as const;

export class SignupDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsIn(SELF_SIGNUP_ROLES, { message: 'Choose Sales, Account Manager, Operations or Training' })
  role!: StaffRole;
}
