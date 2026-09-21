import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { StaffRole, SchoolLifecyclePhase } from '@b2b-ops/shared';

const prisma = new PrismaClient();

// One row per SOP step (see B2B_School_Onboarding_SOP.pdf). sortOrder is
// global across all phases so the checklist UI can render tasks in a single
// SOP-ordered list without a secondary sort.
const PHASE_TASK_TEMPLATES: {
  phase: SchoolLifecyclePhase;
  key: string;
  label: string;
  ownerRole: StaffRole;
  sortOrder: number;
}[] = [
  // Phase 1 — Sales-to-Operations Handover
  { phase: SchoolLifecyclePhase.SALES_HANDOVER, key: 'handover_owner_details', label: 'Capture school owner/decision-maker name, designation, email, phone', ownerRole: StaffRole.SALES, sortOrder: 10 },
  { phase: SchoolLifecyclePhase.SALES_HANDOVER, key: 'handover_product_program', label: 'Capture product/program sold + grade range', ownerRole: StaffRole.SALES, sortOrder: 11 },
  { phase: SchoolLifecyclePhase.SALES_HANDOVER, key: 'handover_location', label: 'Capture school city and state', ownerRole: StaffRole.SALES, sortOrder: 12 },
  { phase: SchoolLifecyclePhase.SALES_HANDOVER, key: 'handover_commitments', label: 'Capture workshops committed, training mode, special commitments', ownerRole: StaffRole.SALES, sortOrder: 13 },

  // Phase 2 — Welcome Process
  { phase: SchoolLifecyclePhase.WELCOME, key: 'welcome_call', label: 'Welcome call placed to school owner/principal', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 20 },
  { phase: SchoolLifecyclePhase.WELCOME, key: 'welcome_email', label: 'Welcome email sent confirming partnership + point of contact', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 21 },

  // Phase 3 — Orientation
  { phase: SchoolLifecyclePhase.ORIENTATION, key: 'leadership_orientation', label: 'Leadership orientation session conducted', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 30 },
  { phase: SchoolLifecyclePhase.ORIENTATION, key: 'teacher_induction', label: 'Teacher induction session conducted', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 31 },
  { phase: SchoolLifecyclePhase.ORIENTATION, key: 'teacher_details_collected', label: 'Teacher details collected during induction (name, contact, designation)', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 32 },

  // Phase 4 — Onboarding Setup
  { phase: SchoolLifecyclePhase.ONBOARDING_SETUP, key: 'whatsapp_group_created', label: 'Official school WhatsApp group created', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 40 },
  { phase: SchoolLifecyclePhase.ONBOARDING_SETUP, key: 'whatsapp_stakeholders_added', label: 'Key stakeholders added to WhatsApp group (AM, Owner/Principal, Computer Teacher)', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 41 },
  { phase: SchoolLifecyclePhase.ONBOARDING_SETUP, key: 'school_logo_collected', label: "School's logo collected", ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 42 },
  { phase: SchoolLifecyclePhase.ONBOARDING_SETUP, key: 'cobranded_logo_designed', label: 'Co-branded partnership logo designed', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 43 },
  { phase: SchoolLifecyclePhase.ONBOARDING_SETUP, key: 'welcome_message_shared', label: 'Welcome message + partnership logo shared on WhatsApp group', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 44 },

  // Phase 5 — Data Collection & LMS Credential Generation
  { phase: SchoolLifecyclePhase.DATA_COLLECTION_LMS, key: 'teacher_data_form_shared', label: 'Teacher details form shared with school', ownerRole: StaffRole.OPERATIONS, sortOrder: 50 },
  { phase: SchoolLifecyclePhase.DATA_COLLECTION_LMS, key: 'teacher_lms_credentials_generated', label: 'Teacher LMS credentials generated', ownerRole: StaffRole.OPERATIONS, sortOrder: 51 },
  { phase: SchoolLifecyclePhase.DATA_COLLECTION_LMS, key: 'student_data_collected', label: 'Student details (name, grade) collected in structured sheet', ownerRole: StaffRole.OPERATIONS, sortOrder: 52 },
  { phase: SchoolLifecyclePhase.DATA_COLLECTION_LMS, key: 'student_lms_credentials_generated', label: 'Student LMS credentials generated', ownerRole: StaffRole.OPERATIONS, sortOrder: 53 },

  // Phase 6 — Infrastructure Diagnostic & Session Planning
  { phase: SchoolLifecyclePhase.INFRA_DIAGNOSTIC, key: 'diagnostic_form_sent', label: 'Infrastructure diagnostic form sent to school', ownerRole: StaffRole.OPERATIONS, sortOrder: 60 },
  { phase: SchoolLifecyclePhase.INFRA_DIAGNOSTIC, key: 'session_mix_recommended', label: 'Theory/practical session mix recommended based on diagnostic', ownerRole: StaffRole.OPERATIONS, sortOrder: 61 },
  { phase: SchoolLifecyclePhase.INFRA_DIAGNOSTIC, key: 'mandatory_practical_communicated', label: 'Mandatory practical/lab requirement communicated to school', ownerRole: StaffRole.OPERATIONS, sortOrder: 62 },

  // Phase 7 — Teacher Training
  { phase: SchoolLifecyclePhase.TEACHER_TRAINING, key: 'teacher_training_conducted', label: 'Teacher training conducted (LMS usage, curriculum delivery, classroom facilitation)', ownerRole: StaffRole.TRAINING, sortOrder: 70 },

  // Phase 8 — Ongoing Engagement
  { phase: SchoolLifecyclePhase.ONGOING_ENGAGEMENT, key: 'monthly_visit_cadence_started', label: 'Monthly on-site visit cadence started', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 80 },
  { phase: SchoolLifecyclePhase.ONGOING_ENGAGEMENT, key: 'weekly_call_cadence_started', label: 'Weekly check-in call cadence started', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 81 },
  { phase: SchoolLifecyclePhase.ONGOING_ENGAGEMENT, key: 'workshops_scheduled', label: 'Student workshops scheduled per committed count', ownerRole: StaffRole.ACCOUNT_MANAGER, sortOrder: 82 },

  // Phase 9 — Competitions & Recognition
  { phase: SchoolLifecyclePhase.COMPETITIONS, key: 'internal_competitions_offered', label: 'Internal competitions (Mind Quest / Coding Quotient) offered to school', ownerRole: StaffRole.OPERATIONS, sortOrder: 90 },
  { phase: SchoolLifecyclePhase.COMPETITIONS, key: 'external_competitions_informed', label: 'External/platform competitions (Scratch Olympiad, Ideathon, Hackathon) shared with school', ownerRole: StaffRole.OPERATIONS, sortOrder: 91 },
  { phase: SchoolLifecyclePhase.COMPETITIONS, key: 'certificates_prizes_distributed', label: 'Certificates/prizes distributed to students and teachers', ownerRole: StaffRole.OPERATIONS, sortOrder: 92 },

  // Phase 10 — Annual Feedback & Renewal
  { phase: SchoolLifecyclePhase.ANNUAL_RENEWAL, key: 'annual_feedback_call', label: 'Annual feedback call conducted', ownerRole: StaffRole.SALES, sortOrder: 100 },
  { phase: SchoolLifecyclePhase.ANNUAL_RENEWAL, key: 'renewal_approached', label: 'Renewal approach made to school owner/decision-maker', ownerRole: StaffRole.SALES, sortOrder: 101 },
  { phase: SchoolLifecyclePhase.ANNUAL_RENEWAL, key: 'renewal_agreement_signed', label: 'Signed renewal agreement obtained', ownerRole: StaffRole.SALES, sortOrder: 102 },
];

// Distinct person-like names on purpose — the topbar shows the role badge
// AND the name right next to each other, so a name that just repeats the
// role ("Super Admin" next to a "SUPER ADMIN" badge) reads as a duplicate.
const DEV_STAFF: { name: string; email: string; role: StaffRole }[] = [
  { name: 'Aditi Rao', email: 'admin@b2bops.dev', role: StaffRole.SUPER_ADMIN },
  { name: 'Rohan Mehta', email: 'sales@b2bops.dev', role: StaffRole.SALES },
  { name: 'Priya Nair', email: 'am@b2bops.dev', role: StaffRole.ACCOUNT_MANAGER },
  { name: 'Karan Verma', email: 'ops@b2bops.dev', role: StaffRole.OPERATIONS },
  { name: 'Neha Joshi', email: 'training@b2bops.dev', role: StaffRole.TRAINING },
];
const DEV_PASSWORD = 'changeme123';

async function main() {
  for (const t of PHASE_TASK_TEMPLATES) {
    await prisma.phaseTaskTemplate.upsert({
      where: { key: t.key },
      create: t,
      update: { phase: t.phase, label: t.label, ownerRole: t.ownerRole, sortOrder: t.sortOrder },
    });
  }
  console.log(`Seeded ${PHASE_TASK_TEMPLATES.length} phase task templates.`);

  const passwordHash = await argon2.hash(DEV_PASSWORD);
  for (const s of DEV_STAFF) {
    await prisma.staff.upsert({
      where: { email: s.email },
      create: { name: s.name, email: s.email, role: s.role, passwordHash },
      update: {},
    });
  }
  console.log(`Seeded ${DEV_STAFF.length} dev staff accounts (password: "${DEV_PASSWORD}").`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
