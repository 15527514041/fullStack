const adminService = require('../services/adminService')

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

module.exports = {
  getUsers,
  updateUserRole,
  updateUserStatus
}