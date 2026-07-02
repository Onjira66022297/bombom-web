const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in the environment (see .env.example)');
}

function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
}

function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, comparePassword, signToken, verifyToken };
