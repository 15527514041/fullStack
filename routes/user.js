const express = require("express");
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

const upload = require('../middlewares/upload')

router.use(auth);

router.post('/me/avatar', upload.single('avatar'), userController.updateAvatar);

module.exports = router;