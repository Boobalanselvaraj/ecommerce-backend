const express = require("express");
const router = express.Router();
const {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress
} = require("../controllers/addressController");
const { WebauthMiddleware } = require("../middlewares/authMiddleware");

router.post("/", WebauthMiddleware, addAddress);
router.get("/", WebauthMiddleware, getAddresses);
router.put("/:id", WebauthMiddleware, updateAddress);
router.delete("/:id", WebauthMiddleware, deleteAddress);

module.exports = router;
