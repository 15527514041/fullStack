const todoService = require('../services/todoService')

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function getTodos(req, res) {
  const page = Math.max(parseInt(req.query.page || '1', 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize || '10', 10) || 10, 1), 50)
  const keyword = typeof req.query.keyword === 'string' ? req.query.keyword.trim() : undefined

  let completed
  if (req.query.completed === 'true') completed = true
  else if (req.query.completed === 'false') completed = false

  const result = await todoService.listTodos(req.user.id, { page, pageSize, keyword, completed })
  res.json(result)
}

async function getTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json( { message: 'ID is required'})
  }

  const todo = await todoService.getTodoById(id, req.user.id)
  if (!todo) {
    return res.status(404).json( { message: "Todo not found"})
  }
  res.json(todo)
}

async function createTodo(req, res) {
  const todo = await todoService.createTodo(req.body || {}, req.user.id)
  res.status(201).json(todo)
}

async function updateTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json( { message: 'ID is required'})
  }

  const body = req.body || {}
  const data = {}
  if (body.title !== undefined) data.title = body.title
  if (body.completed !== undefined) data.completed = body.completed

  if (Object.keys(data).length === 0) {
    return res.status(400).json( { message: "No valid fields to update"})
  }

  const todo = await todoService.updateTodo(id, req.user.id, data)
  res.json(todo)
}

async function deleteTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json( { message: 'ID is required'})
  }

  await todoService.deleteTodo(id, req.user.id)
  res.status(204).end()
}

async function restoreTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json({ message: 'ID is required' })
  }
  const todo = await todoService.restoreTodo(id, req.user.id)
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