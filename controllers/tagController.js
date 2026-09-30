const tagService = require('../services/tagService')

async function getTags(req, res) {
  const tags = await tagService.listTags(req.user.id)
  res.json(tags)
}

async function createTag(req, res) {
  const tag = await tagService.createTag(req.user.id, req.validated.body.name)
  res.status(201).json(tag)
}

async function deleteTag(req, res) {
  await tagService.deleteTag(req.user.id, req.validated.params.id)
  res.status(204).end()
}

module.exports = {
  getTags,
  createTag,
  deleteTag
}