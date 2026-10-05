-- CreateTable
CREATE TABLE "SchoolFestivalApplied" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "day" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchoolFestivalApplied_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolFestivalApplied_schoolId_day_key" ON "SchoolFestivalApplied"("schoolId", "day");

-- AddForeignKey
ALTER TABLE "SchoolFestivalApplied" ADD CONSTRAINT "SchoolFestivalApplied_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
