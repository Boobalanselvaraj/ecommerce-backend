/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");

// ─── Add To Wishlist ─────────────────────────────────────────────────────────
const addToWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { productId } = req.body;

        // ── Input Validation ──────────────────────────────────────────────────
        if (!productId) {
            return res.status(400).json({ status : "error", message: "productId is required." });
        }

        const parsedProductId = parseInt(productId);

        if (isNaN(parsedProductId) || parsedProductId <= 0) {
            return res.status(400).json({ status : "error", message: "productId must be a positive integer." });
        }

        // ── Product Existence Check ───────────────────────────────────────────
        const product = await DB.product.findUnique({
            where: { id: parsedProductId },
        });

        if (!product) {
            return res.status(404).json({ status : "error", message: "Product not found." });
        }

        // ── Duplicate Wishlist Check ──────────────────────────────────────────
        const existing = await DB.wishlist.findFirst({
            where: { userId, productId: parsedProductId },
        });

        if (existing) {
            return res.status(409).json({ status : "error", message: "Product is already in your wishlist." });
        }

        // ── Create Wishlist Entry ─────────────────────────────────────────────
        const wishlistItem = await DB.wishlist.create({
            data: { userId, productId: parsedProductId },
            include: { product: { include: { images: true } } },
        });

        return res.status(201).json({
            success     : true,
            message     : "Product added to wishlist successfully.",
            wishlistItem,
        });

    } catch (error) {
        next(error);
    }
};

// ─── Remove From Wishlist ────────────────────────────────────────────────────
const removeFromWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { wishlistId } = req.params;

        // ── Input Validation ──────────────────────────────────────────────────
        const parsedWishlistId = parseInt(wishlistId);

        if (isNaN(parsedWishlistId) || parsedWishlistId <= 0) {
            return res.status(400).json({ status : "error", message: "Valid wishlistId is required in params." });
        }

        // ── Existence & Ownership Check ───────────────────────────────────────
        const wishlistItem = await DB.wishlist.findUnique({
            where: { id: parsedWishlistId },
        });

        if (!wishlistItem) {
            return res.status(404).json({ status : "error", message: "Wishlist item not found." });
        }

        if (wishlistItem.userId !== userId) {
            return res.status(403).json({ status : "error", message: "You are not authorized to remove this wishlist item." });
        }

        // ── Delete ────────────────────────────────────────────────────────────
        await DB.wishlist.delete({ where: { id: parsedWishlistId } });

        return res.status(200).json({
            status : "success",
            message: "Product removed from wishlist successfully.",
        });

    } catch (error) {
        next(error);
    }
};

// ─── Get My Wishlist ─────────────────────────────────────────────────────────
const getWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const wishlistItems = await DB.wishlist.findMany({
            where  : { userId },
            include: {
                product: {
                    include: { images: true, category: true },
                },
            },
            orderBy: { id: "desc" },
        });

        return res.status(200).json({
            success      : true,
            totalItems   : wishlistItems.length,
            wishlistItems,
        });

    } catch (error) {
        next(error);
    }
};

// ─── Clear Entire Wishlist ───────────────────────────────────────────────────
const clearWishlist = async (req, res, next) => {
    try {
        const userId = req.user.id;

        const { count } = await DB.wishlist.deleteMany({ where: { userId } });

        if (count === 0) {
            return res.status(400).json({ status : "error", message: "Wishlist is already empty." });
        }

        return res.status(200).json({
            status : "success",
            message: `Wishlist cleared successfully. ${count} item(s) removed.`,
        });

    } catch (error) {
        next(error);
    }
};

// ─── Move Wishlist Item To Cart ──────────────────────────────────────────────
const moveToCart = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { wishlistId } = req.params;

        // ── Input Validation ──────────────────────────────────────────────────
        const parsedWishlistId = parseInt(wishlistId);

        if (isNaN(parsedWishlistId) || parsedWishlistId <= 0) {
            return res.status(400).json({ status : "error", message: "Valid wishlistId is required in params." });
        }

        // ── Existence & Ownership Check ───────────────────────────────────────
        const wishlistItem = await DB.wishlist.findUnique({
            where  : { id: parsedWishlistId },
            include: { product: true },
        });

        if (!wishlistItem) {
            return res.status(404).json({ status : "error", message: "Wishlist item not found." });
        }

        if (wishlistItem.userId !== userId) {
            return res.status(403).json({ status : "error", message: "You are not authorized to move this wishlist item." });
        }

        // ── Stock Check ───────────────────────────────────────────────────────
        if (wishlistItem.product.availableQuantity <= 0) {
            return res.status(400).json({ status : "error", message: "Product is out of stock and cannot be moved to cart." });
        }

        // ── Check If Already In Cart ──────────────────────────────────────────
        const existingCartItem = await DB.cart.findFirst({
            where: { userId, productId: wishlistItem.productId },
        });

        if (existingCartItem) {
            const newQuantity = existingCartItem.quantity + 1;

            if (newQuantity > wishlistItem.product.availableQuantity) {
                return res.status(400).json({
                    status : "error",
                    message: `Cannot move to cart. You already have ${existingCartItem.quantity} in cart and only ${wishlistItem.product.availableQuantity} unit(s) are available.`,
                });
            }

            await DB.cart.update({
                where: { id: existingCartItem.id },
                data : { quantity: newQuantity },
            });
        } else {
            // ── Add To Cart ───────────────────────────────────────────────────
            await DB.cart.create({
                data: { userId, productId: wishlistItem.productId, quantity: 1 },
            });
        }

        // ── Remove From Wishlist ──────────────────────────────────────────────
        await DB.wishlist.delete({ where: { id: parsedWishlistId } });

        return res.status(200).json({
            status : "success",
            message: "Product moved from wishlist to cart successfully.",
        });

    } catch (error) {
        next(error);
    }
};

module.exports = {
    addToWishlist,
    removeFromWishlist,
    getWishlist,
    clearWishlist,
    moveToCart,
};


