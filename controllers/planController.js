const planService = require('../services/planService')

async function getPlans(req, res) {
  res.json(await planService.listPlans(req.user.id, req.validated.query))
}

async function getPlan(req, res) {
  const record = await planService.getPlanById(req.validated.params.id, req.user.id)
  if (!record) {
    return res.status(404).json({ message: '日程规划不存在' })
  }
  res.json(record)
}

async function createPlan(req, res) {
  res.status(201).json(await planService.createPlan(req.validated.body, req.user.id))
}

async function updatePlan(req, res) {
  res.json(await planService.updatePlan(req.validated.params.id, req.user.id, req.validated.body))
}

async function deletePlan(req, res) {
  await planService.deletePlan(req.validated.params.id, req.user.id)
  res.status(204).end()
}

module.exports = {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan
}
