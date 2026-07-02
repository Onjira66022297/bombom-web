const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');
const { logAction } = require('../utils/auditLog');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    // PDF BOM parsing isn't implemented yet — reject clearly rather than silently accepting.
    cb(new Error('Unsupported file type. Upload .xlsx, .xls, or .csv. PDF BOM parsing is not yet supported.'));
  },
});

function normalizeKey(k) {
  return String(k).trim().toLowerCase();
}

// Extracts { componentType, value } rows from the first sheet, tolerant of header naming.
function parseBomRows(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows
    .map((row) => {
      const entries = Object.fromEntries(Object.entries(row).map(([k, v]) => [normalizeKey(k), v]));
      const componentType = entries['component type'] || entries['type'] || entries['component'] || '';
      const value = entries['value'] || entries['spec'] || entries['specification'] || entries['model'] || '';
      return { componentType: String(componentType).trim(), value: String(value).trim() };
    })
    .filter((r) => r.componentType && r.value);
}

const OPTION_FIELD_BY_TYPE = {
  cpu: 'cpu_options',
  processor: 'cpu_options',
  ram: 'ram_options',
  memory: 'ram_options',
  storage: 'storage_options',
  ssd: 'storage_options',
  display: 'display_options',
  screen: 'display_options',
  warranty: 'warranty_tiers',
  prosupport: 'warranty_tiers',
};

function checkRow(row, product) {
  const typeKey = row.componentType.toLowerCase();
  const field = OPTION_FIELD_BY_TYPE[typeKey];

  if (!field) {
    return { ...row, status: 'unknown', reason: `Unrecognized component type "${row.componentType}"` };
  }

  const options = (product[field] || []).map((o) => String(o).toLowerCase());
  const isCompatible = options.includes(row.value.toLowerCase());

  return {
    ...row,
    status: isCompatible ? 'pass' : 'fail',
    reason: isCompatible
      ? `Matches an available option for ${product.model_name}`
      : `"${row.value}" is not offered for ${product.model_name} (${row.componentType})`,
  };
}

// POST /api/cases/:caseId/bom-check
router.post('/:caseId/bom-check', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded (expected field name "file")' });

  const caseResult = await db.query('SELECT * FROM cases WHERE id = $1', [req.params.caseId]);
  if (caseResult.rows.length === 0) return res.status(404).json({ error: 'Case not found' });
  const caseRow = caseResult.rows[0];

  if (!caseRow.selected_e_code) {
    return res.status(400).json({ error: 'This case has no selected E-Code yet — complete Step 3 first' });
  }

  const productResult = await db.query('SELECT * FROM products WHERE e_code = $1', [caseRow.selected_e_code]);
  if (productResult.rows.length === 0) {
    return res.status(400).json({ error: 'Selected product no longer exists in the catalog' });
  }
  const product = productResult.rows[0];

  let rows;
  try {
    rows = parseBomRows(req.file.buffer);
  } catch (err) {
    return res.status(400).json({ error: 'Could not parse the uploaded file as a spreadsheet' });
  }
  if (rows.length === 0) {
    return res.status(400).json({
      error: 'No recognizable rows found. Expect columns like "Component Type" and "Value".',
    });
  }

  const checkedRows = rows.map((r) => checkRow(r, product));
  const overallCompatible = checkedRows.every((r) => r.status === 'pass');

  // Also surface any known incompatible pairings (e.g. CPU x RAM) present together in this BOM
  const pairRules = await db.query(
    `SELECT * FROM compatibility_rules WHERE product_id = $1 AND is_compatible = false`,
    [product.id]
  );
  const flaggedPairs = pairRules.rows.filter((rule) => {
    const values = checkedRows.map((r) => r.value.toLowerCase());
    return values.includes(rule.component_a.toLowerCase()) && values.includes(rule.component_b.toLowerCase());
  });

  const result = {
    rows: checkedRows,
    flaggedPairs: flaggedPairs.map((r) => ({
      componentA: r.component_a,
      componentB: r.component_b,
      reason: 'This combination is flagged as incompatible',
      source: r.source_citation,
    })),
  };
  const isCompatible = overallCompatible && flaggedPairs.length === 0;

  const insertResult = await db.query(
    `INSERT INTO bom_checks (case_id, uploaded_file, result, is_compatible, checked_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.params.caseId, req.file.originalname, JSON.stringify(result), isCompatible, req.user.sub]
  );

  await db.query(`UPDATE cases SET status = 'bom_checked', updated_at = now() WHERE id = $1`, [req.params.caseId]);
  await logAction(req.user.sub, 'bom_check.run', 'case', req.params.caseId, { isCompatible });

  res.status(201).json({ bomCheck: insertResult.rows[0] });
});

module.exports = router;
