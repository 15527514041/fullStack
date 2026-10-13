-- AlterTable
-- 密码最后修改时间:签发时间早于它的 token 一律失效(改完密码即踢下线);NULL = 从没改过密码
ALTER TABLE "User" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);
