import { computeSeasonSummary } from "./results";
import type { AggregateResult, FxRateMap, HorizonMonth } from "./otb-engine";
import { computePlan } from "./plan";
import type { CalcStore } from "@/types";

export interface Scenario {
  /** Shift every store's target sell-through by this many percentage points (open seasons only — bought seasons have no target). */
  sellThroughDeltaPts: number;
  /** Scale every planning-season monthly sales forecast (and per-store forward-sales overrides) by this percentage; the current season is left alone. */
  salesChangePct: number;
}

export const SELL_THROUGH_DELTAS = [-10, -5, 0, 5, 10];
export const SALES_CHANGES = [-20, -10, 0, 10, 20];

const clampSellThrough = (v: number) => Math.min(1, Math.max(0.01, v));

/** The stores as they'd be under a scenario. Never mutates the inputs. */
export function applyScenario(stores: CalcStore[], horizon: HorizonMonth[], scenario: Scenario): CalcStore[] {
  const planningKeys = horizon.filter((m) => m.bucket !== "current").map((m) => m.monthKey);
  const factor = 1 + scenario.salesChangePct / 100;
  const delta = scenario.sellThroughDeltaPts / 100;

  return stores.map((s) => {
    const monthlyForecast = { ...s.monthlyForecast };
    for (const key of planningKeys) {
      if (monthlyForecast[key] !== undefined) monthlyForecast[key] = monthlyForecast[key] * factor;
    }
    return {
      ...s,
      monthlyForecast,
      forwardMonthlySales: s.forwardMonthlySales === null ? null : s.forwardMonthlySales * factor,
      s1SellThroughPct: clampSellThrough(s.s1SellThroughPct + delta),
      s2SellThroughPct: clampSellThrough(s.s2SellThroughPct + delta),
    };
  });
}

export interface SensitivityCell {
  sellThroughDeltaPts: number;
  salesChangePct: number;
  totalOtb: AggregateResult;
}

/** Total OTB for one planning season across a grid of sell-through and sales scenarios. */
export function computeSensitivityGrid(
  stores: CalcStore[],
  brandInventory: Record<string, number>,
  horizon: HorizonMonth[],
  fxRates: FxRateMap,
  season: "s1" | "s2",
  brandOutlook: Record<string, number> = {}
): SensitivityCell[][] {
  return SELL_THROUGH_DELTAS.map((sellThroughDeltaPts) =>
    SALES_CHANGES.map((salesChangePct) => {
      const scenarioStores = applyScenario(stores, horizon, { sellThroughDeltaPts, salesChangePct });
      const plan = computePlan(scenarioStores, brandInventory, horizon, fxRates, brandOutlook);
      const rows = season === "s1" ? plan.season1Rows : plan.season2Rows;
      return { sellThroughDeltaPts, salesChangePct, totalOtb: computeSeasonSummary(rows, fxRates).totalOtb };
    })
  );
}
