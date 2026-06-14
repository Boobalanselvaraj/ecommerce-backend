const bcrypt = require("bcryptjs")

const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(10)
    return await bcrypt.hash(password, salt)
  } catch (error) {
    throw new Error("Error hashing password: " + error.message)
  }
}

const verifyPassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword)
  } catch (error) {
    throw new Error("Invalid password")
  }
}

module.exports = {
  hashPassword,
  verifyPassword
}
