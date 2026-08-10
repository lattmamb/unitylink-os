/**
 * UnityLink OS — fleet & mobility operations service.
 *
 * Vehicle registry (VIN, title, lien, insurance), bookings and subscriptions
 * with operator approval gates, dispatch, scheduling, mileage, inspections,
 * maintenance, charging sessions, incidents, payments, utilization, and
 * operating costs.
 *
 * Zero runtime dependencies: node:sqlite, node:crypto, node:http.
 * Runs on Node >= 22.6.
 */
import { audit, newId, nowIso } from "./db.mjs";

export class FleetError extends Error {}
export class ApprovalError extends Error {}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

function requireVehicle(db, id) {
  const row = db.prepare("SELECT * FROM vehicles WHERE id = ?").get(id);
  if (!row) throw new FleetError("Vehicle not found");
  return row;
}

function mapVehicle(row) {
  return {
    id: row.id,
    vin: row.vin,
    make: row.make,
    model: row.model,
    year: row.year,
    color: row.color,
    licensePlate: row.license_plate,
    status: row.status,
    titleStatus: row.title_status,
    lienHolder: row.lien_holder,
    lienAmountCents: row.lien_amount_cents,
    insuranceProvider: row.insurance_provider,
    insurancePolicy: row.insurance_policy,
    insuranceExpiresAt: row.insurance_expires_at,
    baseOdometerMiles: row.base_odometer_miles,
    odometerMiles: row.odometer_miles,
    batteryCapacityKwh: row.battery_capacity_kwh,
    rangeMiles: row.range_miles,
    purchasePriceCents: row.purchase_price_cents,
    acquiredAt: row.acquired_at,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBooking(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    purpose: row.purpose,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSubscription(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    memberName: row.member_name,
    memberEmail: row.member_email,
    plan: row.plan,
    monthlyCents: row.monthly_cents,
    status: row.status,
    requestedBy: row.requested_by,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDispatch(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    bookingId: row.booking_id,
    driverName: row.driver_name,
    assignedAt: row.assigned_at,
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapMileage(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    odometerMiles: row.odometer_miles,
    recordedAt: row.recorded_at,
    recordedBy: row.recorded_by,
    source: row.source,
    notes: row.notes,
  };
}

function mapInspection(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    kind: row.kind,
    result: row.result,
    notes: row.notes,
    inspectedBy: row.inspected_by,
    inspectedAt: row.inspected_at,
    createdAt: row.created_at,
  };
}

function mapMaintenance(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    kind: row.kind,
    description: row.description,
    costCents: row.cost_cents,
    status: row.status,
    completedAt: row.completed_at,
    performedBy: row.performed_by,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapCharging(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    stationId: row.station_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    energyKwh: row.energy_kwh,
    costCents: row.cost_cents,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapIncident(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    kind: row.kind,
    severity: row.severity,
    description: row.description,
    reportedBy: row.reported_by,
    reportedAt: row.reported_at,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.created_at,
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    bookingId: row.booking_id,
    subscriptionId: row.subscription_id,
    amountCents: row.amount_cents,
    method: row.method,
    status: row.status,
    reference: row.reference,
    recordedBy: row.recorded_by,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function mapOperatingCost(row) {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    category: row.category,
    amountCents: row.amount_cents,
    occurredAt: row.occurred_at,
    note: row.note,
    recordedBy: row.recorded_by,
    createdAt: row.created_at,
  };
}

/* ------------------------------------------------------------------ */
/* Vehicle registry                                                    */
/* ------------------------------------------------------------------ */

/**
 * Register a vehicle as a real asset. VIN must be a valid 17-character
 * VIN (letters I, O, Q excluded). Title, lien, and insurance fields are
 * recorded as provided — no legal conclusion is drawn here.
 */
export function registerVehicle(db, actor, input) {
  const vin = (input.vin ?? "").trim().toUpperCase();
  if (!VIN_RE.test(vin)) {
    throw new FleetError("VIN must be 17 characters (A–H, J–N, P, R–Z, 0–9)");
  }
  if (!input.make?.trim()) throw new FleetError("Make is required");
  if (!input.model?.trim()) throw new FleetError("Model is required");
  if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 2100) {
    throw new FleetError("Year must be a valid 4-digit year");
  }

  const existing = db.prepare("SELECT id FROM vehicles WHERE vin = ?").get(vin);
  if (existing) throw new FleetError(`Vehicle with VIN ${vin} already registered`);

  const id = newId();
  db.prepare(
    `INSERT INTO vehicles
       (id, vin, make, model, year, color, license_plate, status, title_status,
        lien_holder, lien_amount_cents, insurance_provider, insurance_policy,
        insurance_expires_at, base_odometer_miles, odometer_miles, battery_capacity_kwh, range_miles,
        purchase_price_cents, acquired_at, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id, vin, input.make.trim(), input.model.trim(), input.year,
    input.color ?? null, input.licensePlate ?? null, input.status ?? "available",
    input.titleStatus ?? "clean", input.lienHolder ?? null,
    input.lienAmountCents ?? null, input.insuranceProvider ?? null,
    input.insurancePolicy ?? null, input.insuranceExpiresAt ?? null,
    input.odometerMiles ?? 0, input.odometerMiles ?? 0, input.batteryCapacityKwh ?? null,
    input.rangeMiles ?? null, input.purchasePriceCents ?? null,
    input.acquiredAt ?? null, input.notes ?? null, actor,
  );

  audit(db, {
    entityType: "vehicle",
    entityId: id,
    action: "vehicle.register",
    actor,
    reason: "Vehicle registered as fleet asset",
    detail: JSON.stringify({ vin, make: input.make, model: input.model, year: input.year }),
  });

  return mapVehicle(requireVehicle(db, id));
}

export function listVehicles(db, opts = {}) {
  const where = [];
  const params = [];
  if (opts.status) { where.push("status = ?"); params.push(opts.status); }
  const sql = `SELECT * FROM vehicles ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...params).map(mapVehicle);
}

export function getVehicle(db, id) {
  return mapVehicle(requireVehicle(db, id));
}

export function updateVehicleStatus(db, actor, id, status, reason) {
  const allowed = ["available", "reserved", "in_service", "maintenance", "out_of_service", "retired"];
  if (!allowed.includes(status)) throw new FleetError(`Invalid vehicle status "${status}"`);
  requireVehicle(db, id);
  db.prepare(`UPDATE vehicles SET status = ?, updated_at = ? WHERE id = ?`).run(status, nowIso(), id);
  audit(db, {
    entityType: "vehicle",
    entityId: id,
    action: "vehicle.status",
    actor,
    reason: reason ?? `Vehicle status changed to ${status}`,
    detail: JSON.stringify({ status }),
  });
  return mapVehicle(requireVehicle(db, id));
}

/* ------------------------------------------------------------------ */
/* Bookings (operator approval gate)                                   */
/* ------------------------------------------------------------------ */

export function requestBooking(db, actor, input) {
  requireVehicle(db, input.vehicleId);
  if (!input.customerName?.trim()) throw new FleetError("Customer name is required");
  if (!input.startsAt || !input.endsAt) throw new FleetError("Start and end times are required");
  if (new Date(input.startsAt) >= new Date(input.endsAt)) {
    throw new FleetError("Booking end must be after start");
  }

  const id = newId();
  db.prepare(
    `INSERT INTO bookings (id, vehicle_id, customer_name, customer_email, purpose, starts_at, ends_at, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.vehicleId, input.customerName.trim(), input.customerEmail ?? null,
    input.purpose ?? null, input.startsAt, input.endsAt, actor);

  audit(db, {
    entityType: "booking",
    entityId: id,
    action: "booking.request",
    actor,
    reason: "Booking requested; operator approval required",
    detail: JSON.stringify({ vehicleId: input.vehicleId, customerName: input.customerName }),
  });
  return mapBooking(db.prepare("SELECT * FROM bookings WHERE id = ?").get(id));
}

/**
 * Operator decides a booking request. On approve the booking moves to
 * "approved"; the operator can then schedule it. On block it is rejected.
 */
export function decideBooking(db, actor, bookingId, decision, note) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  if (!row) throw new FleetError("Booking not found");
  if (row.status !== "pending") throw new FleetError(`Booking already ${row.status}`);

  db.prepare(
    `UPDATE bookings SET status = ?, decided_by = ?, decided_at = ?, decision_note = COALESCE(?, decision_note), updated_at = ?
     WHERE id = ?`,
  ).run(decision === "approve" ? "approved" : "blocked", actor, nowIso(), note ?? null, nowIso(), bookingId);

  audit(db, {
    entityType: "booking",
    entityId: bookingId,
    action: `booking.${decision}`,
    actor,
    reason: decision === "approve" ? "Operator approved booking" : "Operator blocked booking",
    detail: note ?? null,
  });
  return mapBooking(db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId));
}

/** Schedule an approved booking (operator action). */
export function scheduleBooking(db, actor, bookingId) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  if (!row) throw new FleetError("Booking not found");
  if (row.status !== "approved") {
    throw new ApprovalError(`Cannot schedule: booking is "${row.status}" (must be "approved")`);
  }
  db.prepare(`UPDATE bookings SET status = 'scheduled', updated_at = ? WHERE id = ?`).run(nowIso(), bookingId);
  audit(db, {
    entityType: "booking",
    entityId: bookingId,
    action: "booking.schedule",
    actor,
    reason: "Approved booking scheduled",
  });
  return mapBooking(db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId));
}

export function startBooking(db, actor, bookingId) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  if (!row) throw new FleetError("Booking not found");
  if (row.status !== "scheduled") {
    throw new ApprovalError(`Cannot start: booking is "${row.status}" (must be "scheduled")`);
  }
  db.prepare(`UPDATE bookings SET status = 'active', updated_at = ? WHERE id = ?`).run(nowIso(), bookingId);
  audit(db, {
    entityType: "booking",
    entityId: bookingId,
    action: "booking.start",
    actor,
    reason: "Booking started",
  });
  return mapBooking(db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId));
}

export function completeBooking(db, actor, bookingId) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  if (!row) throw new FleetError("Booking not found");
  if (row.status !== "active") {
    throw new ApprovalError(`Cannot complete: booking is "${row.status}" (must be "active")`);
  }
  db.prepare(`UPDATE bookings SET status = 'completed', updated_at = ? WHERE id = ?`).run(nowIso(), bookingId);
  audit(db, {
    entityType: "booking",
    entityId: bookingId,
    action: "booking.complete",
    actor,
    reason: "Booking completed",
  });
  return mapBooking(db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId));
}

export function cancelBooking(db, actor, bookingId, reason) {
  const row = db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId);
  if (!row) throw new FleetError("Booking not found");
  if (["completed", "cancelled"].includes(row.status)) {
    throw new FleetError(`Cannot cancel a ${row.status} booking`);
  }
  db.prepare(`UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), bookingId);
  audit(db, {
    entityType: "booking",
    entityId: bookingId,
    action: "booking.cancel",
    actor,
    reason: reason ?? "Booking cancelled",
  });
  return mapBooking(db.prepare("SELECT * FROM bookings WHERE id = ?").get(bookingId));
}

export function listBookings(db, opts = {}) {
  const where = [];
  const params = [];
  if (opts.status) { where.push("status = ?"); params.push(opts.status); }
  if (opts.vehicleId) { where.push("vehicle_id = ?"); params.push(opts.vehicleId); }
  const sql = `SELECT * FROM bookings ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY starts_at DESC`;
  return db.prepare(sql).all(...params).map(mapBooking);
}

/* ------------------------------------------------------------------ */
/* Subscriptions (operator approval gate)                              */
/* ------------------------------------------------------------------ */

export function requestSubscription(db, actor, input) {
  requireVehicle(db, input.vehicleId);
  if (!input.memberName?.trim()) throw new FleetError("Member name is required");
  if (!input.plan?.trim()) throw new FleetError("Plan is required");
  if (!Number.isInteger(input.monthlyCents) || input.monthlyCents < 0) {
    throw new FleetError("Monthly rate must be a non-negative integer (cents)");
  }

  const id = newId();
  db.prepare(
    `INSERT INTO subscriptions (id, vehicle_id, member_name, member_email, plan, monthly_cents, requested_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.vehicleId, input.memberName.trim(), input.memberEmail ?? null,
    input.plan.trim(), input.monthlyCents, actor);

  audit(db, {
    entityType: "subscription",
    entityId: id,
    action: "subscription.request",
    actor,
    reason: "Subscription requested; operator approval required",
    detail: JSON.stringify({ vehicleId: input.vehicleId, memberName: input.memberName, plan: input.plan }),
  });
  return mapSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id));
}

export function decideSubscription(db, actor, subscriptionId, decision, note) {
  const row = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId);
  if (!row) throw new FleetError("Subscription not found");
  if (row.status !== "pending") throw new FleetError(`Subscription already ${row.status}`);

  db.prepare(
    `UPDATE subscriptions SET status = ?, decided_by = ?, decided_at = ?, decision_note = COALESCE(?, decision_note), updated_at = ?
     WHERE id = ?`,
  ).run(decision === "approve" ? "approved" : "blocked", actor, nowIso(), note ?? null, nowIso(), subscriptionId);

  audit(db, {
    entityType: "subscription",
    entityId: subscriptionId,
    action: `subscription.${decision}`,
    actor,
    reason: decision === "approve" ? "Operator approved subscription" : "Operator blocked subscription",
    detail: note ?? null,
  });
  return mapSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId));
}

/** Activate an approved subscription. */
export function activateSubscription(db, actor, subscriptionId) {
  const row = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId);
  if (!row) throw new FleetError("Subscription not found");
  if (row.status !== "approved") {
    throw new ApprovalError(`Cannot activate: subscription is "${row.status}" (must be "approved")`);
  }
  db.prepare(`UPDATE subscriptions SET status = 'active', updated_at = ? WHERE id = ?`).run(nowIso(), subscriptionId);
  audit(db, {
    entityType: "subscription",
    entityId: subscriptionId,
    action: "subscription.activate",
    actor,
    reason: "Approved subscription activated",
  });
  return mapSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId));
}

export function cancelSubscription(db, actor, subscriptionId, reason) {
  const row = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId);
  if (!row) throw new FleetError("Subscription not found");
  if (row.status === "cancelled") throw new FleetError("Subscription already cancelled");
  db.prepare(`UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?`).run(nowIso(), subscriptionId);
  audit(db, {
    entityType: "subscription",
    entityId: subscriptionId,
    action: "subscription.cancel",
    actor,
    reason: reason ?? "Subscription cancelled",
  });
  return mapSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(subscriptionId));
}

export function listSubscriptions(db, opts = {}) {
  const where = [];
  const params = [];
  if (opts.status) { where.push("status = ?"); params.push(opts.status); }
  if (opts.vehicleId) { where.push("vehicle_id = ?"); params.push(opts.vehicleId); }
  const sql = `SELECT * FROM subscriptions ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
  return db.prepare(sql).all(...params).map(mapSubscription);
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

export function createDispatch(db, actor, input) {
  requireVehicle(db, input.vehicleId);
  if (input.bookingId) {
    const booking = db.prepare("SELECT * FROM bookings WHERE id = ?").get(input.bookingId);
    if (!booking) throw new FleetError("Booking not found");
    if (booking.status !== "scheduled" && booking.status !== "active") {
      throw new ApprovalError(`Cannot dispatch: booking is "${booking.status}" (must be scheduled or active)`);
    }
  }
  const id = newId();
  db.prepare(
    `INSERT INTO dispatch (id, vehicle_id, booking_id, driver_name, status, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.vehicleId, input.bookingId ?? null, input.driverName ?? null,
    input.status ?? "assigned", input.notes ?? null, actor);

  audit(db, {
    entityType: "dispatch",
    entityId: id,
    action: "dispatch.create",
    actor,
    reason: "Vehicle dispatched",
    detail: JSON.stringify({ vehicleId: input.vehicleId, bookingId: input.bookingId ?? null, driverName: input.driverName ?? null }),
  });
  return mapDispatch(db.prepare("SELECT * FROM dispatch WHERE id = ?").get(id));
}

export function listDispatch(db, opts = {}) {
  const where = [];
  const params = [];
  if (opts.vehicleId) { where.push("vehicle_id = ?"); params.push(opts.vehicleId); }
  const sql = `SELECT * FROM dispatch ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY assigned_at DESC`;
  return db.prepare(sql).all(...params).map(mapDispatch);
}

/* ------------------------------------------------------------------ */
/* Mileage                                                             */
/* ------------------------------------------------------------------ */

export function recordMileage(db, actor, vehicleId, input) {
  const vehicle = requireVehicle(db, vehicleId);
  if (!Number.isInteger(input.odometerMiles) || input.odometerMiles < 0) {
    throw new FleetError("Odometer must be a non-negative integer");
  }
  if (input.odometerMiles < vehicle.odometer_miles) {
    throw new FleetError(`Odometer ${input.odometerMiles} is below current reading ${vehicle.odometer_miles}`);
  }
  const id = newId();
  db.prepare(
    `INSERT INTO mileage_readings (id, vehicle_id, odometer_miles, recorded_by, source, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, vehicleId, input.odometerMiles, actor, input.source ?? "manual", input.notes ?? null);

  db.prepare(`UPDATE vehicles SET odometer_miles = ?, updated_at = ? WHERE id = ?`)
    .run(input.odometerMiles, nowIso(), vehicleId);

  audit(db, {
    entityType: "vehicle",
    entityId: vehicleId,
    action: "vehicle.mileage",
    actor,
    reason: "Mileage reading recorded",
    detail: JSON.stringify({ odometerMiles: input.odometerMiles, source: input.source ?? "manual" }),
  });
  return mapMileage(db.prepare("SELECT * FROM mileage_readings WHERE id = ?").get(id));
}

export function listMileage(db, vehicleId) {
  const rows = vehicleId
    ? db.prepare("SELECT * FROM mileage_readings WHERE vehicle_id = ? ORDER BY recorded_at DESC").all(vehicleId)
    : db.prepare("SELECT * FROM mileage_readings ORDER BY recorded_at DESC").all();
  return rows.map(mapMileage);
}

/* ------------------------------------------------------------------ */
/* Inspections                                                         */
/* ------------------------------------------------------------------ */

export function addInspection(db, actor, vehicleId, input) {
  requireVehicle(db, vehicleId);
  const allowedKinds = ["pre_trip", "post_trip", "safety", "annual", "damage"];
  const allowedResults = ["pass", "fail", "conditional"];
  if (!allowedKinds.includes(input.kind)) throw new FleetError(`Invalid inspection kind "${input.kind}"`);
  if (!allowedResults.includes(input.result)) throw new FleetError(`Invalid inspection result "${input.result}"`);

  const id = newId();
  db.prepare(
    `INSERT INTO inspections (id, vehicle_id, kind, result, notes, inspected_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, vehicleId, input.kind, input.result, input.notes ?? null, actor);

  audit(db, {
    entityType: "vehicle",
    entityId: vehicleId,
    action: "vehicle.inspection",
    actor,
    reason: `Inspection recorded (${input.kind}: ${input.result})`,
    detail: JSON.stringify({ kind: input.kind, result: input.result }),
  });
  return mapInspection(db.prepare("SELECT * FROM inspections WHERE id = ?").get(id));
}

export function listInspections(db, vehicleId) {
  const rows = vehicleId
    ? db.prepare("SELECT * FROM inspections WHERE vehicle_id = ? ORDER BY inspected_at DESC").all(vehicleId)
    : db.prepare("SELECT * FROM inspections ORDER BY inspected_at DESC").all();
  return rows.map(mapInspection);
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                         */
/* ------------------------------------------------------------------ */

export function addMaintenance(db, actor, vehicleId, input) {
  requireVehicle(db, vehicleId);
  const allowedKinds = ["routine", "repair", "recall", "tire", "brake", "battery", "software"];
  if (!allowedKinds.includes(input.kind)) throw new FleetError(`Invalid maintenance kind "${input.kind}"`);
  if (!input.description?.trim()) throw new FleetError("Description is required");

  const id = newId();
  db.prepare(
    `INSERT INTO maintenance_records (id, vehicle_id, kind, description, cost_cents, status, performed_by, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, vehicleId, input.kind, input.description.trim(), input.costCents ?? 0,
    input.status ?? "scheduled", input.performedBy ?? null, actor);

  audit(db, {
    entityType: "vehicle",
    entityId: vehicleId,
    action: "vehicle.maintenance",
    actor,
    reason: "Maintenance record added",
    detail: JSON.stringify({ kind: input.kind, costCents: input.costCents ?? 0 }),
  });
  return mapMaintenance(db.prepare("SELECT * FROM maintenance_records WHERE id = ?").get(id));
}

export function completeMaintenance(db, actor, maintenanceId) {
  const row = db.prepare("SELECT * FROM maintenance_records WHERE id = ?").get(maintenanceId);
  if (!row) throw new FleetError("Maintenance record not found");
  if (row.status === "completed") throw new FleetError("Maintenance already completed");
  db.prepare(`UPDATE maintenance_records SET status = 'completed', completed_at = ?, performed_by = COALESCE(?, performed_by) WHERE id = ?`)
    .run(nowIso(), actor, maintenanceId);
  audit(db, {
    entityType: "maintenance_record",
    entityId: maintenanceId,
    action: "maintenance.complete",
    actor,
    reason: "Maintenance completed",
  });
  return mapMaintenance(db.prepare("SELECT * FROM maintenance_records WHERE id = ?").get(maintenanceId));
}

export function listMaintenance(db, vehicleId) {
  const rows = vehicleId
    ? db.prepare("SELECT * FROM maintenance_records WHERE vehicle_id = ? ORDER BY created_at DESC").all(vehicleId)
    : db.prepare("SELECT * FROM maintenance_records ORDER BY created_at DESC").all();
  return rows.map(mapMaintenance);
}

/* ------------------------------------------------------------------ */
/* Charging sessions                                                   */
/* ------------------------------------------------------------------ */

export function startChargingSession(db, actor, vehicleId, input) {
  requireVehicle(db, vehicleId);
  const id = newId();
  db.prepare(
    `INSERT INTO charging_sessions (id, vehicle_id, station_id, started_at, created_by)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, vehicleId, input.stationId ?? null, input.startedAt ?? nowIso(), actor);

  audit(db, {
    entityType: "vehicle",
    entityId: vehicleId,
    action: "vehicle.charging.start",
    actor,
    reason: "Charging session started",
    detail: JSON.stringify({ stationId: input.stationId ?? null }),
  });
  return mapCharging(db.prepare("SELECT * FROM charging_sessions WHERE id = ?").get(id));
}

export function completeChargingSession(db, actor, sessionId, input) {
  const row = db.prepare("SELECT * FROM charging_sessions WHERE id = ?").get(sessionId);
  if (!row) throw new FleetError("Charging session not found");
  if (row.status !== "active") throw new FleetError(`Charging session already ${row.status}`);
  if (input.energyKwh != null && input.energyKwh < 0) throw new FleetError("Energy must be non-negative");
  if (input.costCents != null && input.costCents < 0) throw new FleetError("Cost must be non-negative");

  db.prepare(
    `UPDATE charging_sessions SET status = 'completed', ended_at = ?, energy_kwh = ?, cost_cents = ? WHERE id = ?`,
  ).run(nowIso(), input.energyKwh ?? 0, input.costCents ?? 0, sessionId);

  audit(db, {
    entityType: "charging_session",
    entityId: sessionId,
    action: "vehicle.charging.complete",
    actor,
    reason: "Charging session completed",
    detail: JSON.stringify({ energyKwh: input.energyKwh ?? 0, costCents: input.costCents ?? 0 }),
  });
  return mapCharging(db.prepare("SELECT * FROM charging_sessions WHERE id = ?").get(sessionId));
}

export function listChargingSessions(db, vehicleId) {
  const rows = vehicleId
    ? db.prepare("SELECT * FROM charging_sessions WHERE vehicle_id = ? ORDER BY started_at DESC").all(vehicleId)
    : db.prepare("SELECT * FROM charging_sessions ORDER BY started_at DESC").all();
  return rows.map(mapCharging);
}

/* ------------------------------------------------------------------ */
/* Incidents                                                           */
/* ------------------------------------------------------------------ */

export function reportIncident(db, actor, vehicleId, input) {
  requireVehicle(db, vehicleId);
  const allowedKinds = ["accident", "damage", "theft", "vandalism", "breakdown", "other"];
  const allowedSeverity = ["minor", "moderate", "major", "critical"];
  if (!allowedKinds.includes(input.kind)) throw new FleetError(`Invalid incident kind "${input.kind}"`);
  if (!allowedSeverity.includes(input.severity ?? "minor")) throw new FleetError(`Invalid severity "${input.severity}"`);
  if (!input.description?.trim()) throw new FleetError("Description is required");

  const id = newId();
  db.prepare(
    `INSERT INTO incidents (id, vehicle_id, kind, severity, description, reported_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, vehicleId, input.kind, input.severity ?? "minor", input.description.trim(), actor);

  audit(db, {
    entityType: "vehicle",
    entityId: vehicleId,
    action: "vehicle.incident",
    actor,
    reason: `Incident reported (${input.kind})`,
    detail: JSON.stringify({ kind: input.kind, severity: input.severity ?? "minor" }),
  });
  return mapIncident(db.prepare("SELECT * FROM incidents WHERE id = ?").get(id));
}

export function resolveIncident(db, actor, incidentId, resolution) {
  const row = db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId);
  if (!row) throw new FleetError("Incident not found");
  if (row.status === "closed") throw new FleetError("Incident already closed");
  db.prepare(`UPDATE incidents SET status = 'closed', resolution = COALESCE(?, resolution) WHERE id = ?`)
    .run(resolution ?? null, incidentId);
  audit(db, {
    entityType: "incident",
    entityId: incidentId,
    action: "incident.close",
    actor,
    reason: "Incident closed",
    detail: resolution ?? null,
  });
  return mapIncident(db.prepare("SELECT * FROM incidents WHERE id = ?").get(incidentId));
}

export function listIncidents(db, vehicleId) {
  const rows = vehicleId
    ? db.prepare("SELECT * FROM incidents WHERE vehicle_id = ? ORDER BY reported_at DESC").all(vehicleId)
    : db.prepare("SELECT * FROM incidents ORDER BY reported_at DESC").all();
  return rows.map(mapIncident);
}

/* ------------------------------------------------------------------ */
/* Payments                                                            */
/* ------------------------------------------------------------------ */

export function recordPayment(db, actor, input) {
  if (!input.bookingId && !input.subscriptionId) {
    throw new FleetError("Payment must reference a booking or subscription");
  }
  if (input.bookingId) {
    const b = db.prepare("SELECT * FROM bookings WHERE id = ?").get(input.bookingId);
    if (!b) throw new FleetError("Booking not found");
  }
  if (input.subscriptionId) {
    const s = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(input.subscriptionId);
    if (!s) throw new FleetError("Subscription not found");
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new FleetError("Amount must be a positive integer (cents)");
  }
  const allowedMethods = ["card", "cash", "ach", "credit", "other"];
  if (!allowedMethods.includes(input.method ?? "other")) throw new FleetError(`Invalid payment method "${input.method}"`);

  const id = newId();
  db.prepare(
    `INSERT INTO payments (id, booking_id, subscription_id, amount_cents, method, status, reference, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.bookingId ?? null, input.subscriptionId ?? null, input.amountCents,
    input.method ?? "other", input.status ?? "pending", input.reference ?? null, actor);

  audit(db, {
    entityType: "payment",
    entityId: id,
    action: "payment.record",
    actor,
    reason: "Payment recorded",
    detail: JSON.stringify({ amountCents: input.amountCents, method: input.method ?? "other", bookingId: input.bookingId ?? null, subscriptionId: input.subscriptionId ?? null }),
  });
  return mapPayment(db.prepare("SELECT * FROM payments WHERE id = ?").get(id));
}

export function settlePayment(db, actor, paymentId) {
  const row = db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId);
  if (!row) throw new FleetError("Payment not found");
  if (row.status !== "pending") throw new FleetError(`Payment already ${row.status}`);
  db.prepare(`UPDATE payments SET status = 'settled' WHERE id = ?`).run(paymentId);
  audit(db, {
    entityType: "payment",
    entityId: paymentId,
    action: "payment.settle",
    actor,
    reason: "Payment settled",
  });
  return mapPayment(db.prepare("SELECT * FROM payments WHERE id = ?").get(paymentId));
}

export function listPayments(db, opts = {}) {
  const where = [];
  const params = [];
  if (opts.vehicleId) {
    where.push("(booking_id IN (SELECT id FROM bookings WHERE vehicle_id = ?) OR subscription_id IN (SELECT id FROM subscriptions WHERE vehicle_id = ?))");
    params.push(opts.vehicleId, opts.vehicleId);
  }
  const sql = `SELECT * FROM payments ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY recorded_at DESC`;
  return db.prepare(sql).all(...params).map(mapPayment);
}

/* ------------------------------------------------------------------ */
/* Operating costs                                                     */
/* ------------------------------------------------------------------ */

export function recordOperatingCost(db, actor, vehicleId, input) {
  requireVehicle(db, vehicleId);
  const allowedCategories = ["insurance", "charging", "maintenance", "tires", "cleaning", "registration", "depreciation", "other"];
  if (!allowedCategories.includes(input.category)) throw new FleetError(`Invalid cost category "${input.category}"`);
  if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
    throw new FleetError("Amount must be a non-negative integer (cents)");
  }

  const id = newId();
  db.prepare(
    `INSERT INTO operating_costs (id, vehicle_id, category, amount_cents, occurred_at, note, recorded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, vehicleId, input.category, input.amountCents, input.occurredAt ?? nowIso(), input.note ?? null, actor);

  audit(db, {
    entityType: "vehicle",
    entityId: vehicleId,
    action: "vehicle.operating_cost",
    actor,
    reason: "Operating cost recorded",
    detail: JSON.stringify({ category: input.category, amountCents: input.amountCents }),
  });
  return mapOperatingCost(db.prepare("SELECT * FROM operating_costs WHERE id = ?").get(id));
}

export function listOperatingCosts(db, vehicleId) {
  const rows = vehicleId
    ? db.prepare("SELECT * FROM operating_costs WHERE vehicle_id = ? ORDER BY occurred_at DESC").all(vehicleId)
    : db.prepare("SELECT * FROM operating_costs ORDER BY occurred_at DESC").all();
  return rows.map(mapOperatingCost);
}

/* ------------------------------------------------------------------ */
/* Utilization & vehicle summary                                       */
/* ------------------------------------------------------------------ */

/**
 * Utilization for a vehicle: total booked hours, completed bookings,
 * miles driven (latest odometer minus first reading), charging energy,
 * and operating cost totals. Computed from recorded operations — never
 * fabricated.
 */
export function getUtilization(db, vehicleId) {
  const vehicle = requireVehicle(db, vehicleId);

  const bookings = db.prepare(
    "SELECT * FROM bookings WHERE vehicle_id = ? AND status IN ('scheduled','active','completed')",
  ).all(vehicleId);

  let bookedMs = 0;
  for (const b of bookings) {
    const start = new Date(b.starts_at).getTime();
    const end = new Date(b.ends_at).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) bookedMs += end - start;
  }

  const readings = db.prepare(
    "SELECT odometer_miles FROM mileage_readings WHERE vehicle_id = ? ORDER BY recorded_at ASC",
  ).all(vehicleId);
  const milesDriven = readings.length >= 1
    ? readings[readings.length - 1].odometer_miles - vehicle.base_odometer_miles
    : 0;

  const charging = db.prepare(
    "SELECT COALESCE(SUM(energy_kwh), 0) AS energy, COALESCE(SUM(cost_cents), 0) AS cost FROM charging_sessions WHERE vehicle_id = ? AND status = 'completed'",
  ).get(vehicleId);

  const costs = db.prepare(
    "SELECT COALESCE(SUM(amount_cents), 0) AS total FROM operating_costs WHERE vehicle_id = ?",
  ).get(vehicleId);

  const payments = db.prepare(
    `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM payments
     WHERE status = 'settled' AND (booking_id IN (SELECT id FROM bookings WHERE vehicle_id = ?)
        OR subscription_id IN (SELECT id FROM subscriptions WHERE vehicle_id = ?))`,
  ).get(vehicleId, vehicleId);

  return {
    vehicleId,
    completedBookings: bookings.filter((b) => b.status === "completed").length,
    bookedHours: Math.round((bookedMs / 3600000) * 100) / 100,
    milesDriven,
    chargingEnergyKwh: charging.energy,
    chargingCostCents: charging.cost,
    operatingCostCents: costs.total,
    settledRevenueCents: payments.total,
  };
}

/**
 * Full vehicle summary: profile + all operational records + utilization.
 * Used by the operator UI detail view.
 */
export function getVehicleSummary(db, vehicleId) {
  const vehicle = getVehicle(db, vehicleId);
  return {
    vehicle,
    bookings: listBookings(db, { vehicleId }),
    subscriptions: listSubscriptions(db, { vehicleId }),
    dispatch: listDispatch(db, { vehicleId }),
    mileage: listMileage(db, vehicleId),
    inspections: listInspections(db, vehicleId),
    maintenance: listMaintenance(db, vehicleId),
    chargingSessions: listChargingSessions(db, vehicleId),
    incidents: listIncidents(db, vehicleId),
    payments: listPayments(db, { vehicleId }),
    operatingCosts: listOperatingCosts(db, vehicleId),
    utilization: getUtilization(db, vehicleId),
  };
}

/* ------------------------------------------------------------------ */
/* Audit export                                                        */
/* ------------------------------------------------------------------ */

export function exportAuditJSON(db) {
  const rows = db.prepare(`SELECT * FROM audit_events ORDER BY created_at ASC`).all();
  return {
    exportedAt: nowIso(),
    source: "unitylink-os/fleet-mobility",
    auditEvents: rows,
    count: rows.length,
  };
}

export function exportAuditCSV(db) {
  const rows = db.prepare(`SELECT id, entity_type, entity_id, action, actor, role, reason, detail, created_at FROM audit_events ORDER BY created_at ASC`).all();
  const headers = ["id", "entity_type", "entity_id", "action", "actor", "role", "reason", "detail", "created_at"];
  const escape = (v) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape(r[h])).join(","));
  }
  return lines.join("\n") + "\n";
}

export function exportAuditMarkdown(db) {
  const rows = db.prepare(`SELECT * FROM audit_events ORDER BY created_at ASC`).all();
  const lines = [];
  lines.push("# UnityLink OS — Fleet & Mobility Audit Report");
  lines.push("");
  lines.push(`**Exported at:** ${nowIso()}`);
  lines.push(`**Source:** unitylink-os/fleet-mobility`);
  lines.push(`**Events:** ${rows.length}`);
  lines.push("");
  lines.push("| Timestamp | Actor | Action | Entity | Reason | Detail |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of rows) {
    const detail = r.detail ? String(r.detail).replace(/\|/g, "\\|").slice(0, 120) : "";
    lines.push(`| ${r.created_at} | ${r.actor} | ${r.action} | ${r.entity_type} (${r.entity_id.slice(0, 8)}) | ${(r.reason ?? "").replace(/\|/g, "\\|")} | ${detail} |`);
  }
  lines.push("");
  return lines.join("\n");
}