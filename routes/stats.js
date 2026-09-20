const express = require('express');
const router = express.Router();

const statsController = require('../controllers/statsController');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

router.use(auth, requireRole('ADMIN'));

router.get('/todos-per-user', statsController.getTodosPerUser);

module.exports = router;