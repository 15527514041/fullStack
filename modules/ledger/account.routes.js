const express = require('express')
const router = express.Router()

const accountController = require('./account.controller')
const validate = require('../../middlewares/validate')
const { accountSchemas, idParams } = require('../../validators')

// 路由层只做映射:URL + 方法 -> controller,不写业务逻辑

router.get('/', validate(accountSchemas.query, 'query'), accountController.getAccounts)
router.post('/', validate(accountSchemas.create), accountController.createAccount)
router.patch('/:id', validate(idParams, 'params'), validate(accountSchemas.update), accountController.updateAccount)
// 余额单独一个入口:改余额是「对账」动作,语义和普通编辑不一样
router.patch(
  '/:id/balance',
  validate(idParams, 'params'),
  validate(accountSchemas.balance),
  accountController.updateBalance
)
router.delete('/:id', validate(idParams, 'params'), accountController.deleteAccount)

module.exports = router
