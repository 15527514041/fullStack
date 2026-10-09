const reflectionService = require('../services/reflectionService')

async function getReflections(req, res) {
  res.json(await reflectionService.listReflections(req.user.id, req.validated.query))
}

async function getReflection(req, res) {
  const record = await reflectionService.getReflectionById(req.validated.params.id, req.user.id)
  if (!record) {
    return res.status(404).json({ message: '反思记录不存在' })
  }
  res.json(record)
}

async function createReflection(req, res) {
  res.status(201).json(await reflectionService.createReflection(req.validated.body, req.user.id))
}

async function updateReflection(req, res) {
  res.json(await reflectionService.updateReflection(req.validated.params.id, req.user.id, req.validated.body))
}

async function deleteReflection(req, res) {
  await reflectionService.deleteReflection(req.validated.params.id, req.user.id)
  res.status(204).end()
}

module.exports = {
  getReflections,
  getReflection,
  createReflection,
  updateReflection,
  deleteReflection
}
