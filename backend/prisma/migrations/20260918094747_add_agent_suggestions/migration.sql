-- CreateEnum
CREATE TYPE "AgentKey" AS ENUM ('ENGAGEMENT', 'RENEWAL');

-- CreateEnum
CREATE TYPE "SuggestionType" AS ENUM ('FOLLOWUP_EMAIL', 'RENEWAL_PITCH');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT');

-- CreateTable
CREATE TABLE "AgentSuggestion" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "agentKey" "AgentKey" NOT NULL,
    "suggestionType" "SuggestionType" NOT NULL,
    "draftSubject" TEXT NOT NULL,
    "draftBody" TEXT NOT NULL,
    "reasoning" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByStaffId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSuggestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgentSuggestion" ADD CONSTRAINT "AgentSuggestion_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSuggestion" ADD CONSTRAINT "AgentSuggestion_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
