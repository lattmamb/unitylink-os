/**
 * UnityLink OS — fleet & mobility operations data model (SQLite, zero-dep).
 *
 * Covers: vehicle profiles (VIN, title, lien, insurance), bookings,
 * subscriptions, dispatch, scheduling, mileage, inspections, maintenance,
 * charging sessions, incidents, payments, utilization, and operating costs.
 *
 * Everything is written through the service layer or the HTTP surface —
 * never by hand-editing the database. Every mutation writes an append-only
 * audit event.
 */
import { DatabaseSync } from "node:sqlite";
import { randomUUID, createHash } from "node:crypto";

export function openDb(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export function migrate(db) {
  db.exec(`
  -- Append-only audit trail. Every mutation writes here.
  CREATE TABLE IF NOT EXISTS audit_events (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    action      TEXT NOT NULL,
    actor       TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'operator',
    reason      TEXT,
    detail      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Vehicle registry: the real asset record. VIN is the natural key.
  CREATE TABLE IF NOT EXISTS vehicles (
    id                    TEXT PRIMARY KEY,
    vin                   TEXT NOT NULL UNIQUE,
    make                  TEXT NOT NULL,
    model                 TEXT NOT NULL,
    year                  INTEGER NOT NULL,
    color                 TEXT,
    license_plate         TEXT,
    status                TEXT NOT NULL DEFAULT 'available'
      CHECK (status IN ('available','reserved','in_service','maintenance','out_of_service','retired')),
    title_status          TEXT NOT NULL DEFAULT 'clean'
      CHECK (title_status IN ('clean','salvage','rebuilt','lien')),
    lien_holder           TEXT,
    lien_amount_cents     INTEGER,
    insurance_provider    TEXT,
    insurance_policy      TEXT,
    insurance_expires_at  TEXT,
    base_odometer_miles   INTEGER NOT NULL DEFAULT 0,
    odometer_miles        INTEGER NOT NULL DEFAULT 0,
    battery_capacity_kwh  REAL,
    range_miles           INTEGER,
    purchase_price_cents  INTEGER,
    acquired_at           TEXT,
    notes                 TEXT,
    created_by            TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Bookings: request -> operator approval -> scheduled -> active -> completed.
  CREATE TABLE IF NOT EXISTS bookings (
    id            TEXT PRIMARY KEY,
    vehicle_id    TEXT NOT NULL REFERENCES vehicles(id),
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    purpose       TEXT,
    starts_at     TEXT NOT NULL,
    ends_at       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','approved','blocked','scheduled','active','completed','cancelled')),
    requested_by  TEXT NOT NULL,
    decided_by    TEXT,
    decided_at    TEXT,
    decision_note TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Subscriptions: request -> operator approval -> active -> cancelled.
  CREATE TABLE IF NOT EXISTS subscriptions (
    id            TEXT PRIMARY KEY,
    vehicle_id    TEXT NOT NULL REFERENCES vehicles(id),
    member_name   TEXT NOT NULL,
    member_email  TEXT,
    plan          TEXT NOT NULL,
    monthly_cents INTEGER NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','approved','blocked','active','cancelled')),
    requested_by  TEXT NOT NULL,
    decided_by    TEXT,
    decided_at    TEXT,
    decision_note TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Dispatch assignments (operator assigns a vehicle to a booking/driver).
  CREATE TABLE IF NOT EXISTS dispatch (
    id          TEXT PRIMARY KEY,
    vehicle_id  TEXT NOT NULL REFERENCES vehicles(id),
    booking_id  TEXT REFERENCES bookings(id),
    driver_name TEXT,
    assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
    status      TEXT NOT NULL DEFAULT 'assigned'
      CHECK (status IN ('assigned','en_route','on_site','returned','completed')),
    notes       TEXT,
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Mileage readings (odometer snapshots).
  CREATE TABLE IF NOT EXISTS mileage_readings (
    id             TEXT PRIMARY KEY,
    vehicle_id     TEXT NOT NULL REFERENCES vehicles(id),
    odometer_miles INTEGER NOT NULL,
    recorded_at    TEXT NOT NULL DEFAULT (datetime('now')),
    recorded_by    TEXT NOT NULL,
    source         TEXT NOT NULL DEFAULT 'manual'
      CHECK (source IN ('manual','telemetry','inspection')),
    notes          TEXT
  );

  -- Inspections (pre-trip, safety, annual, damage).
  CREATE TABLE IF NOT EXISTS inspections (
    id           TEXT PRIMARY KEY,
    vehicle_id   TEXT NOT NULL REFERENCES vehicles(id),
    kind         TEXT NOT NULL
      CHECK (kind IN ('pre_trip','post_trip','safety','annual','damage')),
    result       TEXT NOT NULL
      CHECK (result IN ('pass','fail','conditional')),
    notes        TEXT,
    inspected_by TEXT NOT NULL,
    inspected_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Maintenance records.
  CREATE TABLE IF NOT EXISTS maintenance_records (
    id           TEXT PRIMARY KEY,
    vehicle_id   TEXT NOT NULL REFERENCES vehicles(id),
    kind         TEXT NOT NULL
      CHECK (kind IN ('routine','repair','recall','tire','brake','battery','software')),
    description  TEXT NOT NULL,
    cost_cents   INTEGER NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'scheduled'
      CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
    completed_at TEXT,
    performed_by TEXT,
    created_by   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Charging sessions.
  CREATE TABLE IF NOT EXISTS charging_sessions (
    id          TEXT PRIMARY KEY,
    vehicle_id  TEXT NOT NULL REFERENCES vehicles(id),
    station_id  TEXT,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    energy_kwh  REAL NOT NULL DEFAULT 0,
    cost_cents  INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','completed','interrupted')),
    created_by  TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Incidents (accident, damage, theft, breakdown, other).
  CREATE TABLE IF NOT EXISTS incidents (
    id          TEXT PRIMARY KEY,
    vehicle_id  TEXT NOT NULL REFERENCES vehicles(id),
    kind        TEXT NOT NULL
      CHECK (kind IN ('accident','damage','theft','vandalism','breakdown','other')),
    severity    TEXT NOT NULL DEFAULT 'minor'
      CHECK (severity IN ('minor','moderate','major','critical')),
    description TEXT NOT NULL,
    reported_by TEXT NOT NULL,
    reported_at TEXT NOT NULL DEFAULT (datetime('now')),
    status      TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','investigating','resolved','closed')),
    resolution  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Payments (linked to a booking or subscription).
  CREATE TABLE IF NOT EXISTS payments (
    id               TEXT PRIMARY KEY,
    booking_id       TEXT REFERENCES bookings(id),
    subscription_id  TEXT REFERENCES subscriptions(id),
    amount_cents     INTEGER NOT NULL,
    method           TEXT NOT NULL
      CHECK (method IN ('card','cash','ach','credit','other')),
    status           TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','settled','refunded','failed')),
    reference        TEXT,
    recorded_by      TEXT NOT NULL,
    recorded_at      TEXT NOT NULL DEFAULT (datetime('now')),
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Operating costs (insurance, charging, maintenance, tires, cleaning, other).
  CREATE TABLE IF NOT EXISTS operating_costs (
    id           TEXT PRIMARY KEY,
    vehicle_id   TEXT NOT NULL REFERENCES vehicles(id),
    category     TEXT NOT NULL
      CHECK (category IN ('insurance','charging','maintenance','tires','cleaning','registration','depreciation','other')),
    amount_cents INTEGER NOT NULL,
    occurred_at  TEXT NOT NULL,
    note         TEXT,
    recorded_by  TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );
  `);
}

export function nowIso() {
  return new Date().toISOString();
}

export function newId() {
  return randomUUID();
}

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

export function audit(db, input) {
  db.prepare(
    `INSERT INTO audit_events (id, entity_type, entity_id, action, actor, role, reason, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    newId(),
    input.entityType,
    input.entityId,
    input.action,
    input.actor,
    input.role ?? "operator",
    input.reason ?? null,
    input.detail ?? null,
  );
  return true;
}