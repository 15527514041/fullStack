-- AlterTable
-- 待办是否已完成(勾上=完成);已有数据默认 false,安全
ALTER TABLE "DailyPlanItem" ADD COLUMN     "completed" BOOLEAN NOT NULL DEFAULT false;
