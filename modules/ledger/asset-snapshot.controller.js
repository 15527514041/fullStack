const assetSnapshotService = require('./asset-snapshot.service')

async function getPreview(req, res) {
  const preview = await assetSnapshotService.getPreview(req.user.id)
  res.json(preview)
}

async function createSnapshot(req, res) {
  const snapshot = await assetSnapshotService.createSnapshot(req.user.id, req.validated.body)
  res.status(201).json(snapshot)
}

async function listSnapshots(req, res) {
  const snapshots = await assetSnapshotService.listSnapshots(req.user.id)
  res.json(snapshots)
}

async function getSnapshot(req, res) {
  const snapshot = await assetSnapshotService.getSnapshot(
    req.user.id,
    req.validated.params.id
  )
  res.json(snapshot)
}

async function deleteSnapshot(req, res) {
  await assetSnapshotService.deleteSnapshot(req.user.id, req.validated.params.id)
  res.status(204).end()
}

async function compareSnapshots(req, res) {
  const { fromId, toId } = req.validated.query
  const comparison = await assetSnapshotService.compareSnapshots(req.user.id, fromId, toId)
  res.json(comparison)
}

module.exports = {
  getPreview,
  createSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  compareSnapshots
}
