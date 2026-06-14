const express = require("express");
const router = express.Router();
const {
  register,
  login,
  logout,
  getUser,
  getOtp,
  verifyOtp,
} = require("../controllers/authController");
const { WebauthMiddleware } = require("../middlewares/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.post("/getotp", getOtp);
router.post("/verifyotp", verifyOtp);
router.post("/logout", logout);
router.get("/me", WebauthMiddleware, getUser);

module.exports = router;
