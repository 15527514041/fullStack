const AppError = require('../errors/AppError')
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';

const register = async (username, password) => {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new AppError('Username already exists', 409);
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
    throw new AppError('Invalid username or password', 401)
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    throw new AppError('Invalid username or password', 401)
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