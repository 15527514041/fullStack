const userService = require('../services/userService')

async function updateAvatar(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: '请选择要上传的图片'})
  }

  const avatarUrl = `/uploads/${req.file.filename}`
  await userService.updateAvatar(req.user.id, avatarUrl)
  res.json({ avatarUrl })
}

module.exports = {
  updateAvatar
}