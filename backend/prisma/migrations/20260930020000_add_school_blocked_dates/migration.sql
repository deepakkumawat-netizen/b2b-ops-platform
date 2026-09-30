-- CreateTable
CREATE TABLE "SchoolBlockedDate" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolBlockedDate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolBlockedDate_schoolId_day_key" ON "SchoolBlockedDate"("schoolId", "day");

-- AddForeignKey
ALTER TABLE "SchoolBlockedDate" ADD CONSTRAINT "SchoolBlockedDate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
