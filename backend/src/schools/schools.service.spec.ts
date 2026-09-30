import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { SchoolsService } from './schools.service';
import { PrismaService } from '../prisma/prisma.service';
import { PhaseTasksService } from '../phase-tasks/phase-tasks.service';
import { ActivityService } from '../activity/activity.service';
import { SchoolAutomationService } from '../automation/school-automation.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';

const sales = { sub: 'sales-1', role: StaffRole.SALES };
const am = { sub: 'am-1', role: StaffRole.ACCOUNT_MANAGER };
const school = { id: 's1', name: 'DPS', assignedAccountManagerId: 'am-1', ownerEmail: null };

function makeService(staffRow: Record<string, unknown> | null) {
  const prisma = {
    school: {
      findUnique: jest.fn().mockResolvedValue(school),
      update: jest.fn(({ data }) => Promise.resolve({ ...school, ...data })),
    },
    staff: { findUnique: jest.fn().mockResolvedValue(staffRow) },
  };
  const activity = { record: jest.fn().mockResolvedValue(undefined) };
  const automation = { onOwnerEmailAdded: jest.fn().mockResolvedValue(undefined) };
  const service = new SchoolsService(
    prisma as unknown as PrismaService,
    {} as PhaseTasksService,
    activity as unknown as ActivityService,
    automation as unknown as SchoolAutomationService,
    { syncSchool: jest.fn() } as unknown as GoogleCalendarService,
  );
  return { service, prisma, activity };
}

describe('SchoolsService.update — account manager assignment', () => {
  it('lets Sales reassign to another active account manager', async () => {
    const { service, prisma, activity } = makeService({ id: 'am-2', role: StaffRole.ACCOUNT_MANAGER, isActive: true });
    await service.update('s1', { assignedAccountManagerId: 'am-2' }, sales);
    expect(prisma.school.update).toHaveBeenCalledWith({ where: { id: 's1' }, data: { assignedAccountManagerId: 'am-2' } });
    expect(activity.record).toHaveBeenCalledWith('s1', sales, 'School details updated', 'Changed: account manager');
  });

  it('rejects assigning someone who is not an active account manager', async () => {
    const { service, prisma } = makeService({ id: 'sales-2', role: StaffRole.SALES, isActive: true });
    await expect(service.update('s1', { assignedAccountManagerId: 'sales-2' }, sales)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.school.update).not.toHaveBeenCalled();
  });

  it('allows unassigning with null', async () => {
    const { service, prisma } = makeService(null);
    await service.update('s1', { assignedAccountManagerId: null }, sales);
    expect(prisma.school.update.mock.calls[0][0].data).toEqual({ assignedAccountManagerId: null });
  });

  it('will not let an account manager reassign their own school', async () => {
    const { service, prisma } = makeService({ id: 'am-2', role: StaffRole.ACCOUNT_MANAGER, isActive: true });
    await expect(service.update('s1', { assignedAccountManagerId: 'am-2' }, am)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.school.update).not.toHaveBeenCalled();
  });

  it('still lets an account manager edit other fields, resending their unchanged id', async () => {
    const { service, prisma } = makeService(null);
    await service.update('s1', { ownerEmail: 'owner@school.in', assignedAccountManagerId: 'am-1' }, am);
    expect(prisma.school.update).toHaveBeenCalled();
  });

  it('does not log a change when a blank field is re-saved as null', async () => {
    const { service, activity } = makeService(null);
    await service.update('s1', { ownerEmail: null } as never, sales);
    expect(activity.record).not.toHaveBeenCalled();
  });
});
