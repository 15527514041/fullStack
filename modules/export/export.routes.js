const express = require('express')
const router = express.Router()

const exportController = require('./export.controller')
const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const { todoSchemas, planSchemas, reflectionSchemas } = require('../../validators')

router.use(auth)

router.get('/todos', validate(todoSchemas.exportQuery, 'query'), exportController.todos)
router.get('/plans', validate(planSchemas.exportQuery, 'query'), exportController.plans)
router.get(
  '/reflections',
  validate(reflectionSchemas.exportQuery, 'query'),
  exportController.reflections
)

module.exports = router
