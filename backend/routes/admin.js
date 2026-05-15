const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ── GET /api/admin/stats ───────────────────────────────────────
// Returns dashboard summary counts and revenue figures.
router.get('/stats', (req, res) => {
  const sql = `
    SELECT
      /* today */
      SUM(CASE WHEN booking_date = date('now')                              THEN 1 ELSE 0 END) AS today_count,

      /* this week (today → +6 days) */
      SUM(CASE WHEN booking_date BETWEEN date('now') AND date('now','+6 days') THEN 1 ELSE 0 END) AS week_count,

      /* pending (all dates) */
      SUM(CASE WHEN status = 'pending'                                      THEN 1 ELSE 0 END) AS pending_count,

      /* revenue this calendar month (confirmed + completed) */
      SUM(CASE
            WHEN status IN ('confirmed','completed')
             AND strftime('%Y-%m', booking_date) = strftime('%Y-%m', date('now'))
            THEN service_price ELSE 0
          END) AS month_revenue,

      /* total bookings */
      COUNT(*) AS total_count
    FROM bookings
  `;

  db.get(sql, (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({
      today:         row.today_count   || 0,
      this_week:     row.week_count    || 0,
      pending:       row.pending_count || 0,
      month_revenue: row.month_revenue || 0,
      total:         row.total_count   || 0,
    });
  });
});

module.exports = router;
