const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const {
  SERVICES, timeToMin, minToTime, OPEN_MIN, CLOSE_MIN,
} = require('./bookings');

// Slot grid resolution: every 30 minutes
const SLOT_STEP = 30;

// ── Build every possible 30-min slot within working hours ──────
function allSlots() {
  const slots = [];
  for (let m = OPEN_MIN; m < CLOSE_MIN; m += SLOT_STEP) {
    slots.push(minToTime(m));
  }
  return slots;
}

// ── GET /api/availability?date=YYYY-MM-DD ──────────────────────
// Optional query param: ?service=Basic+Wash
//   When supplied, a slot is only returned as "available" if the
//   entire service duration fits without overlap AND before close.
//
// Response shape:
// {
//   date: "2026-05-20",
//   service: "Complete Detail" | null,
//   slots: [
//     { time: "07:00", available: true  },
//     { time: "07:30", available: false, reason: "overlaps existing booking" },
//     ...
//   ],
//   unavailable_times: ["07:30", "08:00", ...],
//   available_times:   ["07:00", "09:00", ...]
// }

router.get('/', (req, res) => {
  const { date, service } = req.query;

  // ── Validate date ──────────────────────────────────────────
  if (!date) return res.status(400).json({ error: 'date query param is required (YYYY-MM-DD)' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format' });

  const parsed = new Date(date);
  if (isNaN(parsed.getTime()))
    return res.status(400).json({ error: 'Invalid date' });

  // ── Validate optional service param ───────────────────────
  let requestedDuration = null;
  if (service) {
    if (!SERVICES[service])
      return res.status(400).json({
        error: `Unknown service "${service}". Valid options: ${Object.keys(SERVICES).join(', ')}`,
      });
    requestedDuration = SERVICES[service].duration;
  }

  // ── Fetch all non-cancelled bookings for the date ──────────
  db.all(
    `SELECT booking_time, service_duration
       FROM bookings
      WHERE booking_date = ?
        AND status != 'cancelled'`,
    [date],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });

      // Convert existing bookings to [startMin, endMin] intervals
      const busy = rows.map(r => {
        const start = timeToMin(r.booking_time);
        return { start, end: start + r.service_duration };
      });

      const slots = allSlots().map(slotTime => {
        const slotStart = timeToMin(slotTime);
        const slotEnd   = slotStart + SLOT_STEP;

        // 1. Is this 30-min window covered by an existing booking?
        const overlapsExisting = busy.some(b => slotStart < b.end && slotEnd > b.start);

        if (overlapsExisting) {
          return { time: slotTime, available: false, reason: 'overlaps existing booking' };
        }

        // 2. If a specific service was requested, check the full duration fits
        if (requestedDuration !== null) {
          const serviceEnd = slotStart + requestedDuration;

          // Would run past closing time?
          if (serviceEnd > CLOSE_MIN) {
            return {
              time: slotTime,
              available: false,
              reason: `${service} (${requestedDuration} min) would end after ${minToTime(CLOSE_MIN)}`,
            };
          }

          // Would overlap any existing booking over the full duration?
          const durationOverlap = busy.some(
            b => slotStart < b.end && serviceEnd > b.start
          );
          if (durationOverlap) {
            return {
              time: slotTime,
              available: false,
              reason: `${service} duration overlaps an existing booking`,
            };
          }
        }

        return { time: slotTime, available: true };
      });

      const unavailable_times = slots.filter(s => !s.available).map(s => s.time);
      const available_times   = slots.filter(s =>  s.available).map(s => s.time);

      res.json({
        date,
        service:           service || null,
        working_hours:     `${minToTime(OPEN_MIN)} – ${minToTime(CLOSE_MIN)}`,
        slot_interval_min: SLOT_STEP,
        total_slots:       slots.length,
        slots,
        available_times,
        unavailable_times,
      });
    }
  );
});

module.exports = router;
