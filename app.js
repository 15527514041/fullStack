const path = require('path')
const express = require('express')
const cors = require('cors')
const todosRouter = require('./routes/todos')
const authRouter = require('./routes/auth')
const statsRouter = require('./routes/stats')
const userRouter = require('./routes/user')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const requestLogger = require('./middlewares/requestLogger')

const app = express()

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173']
}))
app.use(express.json())
app.use(requestLogger)

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/todos', todosRouter)
app.use('/api/stats', statsRouter)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/api/users', userRouter)

app.use(notFound)
app.use(errorHandler)

module.exports = app