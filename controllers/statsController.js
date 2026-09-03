const statsService = require('../services/statsService')

async function getTodosPerUser(req, res) {
  const result = await statsService.todosPerUser()
  res.json(result)
}

module.exports = {
  getTodosPerUser
}