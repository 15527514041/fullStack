-- 资产快照批次:保存一份可回溯的账户数据与汇总指标
CREATE TABLE "LedgerAssetSnapshot" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "note" TEXT,
    "totalAssetsCents" BIGINT NOT NULL,
    "totalDebtCents" BIGINT NOT NULL,
    "netAssetsCents" BIGINT NOT NULL,
    "accountCount" INTEGER NOT NULL,
    "enabledAccountCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAssetSnapshot_pkey" PRIMARY KEY ("id")
);

-- 账户字段复制保存,不关联 LedgerAccount,避免账户删除后历史数据失效
CREATE TABLE "LedgerAssetSnapshotItem" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "accountName" TEXT NOT NULL,
    "kindId" INTEGER NOT NULL,
    "kindName" TEXT NOT NULL,
    "kindCode" TEXT,
    "kindColor" TEXT NOT NULL,
    "note" TEXT,
    "balanceCents" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "balanceUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LedgerAssetSnapshotItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LedgerAssetSnapshot_userId_snapshotDate_key"
ON "LedgerAssetSnapshot"("userId", "snapshotDate");

CREATE INDEX "LedgerAssetSnapshotItem_snapshotId_sortOrder_idx"
ON "LedgerAssetSnapshotItem"("snapshotId", "sortOrder");

ALTER TABLE "LedgerAssetSnapshot"
ADD CONSTRAINT "LedgerAssetSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerAssetSnapshotItem"
ADD CONSTRAINT "LedgerAssetSnapshotItem_snapshotId_fkey"
FOREIGN KEY ("snapshotId") REFERENCES "LedgerAssetSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
