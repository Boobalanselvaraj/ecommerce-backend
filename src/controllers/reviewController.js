/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");

// Helper to recalculate and update product average rating
const updateProductAverageRating = async (productId) => {
  const stats = await DB.review.aggregate({
    where: { productId },
    _avg: { rating: true }
  });
  await DB.product.update({
    where: { id: productId },
    data: { review: stats._avg.rating ? parseFloat(stats._avg.rating.toFixed(2)) : null }
  });
};

// 1. Add / Update Review (Upsert style)
const addReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { productId, rating, comment } = req.body;

    if (!productId || !rating) {
      return res.status(400).json({
        status: "error",
        message: "productId and rating are required."
      });
    }

    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        status: "error",
        message: "Rating must be an integer between 1 and 5."
      });
    }

    const product = await DB.product.findUnique({
      where: { id: Number(productId) }
    });

    if (!product) {
      return res.status(404).json({
        status: "error",
        message: "Product not found."
      });
    }

    // Upsert review
    const review = await DB.review.upsert({
      where: {
        userId_productId: {
          userId,
          productId: Number(productId)
        }
      },
      update: {
        rating: ratingNum,
        comment: comment !== undefined ? comment : null
      },
      create: {
        userId,
        productId: Number(productId),
        rating: ratingNum,
        comment
      }
    });

    // Update average rating
    await updateProductAverageRating(Number(productId));

    return res.status(200).json({
      status: "success",
      message: "Review submitted successfully",
      data: review
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get Product Reviews
const getProductReviews = async (req, res, next) => {
  try {
    const productId = Number(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid product ID"
      });
    }

    const reviews = await DB.review.findMany({
      where: { productId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return res.status(200).json({
      status: "success",
      data: reviews
    });
  } catch (error) {
    next(error);
  }
};

// 3. Delete Review
const deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const reviewId = Number(req.params.id);

    if (isNaN(reviewId)) {
      return res.status(400).json({ status: "error", message: "Invalid review ID" });
    }

    const review = await DB.review.findUnique({
      where: { id: reviewId }
    });

    if (!review) {
      return res.status(404).json({ status: "error", message: "Review not found" });
    }

    // Authorization: writer of review or super admin
    if (review.userId !== userId && userRole !== "SUPER_ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "You are not authorized to delete this review."
      });
    }

    await DB.review.delete({
      where: { id: reviewId }
    });

    // Recalculate average rating
    await updateProductAverageRating(review.productId);

    return res.status(200).json({
      status: "success",
      message: "Review deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addReview,
  getProductReviews,
  deleteReview
};
