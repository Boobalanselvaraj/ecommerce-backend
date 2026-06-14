const { verifyToken } = require("../utils/token");


const { prisma: DB } = require('../config/db');


const WebauthMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.ecommerce_tocken; // <-- match the cookie name

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decodedUser = verifyToken(token);

    if (decodedUser.error) {
      return res.status(401).json({ message: decodedUser.error });
    }

    if (!decodedUser || !decodedUser.id) {
      return res.status(401).json({ message: "Invalid token." });
    }

    const foundedUser = await DB.user.findUnique({
      where: { id: decodedUser.id },
    });

    if (!foundedUser) {
      return res.status(404).json({ message: "User not found , Auth denied" });
    }

    const { password, createdAt, updatedAt,deletedAt, ...userWithoutPassword } = foundedUser;
    req.user = userWithoutPassword;
    req.token = token;
    next();
  } catch (error) {
    console.log(error);
    res.status(401).json({ message: "Unauthorized request." });
  }
};


module.exports = {
  WebauthMiddleware
};
