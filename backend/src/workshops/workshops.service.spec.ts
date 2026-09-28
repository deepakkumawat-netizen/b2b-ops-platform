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
  const service = new WorkshopsService(prisma as unknown as PrismaService, notifications as unknown as NotificationsService);
  return { service, prisma };
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
});
