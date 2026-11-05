const { TextDecoder } = require('util')

const strictUtf8 = new TextDecoder('utf-8', { fatal: true })

/**
 * multipart 文件名可能被 Busboy/Multer 按 Latin-1 解码:
 * UTF-8 的中文字节会显示成 "ä¸­æ–‡" 这样的乱码。
 * 只在能严格按 UTF-8 还原时修复;真正的 Latin-1 文件名保持不变。
 */
function normalizeOriginalName(value) {
  if (typeof value !== 'string' || !value) return value

  let current = value
  // 兼容经过两层 Latin-1 解码的历史数据
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!/[\u0080-\u00ff]/.test(current)) break
    if ([...current].some((char) => char.codePointAt(0) > 0xff)) break

    try {
      const repaired = strictUtf8.decode(Buffer.from(current, 'latin1'))
      if (!repaired || repaired === current) break
      current = repaired
    } catch {
      break
    }
  }

  return current
}

module.exports = {
  normalizeOriginalName
}
