const crypto = require("crypto");

const generateOtp = () => {
   return crypto.randomInt(10000, 99999).toString();
};

const verifyOtp = (storedOtp, enteredOtp) => {
   return storedOtp === enteredOtp;
};

module.exports = {
   generateOtp,
   verifyOtp
};