const express = require('express');
const router = express.Router()

const adminController = require('../controllers/adminController')
const auth = require('../middlewares/auth')
const requireRole = require('../middlewares/requireRole')
const validate = require('../middlewares/validate')
const { idParams, adminSchemas } = require('../validators')

router.use(auth) // 所有路由都需要登录才能访问
router.use(requireRole('ADMIN')) // 只有管理员才能访问

router.get('/users', adminController.getUsers)
router.patch('/users/:id/role', validate(idParams, 'params'), validate(adminSchemas.updateRole), adminController.updateUserRole)

module.exports = router