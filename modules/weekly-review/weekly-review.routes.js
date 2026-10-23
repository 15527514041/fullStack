const express = require('express')
const router = express.Router()

const weeklyReviewController = require('./weekly-review.controller')
const auth = require('../../middlewares/auth')
const validate = require('../../middlewares/validate')
const { weeklyReviewSchemas, idParams } = require('../../validators')

router.use(auth)

// context 必须放在 /:id 前面,否则 Express 会把它当成 id
router.get('/context', validate(weeklyReviewSchemas.context, 'query'), weeklyReviewController.getContext)
router.get('/', validate(weeklyReviewSchemas.query, 'query'), weeklyReviewController.getWeeklyReviews)
router.get('/:id', validate(idParams, 'params'), weeklyReviewController.getWeeklyReview)
router.post('/', validate(weeklyReviewSchemas.create), weeklyReviewController.createWeeklyReview)
router.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(weeklyReviewSchemas.update),
  weeklyReviewController.updateWeeklyReview
)
router.delete(
  '/:id',
  validate(idParams, 'params'),
  weeklyReviewController.deleteWeeklyReview
)

module.exports = router
