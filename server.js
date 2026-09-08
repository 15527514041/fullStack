const express = require('express')
const cors = require('cors')
const todosRouter = require('./routes/todos')
const authRouter = require('./routes/auth')
const statsRouter = require('./routes/stats')
const { notFound, errorHandler } = require('./middlewares/errorHandler')
const requestLogger = require('./middlewares/requestLogger')

const app = express()
const port = process.env.PORT || 3008

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173']
}))
app.use(express.json())
app.use(requestLogger)

app.get('/health', (req, res) => {
  res.json( { status: 'ok' })
})

app.use('/api/auth', authRouter)
app.use('/api/todos', todosRouter)
app.use('/api/stats', statsRouter)

app.use(notFound)
app.use(errorHandler)


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
})
