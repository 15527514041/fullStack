const dictionaryService = require('./dictionary.service')

async function getDictionaryItems(req, res) {
  const { kind } = req.validated.query
  const items = await dictionaryService.listDictionaryItems(req.user.id, kind)
  res.json(items)
}

async function createDictionaryItem(req, res) {
  const item = await dictionaryService.createDictionaryItem(req.user.id, req.validated.body)
  res.status(201).json(item)
}

async function updateDictionaryItem(req, res) {
  const item = await dictionaryService.updateDictionaryItem(
    req.user.id,
    req.validated.params.id,
    req.validated.body
  )
  res.json(item)
}

async function deleteDictionaryItem(req, res) {
  await dictionaryService.deleteDictionaryItem(req.user.id, req.validated.params.id)
  res.status(204).end()
}

module.exports = {
  getDictionaryItems,
  createDictionaryItem,
  updateDictionaryItem,
  deleteDictionaryItem
}
