-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('WECHAT', 'ALIPAY', 'BANK', 'CREDIT_CARD', 'CASH', 'OTHER');

-- CreateTable
-- 资产账户:余额单位是分,由用户手动维护(账单流水不联动);enabled 只是标记,余额照算
CREATE TABLE "LedgerAccount" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "note" TEXT,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "balanceUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LedgerAccount_userId_enabled_idx" ON "LedgerAccount"("userId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_userId_name_key" ON "LedgerAccount"("userId", "name");

-- AddForeignKey
-- 跟着用户走:管理员删用户时账户一并清掉,不用改 admin 的删除链路
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
