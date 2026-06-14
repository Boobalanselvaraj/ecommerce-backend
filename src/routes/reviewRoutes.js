const express = require("express");
const router = express.Router();
const {
  addReview,
  getProductReviews,
  deleteReview
} = require("../controllers/reviewController");
const { WebauthMiddleware } = require("../middlewares/authMiddleware");

router.post("/", WebauthMiddleware, addReview);
router.get("/product/:productId", getProductReviews);
router.delete("/:id", WebauthMiddleware, deleteReview);

module.exports = router;
