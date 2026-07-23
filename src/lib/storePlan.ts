import { computeStorePlan, type HorizonMonth, type StorePlanInputs, type StorePlanResult } from "./otb-engine";
import type { CalcStore } from "@/types";

export function sumHorizonBucket(
  forecast: Record<string, number>,
  horizon: HorizonMonth[],
  bucket: HorizonMonth["bucket"]
): number {
  return horizon
    .filter((m) => m.bucket === bucket)
    .reduce((sum, m) => sum + (forecast[m.monthKey] ?? 0), 0);
}

/**
 * `currentOnHandInventory` is derived (brand+market pool split by
 * current-season sales share — see src/lib/brandInventory.ts) rather than a
 * field on CalcStore, so it's passed in separately.
 *
 * Outlet stores don't receive new-season buys, so on-order is forced to 0
 * here defensively even though the UI already locks that field — the
 * resulting OTB then represents stock needed to operate, not a purchase.
 */
export function toStorePlanInputs(store: CalcStore, horizon: HorizonMonth[], currentOnHandInventory: number): StorePlanInputs {
  const isOutlet = store.storeType === "Outlet";
  return {
    currentOnHandInventory,
    currentRemainingReceipts: store.currentRemainingReceipts,
    currentSeasonDiscountPct: store.currentDiscountPct,
    remainingCurrentSeasonNetForecast: sumHorizonBucket(store.monthlyForecast, horizon, "current"),
    season1: {
      netRevenueTarget: sumHorizonBucket(store.monthlyForecast, horizon, "planning1"),
      discountPct: store.s1DiscountPct,
      sellThroughPct: store.s1SellThroughPct,
      onOrder: isOutlet ? 0 : store.s1OnOrder,
      manualSosOverride: store.s1ManualSosOverride,
    },
    season2: {
      netRevenueTarget: sumHorizonBucket(store.monthlyForecast, horizon, "planning2"),
      discountPct: store.s2DiscountPct,
      sellThroughPct: store.s2SellThroughPct,
      onOrder: isOutlet ? 0 : store.s2OnOrder,
      manualSosOverride: store.s2ManualSosOverride,
    },
  };
}

export function computeStoreResult(store: CalcStore, horizon: HorizonMonth[], currentOnHandInventory: number): StorePlanResult {
  return computeStorePlan(toStorePlanInputs(store, horizon, currentOnHandInventory));
}
