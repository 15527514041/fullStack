const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function listTodos() {
  return prisma.todo.findMany({
    orderBy: { id: 'asc' }
  })
}

async function getTodoById(id) {
  return prisma.todo.findUnique( { 
    where: { id: id}
  })
}

async function createTodo(data) {
  return prisma.todo.create({
    data: {
      title: data.title,
      completed: data.completed || false
    }
  })
}

async function updateTodo(id, data) {
  return prisma.todo.update({
    where: { id: id },
    data
  })
}

async function deleteTodo(id) {
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