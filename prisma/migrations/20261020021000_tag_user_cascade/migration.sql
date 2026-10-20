-- 新用户注册自带标签后,删除用户必须能级联清掉标签
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_userId_fkey";
ALTER TABLE "Tag"
ADD CONSTRAINT "Tag_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
