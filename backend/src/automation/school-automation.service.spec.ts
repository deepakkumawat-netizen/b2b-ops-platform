import { PhaseTaskStatus, SchoolLifecyclePhase, StaffRole } from '@b2b-ops/shared';
import { SchoolAutomationService } from './school-automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ActivityService } from '../activity/activity.service';
import { ConfigService } from '@nestjs/config';

const creator = { sub: 'sales-1', role: StaffRole.SALES };

type Task = { id: string; status: PhaseTaskStatus; notes?: string | null; template: { key: string; phase: SchoolLifecyclePhase; label: string } };

function task(key: string, phase: SchoolLifecyclePhase, status = PhaseTaskStatus.PENDING): Task {
  return { id: key, status, template: { key, phase, label: key } };
}

// A fully filled-in handover form — proves all four Sales-handover tasks.
const handover = {
  ownerName: 'Ms Rao',
  ownerDesignation: 'Principal',
  ownerEmail: 'principal@dps.in',
  ownerPhone: '+919999999999',
  productProgram: 'Coding Lab',
  gradeFrom: '3',
  gradeTo: '8',
  city: 'Jaipur',
  state: 'Rajasthan',
  workshopsCommitted: 2,
  trainingMode: 'OFFLINE',
};

function makeService(schoolOverrides: Record<string, unknown>, tasks: Task[], emailSent = true, env: Record<string, string> = {}) {
  const school: Record<string, unknown> = {
    id: 's1',
    name: 'DPS',
    currentPhase: SchoolLifecyclePhase.SALES_HANDOVER,
    teachers: [],
    infraDiagnostic: null,
    workshops: [],
    competitions: [],
    renewalCycles: [],
    assignedAccountManager: null,
    ...schoolOverrides,
  };
  const prisma = {
    school: {
      findUnique: jest.fn(async () => ({ ...school, phaseTasks: tasks.map((t) => ({ ...t })) })),
      findMany: jest.fn(async () => [{ id: 's1' }]),
      update: jest.fn(async ({ data }) => Object.assign(school, data)),
    },
    schoolPhaseTask: {
      findFirst: jest.fn(async ({ where }) => {
        const t = tasks.find((x) => x.template.key === where.template.key);
        return t && { ...t, school };
      }),
      update: jest.fn(async ({ where, data }) => Object.assign(tasks.find((t) => t.id === where.id)!, data)),
    },
    staff: {
      findMany: jest.fn(async () => [{ email: 'admin1@codevidhya.com' }, { email: 'admin2@codevidhya.com' }]),
      findUnique: jest.fn(async () => ({ name: 'Sam Sales' })),
    },
  };
  const notifications = { sendTemplateEmail: jest.fn().mockResolvedValue(emailSent) };
  const activity = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new SchoolAutomationService(
    prisma as unknown as PrismaService,
    notifications as unknown as NotificationsService,
    activity as unknown as ActivityService,
    {
      get: (key: string) => env[key],
      getOrThrow: (key: string) => env[key] ?? (key === 'JWT_ACCESS_SECRET' ? 'test-secret' : undefined),
    } as unknown as ConfigService,
  );
  return { service, prisma, notifications, school, tasks };
}

const HANDOVER_TASKS = () => [
  task('handover_owner_details', SchoolLifecyclePhase.SALES_HANDOVER),
  task('handover_product_program', SchoolLifecyclePhase.SALES_HANDOVER),
  task('handover_location', SchoolLifecyclePhase.SALES_HANDOVER),
  task('handover_commitments', SchoolLifecyclePhase.SALES_HANDOVER),
  task('welcome_call', SchoolLifecyclePhase.WELCOME),
  task('welcome_email', SchoolLifecyclePhase.WELCOME),
  task('teacher_data_form_shared', SchoolLifecyclePhase.DATA_COLLECTION_LMS),
];

describe('SchoolAutomationService', () => {
  it('on creation: welcome email to the owner, enrollment email to every admin, handover ticked, phase advanced', async () => {
    const { service, notifications, school, tasks } = makeService(handover, HANDOVER_TASKS());
    await service.sync('s1'); // what onSchoolCreated awaits…
    await service.sendCreationEmails('s1', creator); // …and what it starts in the background

    const emails = notifications.sendTemplateEmail.mock.calls.map(([p]) => [p.templateKey, p.recipient]).sort();
    expect(emails).toEqual([
      ['admin_new_school', 'admin1@codevidhya.com'],
      ['admin_new_school', 'admin2@codevidhya.com'],
      ['teacher_details_request', 'principal@dps.in'],
      ['welcome_email', 'principal@dps.in'],
    ]);
    const formEmail = notifications.sendTemplateEmail.mock.calls.find(([p]) => p.templateKey === 'teacher_details_request')![0];
    expect(formEmail.body).toMatch(/http:\/\/localhost:5173\/teacher-form\/s1\/[\w-]{32}/);
    const adminCall = notifications.sendTemplateEmail.mock.calls.find(([p]) => p.templateKey === 'admin_new_school')!;
    expect(adminCall[0].fromAccountManager).toBe(false);
    expect(tasks.filter((t) => t.status === PhaseTaskStatus.DONE).map((t) => t.id)).toEqual([
      'handover_owner_details',
      'handover_product_program',
      'handover_location',
      'handover_commitments',
      'welcome_email',
      'teacher_data_form_shared',
    ]);
    // Handover complete → Welcome; Welcome still has the (human) welcome call pending → stops there.
    expect(school.currentPhase).toBe(SchoolLifecyclePhase.WELCOME);
  });

  it('onSchoolCreated syncs before returning and starts the emails without waiting for them', async () => {
    const { service, school } = makeService(handover, HANDOVER_TASKS());
    const emails = jest.spyOn(service, 'sendCreationEmails').mockReturnValue(new Promise(() => undefined)); // never settles
    await service.onSchoolCreated('s1', creator);
    expect(school.currentPhase).toBe(SchoolLifecyclePhase.WELCOME);
    expect(emails).toHaveBeenCalledWith('s1', creator);
  });

  it('sends the enrollment email to ADMIN_ALERT_EMAILS instead of Super Admins when set', async () => {
    const { service, notifications, prisma } = makeService(handover, HANDOVER_TASKS(), true, {
      ADMIN_ALERT_EMAILS: 'ops@codevidhya.com, head@codevidhya.com',
    });
    await service.sendCreationEmails('s1', creator);
    const adminEmails = notifications.sendTemplateEmail.mock.calls.filter(([p]) => p.templateKey === 'admin_new_school').map(([p]) => p.recipient);
    expect(adminEmails).toEqual(['ops@codevidhya.com', 'head@codevidhya.com']);
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
  });

  it('leaves the welcome task pending when the email could not be sent', async () => {
    const { service, tasks } = makeService(handover, HANDOVER_TASKS(), false);
    await service.sendCreationEmails('s1', creator);
    expect(tasks.find((t) => t.id === 'welcome_email')!.status).toBe(PhaseTaskStatus.PENDING);
  });

  it('does not tick a handover task whose data is missing, and so does not advance', async () => {
    const { service, school, tasks } = makeService({ ...handover, ownerPhone: null }, HANDOVER_TASKS());
    await service.sync('s1');
    expect(tasks.find((t) => t.id === 'handover_owner_details')!.status).toBe(PhaseTaskStatus.PENDING);
    expect(school.currentPhase).toBe(SchoolLifecyclePhase.SALES_HANDOVER);
  });

  it("never overrides a person's N/A, and counts it as complete for advancing", async () => {
    const tasks = HANDOVER_TASKS();
    tasks[3].status = PhaseTaskStatus.NA;
    const { service, school } = makeService({ ...handover, workshopsCommitted: null }, tasks);
    await service.sync('s1');
    expect(tasks[3].status).toBe(PhaseTaskStatus.NA);
    expect(school.currentPhase).toBe(SchoolLifecyclePhase.WELCOME);
  });

  it('ticks data-backed tasks in later phases (teachers, workshops, renewal)', async () => {
    const tasks = [
      task('teacher_details_collected', SchoolLifecyclePhase.ORIENTATION),
      task('teacher_lms_credentials_generated', SchoolLifecyclePhase.DATA_COLLECTION_LMS),
      task('workshops_scheduled', SchoolLifecyclePhase.ONGOING_ENGAGEMENT),
      task('renewal_agreement_signed', SchoolLifecyclePhase.ANNUAL_RENEWAL),
    ];
    const { service } = makeService(
      {
        currentPhase: SchoolLifecyclePhase.ORIENTATION,
        workshopsCommitted: 2,
        teachers: [{ lmsCredentialGenerated: true, trainedAt: null }, { lmsCredentialGenerated: false, trainedAt: null }],
        workshops: [{ status: 'SCHEDULED' }, { status: 'CANCELLED' }, { status: 'COMPLETED' }],
        renewalCycles: [{ renewalStatus: 'AGREED', feedbackCallDate: null }],
      },
      tasks,
    );
    await service.sync('s1');
    expect(Object.fromEntries(tasks.map((t) => [t.id, t.status]))).toEqual({
      teacher_details_collected: PhaseTaskStatus.DONE,
      teacher_lms_credentials_generated: PhaseTaskStatus.PENDING, // one teacher still has no credentials
      workshops_scheduled: PhaseTaskStatus.DONE, // 2 non-cancelled ≥ 2 committed
      renewal_agreement_signed: PhaseTaskStatus.PENDING, // AGREED isn't SIGNED
    });
  });

  it('the daily scan ticks tasks but never sends email', async () => {
    const { service, notifications, tasks } = makeService(handover, HANDOVER_TASKS());
    const changes = await service.scan();
    expect(notifications.sendTemplateEmail).not.toHaveBeenCalled();
    expect(tasks.find((t) => t.id === 'welcome_email')!.status).toBe(PhaseTaskStatus.PENDING);
    expect(changes).toBe(5); // 4 handover ticks + 1 phase advance
  });

  it('never throws into the caller', async () => {
    const { service, prisma } = makeService(handover, HANDOVER_TASKS());
    prisma.school.findUnique.mockRejectedValue(new Error('DB down'));
    const logger = (service as unknown as { logger: { warn: () => void } }).logger;
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    await expect(service.sync('s1')).resolves.toBeUndefined();
  });
});
