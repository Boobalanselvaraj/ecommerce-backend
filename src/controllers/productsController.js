
/** @type {import("../generated/prisma").PrismaClient} */

const { prisma: DB } = require("../config/db");
const {
    uploadToCloudinary,
    deleteFromCloudinary,
} = require("../config/cloudinary");
const { verifyToken } = require("../utils/token");

// ─────────────────────────────────────────────
// CREATE PRODUCT
// ─────────────────────────────────────────────

const createProduct = async (req, res, next) => {
    try {
        const {
            name,
            price,
            description,
            availableQuantity,
            categoryId,
        } = req.body;

        // ---------------- VALIDATION ----------------

        if (
            !name ||
            !price ||
            !description ||
            !availableQuantity ||
            !categoryId
        ) {
            return res.status(400).json({
                status: "error",
                message: "All fields are required",
            });
        }

        // price validation
        if (Number(price) <= 0) {
            return res.status(400).json({
                status: "error",
                message: "Price must be greater than 0",
            });
        }

        // stock validation
        if (Number(availableQuantity) < 0) {
            return res.status(400).json({
                status: "error",
                message: "Available quantity cannot be negative",
            });
        }

        // category exists check
        const category = await DB.category.findUnique({
            where: {
                id: Number(categoryId),
            },
        });

        if (!category) {
            return res.status(404).json({
                status: "error",
                message: "Category not found",
            });
        }

        const existingProduct = await DB.product.findFirst({
            where: {
                name: name.trim(),
                categoryId: Number(categoryId),
            },
        });

        if (existingProduct) {
            return res.status(409).json({
                status: "error",
                message: "Product already exists in this category",
            });
        }

        // ---------------- IMAGE UPLOAD ----------------

        let uploadedImages = [];

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadToCloudinary(
                    file.buffer,
                    "products"
                );

                uploadedImages.push({
                    imgUrl: result.secure_url,
                });
            }
        }

        // ---------------- CREATE PRODUCT ----------------

        const product = await DB.product.create({
            data: {
                name,
                price: Number(price),
                description,
                availableQuantity: Number(availableQuantity),

                category: {
                    connect: {
                        id: Number(categoryId),
                    },
                },

                images: {
                    create: uploadedImages,
                },
            },

            include: {
                category: true,
                images: true,
            },
        });

        return res.status(201).json({
            status: "success",
            message: "Product created successfully",
            data: product,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// UPDATE PRODUCT
// ─────────────────────────────────────────────

const updateProduct = async (req, res, next) => {
    try {
        const productId = Number(req.params.id);

        const {
            name,
            price,
            description,
            availableQuantity,
            categoryId,
        } = req.body;

        // Check product exists
        const existingProduct = await DB.product.findUnique({
            where: {
                id: productId,
            },
            include: {
                images: true,
            },
        });

        if (!existingProduct) {
            return res.status(404).json({
                status: "error",
                message: "Product not found",
            });
        }

        // Validate category if provided
        if (categoryId !== undefined) {
            const category = await DB.category.findUnique({
                where: {
                    id: Number(categoryId),
                },
            });

            if (!category) {
                return res.status(404).json({
                    status: "error",
                    message: "Category not found",
                });
            }
        }

        // Validate quantity
        if (
            availableQuantity !== undefined &&
            Number(availableQuantity) < 0
        ) {
            return res.status(400).json({
                status: "error",
                message: "Quantity cannot be negative",
            });
        }

        // Upload only newly selected images
        let uploadedImages = [];

        if (req.files?.length > 0) {
            uploadedImages = await Promise.all(
                req.files.map(async (file) => {
                    const result = await uploadToCloudinary(
                        file.buffer,
                        "products"
                    );

                    return {
                        imgUrl: result.secure_url,
                    };
                })
            );
        }

        const updateData = {};

        if (name !== undefined) {
            updateData.name = name;
        }

        if (price !== undefined) {
            updateData.price = Number(price);
        }

        if (description !== undefined) {
            updateData.description = description;
        }

        if (availableQuantity !== undefined) {
            updateData.availableQuantity = Number(
                availableQuantity
            );
        }

        if (categoryId !== undefined) {
            updateData.category = {
                connect: {
                    id: Number(categoryId),
                },
            };
        }

        if (uploadedImages.length > 0) {
            updateData.images = {
                create: uploadedImages,
            };
        }

        const updatedProduct = await DB.product.update({
            where: {
                id: productId,
            },
            data: updateData,
            include: {
                category: true,
                images: true,
            },
        });

        return res.status(200).json({
            status: "success",
            message: "Product updated successfully",
            data: updatedProduct,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// GET SINGLE PRODUCT
// ─────────────────────────────────────────────

const getProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await DB.product.findUnique({
            where: {
                id: Number(id),
            },

            include: {
                category: true,
                images: true,
            },
        });

        if (!product) {
            return res.status(404).json({
                status: "error",
                message: "Product not found",
            });
        }

        // Check user auth token to set isInCart and isInWishlist flags
        const token = req.cookies?.ecommerce_tocken;
        let isInCart = false;
        let isInWishlist = false;

        if (token) {
            const decodedUser = verifyToken(token);
            if (decodedUser && !decodedUser.error && decodedUser.id) {
                const userId = decodedUser.id;
                
                const cartItem = await DB.cart.findFirst({
                    where: {
                        userId,
                        productId: Number(id),
                    },
                });
                isInCart = !!cartItem;

                const wishlistItem = await DB.wishlist.findFirst({
                    where: {
                        userId,
                        productId: Number(id),
                    },
                });
                isInWishlist = !!wishlistItem;
            }
        }

        const productWithFlags = {
            ...product,
            isInCart,
            isInWishlist,
        };

        return res.status(200).json({
            status: "success",
            data: productWithFlags,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// GET ALL PRODUCTS (with Search, Filters, Sorting & Pagination)
// ─────────────────────────────────────────────

const getAllProducts = async (req, res, next) => {
    try {
        const {
            search,
            categoryId,
            minPrice,
            maxPrice,
            rating,
            sortBy = "id",
            order = "desc",
            page = 1,
            limit = 10
        } = req.query;

        // Build where filter
        const where = {};

        if (search) {
            where.OR = [
                { name: { contains: search } },
                { description: { contains: search } }
            ];
        }

        if (categoryId) {
            where.categoryId = Number(categoryId);
        }

        if (minPrice !== undefined || maxPrice !== undefined) {
            where.price = {};
            if (minPrice !== undefined) {
                where.price.gte = Number(minPrice);
            }
            if (maxPrice !== undefined) {
                where.price.lte = Number(maxPrice);
            }
        }

        if (rating !== undefined) {
            where.review = {
                gte: Number(rating)
            };
        }

        // Validate sorting
        const allowedSortFields = ["id", "price", "review", "name"];
        const sortField = allowedSortFields.includes(sortBy) ? sortBy : "id";
        const sortOrder = ["asc", "desc"].includes(order.toLowerCase()) ? order.toLowerCase() : "desc";

        // Pagination calculations
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Fetch products and total count in parallel
        const [products, totalCount] = await Promise.all([
            DB.product.findMany({
                where,
                include: {
                    category: true,
                    images: true,
                },
                orderBy: {
                    [sortField]: sortOrder,
                },
                skip,
                take: limitNum,
            }),
            DB.product.count({ where })
        ]);

        // Check user auth token to set isInCart and isInWishlist flags
        const token = req.cookies?.ecommerce_tocken;
        let cartProductIds = new Set();
        let wishlistProductIds = new Set();

        if (token) {
            const decodedUser = verifyToken(token);
            if (decodedUser && !decodedUser.error && decodedUser.id) {
                const userId = decodedUser.id;

                const userCart = await DB.cart.findMany({
                    where: { userId },
                    select: { productId: true },
                });
                cartProductIds = new Set(userCart.map((item) => item.productId));

                const userWishlist = await DB.wishlist.findMany({
                    where: { userId },
                    select: { productId: true },
                });
                wishlistProductIds = new Set(userWishlist.map((item) => item.productId));
            }
        }

        const productsWithFlags = products.map((product) => ({
            ...product,
            isInCart: cartProductIds.has(product.id),
            isInWishlist: wishlistProductIds.has(product.id),
        }));

        return res.status(200).json({
            status: "success",
            pagination: {
                totalItems: totalCount,
                totalPages: Math.ceil(totalCount / limitNum),
                currentPage: pageNum,
                limit: limitNum
            },
            count: productsWithFlags.length,
            data: productsWithFlags,
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// DELETE PRODUCT
// ─────────────────────────────────────────────

const deleteProduct = async (req, res, next) => {
    try {
        const { id } = req.params;

        const product = await DB.product.findUnique({
            where: {
                id: Number(id),
            },

            include: {
                images: true,
            },
        });

        if (!product) {
            return res.status(404).json({
                status: "error",
                message: "Product not found",
            });
        }

        // delete images from cloudinary
        for (const image of product.images) {
            await deleteFromCloudinary(image.imgUrl);
        }

        // delete image records
        await DB.productImg.deleteMany({
            where: {
                ProductId: Number(id),
            },
        });

        // delete product
        await DB.product.delete({
            where: {
                id: Number(id),
            },
        });

        return res.status(200).json({
            status: "success",
            message: "Product deleted successfully",
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createProduct,
    updateProduct,
    getProduct,
    getAllProducts,
    deleteProduct,
};

