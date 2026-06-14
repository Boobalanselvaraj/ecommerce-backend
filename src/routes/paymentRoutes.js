const express = require("express");
const router = express.Router();
const {
  createCheckoutSession,
  stripeWebhook
} = require("../controllers/paymentController");
const { WebauthMiddleware } = require("../middlewares/authMiddleware");

router.post("/checkout-session", WebauthMiddleware, createCheckoutSession);
// Stripe webhook needs raw body parser, so signature verification works.
// We register this as a public endpoint.
router.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

module.exports = router;
