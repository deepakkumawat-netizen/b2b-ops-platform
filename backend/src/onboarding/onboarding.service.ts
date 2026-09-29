import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EmailStatus, PhaseTaskStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { AssetKind, parseImageDataUrl } from './school-assets';

export const WHATSAPP_INVITE_TEMPLATE_KEY = 'whatsapp_group_invite';
export const ONBOARDING_TASK_KEYS = [
  'whatsapp_group_created',
  'whatsapp_stakeholders_added',
  'school_logo_collected',
  'cobranded_logo_designed',
  'welcome_message_shared',
] as const;
const WELCOME_SHARED_TASK_KEY = 'welcome_message_shared';

// SOP Phase 4 (Onboarding Setup). The WhatsApp side happens in WhatsApp
// itself — the app can't create a group or add people — so this does
// everything around it and records proof the checklist agent ticks from:
// the saved group link, the owner's invite email, each teacher's WhatsApp
// invite, the uploaded logo and the generated co-branded logo.
@Injectable()
export class OnboardingService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activity: ActivityService,
  ) {}

  async overview(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        ownerName: true,
        ownerEmail: true,
        ownerPhone: true,
        productProgram: true,
        whatsappGroupLink: true,
        assignedAccountManager: { select: { name: true } },
        teachers: { select: { id: true, name: true, phone: true, designation: true, whatsappInvitedAt: true }, orderBy: { createdAt: 'asc' } },
        assets: { select: { kind: true, updatedAt: true } },
        emailLogs: {
          where: { templateKey: WHATSAPP_INVITE_TEMPLATE_KEY, status: EmailStatus.SENT },
          select: { sentAt: true, recipient: true },
          orderBy: { sentAt: 'desc' },
          take: 1,
        },
        phaseTasks: {
          where: { template: { key: { in: [...ONBOARDING_TASK_KEYS] } } },
          select: { status: true, completedAt: true, template: { select: { key: true } } },
        },
      },
    });
    if (!school) throw new NotFoundException('School not found');
    const asset = (kind: AssetKind) => school.assets.find((a) => a.kind === kind)?.updatedAt ?? null;
    return {
      schoolName: school.name,
      ownerName: school.ownerName,
      ownerEmail: school.ownerEmail,
      ownerPhone: school.ownerPhone,
      accountManagerName: school.assignedAccountManager?.name ?? null,
      whatsappGroupLink: school.whatsappGroupLink,
      ownerInvite: school.emailLogs[0] ?? null,
      teachers: school.teachers,
      logoUpdatedAt: asset('LOGO'),
      cobrandedLogoUpdatedAt: asset('COBRANDED_LOGO'),
      welcomeMessage: this.defaultWelcomeMessage(school),
      tasks: Object.fromEntries(school.phaseTasks.map((t) => [t.template.key, { status: t.status, completedAt: t.completedAt }])),
    };
  }

  /** Saves the group link and, when it's new, emails the owner the invite. */
  async setWhatsappLink(schoolId: string, link: string, actor: StaffJwtPayload) {
    const trimmed = link.trim();
    if (!/^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+\/?$/.test(trimmed)) {
      throw new BadRequestException('Paste the group invite link — it looks like https://chat.whatsapp.com/AbC123…');
    }
    const before = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { whatsappGroupLink: true } });
    await this.prisma.school.update({ where: { id: schoolId }, data: { whatsappGroupLink: trimmed } });
    if (before?.whatsappGroupLink === trimmed) return { saved: true, inviteSent: null };
    await this.activity.record(schoolId, actor, 'Saved the school WhatsApp group link');
    return { saved: true, inviteSent: await this.emailOwnerInvite(schoolId) };
  }

  async emailOwnerInvite(schoolId: string): Promise<boolean> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, ownerName: true, ownerEmail: true, whatsappGroupLink: true },
    });
    if (!school?.whatsappGroupLink) throw new BadRequestException('Save the WhatsApp group link first');
    const link = school.whatsappGroupLink;
    const sent = await this.notifications.sendTemplateEmail({
      schoolId,
      recipient: school.ownerEmail,
      templateKey: WHATSAPP_INVITE_TEMPLATE_KEY,
      button: { label: 'Join the WhatsApp group', url: link },
      subject: `Join the ${school.name} × codevidhya WhatsApp group`,
      body:
        `Dear ${school.ownerName ?? 'Team'},\n\n` +
        `We've created an official WhatsApp group for ${school.name} and codevidhya, for quick updates on ` +
        `training, workshops and competitions. Please join using this link:\n\n` +
        `${link}\n\n` +
        `Please also share it with your computer teacher so they can join.\n\n` +
        `Team codevidhya`,
    });
    if (sent) await this.activity.record(schoolId, null, 'Emailed the WhatsApp group invite', `To ${school.ownerEmail}`);
    return sent;
  }

  async markTeacherInvited(schoolId: string, teacherId: string, actor: StaffJwtPayload) {
    const teacher = await this.prisma.teacher.findFirst({ where: { id: teacherId, schoolId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    await this.prisma.teacher.update({ where: { id: teacherId }, data: { whatsappInvitedAt: new Date() } });
    await this.activity.record(schoolId, actor, 'Sent a WhatsApp group invite', teacher.name);
    return { success: true };
  }

  async saveAsset(schoolId: string, kind: AssetKind, dataUrl: string, actor: StaffJwtPayload | null) {
    const { mimeType, data } = parseImageDataUrl(dataUrl);
    await this.prisma.schoolAsset.upsert({
      where: { schoolId_kind: { schoolId, kind } },
      create: { schoolId, kind, mimeType, data },
      update: { mimeType, data },
    });
    await this.activity.record(
      schoolId,
      actor,
      kind === 'LOGO' ? (actor ? 'Uploaded the school logo' : 'School uploaded its logo via the form') : 'Co-branded partnership logo created',
    );
    return { success: true };
  }

  async getAsset(schoolId: string, kind: AssetKind) {
    const asset = await this.prisma.schoolAsset.findUnique({ where: { schoolId_kind: { schoolId, kind } } });
    if (!asset) throw new NotFoundException('No image yet');
    return asset;
  }

  /** "Share on WhatsApp" was used — a person did it, so it's ticked as theirs. */
  async markWelcomeShared(schoolId: string, actor: StaffJwtPayload) {
    const task = await this.prisma.schoolPhaseTask.findFirst({
      where: { schoolId, template: { key: WELCOME_SHARED_TASK_KEY } },
    });
    if (task && task.status === PhaseTaskStatus.PENDING) {
      await this.prisma.schoolPhaseTask.update({
        where: { id: task.id },
        data: { status: PhaseTaskStatus.DONE, completedAt: new Date(), completedByStaffId: actor.sub, notes: 'Shared with the Share on WhatsApp button' },
      });
    }
    await this.activity.record(schoolId, actor, 'Shared the welcome message + partnership logo on WhatsApp');
    return { success: true };
  }

  private defaultWelcomeMessage(school: { name: string; productProgram: string | null; assignedAccountManager: { name: string } | null }) {
    const manager = school.assignedAccountManager?.name;
    return (
      `Welcome to the official ${school.name} × codevidhya group! 🎉\n\n` +
      `We're delighted to partner with ${school.name}${school.productProgram ? ` for ${school.productProgram}` : ''}. ` +
      `This group is for quick updates on teacher training, student workshops and competitions.\n\n` +
      (manager ? `${manager} is your account manager — reach out here anytime.\n\n` : '') +
      `Looking forward to a great year together!\nTeam codevidhya`
    );
  }
}
