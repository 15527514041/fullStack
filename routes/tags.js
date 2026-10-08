const express = require('express')
const router = express.Router()

const tagController = require('../controllers/tagController')
const auth = require('../middlewares/auth')
const validate = require('../middlewares/validate')
const { tagSchemas, idParams } = require('../validators')

router.use(auth)

router.get('/', tagController.getTags)
router.post('/', validate(tagSchemas.create), tagController.createTag)
router.patch('/:id', validate(idParams, 'params'), validate(tagSchemas.update), tagController.updateTag)
router.delete('/:id', validate(idParams, 'params'), tagController.deleteTag)

module.exports = router
