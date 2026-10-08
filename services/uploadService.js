const fileType = require('file-type')

const prisma = require('../utils/prisma')
const oss = require('../utils/oss')
const AppError = require('../errors/AppError')

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
const VISIBILITIES = ['PUBLIC', 'PRIVATE']

// 兼容 file-type 16(fromBuffer) 与 17+(fileTypeFromBuffer)
async function detectMime(buffer) {
  if (typeof fileType.fileTypeFromBuffer === 'function') return fileType.fileTypeFromBuffer(buffer)
  return fileType.fromBuffer(buffer)
}

// 统一出口:前端只认 ossId / url / expiresAt
function toDTO(record) {
  return {
    ossId: record.id,
    key: record.key,
    visibility: record.visibility,
    url: oss.buildUrl(record.key, record.visibility),
    expiresAt: oss.expiresAt(record.visibility),
    size: record.size,
    mime: record.mime
  }
}

/**
 * 公共上传与私有上传共用这一条链路,只有 visibility 不同:
 * - PUBLIC  → 对象打 public-read,返回永久直链
 * - PRIVATE → 对象保持私有,返回签名临时地址
 */
async function upload({ buffer, originalname, mime, folder, visibility = 'PUBLIC', uploaderId }) {
  if (!VISIBILITIES.includes(visibility)) {
    throw new AppError('文件可见性只能是 PUBLIC 或 PRIVATE', 400)
  }

  // 不信扩展名:按文件头判断真实类型
  const detected = await detectMime(buffer)
  const realMime = detected?.mime || mime
  if (!ALLOWED_MIME.includes(realMime)) {
    throw new AppError('文件内容不是支持的格式', 400)
  }

  const key = oss.buildObjectKey({ originalname, visibility, folder })

  try {
    await oss.putObject({ key, buffer, mime: realMime, publicRead: visibility === 'PUBLIC' })
  } catch (err) {
    // OSS 桶默认开启「阻止公共访问」,会把 public-read 拦掉;给出可执行的提示
    if (String(err.message || '').includes('public object acl')) {
      throw new AppError('OSS 桶开启了「阻止公共访问」,请到 OSS 控制台关闭后再使用公共上传', 500)
    }
    throw err
  }

  const record = await prisma.upload.create({
    data: {
      key,
      visibility,
      mime: realMime,
      size: buffer.length,
      uploaderId: uploaderId ?? null
    }
  })

  return toDTO(record)
}

// 按 ossId 取访问地址;私有文件只有上传者本人或管理员能取
async function getUrl(ossId, user) {
  const record = await prisma.upload.findUnique({ where: { id: ossId } })
  if (!record) throw new AppError('文件不存在', 404)

  const isOwner = record.uploaderId && record.uploaderId === user?.id
  const isAdmin = user?.role === 'ADMIN'
  if (record.visibility === 'PRIVATE' && !isOwner && !isAdmin) {
    throw new AppError('没有权限访问该文件', 403)
  }

  return toDTO(record)
}

// 删除:先删 OSS 对象,再删记录(对象删失败不影响记录清理)
async function remove(ossId, user) {
  const record = await prisma.upload.findUnique({ where: { id: ossId } })
  if (!record) throw new AppError('文件不存在', 404)

  const isOwner = record.uploaderId && record.uploaderId === user?.id
  const isAdmin = user?.role === 'ADMIN'
  if (!isOwner && !isAdmin) {
    throw new AppError('没有权限删除该文件', 403)
  }

  try {
    await oss.removeObject(record.key)
  } catch (err) {
    console.warn('[oss] 删除对象失败', record.key, err.message)
  }

  await prisma.upload.delete({ where: { id: ossId } })
}

module.exports = {
  upload,
  getUrl,
  remove
}
