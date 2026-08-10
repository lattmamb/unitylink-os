/**
 * UnityLink OS — fleet & mobility operations client.
 *
 * Typed client for the fleet & mobility API (`server/fleet-mobility/api.mjs`).
 * The browser talks to the fleet API over the Vite dev proxy (`/api/fleet/*`).
 */

export interface Vehicle {
  id: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string | null;
  licensePlate: string | null;
  status: string;
  titleStatus: string;
  lienHolder: string | null;
  lienAmountCents: number | null;
  insuranceProvider: string | null;
  insurancePolicy: string | null;
  insuranceExpiresAt: string | null;
  baseOdometerMiles: number;
  odometerMiles: number;
  batteryCapacityKwh: number | null;
  rangeMiles: number | null;
  purchasePriceCents: number | null;
  acquiredAt: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  vehicleId: string;
  customerName: string;
  customerEmail: string | null;
  purpose: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  vehicleId: string;
  memberName: string;
  memberEmail: string | null;
  plan: string;
  monthlyCents: number;
  status: string;
  requestedBy: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Dispatch {
  id: string;
  vehicleId: string;
  bookingId: string | null;
  driverName: string | null;
  assignedAt: string;
  status: string;
  notes: string | null;
  createdBy: string;
  createdAt: string;
}

export interface MileageReading {
  id: string;
  vehicleId: string;
  odometerMiles: number;
  recordedAt: string;
  recordedBy: string;
  source: string;
  notes: string | null;
}

export interface Inspection {
  id: string;
  vehicleId: string;
  kind: string;
  result: string;
  notes: string | null;
  inspectedBy: string;
  inspectedAt: string;
  createdAt: string;
}

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  kind: string;
  description: string;
  costCents: number;
  status: string;
  completedAt: string | null;
  performedBy: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ChargingSession {
  id: string;
  vehicleId: string;
  stationId: string | null;
  startedAt: string;
  endedAt: string | null;
  energyKwh: number;
  costCents: number;
  status: string;
  createdBy: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  vehicleId: string;
  kind: string;
  severity: string;
  description: string;
  reportedBy: string;
  reportedAt: string;
  status: string;
  resolution: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  bookingId: string | null;
  subscriptionId: string | null;
  amountCents: number;
  method: string;
  status: string;
  reference: string | null;
  recordedBy: string;
  recordedAt: string;
  createdAt: string;
}

export interface OperatingCost {
  id: string;
  vehicleId: string;
  category: string;
  amountCents: number;
  occurredAt: string;
  note: string | null;
  recordedBy: string;
  createdAt: string;
}

export interface Utilization {
  vehicleId: string;
  completedBookings: number;
  bookedHours: number;
  milesDriven: number;
  chargingEnergyKwh: number;
  chargingCostCents: number;
  operatingCostCents: number;
  settledRevenueCents: number;
}

export interface VehicleSummary {
  vehicle: Vehicle;
  bookings: Booking[];
  subscriptions: Subscription[];
  dispatch: Dispatch[];
  mileage: MileageReading[];
  inspections: Inspection[];
  maintenance: MaintenanceRecord[];
  chargingSessions: ChargingSession[];
  incidents: Incident[];
  payments: Payment[];
  operatingCosts: OperatingCost[];
  utilization: Utilization;
}

export interface AuditEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor: string;
  role: string;
  reason: string | null;
  detail: string | null;
  created_at: string;
}

const BASE = "/api/fleet";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", "X-Operator": "operator" },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const fleetMobility = {
  health: () => request<{ ok: boolean; service: string }>("/health"),

  /* ---- vehicles ---- */
  listVehicles: (opts: { status?: string } = {}) => {
    const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : "";
    return request<{ vehicles: Vehicle[] }>(`/vehicles${qs}`);
  },

  getVehicle: (id: string) => request<{ vehicle: Vehicle }>(`/vehicles/${id}`),

  registerVehicle: (input: {
    vin: string;
    make: string;
    model: string;
    year: number;
    color?: string;
    licensePlate?: string;
    status?: string;
    titleStatus?: string;
    lienHolder?: string;
    lienAmountCents?: number;
    insuranceProvider?: string;
    insurancePolicy?: string;
    insuranceExpiresAt?: string;
    odometerMiles?: number;
    batteryCapacityKwh?: number;
    rangeMiles?: number;
    purchasePriceCents?: number;
    acquiredAt?: string;
    notes?: string;
  }) =>
    request<{ vehicle: Vehicle }>("/vehicles", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateVehicleStatus: (id: string, status: string, reason?: string) =>
    request<{ vehicle: Vehicle }>(`/vehicles/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason }),
    }),

  getVehicleSummary: (id: string) =>
    request<{ summary: VehicleSummary }>(`/vehicles/${id}/summary`),

  /* ---- mileage ---- */
  recordMileage: (vehicleId: string, input: { odometerMiles: number; source?: string; notes?: string }) =>
    request<{ mileage: MileageReading }>(`/vehicles/${vehicleId}/mileage`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /* ---- inspections ---- */
  addInspection: (vehicleId: string, input: { kind: string; result: string; notes?: string }) =>
    request<{ inspection: Inspection }>(`/vehicles/${vehicleId}/inspections`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /* ---- maintenance ---- */
  addMaintenance: (vehicleId: string, input: { kind: string; description: string; costCents?: number; status?: string; performedBy?: string }) =>
    request<{ maintenance: MaintenanceRecord }>(`/vehicles/${vehicleId}/maintenance`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  completeMaintenance: (id: string) =>
    request<{ maintenance: MaintenanceRecord }>(`/maintenance/${id}/complete`, { method: "POST" }),

  /* ---- charging ---- */
  startChargingSession: (vehicleId: string, input: { stationId?: string; startedAt?: string }) =>
    request<{ chargingSession: ChargingSession }>(`/vehicles/${vehicleId}/charging`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  completeChargingSession: (id: string, input: { energyKwh?: number; costCents?: number }) =>
    request<{ chargingSession: ChargingSession }>(`/charging/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /* ---- incidents ---- */
  reportIncident: (vehicleId: string, input: { kind: string; severity?: string; description: string }) =>
    request<{ incident: Incident }>(`/vehicles/${vehicleId}/incidents`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  resolveIncident: (id: string, resolution?: string) =>
    request<{ incident: Incident }>(`/incidents/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    }),

  /* ---- operating costs ---- */
  recordOperatingCost: (vehicleId: string, input: { category: string; amountCents: number; occurredAt?: string; note?: string }) =>
    request<{ operatingCost: OperatingCost }>(`/vehicles/${vehicleId}/costs`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /* ---- bookings ---- */
  listBookings: (opts: { status?: string; vehicleId?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.status) q.set("status", opts.status);
    if (opts.vehicleId) q.set("vehicleId", opts.vehicleId);
    const qs = q.toString();
    return request<{ bookings: Booking[] }>(`/bookings${qs ? `?${qs}` : ""}`);
  },

  requestBooking: (input: { vehicleId: string; customerName: string; customerEmail?: string; purpose?: string; startsAt: string; endsAt: string }) =>
    request<{ booking: Booking }>("/bookings", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  decideBooking: (id: string, decision: "approve" | "block", note?: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  scheduleBooking: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/schedule`, { method: "POST" }),

  startBooking: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/start`, { method: "POST" }),

  completeBooking: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/complete`, { method: "POST" }),

  cancelBooking: (id: string, reason?: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  /* ---- subscriptions ---- */
  listSubscriptions: (opts: { status?: string; vehicleId?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.status) q.set("status", opts.status);
    if (opts.vehicleId) q.set("vehicleId", opts.vehicleId);
    const qs = q.toString();
    return request<{ subscriptions: Subscription[] }>(`/subscriptions${qs ? `?${qs}` : ""}`);
  },

  requestSubscription: (input: { vehicleId: string; memberName: string; memberEmail?: string; plan: string; monthlyCents: number }) =>
    request<{ subscription: Subscription }>("/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  decideSubscription: (id: string, decision: "approve" | "block", note?: string) =>
    request<{ subscription: Subscription }>(`/subscriptions/${id}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, note }),
    }),

  activateSubscription: (id: string) =>
    request<{ subscription: Subscription }>(`/subscriptions/${id}/activate`, { method: "POST" }),

  cancelSubscription: (id: string, reason?: string) =>
    request<{ subscription: Subscription }>(`/subscriptions/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  /* ---- dispatch ---- */
  createDispatch: (input: { vehicleId: string; bookingId?: string; driverName?: string; status?: string; notes?: string }) =>
    request<{ dispatch: Dispatch }>("/dispatch", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /* ---- payments ---- */
  recordPayment: (input: { bookingId?: string; subscriptionId?: string; amountCents: number; method?: string; status?: string; reference?: string }) =>
    request<{ payment: Payment }>("/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  settlePayment: (id: string) =>
    request<{ payment: Payment }>(`/payments/${id}/settle`, { method: "POST" }),

  /* ---- audit export ---- */
  exportAudit: async (format: "json" | "csv" | "markdown" = "json") => {
    const res = await fetch(`${BASE}/audit/export?format=${format}`, {
      headers: { "X-Operator": "operator" },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return res.text();
  },
};

export const VEHICLE_STATUSES = [
  "available",
  "reserved",
  "in_service",
  "maintenance",
  "out_of_service",
  "retired",
] as const;

export const TITLE_STATUSES = ["clean", "salvage", "rebuilt", "lien"] as const;

export const BOOKING_STATUSES = [
  "pending",
  "approved",
  "blocked",
  "scheduled",
  "active",
  "completed",
  "cancelled",
] as const;

export const SUBSCRIPTION_STATUSES = [
  "pending",
  "approved",
  "blocked",
  "active",
  "cancelled",
] as const;

export const INSPECTION_KINDS = ["pre_trip", "post_trip", "safety", "annual", "damage"] as const;
export const INSPECTION_RESULTS = ["pass", "fail", "conditional"] as const;
export const MAINTENANCE_KINDS = ["routine", "repair", "recall", "tire", "brake", "battery", "software"] as const;
export const INCIDENT_KINDS = ["accident", "damage", "theft", "vandalism", "breakdown", "other"] as const;
export const INCIDENT_SEVERITIES = ["minor", "moderate", "major", "critical"] as const;
export const COST_CATEGORIES = ["insurance", "charging", "maintenance", "tires", "cleaning", "registration", "depreciation", "other"] as const;

export function statusMeta(status: string) {
  switch (status) {
    case "available":
    case "approved":
    case "active":
    case "completed":
    case "pass":
    case "settled":
      return { label: status, className: "border-emerald-300/25 bg-emerald-400/10 text-emerald-200", dot: "bg-emerald-400" };
    case "blocked":
    case "fail":
    case "critical":
    case "failed":
      return { label: status, className: "border-red-300/25 bg-red-400/10 text-red-200", dot: "bg-red-400" };
    case "pending":
    case "scheduled":
    case "in_service":
    case "reserved":
    case "conditional":
    case "open":
      return { label: status, className: "border-amber-300/25 bg-amber-400/10 text-amber-200", dot: "bg-amber-400" };
    case "maintenance":
    case "out_of_service":
    case "cancelled":
    case "closed":
      return { label: status, className: "border-white/10 bg-white/[0.06] text-white/60", dot: "bg-white/40" };
    default:
      return { label: status, className: "border-white/10 bg-white/[0.06] text-white/70", dot: "bg-white/40" };
  }
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}