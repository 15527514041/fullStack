-- CreateTable
CREATE TABLE "TodoAttachment" (
    "id" SERIAL NOT NULL,
    "todoId" INTEGER NOT NULL,
    "ossId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TodoAttachment_pkey" PRIMARY KEY ("id")
);

-- 数据迁移:把原来的单附件字段搬进关联表(必须在删列之前执行)
INSERT INTO "TodoAttachment" ("todoId", "ossId", "sortOrder")
SELECT "id", "attachmentOssId", 0 FROM "Todo" WHERE "attachmentOssId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_attachmentOssId_fkey";

-- AlterTable
ALTER TABLE "Todo" DROP COLUMN "attachmentOssId";

-- CreateIndex
CREATE INDEX "TodoAttachment_todoId_idx" ON "TodoAttachment"("todoId");

-- CreateIndex
CREATE INDEX "TodoAttachment_ossId_idx" ON "TodoAttachment"("ossId");

-- CreateIndex
CREATE UNIQUE INDEX "TodoAttachment_todoId_ossId_key" ON "TodoAttachment"("todoId", "ossId");

-- AddForeignKey
ALTER TABLE "TodoAttachment" ADD CONSTRAINT "TodoAttachment_todoId_fkey" FOREIGN KEY ("todoId") REFERENCES "Todo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TodoAttachment" ADD CONSTRAINT "TodoAttachment_ossId_fkey" FOREIGN KEY ("ossId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
