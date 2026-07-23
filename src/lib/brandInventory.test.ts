import { describe, it, expect } from "vitest";
import { getBrandMarketGroups, computeGroupShares, computeOnHandAllocation, brandMarketKey } from "./brandInventory";
import { emptyStore, type CalcStore } from "@/types";
import type { HorizonMonth } from "./otb-engine";

const HORIZON: HorizonMonth[] = [
  { year: 2026, month: 7, monthKey: "2026-07", seasonLabel: "FW26", bucket: "current" },
  { year: 2026, month: 8, monthKey: "2026-08", seasonLabel: "FW26", bucket: "current" },
];

function makeStore(overrides: Partial<CalcStore>): CalcStore {
  return { ...emptyStore(), ...overrides };
}

describe("getBrandMarketGroups", () => {
  it("groups stores by brand+market, ignoring channel/type differences", () => {
    const stores = [
      makeStore({ id: "a", brand: "Acme", market: "Taiwan" }),
      makeStore({ id: "b", brand: "Acme", market: "Taiwan", storeType: "Outlet" }),
      makeStore({ id: "c", brand: "Acme", market: "Vietnam" }),
      makeStore({ id: "d", brand: "Other", market: "Taiwan" }),
    ];
    const groups = getBrandMarketGroups(stores);
    expect(groups).toHaveLength(3);
    const acmeTaiwan = groups.find((g) => g.key === brandMarketKey("Acme", "Taiwan"));
    expect(acmeTaiwan?.storeIds.sort()).toEqual(["a", "b"]);
  });
});

describe("computeGroupShares", () => {
  it("splits proportionally to each store's current-season forecast", () => {
    const stores = [
      makeStore({ id: "a", brand: "Acme", market: "Taiwan", monthlyForecast: { "2026-07": 600, "2026-08": 600 } }), // 1200
      makeStore({ id: "b", brand: "Acme", market: "Taiwan", monthlyForecast: { "2026-07": 400, "2026-08": 400 } }), // 800
    ];
    const shares = computeGroupShares(stores, HORIZON);
    expect(shares["a"]).toBeCloseTo(1200 / 2000, 10);
    expect(shares["b"]).toBeCloseTo(800 / 2000, 10);
    expect(shares["a"] + shares["b"]).toBeCloseTo(1, 10);
  });

  it("splits evenly when the whole group's current-season forecast is 0", () => {
    const stores = [
      makeStore({ id: "a", brand: "Acme", market: "Taiwan" }),
      makeStore({ id: "b", brand: "Acme", market: "Taiwan" }),
      makeStore({ id: "c", brand: "Acme", market: "Taiwan" }),
    ];
    const shares = computeGroupShares(stores, HORIZON);
    expect(shares["a"]).toBeCloseTo(1 / 3, 10);
    expect(shares["b"]).toBeCloseTo(1 / 3, 10);
    expect(shares["c"]).toBeCloseTo(1 / 3, 10);
  });

  it("keeps separate brand+market groups independent", () => {
    const stores = [
      makeStore({ id: "a", brand: "Acme", market: "Taiwan", monthlyForecast: { "2026-07": 1000, "2026-08": 0 } }),
      makeStore({ id: "b", brand: "Acme", market: "Vietnam", monthlyForecast: { "2026-07": 500, "2026-08": 500 } }),
    ];
    const shares = computeGroupShares(stores, HORIZON);
    // Each is the sole store in its own group, so each gets 100% of its own group.
    expect(shares["a"]).toBeCloseTo(1, 10);
    expect(shares["b"]).toBeCloseTo(1, 10);
  });
});

describe("computeOnHandAllocation", () => {
  it("multiplies each store's share by its brand+market pool", () => {
    const stores = [
      makeStore({ id: "a", brand: "Acme", market: "Taiwan", monthlyForecast: { "2026-07": 900, "2026-08": 900 } }), // 1800
      makeStore({ id: "b", brand: "Acme", market: "Taiwan", monthlyForecast: { "2026-07": 600, "2026-08": 600 } }), // 1200
    ];
    const pool = { [brandMarketKey("Acme", "Taiwan")]: 30_000 };
    const allocation = computeOnHandAllocation(stores, pool, HORIZON);
    // a's share = 1800/3000 = 0.6, b's = 0.4
    expect(allocation["a"]).toBeCloseTo(18_000, 6);
    expect(allocation["b"]).toBeCloseTo(12_000, 6);
    expect(allocation["a"] + allocation["b"]).toBeCloseTo(30_000, 6);
  });

  it("returns 0 for a group with no pool entry", () => {
    const stores = [makeStore({ id: "a", brand: "Acme", market: "Taiwan" })];
    const allocation = computeOnHandAllocation(stores, {}, HORIZON);
    expect(allocation["a"]).toBe(0);
  });
});
