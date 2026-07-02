const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const caseRoutes = require('./routes/cases');
const bomCheckRoutes = require('./routes/bomChecks');
const emailRoutes = require('./routes/emails');

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Tighter rate limit on auth endpoints to slow down credential stuffing / brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/cases', bomCheckRoutes); // adds POST /api/cases/:caseId/bom-check
app.use('/api/emails', emailRoutes);

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Central error handler — never leak stack traces to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

module.exports = app;
