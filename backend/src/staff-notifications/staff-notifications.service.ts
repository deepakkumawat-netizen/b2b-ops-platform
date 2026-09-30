import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { schoolScopeWhere } from '../common/scope';

export type StaffNotificationKind =
  | 'WORKSHOP_CONFIRMED'
  | 'WORKSHOP_MOVED'
  | 'WORKSHOP_DATES_UNAVAILABLE'
  | 'WORKSHOP_NEEDS_MANAGER'
  | 'SCHOOL_HOLIDAY_ADDED'
  | 'SCHOOL_HOLIDAY_CLASH'
  | 'WORKSHOPS_AUTO_SCHEDULED';

const LIST_LIMIT = 30;

@Injectable()
export class StaffNotificationsService {
  private readonly logger = new Logger(StaffNotificationsService.name);

  constructor(private prisma: PrismaService) {}

  /** Best-effort, like ActivityService.record: a failed notification must never fail what it's about. */
  async notify(schoolId: string, kind: StaffNotificationKind, title: string, detail?: string | null): Promise<void> {
    try {
      await this.prisma.staffNotification.create({ data: { schoolId, kind, title, detail: detail ?? null } });
    } catch (err) {
      this.logger.warn(`Failed to save notification "${title}" for school ${schoolId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  /** Newest first, only for schools this staff member can see, plus how many are unread. */
  async list(staff: StaffJwtPayload) {
    const where = { school: schoolScopeWhere(staff) };
    const me = await this.prisma.staff.findUnique({ where: { id: staff.sub }, select: { notificationsSeenAt: true } });
    const [items, unread] = await Promise.all([
      this.prisma.staffNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: LIST_LIMIT,
        include: { school: { select: { name: true } } },
      }),
      this.prisma.staffNotification.count({
        where: me?.notificationsSeenAt ? { ...where, createdAt: { gt: me.notificationsSeenAt } } : where,
      }),
    ]);
    return {
      unread,
      seenAt: me?.notificationsSeenAt ?? null,
      items: items.map((n) => ({ id: n.id, schoolId: n.schoolId, schoolName: n.school.name, kind: n.kind, title: n.title, detail: n.detail, createdAt: n.createdAt })),
    };
  }

  async markAllSeen(staff: StaffJwtPayload) {
    await this.prisma.staff.update({ where: { id: staff.sub }, data: { notificationsSeenAt: new Date() } });
    return { success: true };
  }
}
