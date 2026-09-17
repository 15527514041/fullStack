const adminService = require('../services/adminService')

async function getUsers(req, res) {
  const users = await adminService.listUsers()
  res.json(users)
}

async function updateUserRole(req, res) {
  const { role } = req.validated.body
  const user = await adminService.updateUserRole(req.validated.params.id, role)
  res.json(user)
}

module.exports = {
  getUsers,
  updateUserRole
}