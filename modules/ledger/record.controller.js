const recordService = require('./record.service')

async function getRecords(req, res) {
  res.json(await recordService.listRecords(req.user.id, req.validated.query))
}

async function getRecord(req, res) {
  const record = await recordService.getRecordById(req.validated.params.id, req.user.id)
  if (!record) {
    return res.status(404).json({ message: '账单记录不存在' })
  }
  res.json(record)
}

async function createRecord(req, res) {
  const record = await recordService.createRecord(req.user.id, req.validated.body)
  res.status(201).json(record)
}

async function updateRecord(req, res) {
  const record = await recordService.updateRecord(req.user.id, req.validated.params.id, req.validated.body)
  res.json(record)
}

async function deleteRecord(req, res) {
  await recordService.deleteRecord(req.user.id, req.validated.params.id)
  res.status(204).end()
}

module.exports = {
  getRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord
}
