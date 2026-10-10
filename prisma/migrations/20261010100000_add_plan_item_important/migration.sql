-- AlterTable
-- 计划完成 / 实际完成是否标记为重要(界面上是「点亮小三角」);已有数据默认 false,安全
ALTER TABLE "DailyPlanItem" ADD COLUMN     "important" BOOLEAN NOT NULL DEFAULT false;
