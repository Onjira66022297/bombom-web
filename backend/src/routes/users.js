const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

const router = express.Router();

// All routes below require an authenticated admin
router.use(requireAuth, requireRole('admin'));

// GET /api/users?status=pending
router.get('/', async (req, res) => {
  const { status } = req.query;
  const result = status
    ? await db.query(
        'SELECT id, email, full_name, role, status, created_at, approved_at FROM users WHERE status = $1 ORDER BY created_at DESC',
        [status]
      )
    : await db.query(
        'SELECT id, email, full_name, role, status, created_at, approved_at FROM users ORDER BY created_at DESC'
      );
  res.json({ users: result.rows });
});

// POST /api/users/:id/approve
router.post('/:id/approve', async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    `UPDATE users SET status = 'active', approved_by = $1, approved_at = now()
     WHERE id = $2 AND status = 'pending'
     RETURNING id, email, full_name, role, status`,
    [req.user.sub, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Pending user not found' });
  }
  await logAction(req.user.sub, 'user.approve', 'user', id);
  res.json({ user: result.rows[0] });
});

// POST /api/users/:id/reject
router.post('/:id/reject', async (req, res) => {
  const { id } = req.params;
  const result = await db.query(
    `UPDATE users SET status = 'rejected', approved_by = $1, approved_at = now()
     WHERE id = $2 AND status = 'pending'
     RETURNING id, email, full_name, role, status`,
    [req.user.sub, id]
  );
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Pending user not found' });
  }
  await logAction(req.user.sub, 'user.reject', 'user', id);
  res.json({ user: result.rows[0] });
});

const roleSchema = z.object({
  role: z.enum(['admin', 'presales', 'technical_consultant', 'manager']),
});

// PATCH /api/users/:id/role
router.patch('/:id/role', async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid role' });

  const result = await db.query(
    `UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, full_name, role, status`,
    [parsed.data.role, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

  await logAction(req.user.sub, 'user.role_change', 'user', req.params.id, { newRole: parsed.data.role });
  res.json({ user: result.rows[0] });
});

// POST /api/users/:id/suspend
router.post('/:id/suspend', async (req, res) => {
  const result = await db.query(
    `UPDATE users SET status = 'suspended' WHERE id = $1 RETURNING id, email, full_name, role, status`,
    [req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
  await logAction(req.user.sub, 'user.suspend', 'user', req.params.id);
  res.json({ user: result.rows[0] });
});

// GET /api/users/audit-log
router.get('/meta/audit-log', async (req, res) => {
  const result = await db.query(
    `SELECT al.id, al.action, al.target_type, al.target_id, al.metadata, al.created_at,
            u.full_name as actor_name, u.email as actor_email
     FROM audit_log al
     LEFT JOIN users u ON u.id = al.actor_id
     ORDER BY al.created_at DESC
     LIMIT 200`
  );
  res.json({ entries: result.rows });
});

module.exports = router;
