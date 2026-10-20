-- CreateEnum
CREATE TYPE "LedgerRecordSource" AS ENUM ('manual_day', 'manual_week', 'manual_month');

-- CreateEnum
CREATE TYPE "LedgerItemType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerCategory" AS ENUM ('SALARY', 'PART_TIME', 'INVESTMENT', 'RENT', 'GIFT', 'SUBSIDY', 'OTHER_INCOME', 'FOOD', 'TRANSPORT', 'HOUSING', 'SHOPPING', 'MEDICAL', 'ENTERTAINMENT', 'SOCIAL', 'EDUCATION', 'COMMUNICATION', 'INSURANCE', 'REPAYMENT', 'OTHER_EXPENSE');

-- CreateTable
-- 一条周期记录:日/周/月各自最多一条,具体收支放在 LedgerItem
CREATE TABLE "LedgerRecord" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "source" "LedgerRecordSource" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
-- 账单明细:金额始终为正数,收入/支出由 type 决定
CREATE TABLE "LedgerItem" (
    "id" SERIAL NOT NULL,
    "recordId" INTEGER NOT NULL,
    "type" "LedgerItemType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" "LedgerCategory" NOT NULL,
    "accountId" INTEGER NOT NULL,
    "remark" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_LedgerItemToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_LedgerItemToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "LedgerRecord_userId_source_periodStart_key" ON "LedgerRecord"("userId", "source", "periodStart");

-- CreateIndex
CREATE INDEX "LedgerItem_recordId_sortOrder_idx" ON "LedgerItem"("recordId", "sortOrder");

-- CreateIndex
CREATE INDEX "LedgerItem_accountId_idx" ON "LedgerItem"("accountId");

-- CreateIndex
CREATE INDEX "_LedgerItemToTag_B_index" ON "_LedgerItemToTag"("B");

-- AddForeignKey
ALTER TABLE "LedgerRecord" ADD CONSTRAINT "LedgerRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerItem" ADD CONSTRAINT "LedgerItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "LedgerRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
-- 账户删除由 service 层先拦成 409;这里用 CASCADE 是为了删用户时
-- LedgerAccount / LedgerRecord 两条级联路径不会因删除顺序互相阻塞
ALTER TABLE "LedgerItem" ADD CONSTRAINT "LedgerItem_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LedgerItemToTag" ADD CONSTRAINT "_LedgerItemToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "LedgerItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_LedgerItemToTag" ADD CONSTRAINT "_LedgerItemToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
