const express = require('express');
const router = express.Router();
const { getUsers, updateUser, deleteUser } = require('../controllers/userController');
const { WebauthMiddleware } = require("../middlewares/authMiddleware");
const { isSuperAdmin } = require("../middlewares/roleMiddleware");

router.get('/viewall', WebauthMiddleware, isSuperAdmin, getUsers);
router.put("/update/:id", WebauthMiddleware, updateUser);
router.delete("/delete/:id", WebauthMiddleware, deleteUser);

module.exports = router;

