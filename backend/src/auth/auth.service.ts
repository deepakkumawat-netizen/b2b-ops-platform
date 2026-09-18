import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeEmail } from '../common/normalize-email';
import { StaffJwtPayload } from './jwt-payload.interface';

// Runs argon2 for roughly the same cost whether or not a real password hash
// exists to check against, so response timing alone can't reveal whether an
// email is registered.
async function verifyPasswordTimingSafe(passwordHash: string | null | undefined, password: string): Promise<boolean> {
  if (!passwordHash) {
    await argon2.hash(password);
    return false;
  }
  return argon2.verify(passwordHash, password);
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateStaff(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({ where: { email: normalizeEmail(email) } });
    const passwordOk = await verifyPasswordTimingSafe(staff?.passwordHash, password);
    if (!staff || !staff.isActive || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return staff;
  }

  issueStaffTokens(staff: { id: string; role: string }) {
    const payload: StaffJwtPayload = { sub: staff.id, role: staff.role as StaffJwtPayload['role'] };
    const accessToken = this.jwt.sign(payload);
    return { accessToken };
  }

  static async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain);
  }
}
