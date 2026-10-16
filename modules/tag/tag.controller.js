const tagService = require('./tag.service')

async function getTags(req, res) {
  // scope 可选:不传返回所有域,管理页按分类切换时传具体域
  const { scope } = req.validated.query
  const tags = await tagService.listTags(req.user.id, { scope })
  res.json(tags)
}

async function createTag(req, res) {
  const { name, type, scope } = req.validated.body
  const tag = await tagService.createTag(req.user.id, { name, type, scope })
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
