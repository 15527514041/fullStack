-- 用户级字典:账户类型 / 收入分类 / 支出分类
CREATE TYPE "DictionaryKind" AS ENUM ('ACCOUNT_KIND', 'INCOME_CATEGORY', 'EXPENSE_CATEGORY');

CREATE TABLE "DictionaryItem" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "kind" "DictionaryKind" NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DictionaryItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DictionaryItem_userId_kind_sortOrder_idx" ON "DictionaryItem"("userId", "kind", "sortOrder");
CREATE UNIQUE INDEX "DictionaryItem_userId_kind_name_key" ON "DictionaryItem"("userId", "kind", "name");
CREATE UNIQUE INDEX "DictionaryItem_userId_kind_code_key" ON "DictionaryItem"("userId", "kind", "code");

ALTER TABLE "DictionaryItem"
ADD CONSTRAINT "DictionaryItem_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 给所有已有用户补一套中文默认字典;新用户由注册接口按界面语言写入
INSERT INTO "DictionaryItem" ("userId", "kind", "code", "name", "icon", "sortOrder", "createdAt", "updatedAt")
SELECT
    u."id",
    v."kind"::"DictionaryKind",
    v."code",
    v."name",
    v."icon",
    v."sortOrder",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN (
    VALUES
        ('ACCOUNT_KIND', 'CASH', '现金', 'CASH', 0),
        ('ACCOUNT_KIND', 'WECHAT', '微信零钱', 'WECHAT', 1),
        ('ACCOUNT_KIND', 'ALIPAY', '支付宝余额', 'ALIPAY', 2),
        ('ACCOUNT_KIND', 'DEBIT_CARD', '储蓄卡', 'DEBIT_CARD', 3),
        ('ACCOUNT_KIND', 'CREDIT_CARD', '信用卡', 'CREDIT_CARD', 4),
        ('ACCOUNT_KIND', 'INVESTMENT', '理财账户', 'INVESTMENT', 5),
        ('ACCOUNT_KIND', 'LIABILITY', '负债账户', 'LIABILITY', 6),
        ('ACCOUNT_KIND', 'OTHER', '其他', 'OTHER', 7),
        ('INCOME_CATEGORY', 'SALARY', '工资薪金', NULL, 0),
        ('INCOME_CATEGORY', 'PART_TIME', '兼职劳务', NULL, 1),
        ('INCOME_CATEGORY', 'INVESTMENT', '投资收益', NULL, 2),
        ('INCOME_CATEGORY', 'RENT', '租金收入', NULL, 3),
        ('INCOME_CATEGORY', 'GIFT', '红包礼金', NULL, 4),
        ('INCOME_CATEGORY', 'SUBSIDY', '补贴返还', NULL, 5),
        ('INCOME_CATEGORY', 'OTHER_INCOME', '其他收入', NULL, 6),
        ('EXPENSE_CATEGORY', 'FOOD', '餐饮', NULL, 0),
        ('EXPENSE_CATEGORY', 'TRANSPORT', '交通', NULL, 1),
        ('EXPENSE_CATEGORY', 'HOUSING', '住房', NULL, 2),
        ('EXPENSE_CATEGORY', 'SHOPPING', '购物', NULL, 3),
        ('EXPENSE_CATEGORY', 'MEDICAL', '医疗', NULL, 4),
        ('EXPENSE_CATEGORY', 'ENTERTAINMENT', '娱乐', NULL, 5),
        ('EXPENSE_CATEGORY', 'SOCIAL', '人情', NULL, 6),
        ('EXPENSE_CATEGORY', 'EDUCATION', '教育', NULL, 7),
        ('EXPENSE_CATEGORY', 'COMMUNICATION', '通讯', NULL, 8),
        ('EXPENSE_CATEGORY', 'INSURANCE', '保险', NULL, 9),
        ('EXPENSE_CATEGORY', 'REPAYMENT', '还款', NULL, 10),
        ('EXPENSE_CATEGORY', 'OTHER_EXPENSE', '其他支出', NULL, 11)
) AS v("kind", "code", "name", "icon", "sortOrder");

-- 先把外键列建成可空,回填完成后再收紧为 NOT NULL
ALTER TABLE "LedgerAccount" ADD COLUMN "kindId" INTEGER;
ALTER TABLE "LedgerItem" ADD COLUMN "categoryId" INTEGER;

UPDATE "LedgerAccount" a
SET "kindId" = d."id"
FROM "DictionaryItem" d
WHERE d."userId" = a."userId"
  AND d."kind" = 'ACCOUNT_KIND'
  AND d."code" = a."kind"::text;

UPDATE "LedgerItem" i
SET "categoryId" = d."id"
FROM "LedgerRecord" r, "DictionaryItem" d
WHERE r."id" = i."recordId"
  AND d."userId" = r."userId"
  AND d."kind" = CASE
      WHEN i."type" = 'INCOME' THEN 'INCOME_CATEGORY'::"DictionaryKind"
      ELSE 'EXPENSE_CATEGORY'::"DictionaryKind"
  END
  AND d."code" = i."category"::text;

-- 迁移必须完整映射;宁可失败也不能悄悄留下空引用
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "kindId" IS NULL) THEN
    RAISE EXCEPTION 'LedgerAccount.kindId backfill failed';
  END IF;
  IF EXISTS (SELECT 1 FROM "LedgerItem" WHERE "categoryId" IS NULL) THEN
    RAISE EXCEPTION 'LedgerItem.categoryId backfill failed';
  END IF;
END $$;

ALTER TABLE "LedgerAccount" ALTER COLUMN "kindId" SET NOT NULL;
ALTER TABLE "LedgerItem" ALTER COLUMN "categoryId" SET NOT NULL;

CREATE INDEX "LedgerItem_categoryId_idx" ON "LedgerItem"("categoryId");

ALTER TABLE "LedgerAccount"
ADD CONSTRAINT "LedgerAccount_kindId_fkey"
FOREIGN KEY ("kindId") REFERENCES "DictionaryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerItem"
ADD CONSTRAINT "LedgerItem_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "DictionaryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerAccount" DROP COLUMN "kind";
ALTER TABLE "LedgerItem" DROP COLUMN "category";

DROP TYPE "AccountKind";
DROP TYPE "LedgerCategory";
