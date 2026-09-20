const path = require('path')
const fs = require('fs/promises')
const userService = require('../services/userService')

const uploadDir = path.join(__dirname, '..', 'uploads')

// 删除旧头像:只允许删 uploads 目录内的文件,失败不影响主流程
async function removeOldAvatar(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/')) return
  const filePath = path.join(uploadDir, path.basename(avatarUrl))
  try {
    await fs.unlink(filePath)
  } catch {
    // 文件不存在或已被清理,忽略
  }
}

async function updateAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: '请选择要上传的图片' })
  }

  const current = await userService.findById(req.user.id)
  const avatarUrl = `/uploads/${req.file.filename}`

  await userService.updateAvatar(req.user.id, avatarUrl)
  await removeOldAvatar(current?.avatarUrl) // 先更新数据库,再删旧文件

  res.json({ avatarUrl })
}

module.exports = { updateAvatar }