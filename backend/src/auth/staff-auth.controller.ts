import { Body, Controller, Get, HttpCode, NotFoundException, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { StaffJwtPayload } from './jwt-payload.interface';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

// 10 attempts/min/IP — well above any real user's typo rate, low enough to
// blunt credential-stuffing/brute-force against this public route.
const AUTH_THROTTLE = { default: { ttl: 60_000, limit: 10 } };

const publicStaff = (staff: { id: string; email: string; name: string; role: string }) => ({
  id: staff.id,
  email: staff.email,
  name: staff.name,
  role: staff.role,
});

@Controller('auth/staff')
export class StaffAuthController {
  constructor(
    private auth: AuthService,
    private prisma: PrismaService,
  ) {}

  // The JWT goes into the httpOnly session cookie only — it is deliberately
  // not in the response body, so page JavaScript never sees it.
  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const staff = await this.auth.validateStaff(dto.email, dto.password);
    const { accessToken, expiresAt } = this.auth.issueStaffTokens(staff);
    setSessionCookie(req, res, accessToken, expiresAt);
    return { staff: publicStaff(staff) };
  }

  // Creates a pending account — no session until a Super Admin approves it.
  @Post('signup')
  @Throttle(AUTH_THROTTLE)
  async signup(@Body() dto: SignupDto) {
    const staff = await this.auth.signup(dto);
    return { pending: true, staff: publicStaff(staff) };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    clearSessionCookie(req, res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  async me(@CurrentStaff() current: StaffJwtPayload) {
    const staff = await this.prisma.staff.findUnique({ where: { id: current.sub } });
    if (!staff) throw new NotFoundException();
    return { staff: publicStaff(staff) };
  }
}
