const todoService = require('../services/todoService')

async function getTodos(req, res) {
  const result = await todoService.listTodos(req.user.id, req.query)
  res.json(result)
}

async function getTodo(req, res) {
  const todo = await todoService.getTodoById(req.params.id, req.user.id)
  if (!todo) {
    return res.status(404).json( { message: "Todo not found"})
  }
  res.json(todo)
}

async function createTodo(req, res) {
  const todo = await todoService.createTodo(req.body, req.user.id)
  res.status(201).json(todo)
}

async function updateTodo(req, res) {
  const todo = await todoService.updateTodo(req.params.id, req.user.id, req.body)
  res.json(todo)
}

async function deleteTodo(req, res) {
  await todoService.deleteTodo(req.params.id, req.user.id)
  res.status(204).end()
}

async function restoreTodo(req, res) {
  const todo = await todoService.restoreTodo(req.params.id, req.user.id)
  res.json(todo)
}

module.exports = {
  getTodos,
  getTodo,
  createTodo,
  updateTodo,
  deleteTodo,
  restoreTodo
}