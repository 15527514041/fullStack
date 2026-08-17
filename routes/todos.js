const express = require('express')

const router = express.Router()

const todoController = require('../controllers/todoController')
const validateTodo = require('../middlewares/validateTodo')
const auth = require('../middlewares/auth')

router.use(auth) // 所有路由都需要登录才能访问

// 路由层只做 ‘映射’：URL + 方法 -> controller，不写业务逻辑

router.get('/', todoController.getTodos)
router.get('/:id', todoController.getTodo)
router.post('/', validateTodo({ requireTitle: true }), todoController.createTodo)
router.patch('/:id', validateTodo(), todoController.updateTodo)
router.delete('/:id', todoController.deleteTodo)

module.exports = router
