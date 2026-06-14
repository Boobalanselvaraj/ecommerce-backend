const express = require('express');
const router = express.Router();
const { addToWishlist, getWishlist, clearWishlist, removeFromWishlist, moveToCart } = require("../controllers/wishlistController");
const { WebauthMiddleware } = require("../middlewares/authMiddleware");

router.post("/", WebauthMiddleware, addToWishlist);
router.get("/", WebauthMiddleware, getWishlist);
router.delete("/", WebauthMiddleware, clearWishlist);
router.delete("/:wishlistId", WebauthMiddleware, removeFromWishlist);
router.post("/:wishlistId/move-to-cart", WebauthMiddleware, moveToCart);

module.exports = router;