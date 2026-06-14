/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");
const { hashPassword } = require("../utils/password");

// /viewall
const getUsers = async (req, res) => {
  try {
    const users = await DB.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });
    res.status(200).json({
      status: "success",
      message: "Users Fetched Successfully",
      data: users,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//  /update/:id
const updateUser = async (req, res) => {
  try {
    const { mobile, name, username, password, email } = req.body;
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user id"
      });
    }

    // Authorization check: Only user themself or SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN" && req.user.id !== id) {
      return res.status(403).json({
        status: "error",
        message: "You can only update your own profile."
      });
    }

    const existingUser = await DB.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found for provided user id"
      });
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) {
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(String(email))) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      updateData.email = email;
    }
    if (mobile) {
      if (String(mobile).length !== 10 || !/^\d{10}$/.test(String(mobile))) {
        return res.status(400).json({ message: "Mobile number must be exactly 10 digits" });
      }
      updateData.mobile = mobile;
    }
    if (username) updateData.username = username;
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long" });
      }
      updateData.password = await hashPassword(String(password));
    }

    const updatedUser = await DB.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        username: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    });

    return res.status(200).json({
      status: "success",
      message: "User profile updated successfully",
      data: updatedUser
    });
  } catch (err) {
    console.error("updateUser error:", err);
    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

//   /delete/:id
const deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid user id"
      });
    }

    // Authorization check: Only user themself or SUPER_ADMIN
    if (req.user.role !== "SUPER_ADMIN" && req.user.id !== id) {
      return res.status(403).json({
        status: "error",
        message: "You can only delete your own profile."
      });
    }

    const existingUser = await DB.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found for provided user id"
      });
    }

    await DB.user.delete({
      where: { id }
    });

    return res.status(200).json({
      status: "success",
      message: "User deleted successfully"
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      status: "error",
      message: "Internal server error"
    });
  }
};

module.exports = { getUsers, updateUser, deleteUser };
