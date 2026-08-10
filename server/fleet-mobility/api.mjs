#!/usr/bin/env node
/**
 * UnityLink OS — fleet & mobility operations HTTP API.
 *
 * Operator-facing API for the fleet and mobility layer. All mutations write
 * an append-only audit event; booking and subscription requests refuse to
 * proceed past approval until a human operator decides them.
 *
 * Endpoints (all JSON; use `X-Operator: <operator-id>` to attribute actions):
 *   GET  /api/health
 *   POST /api/vehicles                    register a vehicle (VIN, title, lien, insurance)
 *   GET  /api/vehicles[?status=]          list vehicles
 *   GET  /api/vehicles/:id                one vehicle
 *   POST /api/vehicles/:id/status         {status, reason?}
 *   GET  /api/vehicles/:id/summary        profile + all records + utilization
 *   POST /api/vehicles/:id/mileage        {odometerMiles, source?, notes?}
 *   POST /api/vehicles/:id/inspections    {kind, result, notes?}
 *   POST /api/vehicles/:id/maintenance    {kind, description, costCents?, status?, performedBy?}
 *   POST /api/maintenance/:id/complete
 *   POST /api/vehicles/:id/charging       start session {stationId?, startedAt?}
 *   POST /api/charging/:id/complete       {energyKwh?, costCents?}
 *   POST /api/vehicles/:id/incidents      {kind, severity?, description}
 *   POST /api/incidents/:id/resolve       {resolution?}
 *   POST /api/vehicles/:id/costs          {category, amountCents, occurredAt?, note?}
 *   POST /api/bookings                     {vehicleId, customerName, customerEmail?, purpose?, startsAt, endsAt}
 *   GET  /api/bookings[?status=&vehicleId=]
 *   POST /api/bookings/:id/decision        {decision: "approve"|"block", note?}
 *   POST /api/bookings/:id/schedule        (approved -> scheduled)
 *   POST /api/bookings/:id/start           (scheduled -> active)
 *   POST /api/bookings/:id/complete        (active -> completed)
 *   POST /api/bookings/:id/cancel          {reason?}
 *   POST /api/subscriptions                {vehicleId, memberName, memberEmail?, plan, monthlyCents}
 *   GET  /api/subscriptions[?status=&vehicleId=]
 *   POST /api/subscriptions/:id/decision   {decision: "approve"|"block", note?}
 *   POST /api/subscriptions/:id/activate   (approved -> active)
 *   POST /api/subscriptions/:id/cancel     {reason?}
 *   POST /api/dispatch                     {vehicleId, bookingId?, driverName?, status?, notes?}
 *   GET  /api/dispatch[?vehicleId=]
 *   POST /api/payments                     {bookingId?|subscriptionId?, amountCents, method?, status?, reference?}
 *   POST /api/payments/:id/settle
 *   GET  /api/payments[?vehicleId=]
 *   GET  /api/audit/export?format=json|csv|markdown
 *
 * Env:
 *   FLEET_PORT  (optional, default 8789)
 *   FLEET_DB    (optional, default ./data/fleet.db; ":memory:" for tests)
 *   FLEET_CORS  (optional origin allowlist, comma separated; default *)
 *
 * Run: node server/fleet-mobility/api.mjs
 */
import http from "node:http";
import { mkdirSync } from "node:fs";
import { parseArgs } from "node:util";
import { openDb } from "./db.mjs";
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
} from "./fleet.mjs";

const PORT = Number(process.env.FLEET_PORT || 8789);
const DB_PATH = process.env.FLEET_DB || "./data/fleet.db";
const CORS_ALLOW = (process.env.FLEET_CORS || "*").split(",").map((s) => s.trim());

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Operator",
  });
  res.end(payload);
}

function text(res, status, body, contentType) {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {});
      } catch {
        reject(new FleetError("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export function createFleetServer(db, opts = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "api") parts = parts.slice(1);
    const method = (req.method ?? "GET").toUpperCase();
    const actor = (req.headers["x-operator"] || "operator").toString();

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": CORS_ALLOW.includes("*") ? "*" : CORS_ALLOW[0],
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Operator",
      });
      res.end();
      return;
    }

    try {
      /* ---- health ---- */
      if (method === "GET" && parts.join("/") === "health") {
        return json(res, 200, { ok: true, service: "unitylink-os/fleet-mobility" });
      }

      /* ---- vehicles ---- */
      if (method === "POST" && parts.join("/") === "vehicles") {
        const body = await readBody(req);
        const vehicle = registerVehicle(db, actor, body);
        return json(res, 201, { vehicle });
      }

      if (method === "GET" && parts.join("/") === "vehicles") {
        return json(res, 200, {
          vehicles: listVehicles(db, { status: url.searchParams.get("status") ?? undefined }),
        });
      }

      if (method === "GET" && parts.length === 2 && parts[0] === "vehicles") {
        return json(res, 200, { vehicle: getVehicle(db, parts[1]) });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "status") {
        const body = await readBody(req);
        const vehicle = updateVehicleStatus(db, actor, parts[1], body.status, body.reason);
        return json(res, 200, { vehicle });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "summary") {
        return json(res, 200, { summary: getVehicleSummary(db, parts[1]) });
      }

      /* ---- mileage ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "mileage") {
        const body = await readBody(req);
        const reading = recordMileage(db, actor, parts[1], body);
        return json(res, 201, { mileage: reading });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "mileage") {
        return json(res, 200, { mileage: listMileage(db, parts[1]) });
      }

      /* ---- inspections ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "inspections") {
        const body = await readBody(req);
        const inspection = addInspection(db, actor, parts[1], body);
        return json(res, 201, { inspection });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "inspections") {
        return json(res, 200, { inspections: listInspections(db, parts[1]) });
      }

      /* ---- maintenance ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "maintenance") {
        const body = await readBody(req);
        const record = addMaintenance(db, actor, parts[1], body);
        return json(res, 201, { maintenance: record });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "maintenance" && parts[2] === "complete") {
        const record = completeMaintenance(db, actor, parts[1]);
        return json(res, 200, { maintenance: record });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "maintenance") {
        return json(res, 200, { maintenance: listMaintenance(db, parts[1]) });
      }

      /* ---- charging ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "charging") {
        const body = await readBody(req);
        const session = startChargingSession(db, actor, parts[1], body);
        return json(res, 201, { chargingSession: session });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "charging" && parts[2] === "complete") {
        const body = await readBody(req);
        const session = completeChargingSession(db, actor, parts[1], body);
        return json(res, 200, { chargingSession: session });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "charging") {
        return json(res, 200, { chargingSessions: listChargingSessions(db, parts[1]) });
      }

      /* ---- incidents ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "incidents") {
        const body = await readBody(req);
        const incident = reportIncident(db, actor, parts[1], body);
        return json(res, 201, { incident });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "incidents" && parts[2] === "resolve") {
        const body = await readBody(req);
        const incident = resolveIncident(db, actor, parts[1], body.resolution);
        return json(res, 200, { incident });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "incidents") {
        return json(res, 200, { incidents: listIncidents(db, parts[1]) });
      }

      /* ---- operating costs ---- */
      if (method === "POST" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "costs") {
        const body = await readBody(req);
        const cost = recordOperatingCost(db, actor, parts[1], body);
        return json(res, 201, { operatingCost: cost });
      }

      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "costs") {
        return json(res, 200, { operatingCosts: listOperatingCosts(db, parts[1]) });
      }

      /* ---- bookings ---- */
      if (method === "POST" && parts.join("/") === "bookings") {
        const body = await readBody(req);
        const booking = requestBooking(db, actor, body);
        return json(res, 201, { booking });
      }

      if (method === "GET" && parts.join("/") === "bookings") {
        return json(res, 200, {
          bookings: listBookings(db, {
            status: url.searchParams.get("status") ?? undefined,
            vehicleId: url.searchParams.get("vehicleId") ?? undefined,
          }),
        });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "decision") {
        const body = await readBody(req);
        const booking = decideBooking(db, actor, parts[1], body.decision, body.note);
        return json(res, 200, { booking });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "schedule") {
        const booking = scheduleBooking(db, actor, parts[1]);
        return json(res, 200, { booking });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "start") {
        const booking = startBooking(db, actor, parts[1]);
        return json(res, 200, { booking });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "complete") {
        const booking = completeBooking(db, actor, parts[1]);
        return json(res, 200, { booking });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "bookings" && parts[2] === "cancel") {
        const body = await readBody(req);
        const booking = cancelBooking(db, actor, parts[1], body.reason);
        return json(res, 200, { booking });
      }

      /* ---- subscriptions ---- */
      if (method === "POST" && parts.join("/") === "subscriptions") {
        const body = await readBody(req);
        const subscription = requestSubscription(db, actor, body);
        return json(res, 201, { subscription });
      }

      if (method === "GET" && parts.join("/") === "subscriptions") {
        return json(res, 200, {
          subscriptions: listSubscriptions(db, {
            status: url.searchParams.get("status") ?? undefined,
            vehicleId: url.searchParams.get("vehicleId") ?? undefined,
          }),
        });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "subscriptions" && parts[2] === "decision") {
        const body = await readBody(req);
        const subscription = decideSubscription(db, actor, parts[1], body.decision, body.note);
        return json(res, 200, { subscription });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "subscriptions" && parts[2] === "activate") {
        const subscription = activateSubscription(db, actor, parts[1]);
        return json(res, 200, { subscription });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "subscriptions" && parts[2] === "cancel") {
        const body = await readBody(req);
        const subscription = cancelSubscription(db, actor, parts[1], body.reason);
        return json(res, 200, { subscription });
      }

      /* ---- dispatch ---- */
      if (method === "POST" && parts.join("/") === "dispatch") {
        const body = await readBody(req);
        const dispatch = createDispatch(db, actor, body);
        return json(res, 201, { dispatch });
      }

      if (method === "GET" && parts.join("/") === "dispatch") {
        return json(res, 200, {
          dispatch: listDispatch(db, { vehicleId: url.searchParams.get("vehicleId") ?? undefined }),
        });
      }

      /* ---- payments ---- */
      if (method === "POST" && parts.join("/") === "payments") {
        const body = await readBody(req);
        const payment = recordPayment(db, actor, body);
        return json(res, 201, { payment });
      }

      if (method === "POST" && parts.length === 3 && parts[0] === "payments" && parts[2] === "settle") {
        const payment = settlePayment(db, actor, parts[1]);
        return json(res, 200, { payment });
      }

      if (method === "GET" && parts.join("/") === "payments") {
        return json(res, 200, {
          payments: listPayments(db, { vehicleId: url.searchParams.get("vehicleId") ?? undefined }),
        });
      }

      /* ---- utilization ---- */
      if (method === "GET" && parts.length === 3 && parts[0] === "vehicles" && parts[2] === "utilization") {
        return json(res, 200, { utilization: getUtilization(db, parts[1]) });
      }

      /* ---- audit export ---- */
      if (method === "GET" && parts.join("/") === "audit/export") {
        const format = url.searchParams.get("format") ?? "json";
        if (format === "csv") return text(res, 200, exportAuditCSV(db), "text/csv; charset=utf-8");
        if (format === "markdown") return text(res, 200, exportAuditMarkdown(db), "text/markdown; charset=utf-8");
        return json(res, 200, exportAuditJSON(db));
      }

      return json(res, 404, { error: "Not found" });
    } catch (err) {
      if (err instanceof ApprovalError) return json(res, 403, { error: err.message });
      if (err instanceof FleetError) return json(res, 400, { error: err.message });
      return json(res, 500, { error: err.message ?? "Internal error" });
    }
  });
}

// Direct execution: node server/fleet-mobility/api.mjs --port 8789 --db ./data/fleet.db
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: String(PORT) },
      db: { type: "string", default: DB_PATH },
    },
  });
  const dbPath = values.db === ":memory:" ? ":memory:" : values.db;
  if (dbPath !== ":memory:") mkdirSync(dbPath.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  const db = openDb(dbPath);
  const server = createFleetServer(db);
  const port = Number(values.port);
  server.listen(port, () => {
    console.log(`UnityLink OS fleet & mobility API listening on http://127.0.0.1:${port}`);
    console.log(`DB: ${dbPath}`);
  });
}