const express = require('express');
const router = express.Router();

const statsController = require('../controllers/statsController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/todos-per-user', statsController.getTodosPerUser);

module.exports = router;