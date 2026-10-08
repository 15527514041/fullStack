-- CreateEnum
CREATE TYPE "TagType" AS ENUM ('primary', 'success', 'info', 'warning', 'danger');

-- AlterTable
-- 已有标签统一落到 primary(默认值),不需要额外数据迁移
ALTER TABLE "Tag" ADD COLUMN     "type" "TagType" NOT NULL DEFAULT 'primary';
