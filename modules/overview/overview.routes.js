const express = require('express')

const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const { overviewSchemas } = require('../../validators')
const overviewController = require('./overview.controller')

const router = express.Router()

router.use(auth)
router.get('/', validate(overviewSchemas.query, 'query'), overviewController.getOverview)

module.exports = router
