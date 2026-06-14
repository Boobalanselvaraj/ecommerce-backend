var express = require('express');
var router = express.Router();

const {
    placeOrder,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder,
    deleteOrder,
    getOrderStats,
} = require('../controllers/orderController');

const { WebauthMiddleware } = require('../middlewares/authMiddleware');
const { isSuperAdmin } = require("../middlewares/roleMiddleware")

// ── Stats (admin) — must be before /:id to avoid param conflict ──
router.get("/stats", WebauthMiddleware, isSuperAdmin, getOrderStats);

// ── User routes ──
router.post("/", WebauthMiddleware, placeOrder);
router.get("/", WebauthMiddleware, getAllOrders);
router.get("/:id", WebauthMiddleware, getOrderById);
router.patch("/:id/cancel", WebauthMiddleware, cancelOrder);

// ── Admin-only routes ──
router.patch("/:id/status", WebauthMiddleware, isSuperAdmin, updateOrderStatus);
router.delete("/:id", WebauthMiddleware, isSuperAdmin, deleteOrder);

module.exports = router;
