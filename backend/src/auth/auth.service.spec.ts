import { ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StaffRole } from '@b2b-ops/shared';
import { AuthService, isAllowedSignupEmail } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

function makeService(existing: unknown = null) {
  const prisma = {
    staff: {
      findUnique: jest.fn().mockResolvedValue(existing),
      create: jest.fn(({ data }) => Promise.resolve({ id: 'new-id', ...data })),
      findMany: jest.fn().mockResolvedValue([{ email: 'admin@codevidhya.com' }]),
    },
  };
  const notifications = { sendTemplateEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    new JwtService({ secret: 'test' }),
    notifications as unknown as NotificationsService,
  );
  return { service, prisma, notifications };
}

const dto = { name: 'Asha', email: 'Asha@CodeVidhya.com', password: 'longenough1', role: StaffRole.SALES };

describe('AuthService.signup', () => {
  const originalDomains = process.env.SIGNUP_ALLOWED_DOMAINS;
  beforeEach(() => {
    delete process.env.SIGNUP_ALLOWED_DOMAINS;
  });
  afterAll(() => {
    process.env.SIGNUP_ALLOWED_DOMAINS = originalDomains;
  });

  it('creates an inactive, unapproved account and notifies Super Admins', async () => {
    const { service, prisma, notifications } = makeService();
    await service.signup(dto);
    expect(prisma.staff.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'asha@codevidhya.com', isActive: false, approvedAt: null }),
    });
    expect(notifications.sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'admin@codevidhya.com' }));
  });

  it('rejects emails outside the allowed domains', async () => {
    const { service, prisma } = makeService();
    await expect(service.signup({ ...dto, email: 'someone@gmail.com' })).rejects.toThrow(ForbiddenException);
    expect(prisma.staff.create).not.toHaveBeenCalled();
  });

  it('rejects an email that is already registered', async () => {
    const { service } = makeService({ id: 'existing' });
    await expect(service.signup(dto)).rejects.toThrow(ConflictException);
  });

  it('honours SIGNUP_ALLOWED_DOMAINS, including "*"', () => {
    process.env.SIGNUP_ALLOWED_DOMAINS = 'codevidhya.com, @partner.org';
    expect(isAllowedSignupEmail('a@partner.org')).toBe(true);
    expect(isAllowedSignupEmail('a@evil.com')).toBe(false);
    process.env.SIGNUP_ALLOWED_DOMAINS = '*';
    expect(isAllowedSignupEmail('a@evil.com')).toBe(true);
  });
});

describe('AuthService.validateStaff', () => {
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await AuthService.hashPassword('longenough1');
  });

  it('tells a pending user (with the right password) that approval is needed', async () => {
    const { service } = makeService({ id: 'p', passwordHash, isActive: false, approvedAt: null });
    await expect(service.validateStaff('p@codevidhya.com', 'longenough1')).rejects.toThrow(/awaiting approval/);
  });

  it('gives the generic error for a wrong password, even on a pending account', async () => {
    const { service } = makeService({ id: 'p', passwordHash, isActive: false, approvedAt: null });
    await expect(service.validateStaff('p@codevidhya.com', 'wrong-pass')).rejects.toThrow('Invalid email or password');
  });

  it('tells a deactivated user their account is deactivated', async () => {
    const { service } = makeService({ id: 'd', passwordHash, isActive: false, approvedAt: new Date() });
    await expect(service.validateStaff('d@codevidhya.com', 'longenough1')).rejects.toThrow(/deactivated/);
  });
});
