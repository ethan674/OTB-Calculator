import { describe, expect, it } from "vitest";
import { computeAttention } from "./attention";
import type { OtbSeasonRow } from "./results";

function row(over: Partial<OtbSeasonRow>): OtbSeasonRow {
  return {
    storeId: "a", storeName: "A", brand: "B", channel: "Retail", market: "Taiwan", currency: "TWD", isOutlet: false,
    netRevenueTarget: 0, grossSalesValue: 0, discountValue: 0, totalAvailable: 0, eosInventory: 0, forwardGrossSales: 0,
    targetEosInventory: 0, buyLocked: false, sosInventory: 0, onOrder: 0, otb: 0, balance: 0, overbought: false,
    sellThroughPct: 0, discountPct: 0, sosFloored: false, sosOverridden: false, otbUsd: null, transferAdjustment: 0,
    ...over,
  };
}

describe("computeAttention", () => {
  it("flags an open store with negative OTB", () => {
    const items = computeAttention([row({ otb: -100, balance: -100, overbought: true })]);
    expect(items).toEqual([{ storeId: "a", storeName: "A", currency: "TWD", kind: "negative", amount: 100 }]);
  });

  it("flags a bought store holding more than it needs as overbought, and one holding less as short", () => {
    const items = computeAttention([
      row({ storeId: "x", buyLocked: true, balance: -500, overbought: true }),
      row({ storeId: "y", buyLocked: true, balance: 669 }),
    ]);
    expect(items.map((i) => [i.storeId, i.kind, i.amount])).toEqual([["x", "overbought", 500], ["y", "short", 669]]);
  });

  it("ignores outlets, healthy open stores and balanced bought stores", () => {
    expect(
      computeAttention([
        row({ isOutlet: true, otb: -50, balance: -50 }),
        row({ storeId: "h", otb: 1000, balance: 1000 }),
        row({ storeId: "b", buyLocked: true, balance: 0 }),
      ])
    ).toEqual([]);
  });
});
