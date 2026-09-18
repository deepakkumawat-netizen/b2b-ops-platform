-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgentKey" ADD VALUE 'WORKSHOP_REMINDER';
ALTER TYPE "AgentKey" ADD VALUE 'RENEWAL_CYCLE_OPENER';

-- AlterEnum
ALTER TYPE "SuggestionStatus" ADD VALUE 'AUTO_SENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SuggestionType" ADD VALUE 'WORKSHOP_REMINDER_SENT';
ALTER TYPE "SuggestionType" ADD VALUE 'RENEWAL_CYCLE_OPENED';
