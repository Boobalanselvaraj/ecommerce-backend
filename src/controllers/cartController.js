/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");

// ─── Add Item To Cart ────────────────────────────────────────────────────────
const addCartItem = async (req, res, next) => {
    try {
        const userId = req.user.id; // from auth middleware
        const { productId, quantity } = req.body;

        // ── Input Validation ──────────────────────────────────────────────────
        if (!productId) {
            return res.status(400).json({ status: "error", message: "productId is required." });
        }

        const parsedProductId = parseInt(productId);
        const parsedQuantity = quantity ? parseInt(quantity) : 1;

        if (isNaN(parsedProductId) || parsedProductId <= 0) {
            return res.status(400).json({ status: "error", message: "productId must be a positive integer." });
        }

        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ status: "error", message: "quantity must be a positive integer." });
        }

        // ── Product Existence & Stock Check ───────────────────────────────────
        const product = await DB.product.findUnique({
            where: { id: parsedProductId },
        });

        if (!product) {
            return res.status(404).json({ status: "error", message: "Product not found." });
        }

        if (product.availableQuantity <= 0) {
            return res.status(400).json({ status: "error", message: "Product is out of stock." });
        }

        if (parsedQuantity > product.availableQuantity) {
            return res.status(400).json({
                status: "error",
                message: `Only ${product.availableQuantity} unit(s) available in stock.`,
            });
        }

        // ── Check If Item Already Exists In Cart ──────────────────────────────
        const existingCartItem = await DB.cart.findFirst({
            where: { userId, productId: parsedProductId },
        });

        if (existingCartItem) {
            const newQuantity = existingCartItem.quantity + parsedQuantity;

            // Validate updated quantity against stock
            if (newQuantity > product.availableQuantity) {
                return res.status(400).json({
                    status: "error",
                    message: `Cannot add ${parsedQuantity} more. You already have ${existingCartItem.quantity} in cart and only ${product.availableQuantity} unit(s) are available.`,
                });
            }

            const updatedCart = await DB.cart.update({
                where: { id: existingCartItem.id },
                data: { quantity: newQuantity },
                include: { product: true },
            });

            return res.status(200).json({
                success: true,
                message: "Cart item quantity updated successfully.",
                cartItem: updatedCart,
            });
        }

        // ── Create New Cart Item ──────────────────────────────────────────────
        const newCartItem = await DB.cart.create({
            data: {
                userId,
                productId: parsedProductId,
                quantity: parsedQuantity,
            },
            include: { product: true },
        });

        return res.status(201).json({
            success: true,
            message: "Item added to cart successfully.",
            cartItem: newCartItem,
        });

    } catch (error) {
        next(error);
    }
};

// ─── Remove Item From Cart ───────────────────────────────────────────────────
const removeItemFromCart = async (req, res, next) => {
    try {
        const userId = req.user.id; // from auth middleware
        const { cartId } = req.params;

        // ── Input Validation ──────────────────────────────────────────────────
        const parsedCartId = parseInt(cartId);

        if (isNaN(parsedCartId) || parsedCartId <= 0) {
            return res.status(400).json({ status: "error", message: "Valid cartId is required in params." });
        }

        // ── Cart Item Existence & Ownership Check ─────────────────────────────
        const cartItem = await DB.cart.findUnique({
            where: { id: parsedCartId },
        });

        if (!cartItem) {
            return res.status(404).json({ status: "error", message: "Cart item not found." });
        }

        if (cartItem.userId !== userId) {
            return res.status(403).json({ status: "error", message: "You are not authorized to remove this cart item." });
        }

        // ── Delete Cart Item ──────────────────────────────────────────────────
        await DB.cart.delete({ where: { id: parsedCartId } });

        return res.status(200).json({
            status: "success",
            message: "Item removed from cart successfully.",
        });

    } catch (error) {
        next(error);
    }
};

// ─── Update Cart Item Quantity ───────────────────────────────────────────────
const updateCartItemQuantity = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { cartId } = req.params;
        const { quantity } = req.body;

        // ── Input Validation ──────────────────────────────────────────────────
        const parsedCartId = parseInt(cartId);
        const parsedQuantity = parseInt(quantity);

        if (isNaN(parsedCartId) || parsedCartId <= 0) {
            return res.status(400).json({ status: "error", message: "Valid cartId is required in params." });
        }

        if (!quantity && quantity !== 0) {
            return res.status(400).json({ status: "error", message: "quantity is required." });
        }

        if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
            return res.status(400).json({ status: "error", message: "quantity must be a positive integer." });
        }

        // ── Cart Item Existence & Ownership Check ─────────────────────────────
        const cartItem = await DB.cart.findUnique({
            where: { id: parsedCartId },
            include: { product: true },
        });

        if (!cartItem) {
            return res.status(404).json({ status: "error", message: "Cart item not found." });
        }

        if (cartItem.userId !== userId) {
            return res.status(403).json({ status: "error", message: "You are not authorized to update this cart item." });
        }

        // ── Stock Validation ──────────────────────────────────────────────────
        if (parsedQuantity > cartItem.product.availableQuantity) {
            return res.status(400).json({
                status: "error",
                message: `Only ${cartItem.product.availableQuantity} unit(s) available in stock.`,
            });
        }

        // ── Update Quantity ───────────────────────────────────────────────────
        const updatedCart = await DB.cart.update({
            where: { id: parsedCartId },
            data: { quantity: parsedQuantity },
            include: { product: true },
        });

        return res.status(200).json({
            success: true,
            message: "Cart item quantity updated successfully.",
            cartItem: updatedCart,
        });

    } catch (error) {
        next(error);
    }
};

// ─── Get Cart Items (with total) ─────────────────────────────────────────────
const getCartItems = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const cartItems = await DB.cart.findMany({
            where: { userId },
            include: {
                product: {
                    include: { images: true },
                },
            },
            orderBy: { id: "desc" },
        });

        // ── Compute Totals ────────────────────────────────────────────────────
        const cartTotal = cartItems.reduce((acc, item) => {
            return acc + item.product.price * item.quantity;
        }, 0);

        const totalItems = cartItems.reduce((acc, item) => acc + item.quantity, 0);

        return res.status(200).json({
            success: true,
            totalItems,
            cartTotal: parseFloat(cartTotal.toFixed(2)),
            cartItems,
        });

    } catch (error) {
        next(error);
    }
};

// ─── Clear Entire Cart ───────────────────────────────────────────────────────
const clearCart = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const { count } = await DB.cart.deleteMany({ where: { userId } });

        if (count === 0) {
            return res.status(400).json({ status: "error", message: "Cart is already empty." });
        }

        return res.status(200).json({
            status: "success",
            message: `Cart cleared successfully. ${count} item(s) removed.`,
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    addCartItem,
    removeItemFromCart,
    updateCartItemQuantity,
    getCartItems,
    clearCart,
};