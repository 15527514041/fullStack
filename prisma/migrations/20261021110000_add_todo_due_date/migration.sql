-- 计划清单截止日期:可选,只存日期,不自动关联每日规划
ALTER TABLE "Todo" ADD COLUMN "dueDate" DATE;

CREATE INDEX "Todo_userId_dueDate_idx" ON "Todo"("userId", "dueDate");
