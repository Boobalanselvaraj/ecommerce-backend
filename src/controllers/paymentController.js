const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY || "sk_test_mock");
const { prisma: DB } = require("../config/db");

// 1. Create Stripe Checkout Session for an existing PENDING order
const createCheckoutSession = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({
        status: "error",
        message: "orderId is required"
      });
    }

    const order = await DB.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        orderItems: {
          include: { product: true }
        }
      }
    });

    if (!order || order.userId !== userId) {
      return res.status(404).json({
        status: "error",
        message: "Order not found"
      });
    }

    if (order.status !== "PENDING") {
      return res.status(400).json({
        status: "error",
        message: `Payment cannot be processed. Order status is ${order.status}`
      });
    }

    // Build checkout session using dashboard-configured payment methods
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "inr", // Must be 'inr' for UPI payment method
            product_data: {
              name: `Payment for Order #${order.orderNumber}`
            },
            unit_amount: Math.round(order.totalPrice * 100) // Stripe expects subunit (paise for INR)
          },
          quantity: 1
        }
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-success?orderId=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-cancel?orderId=${order.id}`,
      metadata: {
        orderId: order.id.toString(),
        userId: userId.toString()
      }
    });

    return res.status(200).json({
      status: "success",
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    next(error);
  }
};

// 2. Stripe Webhook handler to confirm payment status change
const stripeWebhook = async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (webhookSecret && sig) {
      // Use rawBody buffer attached in app.js express.json configuration
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } else {
      // Fallback/Mock mode if stripe secret/signature is not fully configured (learning purpose)
      event = req.body;
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle successful checkouts
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderId = Number(session.metadata?.orderId);

    if (orderId) {
      try {
        await DB.order.update({
          where: { id: orderId },
          data: { status: "CONFIRMED" }
        });
        console.log(`Order ${orderId} successfully confirmed via Stripe payment.`);
      } catch (err) {
        console.error(`Error updating order ${orderId} status in webhook:`, err);
        return res.status(500).json({ error: "Database update failed" });
      }
    }
  }

  return res.status(200).json({ received: true });
};

module.exports = {
  createCheckoutSession,
  stripeWebhook
};
