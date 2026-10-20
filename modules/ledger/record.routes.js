const express = require('express')
const router = express.Router()

const recordController = require('./record.controller')
const validate = require('../../middlewares/validate')
const { recordSchemas, idParams } = require('../../validators')

router.get('/', validate(recordSchemas.query, 'query'), recordController.getRecords)
router.get('/:id', validate(idParams, 'params'), recordController.getRecord)
router.post('/', validate(recordSchemas.create), recordController.createRecord)
router.patch('/:id', validate(idParams, 'params'), validate(recordSchemas.update), recordController.updateRecord)
router.delete('/:id', validate(idParams, 'params'), recordController.deleteRecord)

module.exports = router
