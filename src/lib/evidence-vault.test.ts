import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  evidenceVault,
  approvalStatusMeta,
  EVIDENCE_KINDS,
  SOURCE_KINDS,
  GATED_ACTION_TYPES,
} from "@/lib/evidence-vault";

describe("evidence-vault lib", () => {
  describe("approvalStatusMeta", () => {
    it("maps known statuses to labels and styling", () => {
      expect(approvalStatusMeta("approved").label).toBe("Approved");
      expect(approvalStatusMeta("approved").dot).toBe("bg-emerald-400");
      expect(approvalStatusMeta("blocked").label).toBe("Blocked");
      expect(approvalStatusMeta("blocked").dot).toBe("bg-red-400");
      expect(approvalStatusMeta("pending").label).toBe("Pending");
      expect(approvalStatusMeta("pending").dot).toBe("bg-amber-400");
    });

    it("falls back to the raw status for unknown values", () => {
      expect(approvalStatusMeta("mystery").label).toBe("mystery");
    });
  });

  describe("constants", () => {
    it("exposes evidence kinds including contract and receipt", () => {
      expect(EVIDENCE_KINDS).toContain("contract");
      expect(EVIDENCE_KINDS).toContain("receipt");
    });

    it("exposes source kinds including statute and regulation", () => {
      expect(SOURCE_KINDS).toContain("statute");
      expect(SOURCE_KINDS).toContain("regulation");
    });

    it("exposes gated action types including payment and legal_conclusion", () => {
      expect(GATED_ACTION_TYPES).toContain("payment");
      expect(GATED_ACTION_TYPES).toContain("legal_conclusion");
      expect(GATED_ACTION_TYPES).toContain("destructive_change");
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

    it("uploads evidence with base64 content to the vault endpoint", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          evidence: {
            id: "ev-1",
            sha256: "abc123",
            vaultPath: "data/vault/ab/c1",
          },
        }),
      });

      const res = await evidenceVault.uploadEvidence({
        title: "Signed agreement",
        kind: "contract",
        contentBase64: "aGVsbG8=",
      });

      expect(res.evidence.sha256).toBe("abc123");
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/evidence/evidence");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body).contentBase64).toBe("aGVsbG8=");
      expect(init.headers["X-Operator"]).toBe("operator");
    });

    it("throws a readable error when the vault rejects", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: "Gated action requires approval" }),
      });

      await expect(
        evidenceVault.executeGatedAction("appr-1"),
      ).rejects.toThrow("Gated action requires approval");
    });

    it("lists approvals with an optional status filter", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ approvals: [] }),
      });

      await evidenceVault.listApprovals("pending");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/evidence/approvals?status=pending");
    });

    it("fetches provenance for an evidence item", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ evidence: { id: "ev-1" }, provenance: [] }),
      });

      const res = await evidenceVault.provenance("ev-1");

      const [url] = fetchMock.mock.calls[0];
      expect(url).toBe("/api/evidence/evidence/ev-1/provenance");
      expect(res.provenance).toEqual([]);
    });
  });
});