/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary");

// ─── CREATE CATEGORY (SUPER_ADMIN only) ───────────────────────────────────────
const createCategory = async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name) {
            return res.status(400).json({
                status : "error",
                message: "Category name is required"
            });
        }

        // CHECK DUPLICATE BEFORE IMAGE UPLOAD
        const existingCategory = await DB.category.findUnique({
            where: {
                name
            }
        });

        if (existingCategory) {
            return res.status(400).json({
                status : "error",
                message: "Category already exists"
            });
        }

        let imageUrl = null;

        // Upload image only after validation
        if (req.file) {
            const result = await uploadToCloudinary(
                req.file.buffer,
                "categories"
            );

            imageUrl = result.secure_url;
        }

        const category = await DB.category.create({
            data: {
                name,
                image: imageUrl,
                userId: req.user.id,
            },
        });

        return res.status(201).json({
            status : "success",
            message: "Category created successfully",
            data: category,
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            status : "error",
            message: "Internal server error"
        });
    }
};

// ─── GET ALL CATEGORIES (Public - for frontend listing) ───────────────────────
const getAllCategories = async (req, res) => {
    try {
        const categories = await DB.category.findMany({
            select: {
                id: true,
                name: true,
                image: true,
                createdAt: true,
                _count: {
                    select: { products: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        return res.status(200).json({
            status : "success",
            message: "Categories fetched successfully",
            data: categories,
        });
    } catch (error) {
        console.error("getAllCategories error:", error);
        return res.status(500).json({ status : "error", message: "Internal server error" });
    }
};

// ─── GET SINGLE CATEGORY WITH PRODUCTS (when user selects a category) ─────────
const getCategoryWithProducts = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await DB.category.findUnique({
            where: { id: parseInt(id) },
            include: {
                products: {
                    where: { availableQuantity: { gt: 0 } }, // only in-stock products
                    include: {
                        images: {
                            take: 1, // first image as thumbnail
                            select: { imgUrl: true },
                        },
                    },
                    orderBy: { id: "desc" },
                },
            },
        });

        if (!category) {
            return res.status(404).json({ status : "error", message: "Category not found" });
        }

        return res.status(200).json({
            status : "success",
            message: "Category with products fetched successfully",
            data: category,
        });
    } catch (error) {
        console.error("getCategoryWithProducts error:", error);
        return res.status(500).json({ status : "error", message: "Internal server error" });
    }
};

// ─── UPDATE CATEGORY (SUPER_ADMIN only) ───────────────────────────────────────
const updateCategory = async (req, res,next) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        const existing = await DB.category.findUnique({ where: { id: parseInt(id) } });
        if (!existing) {
            return res.status(404).json({ status : "error", message: "Category not found" });
        }

        let imageUrl = existing.image;

        // If a new image is uploaded, replace old one on Cloudinary
        if (req.file) {
            // Delete old image from Cloudinary if exists
            if (existing.image) {
                const publicId = existing.image.split("/").pop().split(".")[0];
                await deleteFromCloudinary(`categories/${publicId}`);
            }
            const result = await uploadToCloudinary(req.file.buffer, "categories");
            imageUrl = result.secure_url;
        }

        const updated = await DB.category.update({
            where: { id: parseInt(id) },
            data: {
                name: name || existing.name,
                image: imageUrl,
            },
        });

        return res.status(200).json({
            status : "success",
            message: "Category updated successfully",
            data: updated,
        });
    } catch (error) {
        next(error)
    }
};

// ─── DELETE CATEGORY (SUPER_ADMIN only) ───────────────────────────────────────
const deleteCategory = async (req, res, next) => {
    try {
        const { id } = req.params;

        const existing = await DB.category.findUnique({
            where: { id: parseInt(id) },
            include: { _count: { select: { products: true } } },
        });

        if (!existing) {
            return res.status(404).json({ status : "error", message: "Category not found" });
        }

        // Prevent deletion if products exist under this category
        if (existing._count.products > 0) {
            return res.status(400).json({
                status : "error",
                message: `Cannot delete category. It has ${existing._count.products} product(s) linked to it.`,
            });
        }

        // Delete image from Cloudinary if exists
        if (existing.image) {
            const publicId = existing.image.split("/").pop().split(".")[0];
            await deleteFromCloudinary(`categories/${publicId}`);
        }

        await DB.category.delete({ where: { id: parseInt(id) } });

        return res.status(200).json({
            status : "success",
            message: "Category deleted successfully",
        });
    } catch (error) {
        next(error)
    }
};

module.exports = {
    createCategory,
    getAllCategories,
    getCategoryWithProducts,
    updateCategory,
    deleteCategory,
};
