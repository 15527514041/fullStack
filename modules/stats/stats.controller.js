const statsService = require('./stats.service')

async function getTodosPerUser(req, res) {
  const result = await statsService.todosPerUser()
  res.json(result)
}

module.exports = {
  getTodosPerUser
}
