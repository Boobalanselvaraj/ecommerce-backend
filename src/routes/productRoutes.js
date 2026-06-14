
const express = require("express");

const router = express.Router();

const {
  createProduct,
  updateProduct,
  getProduct,
  getAllProducts,
  deleteProduct,
} = require("../controllers/productsController");

const {upload} = require("../middlewares/uploadMiddleware");

// CREATE
router.post(
  "/create",
  upload.array("images", 5),
  createProduct
);

// GET ALL
router.get("/", getAllProducts);

// GET SINGLE
router.get("/:id", getProduct);

// UPDATE
router.put(
  "/update/:id",
  upload.array("images", 5),
  updateProduct
);

// DELETE
router.delete("/delete/:id", deleteProduct);

module.exports = router;

