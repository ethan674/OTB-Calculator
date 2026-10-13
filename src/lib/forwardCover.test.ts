import { describe, it, expect } from "vitest";
import { buildMonthlyHorizon } from "./otb-engine";
import { computeSeason1Result, computeSeason2Result } from "./storePlan";
import { computePlan } from "./plan";
import { brandMarketKey } from "./brandInventory";
import { emptyStore, type CalcStore } from "@/types";

const horizon = buildMonthlyHorizon(new Date());
const keysOf = (bucket: string) => horizon.filter((m) => m.bucket === bucket).map((m) => m.monthKey);

function store(s1Monthly: number, s2Monthly: number, overrides: Partial<CalcStore> = {}): CalcStore {
  const monthlyForecast: Record<string, number> = {};
  for (const k of keysOf("planning1")) monthlyForecast[k] = s1Monthly;
  for (const k of keysOf("planning2")) monthlyForecast[k] = s2Monthly;
  return { ...emptyStore(), storeName: "A", brand: "B", monthlyForecast, s1SellThroughPct: 0.65, s2SellThroughPct: 0.65, ...overrides };
}

// 6 months × 100,000 net at a 20% discount = 750,000 gross; 65% sell-through → 0.5385 seasons of cover.
const cover = (forwardGross: number) => (forwardGross * 0.35) / 0.65;

describe("target ending inventory sizes against the demand it has to cover", () => {
  it("the last season defaults to its own sales, exactly as before", () => {
    const s2 = computeSeason2Result(store(100_000, 100_000), horizon, 0);
    expect(s2.targetEosInventory).toBeCloseTo(cover(750_000), 4);
  });

  it("the brand outlook % scales what the last season has to cover", () => {
    const s2 = computeSeason2Result(store(100_000, 100_000), horizon, 0, -20);
    expect(s2.targetEosInventory).toBeCloseTo(cover(750_000 * 0.8), 4);
    expect(computeSeason2Result(store(100_000, 100_000), horizon, 0, 10).targetEosInventory).toBeCloseTo(cover(750_000 * 1.1), 4);
  });

  it("a per-store average-monthly-sales override beats the brand outlook", () => {
    const s = store(100_000, 100_000, { forwardMonthlySales: 50_000 });
    const s2 = computeSeason2Result(s, horizon, 0, -20); // outlook ignored
    expect(s2.targetEosInventory).toBeCloseTo(cover((50_000 * 6) / 0.8), 4);
  });

  it("season 1 covers season 2's actual forecast, not its own", () => {
    const s1 = computeSeason1Result(store(100_000, 200_000), horizon, 0, -50); // outlook only applies beyond season 2
    expect(s1.targetEosInventory).toBeCloseTo(cover((200_000 * 6) / 0.8), 4);
  });

  it("a locked (bought) season has no target regardless of the forward inputs", () => {
    const s = store(100_000, 100_000, { s2OnOrder: 1, forwardMonthlySales: 999_999 });
    expect(computeSeason2Result(s, horizon, 0, 50).targetEosInventory).toBe(0);
  });

  it("flows through the whole plan, keyed by brand+market", () => {
    const stores = [store(100_000, 100_000), { ...store(100_000, 100_000), brand: "Other" }];
    const plan = computePlan(stores, {}, horizon, {}, { [brandMarketKey("B", "Taiwan")]: -20 });
    const [b, other] = plan.season2Rows;
    expect(b.targetEosInventory).toBeCloseTo(cover(750_000 * 0.8), 4);
    expect(other.targetEosInventory).toBeCloseTo(cover(750_000), 4); // a different brand is untouched
  });
});
