const express = require('express')
const cors = require('cors')
const todosRouter = require('./routes/todos')
const authRouter = require('./routes/auth')
const { notFound, errorHandler } = require('./middlewares/errorHandler')

const app = express()
const port = process.env.PORT || 3008

app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json( { status: 'ok' })
})

app.use('/auth', authRouter)
app.use('/todos', todosRouter)

app.use(notFound)
app.use(errorHandler)


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`)
})
