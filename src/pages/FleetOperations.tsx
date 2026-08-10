import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BatteryCharging,
  CalendarClock,
  Car,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Gauge,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  fleetMobility,
  statusMeta,
  formatCents,
  VEHICLE_STATUSES,
  TITLE_STATUSES,
  INSPECTION_KINDS,
  INSPECTION_RESULTS,
  MAINTENANCE_KINDS,
  INCIDENT_KINDS,
  INCIDENT_SEVERITIES,
  COST_CATEGORIES,
  type Vehicle,
  type Booking,
  type Subscription,
  type VehicleSummary,
} from "@/lib/fleet-mobility";

type Tab = "vehicles" | "bookings" | "subscriptions" | "operations";

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Car }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/40">{label}</p>
        <Icon className="h-4 w-4 text-white/35" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", meta.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label.replace("_", " ")}
    </span>
  );
}

function KindBadge({ label }: { label: string }) {
  return (
    <Badge className="border-white/10 bg-white/[0.05] text-white/60 capitalize">{label.replace("_", " ")}</Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Vehicle registry                                                    */
/* ------------------------------------------------------------------ */

function RegisterVehicleForm({ onRegistered }: { onRegistered: () => void }) {
  const [vin, setVin] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [color, setColor] = useState("");
  const [licensePlate, setLicensePlate] = useState("");
  const [titleStatus, setTitleStatus] = useState<string>("clean");
  const [lienHolder, setLienHolder] = useState("");
  const [lienAmount, setLienAmount] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicy, setInsurancePolicy] = useState("");
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState("");
  const [odometer, setOdometer] = useState("");
  const [batteryKwh, setBatteryKwh] = useState("");
  const [rangeMiles, setRangeMiles] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [acquiredAt, setAcquiredAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await fleetMobility.registerVehicle({
        vin,
        make,
        model,
        year: Number(year),
        color: color || undefined,
        licensePlate: licensePlate || undefined,
        titleStatus,
        lienHolder: lienHolder || undefined,
        lienAmountCents: lienAmount ? Math.round(Number(lienAmount) * 100) : undefined,
        insuranceProvider: insuranceProvider || undefined,
        insurancePolicy: insurancePolicy || undefined,
        insuranceExpiresAt: insuranceExpiresAt ? new Date(insuranceExpiresAt).toISOString() : undefined,
        odometerMiles: odometer ? Number(odometer) : undefined,
        batteryCapacityKwh: batteryKwh ? Number(batteryKwh) : undefined,
        rangeMiles: rangeMiles ? Number(rangeMiles) : undefined,
        purchasePriceCents: purchasePrice ? Math.round(Number(purchasePrice) * 100) : undefined,
        acquiredAt: acquiredAt ? new Date(acquiredAt).toISOString() : undefined,
      });
      setVin(""); setMake(""); setModel(""); setYear(""); setColor(""); setLicensePlate("");
      setLienHolder(""); setLienAmount(""); setInsuranceProvider(""); setInsurancePolicy(""); setInsuranceExpiresAt("");
      setOdometer(""); setBatteryKwh(""); setRangeMiles(""); setPurchasePrice(""); setAcquiredAt("");
      onRegistered();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Car className="h-4 w-4 text-cyan-200/70" /> Register vehicle asset
      </h3>
      <p className="mt-1 text-xs text-white/40">
        Records the real asset: VIN, title/lien, insurance, and acquisition details. Every mutation is audited.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">VIN * (17 characters)</Label>
          <Input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="1N4AZ1CP1KC123456" className="mt-1 border-white/10 bg-black/20 font-mono" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Make *</Label>
          <Input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Nissan" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Model *</Label>
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Leaf" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Year *</Label>
          <Input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2019" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Color</Label>
          <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Silver" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">License plate</Label>
          <Input value={licensePlate} onChange={(e) => setLicensePlate(e.target.value)} placeholder="IL-EV-001" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Odometer (miles)</Label>
          <Input value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="12000" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Title status</Label>
          <Select value={titleStatus} onValueChange={setTitleStatus}>
            <SelectTrigger className="mt-1 border-white/10 bg-black/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TITLE_STATUSES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-white/50">Lien holder</Label>
          <Input value={lienHolder} onChange={(e) => setLienHolder(e.target.value)} placeholder="Pilot Credit Union" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Lien amount ($)</Label>
          <Input value={lienAmount} onChange={(e) => setLienAmount(e.target.value)} placeholder="8000.00" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Insurance provider</Label>
          <Input value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} placeholder="Pilot Insurer" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Insurance policy #</Label>
          <Input value={insurancePolicy} onChange={(e) => setInsurancePolicy(e.target.value)} placeholder="POL-1001" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Insurance expires</Label>
          <Input type="date" value={insuranceExpiresAt} onChange={(e) => setInsuranceExpiresAt(e.target.value)} className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Battery capacity (kWh)</Label>
          <Input value={batteryKwh} onChange={(e) => setBatteryKwh(e.target.value)} placeholder="40" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Range (miles)</Label>
          <Input value={rangeMiles} onChange={(e) => setRangeMiles(e.target.value)} placeholder="150" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Purchase price ($)</Label>
          <Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="12000.00" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Acquired date</Label>
          <Input type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} className="mt-1 border-white/10 bg-black/20" />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <Button onClick={submit} disabled={busy || !vin || !make || !model || !year} className="mt-4 bg-cyan-500/90 text-black hover:bg-cyan-400">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Register vehicle
      </Button>
    </div>
  );
}

function VehicleRow({ vehicle, onOpen }: { vehicle: Vehicle; onOpen: (id: string) => void }) {
  return (
    <button
      onClick={() => onOpen(vehicle.id)}
      className="group flex w-full items-center gap-3 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5 text-left transition hover:border-white/15 hover:bg-white/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{vehicle.year} {vehicle.make} {vehicle.model}</span>
          <StatusBadge status={vehicle.status} />
          <KindBadge label={vehicle.titleStatus} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
          <span className="font-mono text-cyan-200/60">{vehicle.vin}</span>
          {vehicle.licensePlate ? <span>{vehicle.licensePlate}</span> : null}
          {vehicle.insuranceProvider ? <span className="text-emerald-200/60">insured · {vehicle.insuranceProvider}</span> : <span className="text-amber-200/60">no insurance on file</span>}
          <span className="ml-auto">{vehicle.odometerMiles.toLocaleString()} mi</span>
        </div>
      </div>
    </button>
  );
}

function VehicleDetailPanel({ summary, onRefresh }: { summary: VehicleSummary; onRefresh: () => void }) {
  const v = summary.vehicle;
  const u = summary.utilization;
  const [status, setStatus] = useState<string>(v.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStatus = async () => {
    setBusy(true);
    setError(null);
    try {
      await fleetMobility.updateVehicleStatus(v.id, status, "Operator status change");
      onRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{v.year} {v.make} {v.model}</h3>
          <StatusBadge status={v.status} />
          <KindBadge label={v.titleStatus} />
        </div>
        <div className="mt-3 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">VIN</p>
            <p className="mt-1 break-all font-mono text-cyan-200/70">{v.vin}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">License plate</p>
            <p className="mt-1 font-mono text-white/60">{v.licensePlate ?? "—"}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Title / lien</p>
            <p className="mt-1 text-white/60">
              {v.titleStatus}
              {v.lienHolder ? ` · ${v.lienHolder} (${formatCents(v.lienAmountCents)})` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Insurance</p>
            <p className="mt-1 text-white/60">
              {v.insuranceProvider ? `${v.insuranceProvider} · ${v.insurancePolicy ?? ""}` : "None on file"}
              {v.insuranceExpiresAt ? ` · expires ${new Date(v.insuranceExpiresAt).toLocaleDateString()}` : ""}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Odometer</p>
            <p className="mt-1 text-white/60">{v.odometerMiles.toLocaleString()} mi (base {v.baseOdometerMiles.toLocaleString()})</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <p className="text-white/30">Acquired</p>
            <p className="mt-1 text-white/60">{v.acquiredAt ? new Date(v.acquiredAt).toLocaleDateString() : "—"}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <Label className="text-xs text-white/50">Change status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1 border-white/10 bg-black/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={changeStatus} disabled={busy || status === v.status} size="sm" className="bg-cyan-500/90 text-black hover:bg-cyan-400">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Update
          </Button>
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Completed bookings" value={u.completedBookings} icon={CalendarClock} />
        <StatCard label="Booked hours" value={u.bookedHours} icon={Truck} />
        <StatCard label="Miles driven" value={u.milesDriven.toLocaleString()} icon={Gauge} />
        <StatCard label="Charging energy" value={`${u.chargingEnergyKwh} kWh`} icon={BatteryCharging} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Operating costs" value={formatCents(u.operatingCostCents)} icon={DollarSign} />
        <StatCard label="Settled revenue" value={formatCents(u.settledRevenueCents)} icon={CheckCircle2} />
        <StatCard label="Open incidents" value={summary.incidents.filter((i) => i.status !== "closed").length} icon={ShieldCheck} />
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h4 className="text-xs font-semibold text-white/70">Recent operations</h4>
        <div className="mt-3 space-y-2 text-xs">
          {summary.inspections.slice(0, 3).map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
              <ClipboardCheck className="h-3.5 w-3.5 text-cyan-200/60" />
              <span className="capitalize text-white/60">{i.kind.replace("_", " ")} inspection</span>
              <StatusBadge status={i.result} />
              <span className="ml-auto text-white/30">{new Date(i.inspectedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {summary.maintenance.slice(0, 3).map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
              <Wrench className="h-3.5 w-3.5 text-cyan-200/60" />
              <span className="text-white/60">{m.description}</span>
              <StatusBadge status={m.status} />
              <span className="ml-auto text-white/30">{formatCents(m.costCents)}</span>
            </div>
          ))}
          {summary.incidents.slice(0, 3).map((i) => (
            <div key={i.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-200/60" />
              <span className="capitalize text-white/60">{i.kind} incident</span>
              <StatusBadge status={i.status} />
              <span className="ml-auto text-white/30">{new Date(i.reportedAt).toLocaleDateString()}</span>
            </div>
          ))}
          {summary.inspections.length === 0 && summary.maintenance.length === 0 && summary.incidents.length === 0 ? (
            <p className="text-white/30">No operational records yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

function BookingRequestForm({ vehicles, onCreated }: { vehicles: Vehicle[]; onCreated: () => void }) {
  const [vehicleId, setVehicleId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await fleetMobility.requestBooking({
        vehicleId,
        customerName,
        customerEmail: customerEmail || undefined,
        purpose: purpose || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      setCustomerName(""); setCustomerEmail(""); setPurpose(""); setStartsAt(""); setEndsAt("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <CalendarClock className="h-4 w-4 text-cyan-200/70" /> Request booking
      </h3>
      <p className="mt-1 text-xs text-white/40">Bookings require operator approval before they can be scheduled.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Vehicle *</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="mt-1 border-white/10 bg-black/20">
              <SelectValue placeholder="Select vehicle…" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.vin}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-white/50">Customer name *</Label>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Ada Lovelace" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Customer email</Label>
          <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="ada@example.com" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Purpose</Label>
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Pilot errand" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Starts *</Label>
          <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Ends *</Label>
          <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1 border-white/10 bg-black/20" />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <Button onClick={submit} disabled={busy || !vehicleId || !customerName || !startsAt || !endsAt} className="mt-4 bg-cyan-500/90 text-black hover:bg-cyan-400">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Request booking
      </Button>
    </div>
  );
}

function BookingRow({ booking, onAction, onChanged }: { booking: Booking; onAction: (id: string, action: string, note?: string) => Promise<void>; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: string, note?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onAction(booking.id, action, note);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const actions: Array<{ action: string; label: string; icon: typeof CheckCircle2; className: string }> = [];
  if (booking.status === "pending") {
    actions.push({ action: "approve", label: "Approve", icon: CheckCircle2, className: "bg-emerald-500/90 text-black hover:bg-emerald-400" });
    actions.push({ action: "block", label: "Block", icon: XCircle, className: "bg-red-500/80 text-white hover:bg-red-400" });
  }
  if (booking.status === "approved") actions.push({ action: "schedule", label: "Schedule", icon: CalendarClock, className: "bg-cyan-500/90 text-black hover:bg-cyan-400" });
  if (booking.status === "scheduled") actions.push({ action: "start", label: "Start", icon: Truck, className: "bg-cyan-500/90 text-black hover:bg-cyan-400" });
  if (booking.status === "active") actions.push({ action: "complete", label: "Complete", icon: CheckCircle2, className: "bg-emerald-500/90 text-black hover:bg-emerald-400" });
  if (!["completed", "cancelled"].includes(booking.status)) actions.push({ action: "cancel", label: "Cancel", icon: X, className: "border border-white/10 bg-black/20 text-white/60 hover:bg-white/[0.06]" });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{booking.customerName}</span>
        <StatusBadge status={booking.status} />
        <span className="text-[11px] text-white/35">{booking.purpose ?? "—"}</span>
        <span className="ml-auto text-[11px] text-white/35">
          {new Date(booking.startsAt).toLocaleString()} → {new Date(booking.endsAt).toLocaleString()}
        </span>
      </div>
      {booking.decisionNote ? <p className="mt-1 text-[11px] text-white/40">Note: {booking.decisionNote}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-red-300">{error}</p> : null}
      {actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.action} onClick={() => act(a.action)} disabled={busy} size="sm" className={a.className}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Subscriptions                                                       */
/* ------------------------------------------------------------------ */

function SubscriptionRequestForm({ vehicles, onCreated }: { vehicles: Vehicle[]; onCreated: () => void }) {
  const [vehicleId, setVehicleId] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [plan, setPlan] = useState("pilot_monthly");
  const [monthly, setMonthly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await fleetMobility.requestSubscription({
        vehicleId,
        memberName,
        memberEmail: memberEmail || undefined,
        plan,
        monthlyCents: Math.round(Number(monthly) * 100),
      });
      setMemberName(""); setMemberEmail(""); setMonthly("");
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-cyan-200/70" /> Request subscription
      </h3>
      <p className="mt-1 text-xs text-white/40">Subscriptions require operator approval before activation.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label className="text-xs text-white/50">Vehicle *</Label>
          <Select value={vehicleId} onValueChange={setVehicleId}>
            <SelectTrigger className="mt-1 border-white/10 bg-black/20">
              <SelectValue placeholder="Select vehicle…" />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.year} {v.make} {v.model} · {v.vin}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-white/50">Member name *</Label>
          <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Katherine Johnson" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Member email</Label>
          <Input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="kj@example.com" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Plan</Label>
          <Input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="pilot_monthly" className="mt-1 border-white/10 bg-black/20" />
        </div>
        <div>
          <Label className="text-xs text-white/50">Monthly rate ($) *</Label>
          <Input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="299.00" className="mt-1 border-white/10 bg-black/20" />
        </div>
      </div>
      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <Button onClick={submit} disabled={busy || !vehicleId || !memberName || !monthly} className="mt-4 bg-cyan-500/90 text-black hover:bg-cyan-400">
        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
        Request subscription
      </Button>
    </div>
  );
}

function SubscriptionRow({ subscription, onAction, onChanged }: { subscription: Subscription; onAction: (id: string, action: string, note?: string) => Promise<void>; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const act = async (action: string, note?: string) => {
    setBusy(true);
    setError(null);
    try {
      await onAction(subscription.id, action, note);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const actions: Array<{ action: string; label: string; icon: typeof CheckCircle2; className: string }> = [];
  if (subscription.status === "pending") {
    actions.push({ action: "approve", label: "Approve", icon: CheckCircle2, className: "bg-emerald-500/90 text-black hover:bg-emerald-400" });
    actions.push({ action: "block", label: "Block", icon: XCircle, className: "bg-red-500/80 text-white hover:bg-red-400" });
  }
  if (subscription.status === "approved") actions.push({ action: "activate", label: "Activate", icon: ShieldCheck, className: "bg-cyan-500/90 text-black hover:bg-cyan-400" });
  if (!["cancelled"].includes(subscription.status)) actions.push({ action: "cancel", label: "Cancel", icon: X, className: "border border-white/10 bg-black/20 text-white/60 hover:bg-white/[0.06]" });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/15 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{subscription.memberName}</span>
        <StatusBadge status={subscription.status} />
        <KindBadge label={subscription.plan} />
        <span className="ml-auto text-[11px] text-white/35">{formatCents(subscription.monthlyCents)}/mo</span>
      </div>
      {subscription.decisionNote ? <p className="mt-1 text-[11px] text-white/40">Note: {subscription.decisionNote}</p> : null}
      {error ? <p className="mt-1 text-[11px] text-red-300">{error}</p> : null}
      {actions.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button key={a.action} onClick={() => act(a.action)} disabled={busy} size="sm" className={a.className}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <a.icon className="h-3.5 w-3.5" />}
              {a.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Operations (per-vehicle records)                                    */
/* ------------------------------------------------------------------ */

function OperationsPanel({ summary, onChanged }: { summary: VehicleSummary; onChanged: () => void }) {
  const v = summary.vehicle;
  const [odometer, setOdometer] = useState("");
  const [inspectionKind, setInspectionKind] = useState<string>("safety");
  const [inspectionResult, setInspectionResult] = useState<string>("pass");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [maintKind, setMaintKind] = useState<string>("routine");
  const [maintDesc, setMaintDesc] = useState("");
  const [maintCost, setMaintCost] = useState("");
  const [incidentKind, setIncidentKind] = useState<string>("damage");
  const [incidentSeverity, setIncidentSeverity] = useState<string>("minor");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [costCategory, setCostCategory] = useState<string>("insurance");
  const [costAmount, setCostAmount] = useState("");
  const [costNote, setCostNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOdometer(""); setInspectionNotes(""); setMaintDesc(""); setMaintCost(""); setIncidentDesc(""); setCostAmount(""); setCostNote("");
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h4 className="text-xs font-semibold text-white/70">Record operations for {v.year} {v.make} {v.model}</h4>
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label className="text-xs text-white/50">Odometer (miles)</Label>
            <Input value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="12400" className="mt-1 border-white/10 bg-black/20" />
            <Button onClick={() => run(() => fleetMobility.recordMileage(v.id, { odometerMiles: Number(odometer), source: "manual" }))} disabled={busy || !odometer} size="sm" className="mt-2 w-full bg-cyan-500/90 text-black hover:bg-cyan-400">
              <Gauge className="mr-1.5 h-3.5 w-3.5" /> Record mileage
            </Button>
          </div>
          <div>
            <Label className="text-xs text-white/50">Inspection</Label>
            <div className="mt-1 flex gap-1.5">
              <Select value={inspectionKind} onValueChange={setInspectionKind}>
                <SelectTrigger className="border-white/10 bg-black/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={inspectionResult} onValueChange={setInspectionResult}>
                <SelectTrigger className="border-white/10 bg-black/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSPECTION_RESULTS.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input value={inspectionNotes} onChange={(e) => setInspectionNotes(e.target.value)} placeholder="Notes" className="mt-1.5 border-white/10 bg-black/20" />
            <Button onClick={() => run(() => fleetMobility.addInspection(v.id, { kind: inspectionKind, result: inspectionResult, notes: inspectionNotes || undefined }))} disabled={busy} size="sm" className="mt-2 w-full bg-cyan-500/90 text-black hover:bg-cyan-400">
              <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" /> Add inspection
            </Button>
          </div>
          <div>
            <Label className="text-xs text-white/50">Maintenance</Label>
            <Select value={maintKind} onValueChange={setMaintKind}>
              <SelectTrigger className="mt-1 border-white/10 bg-black/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MAINTENANCE_KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} placeholder="Tire rotation" className="mt-1.5 border-white/10 bg-black/20" />
            <Input value={maintCost} onChange={(e) => setMaintCost(e.target.value)} placeholder="Cost $ 45.00" className="mt-1.5 border-white/10 bg-black/20" />
            <Button onClick={() => run(() => fleetMobility.addMaintenance(v.id, { kind: maintKind, description: maintDesc, costCents: maintCost ? Math.round(Number(maintCost) * 100) : 0 }))} disabled={busy || !maintDesc} size="sm" className="mt-2 w-full bg-cyan-500/90 text-black hover:bg-cyan-400">
              <Wrench className="mr-1.5 h-3.5 w-3.5" /> Add maintenance
            </Button>
          </div>
          <div>
            <Label className="text-xs text-white/50">Incident</Label>
            <div className="mt-1 flex gap-1.5">
              <Select value={incidentKind} onValueChange={setIncidentKind}>
                <SelectTrigger className="border-white/10 bg-black/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_KINDS.map((k) => <SelectItem key={k} value={k} className="capitalize">{k}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={incidentSeverity} onValueChange={setIncidentSeverity}>
                <SelectTrigger className="border-white/10 bg-black/20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INCIDENT_SEVERITIES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input value={incidentDesc} onChange={(e) => setIncidentDesc(e.target.value)} placeholder="Description" className="mt-1.5 border-white/10 bg-black/20" />
            <Button onClick={() => run(() => fleetMobility.reportIncident(v.id, { kind: incidentKind, severity: incidentSeverity, description: incidentDesc }))} disabled={busy || !incidentDesc} size="sm" className="mt-2 w-full bg-cyan-500/90 text-black hover:bg-cyan-400">
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Report incident
            </Button>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <Label className="text-xs text-white/50">Operating cost</Label>
            <Select value={costCategory} onValueChange={setCostCategory}>
              <SelectTrigger className="mt-1 border-white/10 bg-black/20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-white/50">Amount ($)</Label>
            <Input value={costAmount} onChange={(e) => setCostAmount(e.target.value)} placeholder="150.00" className="mt-1 border-white/10 bg-black/20" />
          </div>
          <div>
            <Label className="text-xs text-white/50">Note</Label>
            <Input value={costNote} onChange={(e) => setCostNote(e.target.value)} placeholder="Monthly premium" className="mt-1 border-white/10 bg-black/20" />
          </div>
        </div>
        <Button onClick={() => run(() => fleetMobility.recordOperatingCost(v.id, { category: costCategory, amountCents: Math.round(Number(costAmount) * 100), note: costNote || undefined }))} disabled={busy || !costAmount} size="sm" className="mt-3 bg-cyan-500/90 text-black hover:bg-cyan-400">
          <DollarSign className="mr-1.5 h-3.5 w-3.5" /> Record cost
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h4 className="text-xs font-semibold text-white/70">Mileage history</h4>
          <div className="mt-3 space-y-1.5 text-xs">
            {summary.mileage.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-1.5">
                <Gauge className="h-3.5 w-3.5 text-cyan-200/60" />
                <span className="font-mono text-white/70">{m.odometerMiles.toLocaleString()} mi</span>
                <span className="text-white/30">{m.source}</span>
                <span className="ml-auto text-white/30">{new Date(m.recordedAt).toLocaleString()}</span>
              </div>
            ))}
            {summary.mileage.length === 0 ? <p className="text-white/30">No mileage readings.</p> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
          <h4 className="text-xs font-semibold text-white/70">Charging sessions</h4>
          <div className="mt-3 space-y-1.5 text-xs">
            {summary.chargingSessions.map((c) => (
              <div key={c.id} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-1.5">
                <BatteryCharging className="h-3.5 w-3.5 text-cyan-200/60" />
                <span className="text-white/70">{c.energyKwh} kWh</span>
                <StatusBadge status={c.status} />
                <span className="ml-auto text-white/30">{formatCents(c.costCents)}</span>
              </div>
            ))}
            {summary.chargingSessions.length === 0 ? <p className="text-white/30">No charging sessions.</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function FleetOperations() {
  const [tab, setTab] = useState<Tab>("vehicles");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<VehicleSummary | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, b, s] = await Promise.all([
        fleetMobility.listVehicles(),
        fleetMobility.listBookings(),
        fleetMobility.listSubscriptions(),
      ]);
      setVehicles(v.vehicles);
      setBookings(b.bookings);
      setSubscriptions(s.subscriptions);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openVehicle = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fleetMobility.getVehicleSummary(id);
      setSelectedId(id);
      setSummary(res.summary);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    if (!selectedId) return;
    try {
      const res = await fleetMobility.getVehicleSummary(selectedId);
      setSummary(res.summary);
      const v = await fleetMobility.listVehicles();
      setVehicles(v.vehicles);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [selectedId]);

  const bookingAction = useCallback(async (id: string, action: string, note?: string) => {
    switch (action) {
      case "approve": await fleetMobility.decideBooking(id, "approve", note); break;
      case "block": await fleetMobility.decideBooking(id, "block", note); break;
      case "schedule": await fleetMobility.scheduleBooking(id); break;
      case "start": await fleetMobility.startBooking(id); break;
      case "complete": await fleetMobility.completeBooking(id); break;
      case "cancel": await fleetMobility.cancelBooking(id, note); break;
    }
  }, []);

  const subscriptionAction = useCallback(async (id: string, action: string, note?: string) => {
    switch (action) {
      case "approve": await fleetMobility.decideSubscription(id, "approve", note); break;
      case "block": await fleetMobility.decideSubscription(id, "block", note); break;
      case "activate": await fleetMobility.activateSubscription(id); break;
      case "cancel": await fleetMobility.cancelSubscription(id, note); break;
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter(
      (v) =>
        v.vin.toLowerCase().includes(q) ||
        v.make.toLowerCase().includes(q) ||
        v.model.toLowerCase().includes(q) ||
        v.licensePlate?.toLowerCase().includes(q),
    );
  }, [vehicles, query]);

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: "vehicles", label: "Vehicle registry" },
    { id: "bookings", label: "Bookings" },
    { id: "subscriptions", label: "Subscriptions" },
    { id: "operations", label: "Operations" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Fleet & Mobility Operations</h1>
          <p className="mt-1 text-sm text-white/45">
            Vehicle registry (VIN, title, lien, insurance), bookings and subscriptions with operator approval, dispatch, mileage, inspections, maintenance, charging, incidents, payments, and operating costs.
          </p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                tab === t.id ? "bg-white/10 text-white" : "text-white/45 hover:text-white/70",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Vehicles" value={vehicles.length} icon={Car} />
        <StatCard label="Pending bookings" value={bookings.filter((b) => b.status === "pending").length} icon={CalendarClock} />
        <StatCard label="Pending subscriptions" value={subscriptions.filter((s) => s.status === "pending").length} icon={ShieldCheck} />
        <StatCard label="Active subscriptions" value={subscriptions.filter((s) => s.status === "active").length} icon={CheckCircle2} />
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-200">
          {error}
          <Button variant="outline" size="sm" className="ml-3 border-white/10 bg-black/20" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : null}

      {tab === "vehicles" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by VIN, make, model, or plate…"
                className="border-white/10 bg-black/20 pl-9"
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-white/40">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading fleet…
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
                No vehicles registered yet. Register the first pilot vehicle to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((v) => (
                  <VehicleRow key={v.id} vehicle={v} onOpen={openVehicle} />
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <RegisterVehicleForm onRegistered={refresh} />
            {summary ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white/70">Vehicle detail</h4>
                  <button onClick={() => setSummary(null)} className="text-white/40 hover:text-white/70">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <VehicleDetailPanel summary={summary} onRefresh={refreshSummary} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "bookings" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-white/40">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading bookings…
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
                No bookings yet. Request a booking to start the approval workflow.
              </div>
            ) : (
              bookings.map((b) => (
                <BookingRow key={b.id} booking={b} onAction={bookingAction} onChanged={refresh} />
              ))
            )}
          </div>
          <BookingRequestForm vehicles={vehicles} onCreated={refresh} />
        </div>
      )}

      {tab === "subscriptions" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="space-y-2">
            {loading ? (
              <div className="flex items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-white/40">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading subscriptions…
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
                No subscriptions yet. Request a subscription to start the approval workflow.
              </div>
            ) : (
              subscriptions.map((s) => (
                <SubscriptionRow key={s.id} subscription={s} onAction={subscriptionAction} onChanged={refresh} />
              ))
            )}
          </div>
          <SubscriptionRequestForm vehicles={vehicles} onCreated={refresh} />
        </div>
      )}

      {tab === "operations" && (
        <div className="mt-6">
          {summary ? (
            <OperationsPanel summary={summary} onChanged={refreshSummary} />
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-16 text-center text-sm text-white/35">
              Select a vehicle from the registry to record operations (mileage, inspections, maintenance, charging, incidents, costs).
            </div>
          )}
        </div>
      )}
    </main>
  );
}