-- AlterTable
-- 最近一次登录成功的时间:登录时更新,后台用户列表展示用;老数据为 NULL,安全
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3);
