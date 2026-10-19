-- AlterEnum
-- 账户类型从「微信/支付宝/银行卡/信用卡/现金/其他」换成
-- 「现金/微信零钱/支付宝余额/储蓄卡/信用卡/理财账户/负债账户/其他」
-- Postgres 不支持直接删枚举值,按 Prisma 的标准做法重建一套类型再切列(值按文本映射,老数据不会丢)
-- 老的「银行卡」映射成「储蓄卡」:不映射的话,库里只要有 BANK 的老记录,这次迁移就会失败
BEGIN;
CREATE TYPE "AccountKind_new" AS ENUM ('CASH', 'WECHAT', 'ALIPAY', 'DEBIT_CARD', 'CREDIT_CARD', 'INVESTMENT', 'LIABILITY', 'OTHER');
ALTER TABLE "LedgerAccount"
  ALTER COLUMN "kind" TYPE "AccountKind_new"
  USING (CASE WHEN "kind"::text = 'BANK' THEN 'DEBIT_CARD' ELSE "kind"::text END::"AccountKind_new");
ALTER TYPE "AccountKind" RENAME TO "AccountKind_old";
ALTER TYPE "AccountKind_new" RENAME TO "AccountKind";
DROP TYPE "AccountKind_old";
COMMIT;
