import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  fleetMobility,
  statusMeta,
  formatCents,
  VEHICLE_STATUSES,
  TITLE_STATUSES,
  BOOKING_STATUSES,
  SUBSCRIPTION_STATUSES,
  INSPECTION_KINDS,
  MAINTENANCE_KINDS,
  INCIDENT_KINDS,
  COST_CATEGORIES,
} from "@/lib/fleet-mobility";

describe("fleet-mobility lib", () => {
  describe("statusMeta", () => {
    it("maps healthy statuses to emerald styling", () => {
      expect(statusMeta("available").dot).toBe("bg-emerald-400");
      expect(statusMeta("approved").dot).toBe("bg-emerald-400");
      expect(statusMeta("completed").dot).toBe("bg-emerald-400");
    });

    it("maps blocked/failed statuses to red styling", () => {
      expect(statusMeta("blocked").dot).toBe("bg-red-400");
      expect(statusMeta("fail").dot).toBe("bg-red-400");
    });

    it("maps pending/scheduled statuses to amber styling", () => {
      expect(statusMeta("pending").dot).toBe("bg-amber-400");
      expect(statusMeta("scheduled").dot).toBe("bg-amber-400");
    });
  });

  describe("formatCents", () => {
    it("formats cents as dollars", () => {
      expect(formatCents(29900)).toBe("$299.00");
      expect(formatCents(4500)).toBe("$45.00");
    });

    it("handles null and undefined", () => {
      expect(formatCents(null)).toBe("—");
      expect(formatCents(undefined)).toBe("—");
    });
  });

  describe("constants", () => {
    it("exposes vehicle statuses including available and maintenance", () => {
      expect(VEHICLE_STATUSES).toContain("available");
      expect(VEHICLE_STATUSES).toContain("maintenance");
    });

    it("exposes title statuses including clean and lien", () => {
      expect(TITLE_STATUSES).toContain("clean");
      expect(TITLE_STATUSES).toContain("lien");
    });

    it("exposes booking and subscription statuses", () => {
      expect(BOOKING_STATUSES).toContain("pending");
      expect(BOOKING_STATUSES).toContain("approved");
      expect(SUBSCRIPTION_STATUSES).toContain("active");
    });

    it("exposes inspection, maintenance, incident, and cost constants", () => {
      expect(INSPECTION_KINDS).toContain("safety");
      expect(MAINTENANCE_KINDS).toContain("battery");
      expect(INCIDENT_KINDS).toContain("accident");
      expect(COST_CATEGORIES).toContain("insurance");
    });
  });

  describe("client", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("registers a vehicle against the fleet endpoint", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          vehicle: { id: "v-1", vin: "1N4AZ1CP1KC123456", status: "available" },
        }),
      });

      const res = await fleetMobility.registerVehicle({
        vin: "1N4AZ1CP1KC123456",
        make: "Nissan",
        model: "Leaf",
        year: 2019,
        insuranceProvider: "Pilot Insurer",
      });

      expect(res.vehicle.vin).toBe("1N4AZ1CP1KC123456");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/fleet/vehicles");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body).make).toBe("Nissan");
      expect(init.headers["X-Operator"]).toBe("operator");
    });

    it("throws a readable error when the fleet API rejects", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Cannot schedule: booking is pending" }),
      });

      await expect(
        fleetMobility.scheduleBooking("b-1"),
      ).rejects.toThrow("Cannot schedule: booking is pending");
    });

    it("lists bookings with status and vehicle filters", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ bookings: [] }),
      });

      await fleetMobility.listBookings({ status: "pending", vehicleId: "v-1" });

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/fleet/bookings?status=pending&vehicleId=v-1");
    });

    it("fetches a vehicle summary", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ summary: { vehicle: { id: "v-1" }, utilization: {} } }),
      });

      const res = await fleetMobility.getVehicleSummary("v-1");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/fleet/vehicles/v-1/summary");
      expect(res.summary.vehicle.id).toBe("v-1");
    });

    it("decides a booking approval", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ booking: { id: "b-1", status: "approved" } }),
      });

      await fleetMobility.decideBooking("b-1", "approve", "Verified member");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/fleet/bookings/b-1/decision");
      expect(JSON.parse(init.body).decision).toBe("approve");
    });
  });
});