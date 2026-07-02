const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { hashPassword, comparePassword, signToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

const router = express.Router();

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['presales', 'technical_consultant', 'manager']).default('presales'),
});

// POST /api/auth/register — creates a pending account, awaiting admin approval
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }
  const { fullName, email, password, role } = parsed.data;

  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const passwordHash = await hashPassword(password);
  const result = await db.query(
    `INSERT INTO users (email, password_hash, full_name, role, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, email, full_name, role, status, created_at`,
    [email, passwordHash, fullName, role]
  );

  const user = result.rows[0];
  await logAction(user.id, 'user.register', 'user', user.id);

  res.status(201).json({
    message: 'Registration submitted. An administrator must approve your account before you can log in.',
    user,
  });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;

  const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];

  // Same generic error whether email doesn't exist or password is wrong (avoid user enumeration)
  if (!user || !(await comparePassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({ error: 'Your account is pending administrator approval' });
  }
  if (user.status === 'rejected' || user.status === 'suspended') {
    return res.status(403).json({ error: 'Your account is not active. Contact an administrator.' });
  }

  const token = signToken(user);
  await logAction(user.id, 'user.login', 'user', user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      status: user.status,
    },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  const result = await db.query(
    'SELECT id, email, full_name, role, status, created_at FROM users WHERE id = $1',
    [req.user.sub]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  res.json({ user: result.rows[0] });
});

module.exports = router;
