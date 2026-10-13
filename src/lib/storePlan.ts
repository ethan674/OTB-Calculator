import { SEASON_MONTHS, computeStoreSeason1, computeStoreSeason2, type HorizonMonth, type StorePlanSeasonInputs, type StorePlanSeasonOutput } from "./otb-engine";
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
 * Gross sales the season's ending inventory has to cover: the demand of the
 * season that follows it, at retail.
 *  - Planning season 1: season 2's own forecast months.
 *  - Planning season 2 (the last): nothing is forecast beyond it, so use the
 *    store's average-monthly-sales override if it has one, otherwise its own
 *    season's sales moved by the brand's outlook % (0 when unset — so the
 *    default is "next season looks like this one").
 * The following season is grossed up at season 2's discount.
 */
function forwardGrossSales(
  store: CalcStore,
  horizon: HorizonMonth[],
  bucket: "planning1" | "planning2",
  brandOutlookPct: number
): number {
  const season2Net = sumHorizonBucket(store.monthlyForecast, horizon, "planning2");
  const forwardNet =
    bucket === "planning1"
      ? season2Net
      : store.forwardMonthlySales !== null
        ? store.forwardMonthlySales * SEASON_MONTHS
        : season2Net * (1 + brandOutlookPct / 100);
  return forwardNet / (1 - store.s2DiscountPct);
}

/**
 * Outlet stores don't receive new-season buys, so on-order is forced to 0
 * here defensively even though the UI already locks that field — the
 * resulting OTB then represents stock needed to operate, not a purchase.
 */
function seasonInputs(
  store: CalcStore,
  horizon: HorizonMonth[],
  bucket: "planning1" | "planning2",
  brandOutlookPct: number
): StorePlanSeasonInputs {
  const isOutlet = store.storeType === "Outlet";
  const s1 = bucket === "planning1";
  return {
    netRevenueTarget: sumHorizonBucket(store.monthlyForecast, horizon, bucket),
    discountPct: s1 ? store.s1DiscountPct : store.s2DiscountPct,
    sellThroughPct: s1 ? store.s1SellThroughPct : store.s2SellThroughPct,
    forwardGrossSales: forwardGrossSales(store, horizon, bucket, brandOutlookPct),
    onOrder: isOutlet ? 0 : s1 ? store.s1OnOrder : store.s2OnOrder,
    manualSosOverride: s1 ? store.s1ManualSosOverride : store.s2ManualSosOverride,
  };
}

/**
 * `currentOnHandInventory` is derived (brand+market pool split by
 * current-season sales share — see src/lib/brandInventory.ts) rather than a
 * field on CalcStore, so it's passed in separately.
 */
export function computeSeason1Result(
  store: CalcStore,
  horizon: HorizonMonth[],
  currentOnHandInventory: number,
  brandOutlookPct = 0
): StorePlanSeasonOutput {
  return computeStoreSeason1({
    currentOnHandInventory,
    currentRemainingReceipts: store.currentRemainingReceipts,
    currentSeasonDiscountPct: store.currentDiscountPct,
    remainingCurrentSeasonNetForecast: sumHorizonBucket(store.monthlyForecast, horizon, "current"),
    season1: seasonInputs(store, horizon, "planning1", brandOutlookPct),
  });
}

export function computeSeason2Result(
  store: CalcStore,
  horizon: HorizonMonth[],
  eosSeason1: number,
  brandOutlookPct = 0
): StorePlanSeasonOutput {
  return computeStoreSeason2(seasonInputs(store, horizon, "planning2", brandOutlookPct), eosSeason1);
}
