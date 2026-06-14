const express = require("express");
const router = express.Router();
const {
  addCartItem,
  getCartItems,
  updateCartItemQuantity,
  removeItemFromCart,
  clearCart,
} = require("../controllers/cartController");
const { WebauthMiddleware } = require("../middlewares/authMiddleware");

router.post("/", WebauthMiddleware, addCartItem);
router.get("/", WebauthMiddleware, getCartItems);
router.patch("/:cartId", WebauthMiddleware, updateCartItemQuantity);
router.delete("/:cartId", WebauthMiddleware, removeItemFromCart);
router.delete("/", WebauthMiddleware, clearCart);

module.exports = router;
