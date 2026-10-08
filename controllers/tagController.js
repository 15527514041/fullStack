const tagService = require('../services/tagService')

async function getTags(req, res) {
  const tags = await tagService.listTags(req.user.id)
  res.json(tags)
}

async function createTag(req, res) {
  const { name, type } = req.validated.body
  const tag = await tagService.createTag(req.user.id, { name, type })
  res.status(201).json(tag)
}

async function updateTag(req, res) {
  const { name, type } = req.validated.body
  const tag = await tagService.updateTag(req.user.id, req.validated.params.id, { name, type })
  res.json(tag)
}

async function deleteTag(req, res) {
  await tagService.deleteTag(req.user.id, req.validated.params.id)
  res.status(204).end()
}

module.exports = {
  getTags,
  createTag,
  updateTag,
  deleteTag
}
