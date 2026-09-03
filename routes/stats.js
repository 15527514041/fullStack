const express = require('express');
const router = express.Router();

const statsController = require('../controllers/statsController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/todos-per-user', statsController.getTodoPerUser)

module.exports = router;