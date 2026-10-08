const uploadService = require('../services/uploadService')
const AppError = require('../errors/AppError')

function requireFile(req) {
  if (!req.file) throw new AppError('请选择要上传的文件', 400)
  return req.file
}

// 公共上传:对象在 OSS 上打 public-read,返回永久可访问直链
async function uploadPublic(req, res) {
  const file = requireFile(req)

  const result = await uploadService.upload({
    buffer: file.buffer,
    originalname: file.originalname,
    mime: file.mimetype,
    folder: req.body.folder || req.query.folder || 'uploads',
    visibility: 'PUBLIC',
    uploaderId: req.user.id
  })

  res.status(201).json(result)
}

// 私有上传:对象保持私有,返回带签名的临时地址(有效期 OSS_SIGNED_URL_TTL)
async function uploadPrivate(req, res) {
  const file = requireFile(req)

  const result = await uploadService.upload({
    buffer: file.buffer,
    originalname: file.originalname,
    mime: file.mimetype,
    folder: req.body.folder || req.query.folder || 'uploads',
    visibility: 'PRIVATE',
    uploaderId: req.user.id
  })

  res.status(201).json(result)
}

// 访问地址接口:私有文件会校验归属,并返回新的签名地址
async function getFile(req, res) {
  // ?download=1 时返回带 content-disposition 的地址,浏览器会直接下载
  res.json(await uploadService.getUrl(req.params.ossId, req.user, { download: req.query.download === '1' }))
}

async function deleteFile(req, res) {
  await uploadService.remove(req.params.ossId, req.user)
  res.status(204).end()
}

module.exports = {
  uploadPublic,
  uploadPrivate,
  getFile,
  deleteFile
}
