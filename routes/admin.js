const express = require('express')
const router = express.Router()

const adminController = require('../controllers/adminController')
const auth = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const validate = require('../middlewares/validate')
const { idParams, adminSchemas } = require('../validators')

router.use(auth, requireRole('ADMIN')) // 只有管理员能访问

router.get('/users', validate(adminSchemas.listQuery, 'query'), adminController.getUsers)
router.patch(
  '/users/:id/role',
  validate(idParams, 'params'),
  validate(adminSchemas.updateRole),
  adminController.updateUserRole
)
router.patch(
  '/users/:id/status',
  validate(idParams, 'params'),
  validate(adminSchemas.updateStatus),
  adminController.updateUserStatus
)

module.exports = router