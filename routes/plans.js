const express = require('express')
const router = express.Router()

const planController = require('../controllers/planController')
const auth = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const { planSchemas, idParams } = require('../validators')

router.use(auth) // 所有路由都需要登录才能访问

// 路由层只做 '映射':URL + 方法 -> controller,不写业务逻辑

router.get('/', validate(planSchemas.query, 'query'), planController.getPlans)
router.get('/:id', validate(idParams, 'params'), planController.getPlan)
router.post('/', validate(planSchemas.create), planController.createPlan)
router.patch('/:id', validate(idParams, 'params'), validate(planSchemas.update), planController.updatePlan)
router.delete('/:id', validate(idParams, 'params'), planController.deletePlan)

module.exports = router
