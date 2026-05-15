require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const fs           = require('fs');

const bookingsRouter     = require('./routes/bookings');
const availabilityRouter = require('./routes/availability');
const adminRouter        = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API routes ─────────────────────────────────────────────────
app.use('/api/bookings',     bookingsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/admin',        adminRouter);

// ── Health check ───────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve frontend static files ────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Admin page — inject ADMIN_PASSWORD into window ─────────────
app.get('/admin', (_req, res) => {
  const html   = fs.readFileSync(path.join(__dirname, '../frontend/admin.html'), 'utf8');
  const pass   = process.env.ADMIN_PASSWORD || 'b777admin';
  const output = html.replace(
    '</body>',
    `<script>window.__ADMIN_PASS__ = ${JSON.stringify(pass)};</script>\n</body>`
  );
  res.send(output);
});

// ── Fallback ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`B777 Booking server → http://localhost:${PORT}`);
  console.log(`  Bookings:     http://localhost:${PORT}/api/bookings`);
  console.log(`  Availability: http://localhost:${PORT}/api/availability?date=YYYY-MM-DD`);
  console.log(`  Admin stats:  http://localhost:${PORT}/api/admin/stats`);
  console.log(`  Dashboard:    http://localhost:${PORT}/admin`);
});
