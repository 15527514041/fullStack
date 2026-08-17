const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';

const register = async (username, password) => {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    const error = new Error('Username already exists')
    error.status = 409
    throw error
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      password: hashedPassword
    }
  })
  return user
}

const login = async (username, password) => {
  const user = await prisma.user.findUnique({ where: { username }})
  if (!user) {
    const error = new Error('Invalid username or password')
    error.status = 401
    throw error
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    const error = new Error('Invalid username or password')
    error.status = 401
    throw error
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })
  return { token, user: { id: user.id, username: user.username}}
}

const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET)
}

module.exports = {
  register,
  login,
  verifyToken
}