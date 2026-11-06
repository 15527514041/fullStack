const express = require('express')
const router = express.Router()

const assetSnapshotController = require('./asset-snapshot.controller')
const validate = require('../../middlewares/validate')
const { assetSnapshotSchemas, idParams } = require('../../validators')

// 固定路径要放在 /:id 前面,避免 preview/compare 被当成 ID
router.get('/preview', assetSnapshotController.getPreview)
router.get(
  '/compare',
  validate(assetSnapshotSchemas.compare, 'query'),
  assetSnapshotController.compareSnapshots
)
router.get('/', assetSnapshotController.listSnapshots)
router.post(
  '/',
  validate(assetSnapshotSchemas.create),
  assetSnapshotController.createSnapshot
)
router.get(
  '/:id',
  validate(idParams, 'params'),
  assetSnapshotController.getSnapshot
)

module.exports = router
