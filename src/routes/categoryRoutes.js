const express = require("express");
const router = express.Router();
const {
  createCategory,
  getAllCategories,
  getCategoryWithProducts,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const { WebauthMiddleware } = require("../middlewares/authMiddleware");
const { isSuperAdmin } = require("../middlewares/roleMiddleware");
const { upload } = require("../middlewares/uploadMiddleware");

// ─── PUBLIC ROUTES ────────────────────────────────────────────────────────────
// GET all categories (for frontend listing)
router.get("/getcategories", getAllCategories);

// GET single category with its products (when user clicks a category)
router.get("/:id/products", getCategoryWithProducts);

// ─── SUPER_ADMIN PROTECTED ROUTES ────────────────────────────────────────────
// POST create new category with image
router.post("/create",WebauthMiddleware, upload.single("image"), createCategory);

// PUT update category
router.put("/update/:id", upload.single("image"), updateCategory);

// DELETE category
router.delete("/delete/:id", deleteCategory);

module.exports = router;
