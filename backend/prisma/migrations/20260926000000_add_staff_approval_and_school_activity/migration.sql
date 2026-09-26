-- AlterTable
ALTER TABLE "Staff" ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Every account that existed before approval was introduced counts as approved.
UPDATE "Staff" SET "approvedAt" = "createdAt";

-- CreateTable
CREATE TABLE "SchoolActivity" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "actorStaffId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchoolActivity_schoolId_createdAt_idx" ON "SchoolActivity"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "SchoolActivity" ADD CONSTRAINT "SchoolActivity_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchoolActivity" ADD CONSTRAINT "SchoolActivity_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
