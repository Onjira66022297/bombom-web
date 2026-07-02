const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

const router = express.Router();

// GET /api/products?status=published&category=Laptops
router.get('/', requireAuth, async (req, res) => {
  const { status, category } = req.query;
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await db.query(`SELECT * FROM products ${where} ORDER BY created_at DESC`, params);
  res.json({ products: result.rows });
});

router.get('/:eCode', requireAuth, async (req, res) => {
  const result = await db.query('SELECT * FROM products WHERE e_code = $1', [req.params.eCode]);
  if (result.rows.length === 0) return res.status(404).json({ error: 'Product not found' });

  const rules = await db.query('SELECT * FROM compatibility_rules WHERE product_id = $1', [result.rows[0].id]);
  res.json({ product: result.rows[0], compatibilityRules: rules.rows });
});

const productSchema = z.object({
  eCode: z.string().min(3),
  modelName: z.string().min(1),
  category: z.enum(['Laptops & 2-in-1s', 'Desktops & All-in-Ones']),
  line: z.string().optional(),
  cpuOptions: z.array(z.string()).default([]),
  ramOptions: z.array(z.string()).default([]),
  storageOptions: z.array(z.string()).default([]),
  displayOptions: z.array(z.string()).default([]),
  warrantyTiers: z.array(z.string()).default([]),
  sourceDocument: z.string().optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
});

// POST /api/products — create as draft/pending_review (e.g. from AI datasheet ingestion)
router.post('/', requireAuth, requireRole('admin', 'presales', 'technical_consultant'), async (req, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
  const p = parsed.data;

  const result = await db.query(
    `INSERT INTO products
      (e_code, model_name, category, line, cpu_options, ram_options, storage_options,
       display_options, warranty_tiers, source_document, confidence_score, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, 'pending_review')
     RETURNING *`,
    [p.eCode, p.modelName, p.category, p.line ?? null, JSON.stringify(p.cpuOptions),
     JSON.stringify(p.ramOptions), JSON.stringify(p.storageOptions), JSON.stringify(p.displayOptions),
     JSON.stringify(p.warrantyTiers), p.sourceDocument ?? null, p.confidenceScore ?? null]
  );
  await logAction(req.user.sub, 'product.create', 'product', result.rows[0].id);
  res.status(201).json({ product: result.rows[0] });
});

// POST /api/products/:id/publish — the human review/approve gate before it enters the live catalog
router.post('/:id/publish', requireAuth, requireRole('admin', 'manager'), async (req, res) => {
  const result = await db.query(
    `UPDATE products SET status = 'published', reviewed_by = $1, reviewed_at = now(), updated_at = now()
     WHERE id = $2 AND status = 'pending_review'
     RETURNING *`,
    [req.user.sub, req.params.id]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'No pending_review product with that id' });
  await logAction(req.user.sub, 'product.publish', 'product', req.params.id);
  res.json({ product: result.rows[0] });
});

module.exports = router;
