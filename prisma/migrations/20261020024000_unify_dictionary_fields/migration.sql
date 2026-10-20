-- 5 类字典统一字段:颜色 / 状态 / 序号
ALTER TABLE "Tag"
ADD COLUMN "color" TEXT NOT NULL DEFAULT '#0bb06d',
ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "Tag"
SET "color" = CASE "type"
  WHEN 'success' THEN '#67c23a'
  WHEN 'info' THEN '#909399'
  WHEN 'warning' THEN '#e6a23c'
  WHEN 'danger' THEN '#f56c6c'
  ELSE '#0bb06d'
END;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId", "scope" ORDER BY "id") - 1 AS rn
  FROM "Tag"
)
UPDATE "Tag" t
SET "sortOrder" = ranked.rn
FROM ranked
WHERE t."id" = ranked."id";

ALTER TABLE "Tag" DROP COLUMN "type";
DROP TYPE "TagType";

ALTER TABLE "DictionaryItem"
ADD COLUMN "color" TEXT NOT NULL DEFAULT '#0bb06d',
ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT true;

UPDATE "DictionaryItem"
SET "color" = CASE
  WHEN "code" = 'CASH' THEN '#22c55e'
  WHEN "code" = 'WECHAT' THEN '#07c160'
  WHEN "code" = 'ALIPAY' THEN '#1677ff'
  WHEN "code" = 'DEBIT_CARD' THEN '#5b8ff9'
  WHEN "code" = 'CREDIT_CARD' THEN '#f0a020'
  WHEN "code" = 'INVESTMENT' AND "kind" = 'INCOME_CATEGORY' THEN '#9254de'
  WHEN "code" = 'INVESTMENT' THEN '#9254de'
  WHEN "code" = 'LIABILITY' THEN '#f5222d'
  WHEN "code" = 'SALARY' THEN '#0bb06d'
  WHEN "code" = 'PART_TIME' THEN '#36b37e'
  WHEN "code" = 'RENT' THEN '#2f80ed'
  WHEN "code" = 'GIFT' THEN '#eb5757'
  WHEN "code" = 'SUBSIDY' THEN '#00a6a6'
  WHEN "code" = 'FOOD' THEN '#f2994a'
  WHEN "code" = 'TRANSPORT' THEN '#2d9cdb'
  WHEN "code" = 'HOUSING' THEN '#6fcf97'
  WHEN "code" = 'SHOPPING' THEN '#bb6bd9'
  WHEN "code" = 'MEDICAL' THEN '#eb5757'
  WHEN "code" = 'ENTERTAINMENT' THEN '#f2c94c'
  WHEN "code" = 'SOCIAL' THEN '#56ccf2'
  WHEN "code" = 'EDUCATION' THEN '#27ae60'
  WHEN "code" = 'COMMUNICATION' THEN '#2f80ed'
  WHEN "code" = 'INSURANCE' THEN '#9b51e0'
  WHEN "code" = 'REPAYMENT' THEN '#eb5757'
  WHEN "code" IN ('OTHER', 'OTHER_INCOME', 'OTHER_EXPENSE') THEN '#909399'
  ELSE '#0bb06d'
END;
