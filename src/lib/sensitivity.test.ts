import { describe, it, expect } from "vitest";
import { applyScenario, computeSensitivityGrid, SALES_CHANGES, SELL_THROUGH_DELTAS } from "./sensitivity";
import { buildMonthlyHorizon } from "./otb-engine";
import { computePlan } from "./plan";
import { computeSeasonSummary } from "./results";
import { emptyStore, type CalcStore } from "@/types";

const horizon = buildMonthlyHorizon(new Date());
const planningKeys = horizon.filter((m) => m.bucket !== "current").map((m) => m.monthKey);
const currentKeys = horizon.filter((m) => m.bucket === "current").map((m) => m.monthKey);

function store(overrides: Partial<CalcStore> = {}): CalcStore {
  const forecast: Record<string, number> = {};
  for (const k of planningKeys) forecast[k] = 100_000;
  for (const k of currentKeys) forecast[k] = 50_000;
  return { ...emptyStore(), storeName: "A", brand: "B", monthlyForecast: forecast, s1SellThroughPct: 0.65, s2SellThroughPct: 0.65, ...overrides };
}

const base = (stores: CalcStore[], season: "s1" | "s2") => {
  const plan = computePlan(stores, {}, horizon, {});
  const total = computeSeasonSummary(season === "s1" ? plan.season1Rows : plan.season2Rows, {}).totalOtb;
  return total.ok ? total.total : NaN;
};

describe("applyScenario", () => {
  it("scales planning months only, shifts sell-through, and never mutates the inputs", () => {
    const stores = [store()];
    const snapshot = JSON.stringify(stores);
    const [s] = applyScenario(stores, horizon, { sellThroughDeltaPts: -5, salesChangePct: 10 });
    expect(JSON.stringify(stores)).toBe(snapshot);
    expect(s.monthlyForecast[planningKeys[0]]).toBeCloseTo(110_000, 6);
    expect(s.monthlyForecast[currentKeys[0]]).toBe(50_000); // current season untouched
    expect(s.s1SellThroughPct).toBeCloseTo(0.6, 6);
  });

  it("keeps sell-through within 1%–100%", () => {
    const [s] = applyScenario([store({ s1SellThroughPct: 0.98, s2SellThroughPct: 0.03 })], horizon, { sellThroughDeltaPts: 10, salesChangePct: 0 });
    expect(s.s1SellThroughPct).toBe(1);
    expect(s.s2SellThroughPct).toBeCloseTo(0.13, 6);
    const [low] = applyScenario([store({ s2SellThroughPct: 0.03 })], horizon, { sellThroughDeltaPts: -10, salesChangePct: 0 });
    expect(low.s2SellThroughPct).toBe(0.01);
  });
});

describe("computeSensitivityGrid", () => {
  it("its base cell equals the plain plan, and the grid moves the right way", () => {
    const stores = [store()];
    const grid = computeSensitivityGrid(stores, {}, horizon, {}, "s1");
    const b = SELL_THROUGH_DELTAS.indexOf(0), c = SALES_CHANGES.indexOf(0);
    const val = (r: number, col: number) => {
      const t = grid[r][col].totalOtb;
      return t.ok ? t.total : NaN;
    };

    expect(val(b, c)).toBeCloseTo(base(stores, "s1"), 4);
    // No starting stock, so open-buy OTB = gross ÷ sell-through: it scales linearly with sales...
    expect(val(b, SALES_CHANGES.indexOf(10))).toBeCloseTo(val(b, c) * 1.1, 4);
    // ...and a lower sell-through target needs more ending stock, so more OTB.
    expect(val(SELL_THROUGH_DELTAS.indexOf(-5), c)).toBeCloseTo((val(b, c) * 0.65) / 0.6, 4);
    expect(val(SELL_THROUGH_DELTAS.indexOf(-10), c)).toBeGreaterThan(val(b, c));
    expect(val(SELL_THROUGH_DELTAS.indexOf(10), c)).toBeLessThan(val(b, c));
  });

  it("shows no OTB to flex when the season is already bought for", () => {
    const grid = computeSensitivityGrid([store({ s1OnOrder: 1_000_000 })], {}, horizon, {}, "s1");
    for (const row of grid) for (const cell of row) expect(cell.totalOtb.ok && cell.totalOtb.total).toBe(0);
  });
});
