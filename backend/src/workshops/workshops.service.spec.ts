import { ConfigService } from '@nestjs/config';
import { WorkshopStatus } from '@b2b-ops/shared';
import { WorkshopsService } from './workshops.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

const workshop = {
  id: 'w1',
  schoolId: 's1',
  topic: 'AI',
  targetGrades: null,
  scheduledAt: new Date('2026-10-05T04:30:00Z'),
  status: WorkshopStatus.SCHEDULED,
  confirmationSentAt: null,
  reminderSentAt: null,
};

function makeService(emailSent: boolean) {
  let row: Record<string, unknown> = { ...workshop };
  const prisma = {
    workshop: {
      findFirst: jest.fn().mockResolvedValue(workshop),
      update: jest.fn(({ data }) => {
        row = { ...row, ...data };
        return Promise.resolve(row);
      }),
    },
    school: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 's1', name: 'DPS', ownerName: null, ownerEmail: 'o@dps.in' }) },
  };
  const notifications = { sendTemplateEmail: jest.fn().mockResolvedValue(emailSent) };
  const config = { get: () => 'https://ops.example', getOrThrow: () => 'secret' };
  const service = new WorkshopsService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    config as unknown as ConfigService,
  );
  return { service, prisma, notifications };
}

describe('WorkshopsService — "sent" timestamps only when the email went out', () => {
  it('confirm stamps confirmationSentAt when the email was sent', async () => {
    const { service } = makeService(true);
    const result = await service.confirm('s1', 'w1');
    expect(result.status).toBe(WorkshopStatus.CONFIRMED);
    expect(result.confirmationSentAt).toBeInstanceOf(Date);
  });

  it('confirm still moves to CONFIRMED but leaves confirmationSentAt null when the email failed', async () => {
    const { service } = makeService(false);
    const result = await service.confirm('s1', 'w1');
    expect(result.status).toBe(WorkshopStatus.CONFIRMED);
    expect(result.confirmationSentAt).toBeNull();
  });

  it('remind leaves reminderSentAt null (so the agent retries) when the email failed', async () => {
    const { service, prisma } = makeService(false);
    const result = await service.remind('s1', 'w1');
    expect(result.reminderSentAt).toBeNull();
    expect(prisma.workshop.update).not.toHaveBeenCalled();
  });

  it('reschedule moves the date, emails the new date and clears the old reminder', async () => {
    const { service, notifications } = makeService(true);
    const result = await service.reschedule('s1', 'w1', { scheduledAt: '2026-10-12T04:30:00Z', reason: 'Exams' });
    expect(result.status).toBe(WorkshopStatus.RESCHEDULED);
    expect(result.scheduledAt).toEqual(new Date('2026-10-12T04:30:00Z'));
    expect(result.reminderSentAt).toBeNull();
    expect(result.confirmationSentAt).toBeInstanceOf(Date);
    const email = notifications.sendTemplateEmail.mock.calls[0][0];
    expect(email.templateKey).toBe('workshop_rescheduled');
    expect(email.body).toContain('Reason: Exams');
    expect(email.body).toMatch(/mark your holidays: https:\/\/ops\.example\/calendar\/s1\/[\w-]{32}$/);
    expect(email.button.url).toMatch(/^https:\/\/ops\.example\/workshop\/w1\/[\w-]{32}$/);
  });

  it('reschedule leaves confirmationSentAt null when the email failed', async () => {
    const { service } = makeService(false);
    const result = await service.reschedule('s1', 'w1', { scheduledAt: '2026-10-12T04:30:00Z' });
    expect(result.status).toBe(WorkshopStatus.RESCHEDULED);
    expect(result.confirmationSentAt).toBeNull();
  });
});
