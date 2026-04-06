import { renderHook } from "@testing-library/react";
import { useBuilderValidation } from "../useBuilderValidation";
import type { Grant } from "../types";

describe("useBuilderValidation", () => {
  const createMockGrant = (overrides?: Partial<Grant>): Grant => ({
    id: "test-grant-1",
    name: "Test Grant",
    founder: "Test Foundation",
    amount: "$50,000",
    deadlineDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    matchScore: 85,
    aiVerdict: "Strong Match",
    url: "https://example.com/grant",
    decision: null,
    crmStatus: null,
    aiBrief: null,
    geographicScope: "National",
    complexityLabel: "Medium",
    fitScore: 85,
    aiScore: 85,
    validationStatus: null,
    eligibility: "Registered nonprofits",
    ...overrides,
  });

  describe("Error Validation (blocks generation)", () => {
    it("should block generation for expired deadline", () => {
      const expiredGrant = createMockGrant({
        deadlineDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: expiredGrant }));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0].category).toBe("deadline");
      expect(result.current.errors[0].message).toContain("expired");
    });

    it("should block generation for deadline today", () => {
      const todayGrant = createMockGrant({
        deadlineDate: new Date().toISOString(),
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: todayGrant }));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0].message).toContain("TODAY");
    });

    it("should block generation for failed validation status", () => {
      const failedGrant = createMockGrant({
        validationStatus: "FAILED",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: failedGrant }));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0].category).toBe("verification");
    });

    it("should block generation for missing funder", () => {
      const noFunderGrant = createMockGrant({
        founder: "",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: noFunderGrant }));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.errors[0].field).toBe("founder");
    });
  });

  describe("Warning Validation (allow with confirmation)", () => {
    it("should warn for deadline within 7 days", () => {
      const soonGrant = createMockGrant({
        deadlineDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: soonGrant }));

      expect(result.current.canGenerate).toBe(true); // No errors, just warnings
      expect(result.current.warnings.length).toBeGreaterThan(0);
      expect(result.current.warnings[0].category).toBe("deadline");
    });

    it("should warn for missing URL", () => {
      const noUrlGrant = createMockGrant({
        url: "",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: noUrlGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.warnings.some((w) => w.field === "url")).toBe(true);
    });

    it("should warn for missing amount", () => {
      const noAmountGrant = createMockGrant({
        amount: "",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: noAmountGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.warnings.some((w) => w.field === "amount")).toBe(true);
    });

    it("should warn for decision = No", () => {
      const rejectedGrant = createMockGrant({
        decision: "No",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: rejectedGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.warnings.some((w) => w.field === "decision")).toBe(true);
    });

    it("should warn for CRM status = Lost", () => {
      const lostGrant = createMockGrant({
        crmStatus: "Lost",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: lostGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.warnings.some((w) => w.field === "crmStatus")).toBe(true);
    });
  });

  describe("Info Validation (suggestions)", () => {
    it("should suggest adding to CRM if not in CRM", () => {
      const noCrmGrant = createMockGrant({
        crmStatus: null,
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: noCrmGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.infos.some((i) => i.field === "crmStatus")).toBe(true);
    });

    it("should suggest adding eligibility criteria", () => {
      const noEligibilityGrant = createMockGrant({
        eligibility: "",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: noEligibilityGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.infos.some((i) => i.field === "eligibility")).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle invalid date gracefully", () => {
      const invalidDateGrant = createMockGrant({
        deadlineDate: "invalid-date",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: invalidDateGrant }));

      expect(result.current.warnings.some((w) => w.message.includes("invalid"))).toBe(true);
    });

    it("should handle null grant", () => {
      const { result } = renderHook(() => useBuilderValidation({ grant: null }));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.issues.length).toBe(0);
    });

    it("should handle grant with all valid data", () => {
      const perfectGrant = createMockGrant();

      const { result } = renderHook(() => useBuilderValidation({ grant: perfectGrant }));

      expect(result.current.canGenerate).toBe(true);
      expect(result.current.errors.length).toBe(0);
      // May have some info suggestions, but no errors or warnings
    });

    it("should handle multiple errors", () => {
      const multiErrorGrant = createMockGrant({
        deadlineDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        founder: "",
        validationStatus: "FAILED",
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: multiErrorGrant }));

      expect(result.current.canGenerate).toBe(false);
      expect(result.current.errors.length).toBe(3);
    });
  });

  describe("Categorization", () => {
    it("should correctly categorize issues by severity", () => {
      const mixedGrant = createMockGrant({
        deadlineDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Error: expired
        url: "", // Warning: missing URL
        crmStatus: null, // Info: not in CRM
      });

      const { result } = renderHook(() => useBuilderValidation({ grant: mixedGrant }));

      expect(result.current.errors.length).toBeGreaterThan(0);
      expect(result.current.warnings.length).toBeGreaterThan(0);
      expect(result.current.infos.length).toBeGreaterThan(0);
      expect(result.current.issues.length).toBe(
        result.current.errors.length + result.current.warnings.length + result.current.infos.length
      );
    });
  });
});
