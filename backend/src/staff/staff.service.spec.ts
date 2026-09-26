import { BadRequestException } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const admin = { sub: 'admin-1', role: StaffRole.SUPER_ADMIN };

function makeService(target: Record<string, unknown>, activeAdmins = 2) {
  const prisma = {
    staff: {
      findUnique: jest.fn().mockResolvedValue(target),
      count: jest.fn().mockResolvedValue(activeAdmins),
      update: jest.fn(({ data }) => Promise.resolve({ ...target, ...data })),
      delete: jest.fn().mockResolvedValue(target),
    },
  };
  const notifications = { sendTemplateEmail: jest.fn().mockResolvedValue(undefined) };
  const service = new StaffService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
  return { service, prisma, notifications };
}

describe('StaffService.update', () => {
  it('approving a pending account stamps approvedAt and emails them', async () => {
    const { service, prisma, notifications } = makeService({
      id: 'p',
      email: 'p@codevidhya.com',
      role: StaffRole.SALES,
      isActive: false,
      approvedAt: null,
    });
    await service.update('p', { isActive: true }, admin);
    expect(prisma.staff.update.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ isActive: true, approvedAt: expect.any(Date) }),
    );
    expect(notifications.sendTemplateEmail).toHaveBeenCalledWith(expect.objectContaining({ templateKey: 'STAFF_ACCOUNT_APPROVED' }));
  });

  it('re-activating a previously approved account does not re-send the approval email', async () => {
    const { service, notifications } = makeService({ id: 'd', role: StaffRole.SALES, isActive: false, approvedAt: new Date() });
    await service.update('d', { isActive: true }, admin);
    expect(notifications.sendTemplateEmail).not.toHaveBeenCalled();
  });

  it('will not let an admin deactivate or demote themselves', async () => {
    const { service } = makeService({ id: 'admin-1', role: StaffRole.SUPER_ADMIN, isActive: true, approvedAt: new Date() });
    await expect(service.update('admin-1', { isActive: false }, admin)).rejects.toThrow(BadRequestException);
    await expect(service.update('admin-1', { role: StaffRole.SALES }, admin)).rejects.toThrow(BadRequestException);
  });

  it('keeps at least one active Super Admin', async () => {
    const { service } = makeService({ id: 'admin-2', role: StaffRole.SUPER_ADMIN, isActive: true, approvedAt: new Date() }, 1);
    await expect(service.update('admin-2', { isActive: false }, admin)).rejects.toThrow(/at least one active Super Admin/);
  });
});

describe('StaffService.rejectPending', () => {
  it('refuses to delete an approved account', async () => {
    const { service, prisma } = makeService({ id: 'a', approvedAt: new Date() });
    await expect(service.rejectPending('a')).rejects.toThrow(BadRequestException);
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });
});
