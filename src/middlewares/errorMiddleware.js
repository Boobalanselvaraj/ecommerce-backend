const errorMiddleware = (err, req, res, next) => {

    console.log(err);

    // Prisma unique constraint
    if (err.code === "P2002") {
        return res.status(400).json({
           status : "error",
            message: "Already exists"
        });
    }

    // Prisma record not found
    if (err.code === "P2025") {
        return res.status(404).json({
           status : "error",
            message: "Record not found"
        });
    }

    // JWT invalid token
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
           status : "error",
            message: "Invalid token"
        });
    }

    // JWT expired token
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
           status : "error",
            message: "Token expired"
        });
    }

    // Multer file upload errors
    if (err.name === "MulterError") {
        return res.status(400).json({
           status : "error",
            message: err.message
        });
    }

    // Default error
    res.status(err.statusCode || 500).json({
       status : "error",
        message: err.message || "Internal server error"
    });

};

module.exports = errorMiddleware;