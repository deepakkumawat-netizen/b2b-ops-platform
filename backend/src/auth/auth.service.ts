import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { StaffRole } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeEmail } from '../common/normalize-email';
import { StaffJwtPayload } from './jwt-payload.interface';
import { SignupDto } from './dto/signup.dto';

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
    private notifications: NotificationsService,
  ) {}

  // Self-service account creation for anyone on the operations team — the
  // account is usable immediately (role/designation controls what it can
  // access via RolesGuard), but every Super Admin gets an email so unwanted
  // sign-ups are caught rather than gated behind an approval step nobody
  // wants to run day-to-day.
  async signup(dto: SignupDto) {
    const email = normalizeEmail(dto.email);
    const existing = await this.prisma.staff.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await AuthService.hashPassword(dto.password);
    const staff = await this.prisma.staff.create({
      data: { name: dto.name, email, passwordHash, role: dto.role },
    });

    await this.notifications.sendTemplateEmail({
      recipient: staff.email,
      templateKey: 'STAFF_ACCOUNT_CREATED',
      subject: 'Your B2B Ops Platform account is ready',
      body: `Hi ${staff.name},\n\nYour account has been created with the role ${staff.role}. You can now sign in at the B2B Ops Platform with the email and password you just set.\n\nIf you didn't request this account, contact your Super Admin.`,
    });

    const superAdmins = await this.prisma.staff.findMany({
      where: { role: StaffRole.SUPER_ADMIN, isActive: true, id: { not: staff.id } },
    });
    await Promise.all(
      superAdmins.map((admin) =>
        this.notifications.sendTemplateEmail({
          recipient: admin.email,
          templateKey: 'STAFF_SIGNUP_ADMIN_NOTICE',
          subject: `New staff account created: ${staff.name} (${staff.role})`,
          body: `${staff.name} (${staff.email}) just created a staff account on B2B Ops Platform with the role ${staff.role}.\n\nIf this wasn't expected, deactivate the account from the database.`,
        }),
      ),
    );

    return staff;
  }

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
