const express = require('express')
const router = express.Router()

const accountRoutes = require('./account.routes')
const auth = require('../../middlewares/auth')

// 记账域的入口:登录一次,下面的子资源共用
router.use(auth)

router.use('/accounts', accountRoutes)

module.exports = router
