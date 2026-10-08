-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "remark" TEXT,
ADD COLUMN     "attachmentOssId" TEXT;

-- AddForeignKey
ALTER TABLE "Todo" ADD CONSTRAINT "Todo_attachmentOssId_fkey" FOREIGN KEY ("attachmentOssId") REFERENCES "Upload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
