const userService = require('./user.service')
const uploadService = require('../upload/upload.service')
const AppError = require('../../errors/AppError')

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

// 修改密码:成功后不签发新 token,前端引导用户用新密码重新登录
// 只认 req.user.id(来自 token),所以不存在"改到别人密码"的可能;
// 另外会更新 passwordChangedAt,老 token 随即失效
async function changePassword(req, res) {
  const { oldPassword, password } = req.validated.body
  await userService.changePassword(req.user.id, oldPassword, password)
  res.json({ message: '密码修改成功' })
}

async function getPreferences(req, res) {
  res.json(await userService.getPreferences(req.user.id))
}

async function updatePreferences(req, res) {
  const { ledgerEntrySources } = req.validated.body
  res.json(await userService.updatePreferences(req.user.id, ledgerEntrySources))
}

module.exports = { updateAvatar, changePassword, getPreferences, updatePreferences }
