-- AlterEnum
ALTER TYPE "AgentKey" ADD VALUE 'SCHOOL_DETAILS_REMINDER';

-- AlterEnum
ALTER TYPE "SuggestionType" ADD VALUE 'SCHOOL_DETAILS_REMINDER_SENT';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "orientationNote" TEXT,
ADD COLUMN     "orientationPreferredDate" TIMESTAMP(3),
ADD COLUMN     "whatsappGroupLink" TEXT;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "whatsappInvitedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" TEXT,
    "section" TEXT,
    "lmsCredentialGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchoolAsset" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Student_schoolId_idx" ON "Student"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "SchoolAsset_schoolId_kind_key" ON "SchoolAsset"("schoolId", "kind");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolAsset" ADD CONSTRAINT "SchoolAsset_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

