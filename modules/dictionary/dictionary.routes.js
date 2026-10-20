const express = require('express')
const router = express.Router()

const dictionaryController = require('./dictionary.controller')
const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const { dictionarySchemas, idParams } = require('../../validators')

router.use(auth)

router.get('/', validate(dictionarySchemas.query, 'query'), dictionaryController.getDictionaryItems)
router.post('/', validate(dictionarySchemas.create), dictionaryController.createDictionaryItem)
router.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(dictionarySchemas.update),
  dictionaryController.updateDictionaryItem
)
router.delete('/:id', validate(idParams, 'params'), dictionaryController.deleteDictionaryItem)

module.exports = router
