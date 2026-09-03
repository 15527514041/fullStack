const express = require('express');
const router = express.Router();

const statsController = require('../controllers/stats');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/todo-per-user', statsController.getTodoPerUser)

module.exports = router;