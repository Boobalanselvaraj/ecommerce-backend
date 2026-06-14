/** @type {import("../generated/prisma").PrismaClient} */
const { prisma: DB } = require("../config/db");

// 1. Add Address
const addAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { doorNumber, street, city, landmark, country, isPrimary } = req.body;

    if (!doorNumber || !street || !city || !country) {
      return res.status(400).json({
        status: "error",
        message: "doorNumber, street, city, and country are required."
      });
    }

    // If making this address primary, unset existing primary address
    if (isPrimary === true) {
      await DB.address.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false }
      });
    }

    const newAddress = await DB.address.create({
      data: {
        doorNumber,
        street,
        city,
        landmark,
        country,
        isPrimary: isPrimary === true,
        userId
      }
    });

    return res.status(201).json({
      status: "success",
      message: "Address added successfully",
      data: newAddress
    });
  } catch (error) {
    next(error);
  }
};

// 2. Get All Addresses of User
const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addresses = await DB.address.findMany({
      where: { userId },
      orderBy: { isPrimary: "desc" }
    });

    return res.status(200).json({
      status: "success",
      data: addresses
    });
  } catch (error) {
    next(error);
  }
};

// 3. Update Address
const updateAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addressId = Number(req.params.id);
    const { doorNumber, street, city, landmark, country, isPrimary } = req.body;

    if (isNaN(addressId)) {
      return res.status(400).json({ status: "error", message: "Invalid address ID" });
    }

    const address = await DB.address.findUnique({
      where: { id: addressId }
    });

    if (!address || address.userId !== userId) {
      return res.status(404).json({ status: "error", message: "Address not found" });
    }

    if (isPrimary === true) {
      await DB.address.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false }
      });
    }

    const updated = await DB.address.update({
      where: { id: addressId },
      data: {
        doorNumber: doorNumber !== undefined ? doorNumber : address.doorNumber,
        street: street !== undefined ? street : address.street,
        city: city !== undefined ? city : address.city,
        landmark: landmark !== undefined ? landmark : address.landmark,
        country: country !== undefined ? country : address.country,
        isPrimary: isPrimary !== undefined ? isPrimary === true : address.isPrimary
      }
    });

    return res.status(200).json({
      status: "success",
      message: "Address updated successfully",
      data: updated
    });
  } catch (error) {
    next(error);
  }
};

// 4. Delete Address
const deleteAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addressId = Number(req.params.id);

    if (isNaN(addressId)) {
      return res.status(400).json({ status: "error", message: "Invalid address ID" });
    }

    const address = await DB.address.findUnique({
      where: { id: addressId }
    });

    if (!address || address.userId !== userId) {
      return res.status(404).json({ status: "error", message: "Address not found" });
    }

    await DB.address.delete({
      where: { id: addressId }
    });

    return res.status(200).json({
      status: "success",
      message: "Address deleted successfully"
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  addAddress,
  getAddresses,
  updateAddress,
  deleteAddress
};
