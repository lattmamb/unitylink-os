/**
 * UnityLink OS — fleet & mobility operations test suite.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../db.mjs";
import {
  registerVehicle, listVehicles, getVehicle, updateVehicleStatus, getVehicleSummary,
  requestBooking, decideBooking, scheduleBooking, startBooking, completeBooking, cancelBooking, listBookings,
  requestSubscription, decideSubscription, activateSubscription, cancelSubscription, listSubscriptions,
  createDispatch, listDispatch,
  recordMileage, listMileage,
  addInspection, listInspections,
  addMaintenance, completeMaintenance, listMaintenance,
  startChargingSession, completeChargingSession, listChargingSessions,
  reportIncident, resolveIncident, listIncidents,
  recordPayment, settlePayment, listPayments,
  recordOperatingCost, listOperatingCosts,
  getUtilization,
  exportAuditJSON, exportAuditCSV, exportAuditMarkdown,
  FleetError, ApprovalError,
} from "../fleet.mjs";

const VIN = "1N4AZ1CP1KC123456";

function registerTestVehicle(db, overrides = {}) {
  return registerVehicle(db, "operator", {
    vin: VIN,
    make: "Nissan",
    model: "Leaf",
    year: 2019,
    color: "Silver",
    licensePlate: "IL-EV-001",
    titleStatus: "clean",
    insuranceProvider: "Pilot Insurer",
    insurancePolicy: "POL-1001",
    insuranceExpiresAt: "2027-01-01T00:00:00.000Z",
    odometerMiles: 12000,
    batteryCapacityKwh: 40,
    rangeMiles: 150,
    purchasePriceCents: 1200000,
    acquiredAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  });
}

describe("fleet & mobility operations", () => {
  describe("vehicle registry", () => {
    test("registers a vehicle with VIN, title, lien, and insurance", () => {
      const db = openDb();
      const v = registerTestVehicle(db, {
        titleStatus: "lien",
        lienHolder: "Pilot Credit Union",
        lienAmountCents: 800000,
      });
      assert.equal(v.vin, VIN);
      assert.equal(v.make, "Nissan");
      assert.equal(v.titleStatus, "lien");
      assert.equal(v.lienHolder, "Pilot Credit Union");
      assert.equal(v.lienAmountCents, 800000);
      assert.equal(v.insuranceProvider, "Pilot Insurer");
      assert.equal(v.insurancePolicy, "POL-1001");
      assert.equal(v.status, "available");
    });

    test("rejects an invalid VIN", () => {
      const db = openDb();
      assert.throws(
        () => registerVehicle(db, "operator", { vin: "BAD", make: "Nissan", model: "Leaf", year: 2019 }),
        FleetError,
      );
    });

    test("rejects duplicate VINs", () => {
      const db = openDb();
      registerTestVehicle(db);
      assert.throws(() => registerTestVehicle(db), FleetError);
    });

    test("lists and updates vehicle status", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const all = listVehicles(db);
      assert.equal(all.length, 1);

      const updated = updateVehicleStatus(db, "operator", v.id, "maintenance", "Scheduled service");
      assert.equal(updated.status, "maintenance");
      assert.equal(listVehicles(db, { status: "maintenance" }).length, 1);
    });
  });

  describe("booking approval workflow", () => {
    test("request -> approve -> schedule -> start -> complete", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const booking = requestBooking(db, "operator", {
        vehicleId: v.id,
        customerName: "Ada Lovelace",
        customerEmail: "ada@example.com",
        purpose: "Pilot errand",
        startsAt: "2026-08-15T09:00:00.000Z",
        endsAt: "2026-08-15T17:00:00.000Z",
      });
      assert.equal(booking.status, "pending");

      const approved = decideBooking(db, "operator", booking.id, "approve", "Verified member");
      assert.equal(approved.status, "approved");

      const scheduled = scheduleBooking(db, "operator", booking.id);
      assert.equal(scheduled.status, "scheduled");

      const active = startBooking(db, "operator", booking.id);
      assert.equal(active.status, "active");

      const completed = completeBooking(db, "operator", booking.id);
      assert.equal(completed.status, "completed");
    });

    test("blocked booking cannot be scheduled", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const booking = requestBooking(db, "operator", {
        vehicleId: v.id, customerName: "Grace Hopper",
        startsAt: "2026-08-15T09:00:00.000Z", endsAt: "2026-08-15T17:00:00.000Z",
      });
      decideBooking(db, "operator", booking.id, "block", "Missing insurance verification");
      assert.throws(() => scheduleBooking(db, "operator", booking.id), ApprovalError);
    });

    test("booking end must be after start", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      assert.throws(
        () => requestBooking(db, "operator", {
          vehicleId: v.id, customerName: "Test",
          startsAt: "2026-08-15T17:00:00.000Z", endsAt: "2026-08-15T09:00:00.000Z",
        }),
        FleetError,
      );
    });
  });

  describe("subscription approval workflow", () => {
    test("request -> approve -> activate -> cancel", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const sub = requestSubscription(db, "operator", {
        vehicleId: v.id,
        memberName: "Katherine Johnson",
        memberEmail: "kj@example.com",
        plan: "pilot_monthly",
        monthlyCents: 29900,
      });
      assert.equal(sub.status, "pending");

      const approved = decideSubscription(db, "operator", sub.id, "approve", "Member verified");
      assert.equal(approved.status, "approved");

      const active = activateSubscription(db, "operator", sub.id);
      assert.equal(active.status, "active");

      const cancelled = cancelSubscription(db, "operator", sub.id, "Member request");
      assert.equal(cancelled.status, "cancelled");
    });

    test("blocked subscription cannot be activated", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const sub = requestSubscription(db, "operator", {
        vehicleId: v.id, memberName: "Test", plan: "pilot_monthly", monthlyCents: 29900,
      });
      decideSubscription(db, "operator", sub.id, "block", "No payment method on file");
      assert.throws(() => activateSubscription(db, "operator", sub.id), ApprovalError);
    });
  });

  describe("dispatch", () => {
    test("creates dispatch for a scheduled booking", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const booking = requestBooking(db, "operator", {
        vehicleId: v.id, customerName: "Dispatch Test",
        startsAt: "2026-08-15T09:00:00.000Z", endsAt: "2026-08-15T17:00:00.000Z",
      });
      decideBooking(db, "operator", booking.id, "approve");
      scheduleBooking(db, "operator", booking.id);

      const d = createDispatch(db, "operator", {
        vehicleId: v.id, bookingId: booking.id, driverName: "Driver One",
      });
      assert.equal(d.status, "assigned");
      assert.equal(listDispatch(db, { vehicleId: v.id }).length, 1);
    });

    test("refuses dispatch for a pending booking", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const booking = requestBooking(db, "operator", {
        vehicleId: v.id, customerName: "Dispatch Test",
        startsAt: "2026-08-15T09:00:00.000Z", endsAt: "2026-08-15T17:00:00.000Z",
      });
      assert.throws(
        () => createDispatch(db, "operator", { vehicleId: v.id, bookingId: booking.id }),
        ApprovalError,
      );
    });
  });

  describe("mileage", () => {
    test("records mileage and updates the vehicle odometer", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const reading = recordMileage(db, "operator", v.id, { odometerMiles: 12400, source: "manual" });
      assert.equal(reading.odometerMiles, 12400);
      assert.equal(getVehicle(db, v.id).odometerMiles, 12400);
    });

    test("rejects odometer rollback", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      assert.throws(
        () => recordMileage(db, "operator", v.id, { odometerMiles: 1000 }),
        FleetError,
      );
    });
  });

  describe("inspections, maintenance, charging, incidents", () => {
    test("records an inspection", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const inspection = addInspection(db, "operator", v.id, { kind: "safety", result: "pass", notes: "All good" });
      assert.equal(inspection.result, "pass");
      assert.equal(listInspections(db, v.id).length, 1);
    });

    test("records and completes maintenance", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const m = addMaintenance(db, "operator", v.id, {
        kind: "routine", description: "Tire rotation", costCents: 4500,
      });
      assert.equal(m.status, "scheduled");
      const done = completeMaintenance(db, "operator", m.id);
      assert.equal(done.status, "completed");
      assert.ok(done.completedAt);
    });

    test("records a charging session and completes it", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const session = startChargingSession(db, "operator", v.id, { stationId: "ST-01" });
      assert.equal(session.status, "active");
      const done = completeChargingSession(db, "operator", session.id, { energyKwh: 32.5, costCents: 1200 });
      assert.equal(done.status, "completed");
      assert.equal(done.energyKwh, 32.5);
    });

    test("reports and resolves an incident", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const incident = reportIncident(db, "operator", v.id, {
        kind: "damage", severity: "moderate", description: "Scratched rear bumper",
      });
      assert.equal(incident.status, "open");
      const closed = resolveIncident(db, "operator", incident.id, "Repaired 2026-08-09");
      assert.equal(closed.status, "closed");
    });
  });

  describe("payments and operating costs", () => {
    test("records and settles a payment against a booking", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const booking = requestBooking(db, "operator", {
        vehicleId: v.id, customerName: "Pay Test",
        startsAt: "2026-08-15T09:00:00.000Z", endsAt: "2026-08-15T17:00:00.000Z",
      });
      const payment = recordPayment(db, "operator", {
        bookingId: booking.id, amountCents: 4500, method: "card",
      });
      assert.equal(payment.status, "pending");
      const settled = settlePayment(db, "operator", payment.id);
      assert.equal(settled.status, "settled");
    });

    test("payment must reference a booking or subscription", () => {
      const db = openDb();
      assert.throws(
        () => recordPayment(db, "operator", { amountCents: 4500, method: "card" }),
        FleetError,
      );
    });

    test("records operating costs", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const cost = recordOperatingCost(db, "operator", v.id, {
        category: "insurance", amountCents: 15000, note: "Monthly premium",
      });
      assert.equal(cost.category, "insurance");
      assert.equal(listOperatingCosts(db, v.id).length, 1);
    });
  });

  describe("utilization", () => {
    test("computes utilization from recorded operations", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      recordMileage(db, "operator", v.id, { odometerMiles: 12400 });
      const booking = requestBooking(db, "operator", {
        vehicleId: v.id, customerName: "Util Test",
        startsAt: "2026-08-15T09:00:00.000Z", endsAt: "2026-08-15T17:00:00.000Z",
      });
      decideBooking(db, "operator", booking.id, "approve");
      scheduleBooking(db, "operator", booking.id);
      startBooking(db, "operator", booking.id);
      completeBooking(db, "operator", booking.id);
      recordOperatingCost(db, "operator", v.id, { category: "insurance", amountCents: 15000 });

      const u = getUtilization(db, v.id);
      assert.equal(u.completedBookings, 1);
      assert.equal(u.bookedHours, 8);
      assert.equal(u.milesDriven, 400);
      assert.equal(u.operatingCostCents, 15000);
    });
  });

  describe("vehicle summary and audit export", () => {
    test("builds a full vehicle summary", () => {
      const db = openDb();
      const v = registerTestVehicle(db);
      const summary = getVehicleSummary(db, v.id);
      assert.equal(summary.vehicle.id, v.id);
      assert.ok(Array.isArray(summary.bookings));
      assert.ok(Array.isArray(summary.inspections));
      assert.ok(summary.utilization);
    });

    test("exports audit JSON, CSV, and Markdown", () => {
      const db = openDb();
      registerTestVehicle(db);
      const json = exportAuditJSON(db);
      assert.ok(json.count >= 1);
      assert.equal(json.source, "unitylink-os/fleet-mobility");

      const csv = exportAuditCSV(db);
      assert.ok(csv.includes("vehicle.register"));

      const md = exportAuditMarkdown(db);
      assert.ok(md.includes("Fleet & Mobility Audit Report"));
      assert.ok(md.includes("vehicle.register"));
    });
  });
});