const jwt=require("jsonwebtoken")

const generateToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET); // Use a secure secret
    } catch (err) {
        // Handle specific token errors
        if (err.name === 'TokenExpiredError') {
            return { error: 'Token has expired' };
        } else {
            return { error: 'Invalid token' };
        }
    }
};


const setAuthTokenCookie = (res, cookiename,token) => {   
      res.cookie(cookiename, token, {
            httpOnly: true,
            secure: true,
            sameSite: "None",  
            path: "/",
            maxAge: 100 * 60 * 1000 // 100 minutes
        });
    };


    // const token = req.cookies.authToken;
    // console.log("Extracted token",token);
    // if (!token) {
    //   return res.status(401).json({
    //     status: 401,
    //     message: "Authentication required",
    //   });
    // }

  module.exports={
    generateToken,
    verifyToken,
    setAuthTokenCookie
  }