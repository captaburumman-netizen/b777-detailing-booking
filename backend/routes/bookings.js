const express              = require('express');
const router               = express.Router();
const db                   = require('../db/database');
const { sendBookingEmails } = require('../services/emailService');

// ── Service catalogue ──────────────────────────────────────────
const SERVICES = {
  'Basic Wash':      { price: 120, duration: 90  },   // 1.5 h
  'Interior Detail': { price: 179, duration: 120 },   // 2 h
  'Exterior Detail': { price: 79,  duration: 60  },   // 1 h
  'Complete Detail': { price: 250, duration: 240 },   // 4 h
};

const SERVICE_NAMES = Object.keys(SERVICES);
const VALID_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

// ── Working-hours constants ────────────────────────────────────
const OPEN_MIN  = 7  * 60;   // 07:00 → 420 minutes
const CLOSE_MIN = 20 * 60;   // 20:00 → 1200 minutes

// ── Helpers ────────────────────────────────────────────────────
function timeToMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(min) {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function validateBookingBody(body) {
  const errors = [];

  const requiredText = [
    'customer_name', 'customer_email', 'customer_phone',
    'service_type',
    'vehicle_make', 'vehicle_model', 'vehicle_color',
    'service_address', 'booking_date', 'booking_time',
  ];
  requiredText.forEach(f => {
    if (!body[f] || !String(body[f]).trim())
      errors.push(`${f} is required`);
  });

  if (body.customer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customer_email))
    errors.push('customer_email is not a valid email address');

  if (body.customer_phone && body.customer_phone.replace(/\D/g, '').length < 10)
    errors.push('customer_phone must contain at least 10 digits');

  if (body.service_type && !SERVICES[body.service_type])
    errors.push(`service_type must be one of: ${SERVICE_NAMES.join(', ')}`);

  if (body.booking_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.booking_date))
    errors.push('booking_date must be YYYY-MM-DD');

  if (body.booking_time && !/^\d{2}:\d{2}$/.test(body.booking_time))
    errors.push('booking_time must be HH:MM');

  if (body.booking_date && body.booking_time && body.service_type) {
    const service = SERVICES[body.service_type];
    if (service) {
      const startMin = timeToMin(body.booking_time);
      const endMin   = startMin + service.duration;
      if (startMin < OPEN_MIN)
        errors.push(`Earliest booking time is ${minToTime(OPEN_MIN)}`);
      if (endMin > CLOSE_MIN)
        errors.push(
          `${body.service_type} (${service.duration} min) starting at ` +
          `${body.booking_time} runs past closing time ${minToTime(CLOSE_MIN)}`
        );
    }
  }

  return errors;
}


// ── POST /api/bookings ─────────────────────────────────────────
router.post('/', (req, res) => {
  const errors = validateBookingBody(req.body);
  if (errors.length) return res.status(400).json({ errors });

  const {
    customer_name, customer_email, customer_phone,
    service_type,
    vehicle_make, vehicle_model, vehicle_color,
    service_address, booking_date, booking_time,
    deposit_paid = 0,
  } = req.body;

  const service   = SERVICES[service_type];
  const price     = service.price;
  const duration  = service.duration;
  const startMin  = timeToMin(booking_time);

  // Conflict check — block if any non-cancelled booking overlaps
  const conflictSQL = `
    SELECT id FROM bookings
    WHERE booking_date = ?
      AND status != 'cancelled'
      AND (
            (? >= (strftime('%H', booking_time) * 60 + strftime('%M', booking_time))
              AND ? <  (strftime('%H', booking_time) * 60 + strftime('%M', booking_time) + service_duration))
        OR  (? >  (strftime('%H', booking_time) * 60 + strftime('%M', booking_time))
              AND ? <  (strftime('%H', booking_time) * 60 + strftime('%M', booking_time) + service_duration))
        OR  ((strftime('%H', booking_time) * 60 + strftime('%M', booking_time)) >= ?
              AND (strftime('%H', booking_time) * 60 + strftime('%M', booking_time)) < ?)
      )
    LIMIT 1
  `;
  const endMin = startMin + duration;

  db.get(conflictSQL, [
    booking_date,
    startMin, startMin,
    startMin, startMin,
    startMin, endMin,
  ], (err, conflict) => {
    if (err) return res.status(500).json({ error: 'Database error during conflict check' });
    if (conflict) {
      return res.status(409).json({
        error: 'That time slot is already taken. Please choose a different time.',
        conflicting_booking_id: conflict.id,
      });
    }

    db.run(
      `INSERT INTO bookings
         (customer_name, customer_email, customer_phone,
          service_type, service_price, service_duration,
          vehicle_make, vehicle_model, vehicle_color,
          service_address, booking_date, booking_time,
          deposit_paid)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        customer_name.trim(), customer_email.trim(), customer_phone.trim(),
        service_type, price, duration,
        vehicle_make.trim(), vehicle_model.trim(), vehicle_color.trim(),
        service_address.trim(), booking_date, booking_time,
        deposit_paid ? 1 : 0,
      ],
      async function (err) {
        if (err) return res.status(500).json({ error: 'Failed to save booking' });

        const booking = {
          id: this.lastID,
          customer_name, customer_email, customer_phone,
          service_type, service_price: price, service_duration: duration,
          vehicle_make, vehicle_model, vehicle_color,
          service_address, booking_date, booking_time,
          status: 'pending', deposit_paid: deposit_paid ? 1 : 0,
        };

        try { await sendBookingEmails(booking); }
        catch (mailErr) { console.warn('[email] Send failed (non-fatal):', mailErr.message); }

        res.status(201).json({ message: 'Booking created', booking });
      }
    );
  });
});

// ── GET /api/bookings ──────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, date, email } = req.query;
  const where  = [];
  const params = [];

  if (status) { where.push('status = ?');        params.push(status); }
  if (date)   { where.push('booking_date = ?');  params.push(date);   }
  if (email)  { where.push('customer_email = ?');params.push(email);  }

  const sql = `SELECT * FROM bookings${where.length ? ' WHERE ' + where.join(' AND ') : ''}
               ORDER BY booking_date ASC, booking_time ASC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ count: rows.length, bookings: rows });
  });
});

// ── GET /api/bookings/:id ──────────────────────────────────────
router.get('/:id', (req, res) => {
  db.get('SELECT * FROM bookings WHERE id = ?', [req.params.id], (err, row) => {
    if (err)  return res.status(500).json({ error: 'Database error' });
    if (!row) return res.status(404).json({ error: `Booking #${req.params.id} not found` });
    res.json(row);
  });
});

// ── PATCH /api/bookings/:id/status ────────────────────────────
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: 'status is required' });
  if (!VALID_STATUSES.includes(status))
    return res.status(400).json({
      error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
    });

  db.run(
    'UPDATE bookings SET status = ? WHERE id = ?',
    [status, req.params.id],
    function (err) {
      if (err)           return res.status(500).json({ error: 'Database error' });
      if (!this.changes) return res.status(404).json({ error: `Booking #${req.params.id} not found` });
      res.json({ message: 'Status updated', id: Number(req.params.id), status });
    }
  );
});

// ── DELETE /api/bookings/:id ───────────────────────────────────
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM bookings WHERE id = ?', [req.params.id], function (err) {
    if (err)           return res.status(500).json({ error: 'Database error' });
    if (!this.changes) return res.status(404).json({ error: `Booking #${req.params.id} not found` });
    res.json({ message: 'Booking deleted', id: Number(req.params.id) });
  });
});

module.exports = router;
module.exports.SERVICES   = SERVICES;
module.exports.timeToMin  = timeToMin;
module.exports.minToTime  = minToTime;
module.exports.OPEN_MIN   = OPEN_MIN;
module.exports.CLOSE_MIN  = CLOSE_MIN;
