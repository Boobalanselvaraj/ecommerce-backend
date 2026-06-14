/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");

// ─────────────────────────────────────────────
// Helper: generate a unique order number
// ─────────────────────────────────────────────
function generateOrderNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

// ─────────────────────────────────────────────
// Valid status transition map
// ─────────────────────────────────────────────
const VALID_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELED"],
  CONFIRMED: ["SHIPPED", "CANCELED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: [],   // terminal
  CANCELED: [],    // terminal
};

// ─────────────────────────────────────────────
// 1. Place Order  (from cart)
//    POST /orders
// ─────────────────────────────────────────────
const placeOrder = async (req, res) => {
  const userId = req.user.id; // set by auth middleware

  try {
    const { productId, quantity = 1 } = req.body;

    // Direct "Buy Now" flow
    if (productId !== undefined) {
      const prodId = parseInt(productId);
      const qty = parseInt(quantity);

      if (isNaN(prodId) || prodId <= 0) {
        return res.status(400).json({ message: "Invalid product ID." });
      }
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: "Quantity must be a positive integer." });
      }

      const product = await DB.product.findUnique({
        where: { id: prodId },
      });

      if (!product) {
        return res.status(404).json({ message: `Product with id ${prodId} not found.` });
      }

      if (product.availableQuantity < qty) {
        return res.status(422).json({
          message: "Insufficient stock.",
          insufficientStock: [
            {
              productId: prodId,
              productName: product.name,
              requested: qty,
              available: product.availableQuantity,
            },
          ],
        });
      }

      const totalPrice = product.price * qty;

      const order = await DB.$transaction(async (tx) => {
        // Decrement stock for the product
        await tx.product.update({
          where: { id: prodId },
          data: { availableQuantity: { decrement: qty } },
        });

        // Create the order + order items
        const newOrder = await tx.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            totalPrice,
            userId,
            orderItems: {
              create: [
                {
                  productId: prodId,
                  quantity: qty,
                  price: product.price,
                },
              ],
            },
          },
          include: { orderItems: true },
        });

        return newOrder;
      });

      return res.status(201).json({
        message: "Order placed successfully.",
        order,
      });
    }

    // Standard checkout from cart flow
    // 1a. Fetch cart items with product details
    const cartItems = await DB.cart.findMany({
      where: { userId },
      include: {
        product: true,
      },
    });

    if (!cartItems.length) {
      return res.status(400).json({ message: "Cart is empty." });
    }

    // 1b. Validate stock & calculate total
    const insufficientStock = [];
    let totalPrice = 0;

    for (const item of cartItems) {
      if (!item.product) {
        return res.status(404).json({
          message: `Product with id ${item.productId} no longer exists.`,
        });
      }

      if (item.product.availableQuantity < item.quantity) {
        insufficientStock.push({
          productId: item.productId,
          productName: item.product.name,
          requested: item.quantity,
          available: item.product.availableQuantity,
        });
      }

      totalPrice += item.product.price * item.quantity;
    }

    if (insufficientStock.length) {
      return res.status(422).json({
        message: "Some items are out of stock.",
        insufficientStock,
      });
    }

    // 1c. All-or-nothing transaction
    const order = await DB.$transaction(async (tx) => {
      // Decrement stock for each product
      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { availableQuantity: { decrement: item.quantity } },
        });
      }

      // Create the order + order items
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          totalPrice,
          userId,
          orderItems: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
            })),
          },
        },
        include: { orderItems: true },
      });

      // Clear the cart
      await tx.cart.deleteMany({ where: { userId } });

      return newOrder;
    });

    return res.status(201).json({
      message: "Order placed successfully.",
      order,
    });
  } catch (err) {
    console.error("placeOrder error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// 2. Get All Orders  (admin: all | user: own)
//    GET /orders
// ─────────────────────────────────────────────
const getAllOrders = async (req, res) => {
  const { role, id: userId } = req.user;
  const {
    page = 1,
    limit = 10,
    status,
    sortBy = "orderedAt",
    order = "desc",
  } = req.query;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const ALLOWED_SORT = ["orderedAt", "totalPrice", "status"];
  const ALLOWED_ORDER = ["asc", "desc"];

  if (!ALLOWED_SORT.includes(sortBy)) {
    return res.status(400).json({ message: `Invalid sortBy. Allowed: ${ALLOWED_SORT.join(", ")}` });
  }
  if (!ALLOWED_ORDER.includes(order)) {
    return res.status(400).json({ message: "Invalid order. Use 'asc' or 'desc'." });
  }

  const where = {};
  if (role !== "SUPER_ADMIN") where.userId = userId;
  if (status) {
    const validStatuses = ["PENDING", "CONFIRMED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELED"];
    if (!validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${validStatuses.join(", ")}` });
    }
    where.status = status.toUpperCase();
  }

  try {
    const [orders, total] = await Promise.all([
      DB.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { [sortBy]: order },
        include: {
          orderItems: {
            include: { product: { include: { images: true } } },
          },
          user: role === "SUPER_ADMIN"
            ? { select: { id: true, name: true, email: true, mobile: true } }
            : false,
        },
      }),
      DB.order.count({ where }),
    ]);

    return res.status(200).json({
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
      orders,
    });
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// 3. Get Single Order
//    GET /orders/:id
// ─────────────────────────────────────────────
const getOrderById = async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const orderId = parseInt(id);
  if (isNaN(orderId)) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  try {
    const order = await DB.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: {
          include: { product: { include: { images: true } } },
        },
        user: { select: { id: true, name: true, email: true, mobile: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Non-admin can only see own orders
    if (role !== "SUPER_ADMIN" && order.userId !== userId) {
      return res.status(403).json({ message: "Access denied." });
    }

    return res.status(200).json({ order });
  } catch (err) {
    console.error("getOrderById error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// 4. Update Order Status  (admin only)
//    PATCH /orders/:id/status
// ─────────────────────────────────────────────
const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const orderId = parseInt(id);
  if (isNaN(orderId)) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  if (!status) {
    return res.status(400).json({ message: "Status is required." });
  }

  const newStatus = status.toUpperCase();
  const validStatuses = Object.keys(VALID_TRANSITIONS);
  if (!validStatuses.includes(newStatus)) {
    return res.status(400).json({
      message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
    });
  }

  try {
    const order = await DB.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const allowedNext = VALID_TRANSITIONS[order.status];
    if (!allowedNext.includes(newStatus)) {
      return res.status(422).json({
        message: `Cannot transition from ${order.status} to ${newStatus}. Allowed: [${allowedNext.join(", ") || "none"}]`,
      });
    }

    const updateData = { status: newStatus };
    if (newStatus === "DELIVERED") updateData.deliveredAt = new Date();

    const updated = await DB.order.update({
      where: { id: orderId },
      data: updateData,
      include: { orderItems: true },
    });

    return res.status(200).json({
      message: `Order status updated to ${newStatus}.`,
      order: updated,
    });
  } catch (err) {
    console.error("updateOrderStatus error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// 5. Cancel Order  (user: own PENDING/CONFIRMED | admin: any cancelable)
//    PATCH /orders/:id/cancel
// ─────────────────────────────────────────────
const cancelOrder = async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  const orderId = parseInt(id);
  if (isNaN(orderId)) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  try {
    const order = await DB.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    // Ownership check for regular users
    if (role !== "SUPER_ADMIN" && order.userId !== userId) {
      return res.status(403).json({ message: "Access denied." });
    }

    // Users can only cancel PENDING or CONFIRMED
    if (role !== "SUPER_ADMIN" && !["PENDING", "CONFIRMED"].includes(order.status)) {
      return res.status(422).json({
        message: `You can only cancel orders that are PENDING or CONFIRMED. Current status: ${order.status}`,
      });
    }

    // Even admin cannot cancel terminal orders
    if (["DELIVERED", "CANCELED"].includes(order.status)) {
      return res.status(422).json({
        message: `Order is already ${order.status} and cannot be canceled.`,
      });
    }

    // Restore stock and cancel in one transaction
    await DB.$transaction(async (tx) => {
      for (const item of order.orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { availableQuantity: { increment: item.quantity } },
        });
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: "CANCELED" },
      });
    });

    return res.status(200).json({ message: "Order canceled and stock restored." });
  } catch (err) {
    console.error("cancelOrder error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// 6. Delete Order  (admin only — soft approach: only CANCELED orders)
//    DELETE /orders/:id
// ─────────────────────────────────────────────
const deleteOrder = async (req, res) => {
  const { id } = req.params;

  const orderId = parseInt(id);
  if (isNaN(orderId)) {
    return res.status(400).json({ message: "Invalid order ID." });
  }

  try {
    const order = await DB.order.findUnique({ where: { id: orderId } });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    if (order.status !== "CANCELED") {
      return res.status(422).json({
        message: "Only CANCELED orders can be deleted.",
      });
    }

    // Delete order items first (FK constraint), then the order
    await DB.$transaction([
      DB.orderItem.deleteMany({ where: { orderId } }),
      DB.order.delete({ where: { id: orderId } }),
    ]);

    return res.status(200).json({ message: "Order deleted successfully." });
  } catch (err) {
    console.error("deleteOrder error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────
// 7. Get Order Summary / Stats  (admin only)
//    GET /orders/stats
// ─────────────────────────────────────────────
const getOrderStats = async (req, res) => {
  try {
    const [statusGroups, revenue] = await Promise.all([
      DB.order.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      DB.order.aggregate({
        where: { status: "DELIVERED" },
        _sum: { totalPrice: true },
        _avg: { totalPrice: true },
        _count: { id: true },
      }),
    ]);

    const byStatus = {};
    for (const g of statusGroups) {
      byStatus[g.status] = g._count.id;
    }

    return res.status(200).json({
      byStatus,
      revenue: {
        total: revenue._sum.totalPrice ?? 0,
        average: revenue._avg.totalPrice ?? 0,
        deliveredOrders: revenue._count.id,
      },
    });
  } catch (err) {
    console.error("getOrderStats error:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  placeOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  deleteOrder,
  getOrderStats,
};
