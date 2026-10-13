const express = require("express");
const router = express.Router();

const userController = require('./user.controller');
const auth = require('../../middlewares/auth');
const validate = require('../../middlewares/validate');
const { userSchemas } = require('../../validators')

const { imageUpload } = require('../../middlewares/upload')

router.use(auth);

router.post('/me/avatar', imageUpload.single('avatar'), userController.updateAvatar);
router.patch('/me/password', validate(userSchemas.changePassword), userController.changePassword);

module.exports = router;
