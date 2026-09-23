-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgentKey" ADD VALUE 'WORKSHOP_FEEDBACK_NAG';
ALTER TYPE "AgentKey" ADD VALUE 'STALE_PHASE_ALERT';
ALTER TYPE "AgentKey" ADD VALUE 'RENEWAL_STALLED_ALERT';
ALTER TYPE "AgentKey" ADD VALUE 'COMPETITION_FOLLOWUP_ALERT';
ALTER TYPE "AgentKey" ADD VALUE 'DATA_COMPLETENESS_ALERT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SuggestionType" ADD VALUE 'WORKSHOP_FEEDBACK_NAG_SENT';
ALTER TYPE "SuggestionType" ADD VALUE 'STALE_PHASE_DETECTED';
ALTER TYPE "SuggestionType" ADD VALUE 'RENEWAL_STALLED';
ALTER TYPE "SuggestionType" ADD VALUE 'COMPETITION_FOLLOWUP_NEEDED';
ALTER TYPE "SuggestionType" ADD VALUE 'MISSING_HANDOVER_DATA';

-- AlterTable
ALTER TABLE "Workshop" ADD COLUMN     "feedbackNagSentAt" TIMESTAMP(3);
