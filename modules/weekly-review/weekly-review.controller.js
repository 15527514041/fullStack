const weeklyReviewService = require('./weekly-review.service')

async function getContext(req, res) {
  res.json(await weeklyReviewService.getWeeklyContext(req.user.id, req.validated.query.weekStart))
}

async function getWeeklyReviews(req, res) {
  res.json(await weeklyReviewService.listWeeklyReviews(req.user.id, req.validated.query))
}

async function getWeeklyReview(req, res) {
  const record = await weeklyReviewService.getWeeklyReviewById(
    req.validated.params.id,
    req.user.id
  )
  if (!record) {
    return res.status(404).json({ message: '周复盘不存在' })
  }
  res.json(record)
}

async function createWeeklyReview(req, res) {
  res.status(201).json(
    await weeklyReviewService.createWeeklyReview(req.validated.body, req.user.id)
  )
}

async function updateWeeklyReview(req, res) {
  res.json(
    await weeklyReviewService.updateWeeklyReview(
      req.validated.params.id,
      req.user.id,
      req.validated.body
    )
  )
}

async function deleteWeeklyReview(req, res) {
  await weeklyReviewService.deleteWeeklyReview(req.validated.params.id, req.user.id)
  res.status(204).end()
}

module.exports = {
  getContext,
  getWeeklyReviews,
  getWeeklyReview,
  createWeeklyReview,
  updateWeeklyReview,
  deleteWeeklyReview
}
