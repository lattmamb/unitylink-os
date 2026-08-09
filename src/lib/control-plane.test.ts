import { describe, expect, it } from "vitest";
import { statusMeta, timeAgo } from "@/lib/control-plane";

describe("control-plane lib", () => {
  describe("statusMeta", () => {
    it("maps known statuses to labels", () => {
      expect(statusMeta("in_progress").label).toBe("In progress");
      expect(statusMeta("blocked").label).toBe("Blocked");
      expect(statusMeta("done").label).toBe("Done");
    });

    it("falls back to the raw status for unknown values", () => {
      expect(statusMeta("mystery").label).toBe("mystery");
    });
  });

  describe("timeAgo", () => {
    it("returns an em dash for missing or invalid input", () => {
      expect(timeAgo(null)).toBe("—");
      expect(timeAgo(undefined)).toBe("—");
      expect(timeAgo("not-a-date")).toBe("—");
    });

    it("formats seconds, minutes, hours, and days", () => {
      const now = Date.now();
      expect(timeAgo(new Date(now - 30_000).toISOString())).toBe("30s ago");
      expect(timeAgo(new Date(now - 5 * 60_000).toISOString())).toBe("5m ago");
      expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString())).toBe("3h ago");
      expect(timeAgo(new Date(now - 2 * 86_400_000).toISOString())).toBe("2d ago");
    });
  });
});