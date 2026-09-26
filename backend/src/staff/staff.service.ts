import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { UpdateStaffDto } from './dto/update-staff.dto';

const STAFF_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  approvedAt: true,
  createdAt: true,
} as const;

// Super-Admin-only staff management — approving self-signups, changing
// roles, deactivating people who leave. Replaces "edit the database by hand".
@Injectable()
export class StaffService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.staff.findMany({
      select: STAFF_SELECT,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateStaffDto, actor: StaffJwtPayload) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff member not found');

    // A Super Admin locking themselves out (or demoting the last admin)
    // would leave nobody able to manage accounts.
    if (id === actor.sub && (dto.isActive === false || (dto.role && dto.role !== StaffRole.SUPER_ADMIN))) {
      throw new BadRequestException("You can't deactivate or demote your own account");
    }
    const losingAdmin =
      staff.role === StaffRole.SUPER_ADMIN &&
      staff.isActive &&
      (dto.isActive === false || (dto.role !== undefined && dto.role !== StaffRole.SUPER_ADMIN));
    if (losingAdmin) {
      const activeAdmins = await this.prisma.staff.count({ where: { role: StaffRole.SUPER_ADMIN, isActive: true } });
      if (activeAdmins <= 1) throw new BadRequestException('There must always be at least one active Super Admin');
    }

    const approvingNow = dto.isActive === true && !staff.approvedAt;
    const updated = await this.prisma.staff.update({
      where: { id },
      data: { ...dto, ...(approvingNow ? { approvedAt: new Date() } : {}) },
      select: STAFF_SELECT,
    });

    if (approvingNow) {
      await this.notifications.sendTemplateEmail({
        recipient: updated.email,
        templateKey: 'STAFF_ACCOUNT_APPROVED',
        subject: 'Your B2B Ops Platform account is approved',
        body: `Hi ${updated.name},\n\nYour account has been approved with the role ${updated.role}. You can now sign in with the email and password you chose.\n\nTeam CodeVidhya`,
      });
    }
    return updated;
  }

  /** Rejecting a pending sign-up removes it entirely (it never did anything,
   * so there's nothing to keep for audit). Approved accounts are only ever
   * deactivated, never deleted, since they're referenced by history. */
  async rejectPending(id: string) {
    const staff = await this.prisma.staff.findUnique({ where: { id } });
    if (!staff) throw new NotFoundException('Staff member not found');
    if (staff.approvedAt) throw new BadRequestException('Only pending sign-ups can be rejected — deactivate this account instead');
    await this.prisma.staff.delete({ where: { id } });
    return { success: true };
  }
}
