const adminService = require('./admin.service')

async function getUsers(req, res) {
  const result = await adminService.listUsers(req.validated.query)
  res.json(result)
}

async function updateUserRole(req, res) {
  const { role } = req.validated.body
  const user = await adminService.updateUserRole(req.validated.params.id, role)
  res.json(user)
}

async function updateUserStatus(req, res) {
  const { status } = req.validated.body
  const user = await adminService.updateUserStatus(req.validated.params.id, status)
  res.json(user)
}

// 删除用户:账号和它的数据一起没了,前端必须二次确认
async function deleteUser(req, res) {
  const result = await adminService.deleteUser(req.user.id, req.validated.params.id)
  res.json({ message: '用户已删除', ...result })
}

module.exports = {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser
}
