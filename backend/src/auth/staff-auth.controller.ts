import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';

// 10 attempts/min/IP — well above any real user's typo rate, low enough to
// blunt credential-stuffing/brute-force against this public route.
const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

@Controller('auth/staff')
export class StaffAuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  @Throttle(AUTH_THROTTLE)
  async login(@Body() dto: LoginDto) {
    const staff = await this.auth.validateStaff(dto.email, dto.password);
    const tokens = this.auth.issueStaffTokens(staff);
    return {
      ...tokens,
      staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    };
  }

  @Post('signup')
  @Throttle(AUTH_THROTTLE)
  async signup(@Body() dto: SignupDto) {
    const staff = await this.auth.signup(dto);
    const tokens = this.auth.issueStaffTokens(staff);
    return {
      ...tokens,
      staff: { id: staff.id, email: staff.email, name: staff.name, role: staff.role },
    };
  }
}
