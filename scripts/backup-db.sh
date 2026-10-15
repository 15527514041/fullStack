#!/usr/bin/env bash
set -euo pipefail

# ============ 生产库每日备份 ============
# 用法:  bash scripts/backup-db.sh
# 前置:  ~/.pgpass 里配好密码(见「全栈学习总结-双环境部署.md」)
# 范围:  只备生产库;开发库/测试库不备;上传的文件在 OSS,不归这里管
# 调度:  由 crontab 每天定时调用,输出重定向到 /var/log/backup-db.log

BACKUP_DIR=/var/backups/fullstack
DB_HOST=127.0.0.1
DB_USER=fullstack
DB_NAME=fullstack
KEEP_DAYS=7            # 日备保留天数
KEEP_MONTHLY_DAYS=180  # 月备保留天数(约半年)

STAMP=$(date +%F)
FILE="$BACKUP_DIR/$DB_NAME-$STAMP.dump"
log() { echo "[$(date '+%F %T')] $*"; }

mkdir -p "$BACKUP_DIR"
log "开始备份 $DB_NAME → $FILE"

# 1) 导出(自定义格式:压缩 + 支持选择性恢复)
#    库不存在/连不上时 pg_dump 直接非零退出,set -e 会立刻中断,
#    不会出现"备份失败了还继续往下清理旧文件"这种事
pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -F c -f "$FILE"

# 2) 校验:能被 pg_restore 列出目录清单,才算真的写完整
#    磁盘写满时 dump 可能只写了一半,"文件存在"并不等于"备份可用"
pg_restore -l "$FILE" > /dev/null

# 3) 体积兜底:空库或半截文件通常只有几百字节
SIZE=$(stat -c %s "$FILE")
if [ "$SIZE" -lt 10240 ]; then
  log "备份文件只有 $SIZE 字节,疑似异常,请人工检查"
  exit 1
fi

# 4) 每月 1 号额外留一份月备,保留约半年
if [ "$(date +%d)" = "01" ]; then
  MONTHLY="$BACKUP_DIR/$DB_NAME-monthly-$(date +%Y-%m).dump"
  cp "$FILE" "$MONTHLY"
  log "已留月备:$MONTHLY"
  find "$BACKUP_DIR" -name "$DB_NAME-monthly-*.dump" -type f -mtime +"$KEEP_MONTHLY_DAYS" -delete
fi

# 5) 清理过期日备
#    `! -name` 那一项不能省:不加的话 "fullstack-*.dump" 会把月备也一起删掉
find "$BACKUP_DIR" -name "$DB_NAME-*.dump" ! -name "$DB_NAME-monthly-*" -type f -mtime +"$KEEP_DAYS" -delete

# numfmt 属于 coreutils,正常都有;万一缺了也别让脚本以"失败"收场
log "✅ 完成:$FILE ($(numfmt --to=iec "$SIZE" 2>/dev/null || echo "${SIZE} bytes"))"
