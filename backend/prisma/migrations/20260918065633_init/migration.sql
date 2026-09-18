-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SUPER_ADMIN', 'SALES', 'ACCOUNT_MANAGER', 'OPERATIONS', 'TRAINING');

-- CreateEnum
CREATE TYPE "SchoolLifecyclePhase" AS ENUM ('SALES_HANDOVER', 'WELCOME', 'ORIENTATION', 'ONBOARDING_SETUP', 'DATA_COLLECTION_LMS', 'INFRA_DIAGNOSTIC', 'TEACHER_TRAINING', 'ONGOING_ENGAGEMENT', 'COMPETITIONS', 'ANNUAL_RENEWAL');

-- CreateEnum
CREATE TYPE "TrainingMode" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('ACTIVE', 'RENEWED', 'CHURNED');

-- CreateEnum
CREATE TYPE "PhaseTaskStatus" AS ENUM ('PENDING', 'DONE', 'NA');

-- CreateEnum
CREATE TYPE "WorkshopStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('MONTHLY_VISIT', 'WEEKLY_CALL');

-- CreateEnum
CREATE TYPE "CompetitionType" AS ENUM ('INTERNAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "RenewalStatus" AS ENUM ('PENDING', 'APPROACHED', 'AGREED', 'DECLINED', 'SIGNED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "ownerName" TEXT,
    "ownerDesignation" TEXT,
    "ownerEmail" TEXT,
    "ownerPhone" TEXT,
    "productProgram" TEXT,
    "gradeFrom" TEXT,
    "gradeTo" TEXT,
    "workshopsCommitted" INTEGER,
    "trainingMode" "TrainingMode",
    "specialCommitments" TEXT,
    "totalStudents" INTEGER,
    "currentPhase" "SchoolLifecyclePhase" NOT NULL DEFAULT 'SALES_HANDOVER',
    "status" "SchoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAccountManagerId" TEXT,
    "assignedSalesRepId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhaseTaskTemplate" (
    "id" TEXT NOT NULL,
    "phase" "SchoolLifecyclePhase" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ownerRole" "StaffRole",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PhaseTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolPhaseTask" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "PhaseTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedByStaffId" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "SchoolPhaseTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Teacher" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT,
    "gradeAssigned" TEXT,
    "lmsCredentialGenerated" BOOLEAN NOT NULL DEFAULT false,
    "trainedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Teacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfraDiagnostic" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "labCapacity" TEXT,
    "internetConnectivity" TEXT,
    "systemsPerStudent" TEXT,
    "recommendedSessionMix" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfraDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workshop" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "targetGrades" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "WorkshopStatus" NOT NULL DEFAULT 'SCHEDULED',
    "confirmationSentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "feedbackFormSentAt" TIMESTAMP(3),
    "feedbackReceivedAt" TIMESTAMP(3),
    "feedbackSummary" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "type" "EngagementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "conductedByStaffId" TEXT,
    "summary" TEXT,
    "issuesRaised" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionParticipation" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompetitionType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "studentsParticipated" INTEGER,
    "certificatesIssued" BOOLEAN NOT NULL DEFAULT false,
    "prizesAwarded" TEXT,
    "teacherCertified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenewalCycle" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "cycleLabel" TEXT NOT NULL,
    "feedbackCallDate" TIMESTAMP(3),
    "feedbackSummary" TEXT,
    "renewalStatus" "RenewalStatus" NOT NULL DEFAULT 'PENDING',
    "agreementSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "recipient" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "providerResponse" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseTaskTemplate_key_key" ON "PhaseTaskTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolPhaseTask_schoolId_templateId_key" ON "SchoolPhaseTask"("schoolId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "InfraDiagnostic_schoolId_key" ON "InfraDiagnostic"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalCycle_schoolId_cycleLabel_key" ON "RenewalCycle"("schoolId", "cycleLabel");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_assignedAccountManagerId_fkey" FOREIGN KEY ("assignedAccountManagerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_assignedSalesRepId_fkey" FOREIGN KEY ("assignedSalesRepId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPhaseTask" ADD CONSTRAINT "SchoolPhaseTask_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPhaseTask" ADD CONSTRAINT "SchoolPhaseTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PhaseTaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolPhaseTask" ADD CONSTRAINT "SchoolPhaseTask_completedByStaffId_fkey" FOREIGN KEY ("completedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Teacher" ADD CONSTRAINT "Teacher_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InfraDiagnostic" ADD CONSTRAINT "InfraDiagnostic_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementLog" ADD CONSTRAINT "EngagementLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementLog" ADD CONSTRAINT "EngagementLog_conductedByStaffId_fkey" FOREIGN KEY ("conductedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionParticipation" ADD CONSTRAINT "CompetitionParticipation_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalCycle" ADD CONSTRAINT "RenewalCycle_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
