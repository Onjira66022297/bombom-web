/**
 * Bootstraps the first admin account so there's someone able to approve
 * the pending-registration queue. Run once after migrations:
 *
 *   node src/db/seedAdmin.js admin@yourcompany.com "Strong Password123" "Admin Name"
 */
require('dotenv').config();
const db = require('./index');
const { hashPassword } = require('../utils/auth');

async function main() {
  const [, , email, password, fullName] = process.argv;
  if (!email || !password || !fullName) {
    console.error('Usage: node src/db/seedAdmin.js <email> <password> <full name>');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters');
    process.exit(1);
  }

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    console.error('A user with that email already exists.');
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, status, approved_at)
     VALUES ($1, $2, $3, 'admin', 'active', now())
     RETURNING id, email, full_name, role`,
    [email, passwordHash, fullName]
  );

  console.log('Admin account created:', result.rows[0]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
