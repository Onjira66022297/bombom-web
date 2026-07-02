const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

const router = express.Router();

router.use(requireAuth);

// GET /api/cases — list cases created by the current user (or all, for admin/manager)
router.get('/', async (req, res) => {
  const isPrivileged = ['admin', 'manager'].includes(req.user.role);
  const result = isPrivileged
    ? await db.query('SELECT * FROM cases ORDER BY updated_at DESC LIMIT 100')
    : await db.query('SELECT * FROM cases WHERE created_by = $1 ORDER BY updated_at DESC LIMIT 100', [req.user.sub]);
  res.json({ cases: result.rows });
});

router.get('/:id', async (req, res) => {
  const result = await db.query('SELECT * FROM cases WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });

  const bomChecks = await db.query(
    'SELECT * FROM bom_checks WHERE case_id = $1 ORDER BY created_at DESC',
    [req.params.id]
  );
  res.json({ case: result.rows[0], bomChecks: bomChecks.rows });
});

const createCaseSchema = z.object({
  customerName: z.string().min(1).optional(),
  sourceEmailId: z.string().optional(),
});

// POST /api/cases — Step 1: create a case from a searched email (or blank)
router.post('/', async (req, res) => {
  const parsed = createCaseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });

  const result = await db.query(
    `INSERT INTO cases (created_by, customer_name, source_email_id, status)
     VALUES ($1, $2, $3, 'draft') RETURNING *`,
    [req.user.sub, parsed.data.customerName ?? null, parsed.data.sourceEmailId ?? null]
  );
  await logAction(req.user.sub, 'case.create', 'case', result.rows[0].id);
  res.status(201).json({ case: result.rows[0] });
});

const analyzeSchema = z.object({
  extractedRequirements: z.record(z.string(), z.any()),
});

// PATCH /api/cases/:id/analyze — Step 2: store AI-extracted requirements from the email body
router.patch('/:id/analyze', async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });

  const result = await db.query(
    `UPDATE cases SET extracted_requirements = $1, status = 'analyzed', updated_at = now()
     WHERE id = $2 RETURNING *`,
    [JSON.stringify(parsed.data.extractedRequirements), req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
  await logAction(req.user.sub, 'case.analyze', 'case', req.params.id);
  res.json({ case: result.rows[0] });
});

const specsSchema = z.object({ eCode: z.string().min(1) });

// PATCH /api/cases/:id/specs — Step 3: attach the selected Dell E-Code / configuration
router.patch('/:id/specs', async (req, res) => {
  const parsed = specsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });

  const product = await db.query('SELECT e_code FROM products WHERE e_code = $1 AND status = $2', [
    parsed.data.eCode,
    'published',
  ]);
  if (product.rows.length === 0) {
    return res.status(400).json({ error: 'E-Code not found in the published catalog' });
  }

  const result = await db.query(
    `UPDATE cases SET selected_e_code = $1, status = 'specs_selected', updated_at = now()
     WHERE id = $2 RETURNING *`,
    [parsed.data.eCode, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
  await logAction(req.user.sub, 'case.select_specs', 'case', req.params.id, { eCode: parsed.data.eCode });
  res.json({ case: result.rows[0] });
});

module.exports = router;
