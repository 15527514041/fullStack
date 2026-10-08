const OSS = require('ali-oss')
const crypto = require('crypto')
const path = require('path')

const REQUIRED = ['OSS_REGION', 'OSS_BUCKET', 'OSS_ACCESS_KEY_ID', 'OSS_ACCESS_KEY_SECRET']

let client = null

/**
 * 延迟初始化:
 * CI/测试环境没有 OSS 配置时,只要不调用上传接口就不该报错
 * (否则应用一加载就崩,连测试都跑不起来)
 */
function getClient() {
  if (client) return client

  const missing = REQUIRED.filter((key) => !process.env[key])
  if (missing.length) {
    throw new Error(`OSS 未配置:缺少环境变量 ${missing.join(', ')}`)
  }

  client = new OSS({
    region: process.env.OSS_REGION,
    bucket: process.env.OSS_BUCKET,
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    secure: true
  })
  return client
}

// 访问地址前缀(公共直链用)
function getPublicBaseUrl() {
  const base =
    process.env.OSS_PUBLIC_BASE_URL ||
    `https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com`
  return base.replace(/\/+$/, '')
}

// 私有文件签名地址有效期(秒),默认 1 小时
function getSignedUrlTtl() {
  return Number(process.env.OSS_SIGNED_URL_TTL || 3600)
}

// 启动时只提醒,不直接崩:避免部署时因为漏配环境变量导致整个服务 502
if (REQUIRED.some((key) => !process.env[key])) {
  console.warn('[oss] 未检测到 OSS 环境变量,上传相关接口将不可用')
}

/**
 * 对象 key:{public|private}/{folder}/{年}/{月}/{uuid}.{ext}
 * 按年月分目录:方便按生命周期规则清理,也方便在控制台排查
 */
function buildObjectKey({ originalname, visibility = 'PUBLIC', folder = 'uploads' }) {
  const prefix = visibility === 'PRIVATE' ? 'private' : 'public'
  const safeFolder = String(folder).replace(/[^a-zA-Z0-9/_-]/g, '') || 'uploads'
  const ext = (path.extname(originalname) || '').toLowerCase()
  const now = new Date()
  const ym = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`
  return `${prefix}/${safeFolder}/${ym}/${crypto.randomUUID()}${ext}`
}

/**
 * 上传对象
 * @param {boolean} publicRead 公共文件:给对象单独打 public-read(桶本身保持私有)
 */
async function putObject({ key, buffer, mime, publicRead = false }) {
  const headers = {
    // 对象内容不可变,给足长缓存
    'Cache-Control': 'public, max-age=31536000'
  }
  if (publicRead) {
    headers['x-oss-object-acl'] = 'public-read'
  }

  await getClient().put(key, buffer, { mime, headers })
  return key
}

async function removeObject(key) {
  await getClient().delete(key)
}

/**
 * 访问地址的唯一出口:
 * - PUBLIC → 永久直链(对象是 public-read)
 * - PRIVATE → 带签名的临时地址
 * 以后换 CDN / 改策略,只改这里,业务和前端都不用动
 */
function buildUrl(key, visibility = 'PUBLIC', options = {}) {
  const { download = false, filename = '' } = options
  // 加 content-disposition 让浏览器直接下载而不是预览(文件名用原始名)
  const disposition = download
    ? `attachment; filename="${encodeURIComponent(filename || 'download')}"`
    : null

  if (visibility === 'PRIVATE') {
    return getClient().signatureUrl(key, {
      expires: getSignedUrlTtl(),
      response: disposition ? { 'content-disposition': disposition } : undefined
    })
  }

  const base = `${getPublicBaseUrl()}/${key}`
  return disposition ? `${base}?response-content-disposition=${encodeURIComponent(disposition)}` : base
}

// 私有地址的过期时间(返回给前端做缓存判断);公共直链返回 null
function expiresAt(visibility) {
  if (visibility !== 'PRIVATE') return null
  return new Date(Date.now() + getSignedUrlTtl() * 1000).toISOString()
}

module.exports = {
  getClient,
  getPublicBaseUrl,
  getSignedUrlTtl,
  buildObjectKey,
  putObject,
  removeObject,
  buildUrl,
  expiresAt
}
