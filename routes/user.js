const express = require("express");
const router = express.Router();

const userController = require('../controllers/userController');
const auth = require('../middlewares/auth');

const { imageUpload } = require('../middlewares/upload')

router.use(auth);

router.post('/me/avatar', imageUpload.single('avatar'), userController.updateAvatar);

module.exports = router;
