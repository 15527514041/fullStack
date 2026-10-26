-- CreateEnum
CREATE TYPE "WeeklyReviewStatus" AS ENUM ('DRAFT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "WeeklyReviewItemKind" AS ENUM ('WIN', 'CHALLENGE', 'LEARNING', 'NEXT_ACTION');

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weekStart" DATE NOT NULL,
    "summary" TEXT,
    "status" "WeeklyReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReviewItem" (
    "id" SERIAL NOT NULL,
    "reviewId" INTEGER NOT NULL,
    "kind" "WeeklyReviewItemKind" NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekStart_key" ON "WeeklyReview"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyReview_userId_status_weekStart_idx" ON "WeeklyReview"("userId", "status", "weekStart");

-- CreateIndex
CREATE INDEX "WeeklyReviewItem_reviewId_kind_sortOrder_idx" ON "WeeklyReviewItem"("reviewId", "kind", "sortOrder");

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReviewItem" ADD CONSTRAINT "WeeklyReviewItem_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "WeeklyReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
