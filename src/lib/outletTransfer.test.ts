import { describe, it, expect } from "vitest";
import { applyOutletTransfers } from "./outletTransfer";
import type { OtbSeasonRow } from "./results";

function makeRow(overrides: Partial<OtbSeasonRow> & Pick<OtbSeasonRow, "storeId" | "brand" | "market" | "isOutlet" | "otb" | "sosInventory">): OtbSeasonRow {
  return {
    storeName: overrides.storeId,
    channel: "Retail",
    currency: "USD",
    netRevenueTarget: 0,
    grossSalesValue: 0,
    discountValue: 0,
    totalAvailable: 0,
    targetEosInventory: 0,
    onOrder: 0,
    overbought: overrides.otb < 0,
    sellThroughPct: 0.7,
    discountPct: 0.2,
    sosFloored: false,
    sosOverridden: false,
    otbUsd: null,
    transferAdjustment: 0,
    ...overrides,
  };
}

function sumOtb(rows: OtbSeasonRow[]): number {
  return rows.reduce((sum, r) => sum + r.otb, 0);
}

describe("applyOutletTransfers", () => {
  it("routes an outlet's full need to its sole full-price peer", () => {
    const rows = [
      makeRow({ storeId: "F", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "O", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 40, sosInventory: 10 }),
    ];
    const shares = { F: 0.6, O: 0.4 };
    const result = applyOutletTransfers(rows, shares);

    const f = result.find((r) => r.storeId === "F")!;
    const o = result.find((r) => r.storeId === "O")!;

    expect(f.otb).toBeCloseTo(140, 6);
    expect(f.sosInventory).toBeCloseTo(460, 6);
    expect(f.transferAdjustment).toBeCloseTo(40, 6);

    expect(o.otb).toBe(0);
    expect(o.sosInventory).toBeCloseTo(50, 6);
    expect(o.transferAdjustment).toBeCloseTo(-40, 6);
  });

  it("splits an outlet's need across multiple full-price peers by their on-hand-allocation shares", () => {
    const rows = [
      makeRow({ storeId: "F1", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "F2", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 50, sosInventory: 300 }),
      makeRow({ storeId: "O", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 40, sosInventory: 5 }),
    ];
    // F1:F2 = 0.3:0.2 -> weights 0.6 / 0.4 among full-price stores
    const shares = { F1: 0.3, F2: 0.2, O: 0.5 };
    const result = applyOutletTransfers(rows, shares);

    const f1 = result.find((r) => r.storeId === "F1")!;
    const f2 = result.find((r) => r.storeId === "F2")!;
    const o = result.find((r) => r.storeId === "O")!;

    expect(f1.transferAdjustment).toBeCloseTo(24, 6); // 40 * 0.6
    expect(f2.transferAdjustment).toBeCloseTo(16, 6); // 40 * 0.4
    expect(f1.otb).toBeCloseTo(124, 6);
    expect(f2.otb).toBeCloseTo(66, 6);
    expect(o.otb).toBe(0);
  });

  it("does not transfer when the outlet's OTB is negative (already overstocked)", () => {
    const rows = [
      makeRow({ storeId: "F", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "O", brand: "Acme", market: "Taiwan", isOutlet: true, otb: -20, sosInventory: 999 }),
    ];
    const shares = { F: 0.6, O: 0.4 };
    const result = applyOutletTransfers(rows, shares);

    const f = result.find((r) => r.storeId === "F")!;
    const o = result.find((r) => r.storeId === "O")!;

    expect(f.otb).toBe(100);
    expect(f.sosInventory).toBe(500);
    expect(f.transferAdjustment).toBe(0);
    expect(o.otb).toBe(-20);
    expect(o.sosInventory).toBe(999);
    expect(o.transferAdjustment).toBe(0);
  });

  it("does not transfer when the group has no full-price peer", () => {
    const rows = [makeRow({ storeId: "O", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 40, sosInventory: 5 })];
    const result = applyOutletTransfers(rows, { O: 1 });

    expect(result[0].otb).toBe(40);
    expect(result[0].sosInventory).toBe(5);
    expect(result[0].transferAdjustment).toBe(0);
  });

  it("keeps brand+market groups independent — no cross-group transfer", () => {
    const rows = [
      makeRow({ storeId: "F", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "O", brand: "Acme", market: "Vietnam", isOutlet: true, otb: 40, sosInventory: 5 }),
    ];
    const result = applyOutletTransfers(rows, { F: 1, O: 1 });

    const f = result.find((r) => r.storeId === "F")!;
    const o = result.find((r) => r.storeId === "O")!;
    expect(f.otb).toBe(100);
    expect(f.transferAdjustment).toBe(0);
    // No full-price peer in Vietnam group, so the outlet's need goes unmet.
    expect(o.otb).toBe(40);
    expect(o.transferAdjustment).toBe(0);
  });

  it("falls back to an even split among full-price peers when all their shares are 0", () => {
    const rows = [
      makeRow({ storeId: "F1", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "F2", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "O", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 20, sosInventory: 5 }),
    ];
    const result = applyOutletTransfers(rows, {});

    const f1 = result.find((r) => r.storeId === "F1")!;
    const f2 = result.find((r) => r.storeId === "F2")!;
    expect(f1.transferAdjustment).toBeCloseTo(10, 6);
    expect(f2.transferAdjustment).toBeCloseTo(10, 6);
  });

  it("conserves the group's grand total OTB (dollars just move between rows)", () => {
    const rows = [
      makeRow({ storeId: "F1", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 100, sosInventory: 500 }),
      makeRow({ storeId: "F2", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 50, sosInventory: 300 }),
      makeRow({ storeId: "O1", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 40, sosInventory: 5 }),
      makeRow({ storeId: "O2", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 15, sosInventory: 2 }),
    ];
    const shares = { F1: 0.3, F2: 0.2, O1: 0.35, O2: 0.15 };
    const before = sumOtb(rows);
    const after = sumOtb(applyOutletTransfers(rows, shares));
    expect(after).toBeCloseTo(before, 6);
  });

  it("handles multiple outlets in one group, each zeroed out and fully covered", () => {
    const rows = [
      makeRow({ storeId: "F", brand: "Acme", market: "Taiwan", isOutlet: false, otb: 200, sosInventory: 1000 }),
      makeRow({ storeId: "O1", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 40, sosInventory: 5 }),
      makeRow({ storeId: "O2", brand: "Acme", market: "Taiwan", isOutlet: true, otb: 15, sosInventory: 2 }),
    ];
    const result = applyOutletTransfers(rows, { F: 1, O1: 0, O2: 0 });

    const f = result.find((r) => r.storeId === "F")!;
    const o1 = result.find((r) => r.storeId === "O1")!;
    const o2 = result.find((r) => r.storeId === "O2")!;

    expect(f.transferAdjustment).toBeCloseTo(55, 6); // 40 + 15
    expect(o1.otb).toBe(0);
    expect(o2.otb).toBe(0);
  });
});
