const { hashPassword, verifyPassword } = require("../utils/password");
const { prisma: DB } = require("../config/db");
const { generateToken, setAuthTokenCookie } = require("../utils/token");
const { generateOtp, verifyOtp: verifyOtpUtil } = require("../utils/otp");

//  /register
const register = async (req, res) => {
  try {
    const { name, email, mobile, username, password } = req.body;

    if (!name || !email || !mobile || !username || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    if (!emailRegex.test(String(email))) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (String(mobile).length !== 10 || !/^\d{10}$/.test(String(mobile))) {
      return res
        .status(400)
        .json({ message: "Mobile number must be exactly 10 digits" });
    }

    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    const existingUser = await DB.user.findFirst({
      where: {
        OR: [{ email }, { username }, { mobile }],
      },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists with given email, username or mobile",
      });
    }

    const hashedPassword = await hashPassword(String(password));

    const newUser = await DB.user.create({
      data: {
        name: String(name),
        email: String(email),
        mobile: String(mobile),
        username: String(username),
        password: hashedPassword,
      },
    });
    const { password: _, ...WithoutPassword } = newUser;
    res.status(201).json({
      message: "User registered successfully",
      user: WithoutPassword,
    });
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//  /login
const login = async (req, res) => {
  try {
    // Check if the user is already logged in by looking for the auth token cookie
    if (req.cookies && req.cookies.ecommerce_tocken) {
      return res.status(400).json({ message: "You are already logged in" });
    }

    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const user = await DB.user.findFirst({
      where: {
        username: String(username),
      },
    });

    if (!user) {
      // Edge case: User does not exist in the database
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await verifyPassword(String(password), user.password);
    if (!isMatch) {
      // Edge case: Password provided does not match the database record
      return res.status(401).json({ message: "Incorrect password" });
    }

    const token = generateToken({ id: user.id, role: user.role });

    // Match the cookie name in authMiddleware -> ecommerce_tocken
    setAuthTokenCookie(res, "ecommerce_tocken", token);

    res.status(200).json({
      message: "Logged in successfully",
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//  /getotp
const getOtp = async (req, res) => {
  try {
    const { mobile } = req.body;

    // Validate mobile
    if (!mobile) {
      return res.status(400).json({
        status: "error",
        message: "Mobile number is required",
      });
    }

    // Find user
    const existingUser = await DB.user.findUnique({
      where: {
        mobile,
      },
    });

    // User not found
    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "User not registered",
      });
    }

    // Generate OTP
    const otp = generateOtp();

    // Expiry time (2 minutes)
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    // Store OTP using upsert
    await DB.otp.upsert({
      where: {
        userId: existingUser.id,
      },
      update: {
        otp,
        expiresAt,
        attempts: 0,
      },
      create: {
        userId: existingUser.id,
        otp,
        expiresAt,
      },
    });

    // Send response
    return res.status(200).json({
      status: "success",
      message: "OTP generated successfully",
      otp, // remove this in production
    });
  } catch (error) {
    console.error("Get OTP Error:", error);

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

//  /verifyotp
const verifyOtp = async (req, res) => {
  try {
    const { mobile, otp } = req.body;

    // Validate fields
    if (!mobile || !otp) {
      return res.status(400).json({
        status: "error",
        message: "Mobile number and OTP are required",
      });
    }

    // Find user
    const existingUser = await DB.user.findUnique({
      where: {
        mobile,
      },
    });

    // User not found
    if (!existingUser) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Find OTP record
    const existingOtp = await DB.otp.findUnique({
      where: {
        userId: existingUser.id,
      },
    });

    // OTP not found
    if (!existingOtp) {
      return res.status(404).json({
        status: "error",
        message: "OTP not found",
      });
    }

    // Check attempts
    if (existingOtp.attempts >= 5) {
      return res.status(400).json({
        status: "error",
        message: "Maximum OTP attempts reached. Please request a new OTP.",
      });
    }

    // Check OTP expiry
    if (new Date() > existingOtp.expiresAt) {
      // Delete expired OTP
      await DB.otp.delete({
        where: {
          id: existingOtp.id,
        },
      });

      return res.status(400).json({
        status: "error",
        message: "OTP expired",
      });
    }

    // Verify OTP
    if (!verifyOtpUtil(existingOtp.otp, otp)) {
      // Increment attempts
      await DB.otp.update({
        where: { id: existingOtp.id },
        data: { attempts: { increment: 1 } },
      });

      return res.status(400).json({
        status: "error",
        message: "Invalid OTP",
      });
    }

    // Delete OTP after successful verification
    await DB.otp.delete({
      where: {
        id: existingOtp.id,
      },
    });

    // Generate Token
    const token = generateToken({
      id: existingUser.id,
      role: existingUser.role,
    });
    setAuthTokenCookie(res, "ecommerce_tocken", token);

    // Success response
    return res.status(200).json({
      status: "success",
      message: "OTP verified successfully",
      user: {
        id: existingUser.id,
        name: existingUser.name,
        username: existingUser.username,
        mobile: existingUser.mobile,
        role: existingUser.role,
      },
      token,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);

    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

//  /me
const getUser = (req, res) => {
  try {
    const { user, token } = req;
    if (!user && !token) {
      res.status(401).json({
        status: "error",
        message: "User is not authorized",
      });
      return;
    }

    res.status(200).json({
      status: "success",
      message: "Authorised user",
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//  /logout
const logout = (req, res) => {
  res.clearCookie("ecommerce_tocken", {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
  });
  res.status(200).json({ message: "Logged out successfully" });
};

module.exports = {
  register,
  login,
  getOtp,
  verifyOtp,
  logout,
  getUser,
};
