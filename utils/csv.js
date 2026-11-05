// 通用 CSV 生成:各导出模块只提供表头和已经整理好的业务行

function protectFormula(value) {
  const text = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

function serializeCell(value) {
  return `"${protectFormula(value).replace(/"/g, '""')}"`
}

/**
 * 所有单元格都加引号,换行和逗号会原样保留在单元格内。
 * 以 Excel 公式字符开头的用户内容前加单引号,避免导出文件被当成公式执行。
 */
function buildCsv(columns, rows) {
  const lines = [
    columns.map((column) => serializeCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => serializeCell(row[column.key])).join(','))
  ]
  return lines.join('\r\n')
}

/**
 * 同时提供 ASCII fallback 和 RFC 5987 UTF-8 文件名:
 * 老客户端能用,现代浏览器能拿到中文文件名。
 */
function contentDisposition(fileName) {
  const asciiName = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

module.exports = {
  buildCsv,
  contentDisposition
}
