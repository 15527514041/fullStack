const userService = require('../services/userService')
const uploadService = require('../services/uploadService')
const AppError = require('../errors/AppError')

// 头像:走「私有上传」,库里只存 ossId,展示时前端用访问地址接口换签名地址
async function updateAvatar(req, res) {
  if (!req.file) {
    throw new AppError('请选择要上传的图片', 400)
  }

  const current = await userService.findById(req.user.id)

  const result = await uploadService.upload({
    buffer: req.file.buffer,
    originalname: req.file.originalname,
    mime: req.file.mimetype,
    folder: 'avatars',
    visibility: 'PRIVATE',
    uploaderId: req.user.id
  })

  await userService.updateAvatar(req.user.id, result.ossId)

  // 先更新数据库,再删旧头像;删失败不影响主流程
  if (current?.avatarOssId) {
    try {
      await uploadService.remove(current.avatarOssId, req.user)
    } catch (err) {
      console.warn('[avatar] 删除旧头像失败', err.message)
    }
  }

  res.json({ avatarOssId: result.ossId, avatarUrl: result.url })
}

module.exports = { updateAvatar }
