const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function listTodos(userId, query) {
  const { page = 1, pageSize = 10, keyword, completed } = query

  const where = { ueserId }
  if (keyword) {
    where.title = { contains: keyword, mode: 'insensitive' }
  }
  if (completed !== undefined) {
    where.completed = completed
  }

  const [list, total] = await Promise.all([
    prisma.todo.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.todo.count({ where})
  ])

  return { list, total, page, pageSize}
}

async function getTodoById(id, userId) {
  return prisma.todo.findFirst({ 
    where: { id, userId }
  })
}

async function createTodo(data, userId) {
  return prisma.todo.create({
    data: {
      title: data.title,
      completed: data.completed ?? false,
      userId
    }
  })
}

async function updateTodo(id, userId, data) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId }
  })
  if (!todo) {
    const error = new Error("Todo not found")
    error.status = 404
    throw error
  }
  return prisma.todo.update({
    where: { id: id },
    data
  })
}

async function deleteTodo(id, userId) {
  const todo = await prisma.todo.findFirst({
    where: { id, userId }
  })
  if (!todo) {
    const error = new Error("Todo not found")
    error.status = 404
    throw error
  }
  return prisma.todo.delete({
    where: { id: id}
  })
}

module.exports = {
  listTodos,
  getTodoById,
  createTodo,
  updateTodo,
  deleteTodo
}