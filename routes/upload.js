const express = require('express')
const router = express.Router()

const auth = require('../middlewares/auth')
const { fileUpload } = require('../middlewares/upload')
const uploadController = require('../controllers/uploadController')

// 公共接口≠匿名接口:仍要求登录,避免被刷
router.use(auth)

// 公共上传(永久直链)
router.post('/public', fileUpload.single('file'), uploadController.uploadPublic)

// 私有上传(签名地址)
router.post('/private', fileUpload.single('file'), uploadController.uploadPrivate)

// 访问地址 + 删除
router.get('/:ossId', uploadController.getFile)
router.delete('/:ossId', uploadController.deleteFile)

module.exports = router
