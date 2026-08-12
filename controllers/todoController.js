const todoService = require('../services/todoService')

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

async function getTodos(req, res) {
  const todos = await todoService.listTodos()
  res.json(todos)
}

async function getTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json( { message: 'ID is required'})
  }

  const todo = await todoService.getTodoById(id)
  if (todo === null) {
    return res.status(404).json( { message: "Todo not found"})
  }
  res.json(todo)
}

async function createTodo(req, res) {
  const todo = await todoService.createTodo(req.body)
  res.status(201).json(todo)
}

async function updateTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json( { message: 'ID is required'})
  }

  const data = {}
  if (req.body.title !== undefined) data.title = req.body.title
  if (req.body.completed !== undefined) data.completed = req.body.completed

  if (Object.keys(data).length === 0) {
    return res.status(400).json( { message: "No valid fields to update"})
  }

  try {
    const todo = await todoService.updateTodo(id, data)
    res.json(todo)
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json( { message: "Todo not found"})
    }
    throw error
  }
}

async function deleteTodo(req, res) {
  const id = parseId(req.params.id)
  if (id === null) {
    return res.status(400).json( { message: 'ID is required'})
  }

  try {
    await todoService.deleteTodo(id)
    res.status(204).end()
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json( { message: "Todo not found"})
    }
    throw error
  }
}

module.exports = {
  getTodos,
  getTodo,
  createTodo,
  updateTodo,
  deleteTodo
}