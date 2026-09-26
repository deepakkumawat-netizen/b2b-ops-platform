import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { StaffRole } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeEmail } from '../common/normalize-email';
import { StaffJwtPayload } from './jwt-payload.interface';
import { SignupDto } from './dto/signup.dto';

/** Comma-separated SIGNUP_ALLOWED_DOMAINS (default codevidhya.com); "*" allows any domain. */
export function allowedSignupDomains(): string[] {
  return (process.env.SIGNUP_ALLOWED_DOMAINS ?? 'codevidhya.com')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

export function isAllowedSignupEmail(email: string): boolean {
  const domains = allowedSignupDomains();
  if (domains.includes('*')) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && domains.includes(domain);
}

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

  // Self-service account *request* — only for emails on an allowed company
  // domain, never as SUPER_ADMIN (see SignupDto), and the account stays
  // inactive until a Super Admin approves it on the Staff page. Before this,
  // anyone on the internet could sign up as SUPER_ADMIN and get in instantly.
  async signup(dto: SignupDto) {
    const email = normalizeEmail(dto.email);
    if (!isAllowedSignupEmail(email)) {
      throw new ForbiddenException(`Sign-up is limited to ${allowedSignupDomains().map((d) => '@' + d).join(', ')} email addresses`);
    }
    const existing = await this.prisma.staff.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    const passwordHash = await AuthService.hashPassword(dto.password);
    const staff = await this.prisma.staff.create({
      data: { name: dto.name, email, passwordHash, role: dto.role, isActive: false, approvedAt: null },
    });

    await this.notifications.sendTemplateEmail({
      recipient: staff.email,
      templateKey: 'STAFF_ACCOUNT_REQUESTED',
      subject: 'Your B2B Ops Platform account request was received',
      body: `Hi ${staff.name},

We received your request for a B2B Ops Platform account with the role ${staff.role}. A Super Admin will review it — you'll get another email as soon as it's approved.

If you didn't request this account, you can ignore this email.`,
    });

    const superAdmins = await this.prisma.staff.findMany({
      where: { role: StaffRole.SUPER_ADMIN, isActive: true },
    });
    await Promise.all(
      superAdmins.map((admin) =>
        this.notifications.sendTemplateEmail({
          recipient: admin.email,
          templateKey: 'STAFF_SIGNUP_ADMIN_NOTICE',
          subject: `Account awaiting approval: ${staff.name} (${staff.role})`,
          body: `${staff.name} (${staff.email}) requested a B2B Ops Platform account with the role ${staff.role}.

Approve or reject it from the Staff page. The account can't sign in until you do.`,
        }),
      ),
    );

    return staff;
  }

  async validateStaff(email: string, password: string) {
    const staff = await this.prisma.staff.findUnique({ where: { email: normalizeEmail(email) } });
    const passwordOk = await verifyPasswordTimingSafe(staff?.passwordHash, password);
    if (!staff || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    // Only reached with the correct password, so these specific messages
    // don't let a stranger probe which emails are registered.
    if (!staff.isActive) {
      throw new UnauthorizedException(
        staff.approvedAt ? 'This account has been deactivated. Contact your Super Admin.' : 'Your account is awaiting approval from a Super Admin.',
      );
    }
    return staff;
  }

  issueStaffTokens(staff: { id: string; role: string }) {
    const payload: StaffJwtPayload = { sub: staff.id, role: staff.role as StaffJwtPayload['role'] };
    const accessToken = this.jwt.sign(payload);
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    return { accessToken, expiresAt: decoded?.exp };
  }

  static async hashPassword(plain: string): Promise<string> {
    return argon2.hash(plain);
  }
}
