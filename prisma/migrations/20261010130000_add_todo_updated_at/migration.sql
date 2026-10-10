-- AlterTable
-- 最近一次更新时间:老数据回填成迁移执行时间,之后由 @updatedAt 在每次写库时自动刷新
ALTER TABLE "Todo" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
