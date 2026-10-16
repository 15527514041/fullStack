-- CreateEnum
CREATE TYPE "TagScope" AS ENUM ('TODO', 'ACCOUNTING');

-- AlterTable
-- 已有标签全部归到任务域(默认值就是 TODO),不需要额外的数据迁移
ALTER TABLE "Tag" ADD COLUMN     "scope" "TagScope" NOT NULL DEFAULT 'TODO';

-- 唯一约束从「一个用户内标签名唯一」改成「一个用户在一个域内标签名唯一」:
-- 不同域允许同名(任务里叫「工作」的标签,记账里也可以再有一个)
DROP INDEX "Tag_userId_name_key";
CREATE UNIQUE INDEX "Tag_userId_scope_name_key" ON "Tag"("userId", "scope", "name");
