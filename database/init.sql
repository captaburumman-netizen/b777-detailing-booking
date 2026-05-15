PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS bookings (
  id                INTEGER  PRIMARY KEY AUTOINCREMENT,
  customer_name     TEXT     NOT NULL,
  customer_email    TEXT     NOT NULL,
  customer_phone    TEXT     NOT NULL,
  service_type      TEXT     NOT NULL,
  service_price     REAL     NOT NULL,
  service_duration  INTEGER  NOT NULL,          -- minutes
  vehicle_make      TEXT     NOT NULL,
  vehicle_model     TEXT     NOT NULL,
  vehicle_color     TEXT     NOT NULL,
  service_address   TEXT     NOT NULL,
  booking_date      TEXT     NOT NULL,          -- YYYY-MM-DD
  booking_time      TEXT     NOT NULL,          -- HH:MM
  status            TEXT     NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  deposit_paid      INTEGER  NOT NULL DEFAULT 0 -- 0 = false, 1 = true
                    CHECK(deposit_paid IN (0, 1)),
  created_at        TEXT     NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_date   ON bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_email  ON bookings (customer_email);
