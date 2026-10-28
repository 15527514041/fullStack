const overviewService = require('./overview.service')

async function getOverview(req, res) {
  res.json(await overviewService.getOverview(req.user.id, req.validated.query.date))
}

module.exports = { getOverview }
