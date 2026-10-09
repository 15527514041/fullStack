const express = require('express')
const router = express.Router()

const reflectionController = require('../controllers/reflectionController')
const auth = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const { reflectionSchemas, idParams } = require('../validators')

router.use(auth) // 所有路由都需要登录才能访问

// 路由层只做 '映射':URL + 方法 -> controller,不写业务逻辑

router.get('/', validate(reflectionSchemas.query, 'query'), reflectionController.getReflections)
router.get('/:id', validate(idParams, 'params'), reflectionController.getReflection)
router.post('/', validate(reflectionSchemas.create), reflectionController.createReflection)
router.patch('/:id', validate(idParams, 'params'), validate(reflectionSchemas.update), reflectionController.updateReflection)
router.delete('/:id', validate(idParams, 'params'), reflectionController.deleteReflection)

module.exports = router
