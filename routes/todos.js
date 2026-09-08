const express = require('express')
const router = express.Router()

const todoController = require('../controllers/todoController')
const auth = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const { todoSchemas, idParams } = require('../validators')

router.use(auth) // 所有路由都需要登录才能访问

// 路由层只做 ‘映射’：URL + 方法 -> controller，不写业务逻辑

router.get('/', validate(todoSchemas.query, 'query'), todoController.getTodos)
router.get('/:id', validate(idParams, 'params'), todoController.getTodo)
router.post('/', validate(todoSchemas.create), todoController.createTodo)
router.patch('/:id', validate(idParams, 'params'), validate(todoSchemas.update), todoController.updateTodo)
router.delete('/:id', validate(idParams, 'params'), todoController.deleteTodo)
router.post('/:id/restore', validate(idParams, 'params'), todoController.restoreTodo)

module.exports = router