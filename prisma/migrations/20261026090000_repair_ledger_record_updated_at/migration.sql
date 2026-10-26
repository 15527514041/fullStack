-- 早期编辑账单时只替换了明细,父记录的 updatedAt 未同步刷新。
-- 当前明细是整批重建的,其最后更新时间就是账单最后一次编辑时间;
-- 只向前修复,避免覆盖父记录上更晚的业务更新时间。
UPDATE "LedgerRecord" AS r
SET "updatedAt" = latest."updatedAt"
FROM (
    SELECT "recordId", MAX("updatedAt") AS "updatedAt"
    FROM "LedgerItem"
    GROUP BY "recordId"
) AS latest
WHERE latest."recordId" = r."id"
  AND latest."updatedAt" > r."updatedAt";
