import type { FxRateMap, HorizonMonth } from "./otb-engine";
import { brandMarketKey, computeGroupShares, computeOnHandAllocation } from "./brandInventory";
import { applyOutletTransfers } from "./outletTransfer";
import type { CurrentSeasonRow, OtbSeasonRow } from "./results";
import { computeSeason1Result, computeSeason2Result, sumHorizonBucket } from "./storePlan";
import type { CalcStore } from "@/types";

export interface Plan {
  onHandAllocation: Record<string, number>;
  season1Rows: OtbSeasonRow[];
  season2Rows: OtbSeasonRow[];
  currentSeasonRows: CurrentSeasonRow[];
}

/**
 * The whole calculation, from raw inputs to per-store rows for both planning
 * seasons: current-season roll-forward → season 1 → outlet transfers → season
 * 2 (starting from season 1's forecast ending inventory) → outlet transfers.
 * Pure, so the sensitivity panel can re-run it under different assumptions.
 */
export function computePlan(
  stores: CalcStore[],
  brandInventory: Record<string, number>,
  horizon: HorizonMonth[],
  fxRates: FxRateMap,
  brandOutlook: Record<string, number> = {}
): Plan {
  const onHandAllocation = computeOnHandAllocation(stores, brandInventory, horizon);
  const outlookOf = (store: CalcStore) => brandOutlook[brandMarketKey(store.brand, store.market)] ?? 0;

  const baseOf = (store: CalcStore) => ({
    storeId: store.id,
    storeName: store.storeName,
    brand: store.brand,
    channel: store.channel,
    market: store.market,
    currency: store.currency,
    isOutlet: store.storeType === "Outlet",
  });

  const rawSeason1: OtbSeasonRow[] = [];
  const currentSeasonRows: CurrentSeasonRow[] = [];

  for (const store of stores) {
    const currentOnHandInventory = onHandAllocation[store.id] ?? 0;
    const s1 = computeSeason1Result(store, horizon, currentOnHandInventory, outlookOf(store));

    rawSeason1.push({ ...baseOf(store), ...s1, otbUsd: null, transferAdjustment: 0 });

    currentSeasonRows.push({
      ...baseOf(store),
      currentSeasonInventory: currentOnHandInventory,
      currentIncomingGoods: store.currentRemainingReceipts,
      currentRemainingTarget: sumHorizonBucket(store.monthlyForecast, horizon, "current"),
      currentDiscountRate: store.currentDiscountPct,
      projectedEosInventory: s1.sosInventory,
      floored: s1.sosFloored,
      overridden: s1.sosOverridden,
    });
  }

  // Outlet stores have a sales target but can't place new buys, so their
  // need (or surplus) nets against the full-price stores in the same
  // brand+market group — see lib/outletTransfer.ts.
  const shares = computeGroupShares(stores, horizon);
  const adjustedSeason1 = applyOutletTransfers(rawSeason1, shares);

  // Season 2 starts from season 1's forecast ending inventory (what's left
  // after sales), which includes any overbought excess since on-order is a
  // locked buy — so an overbought position carries into next season via SoS
  // rather than disappearing. That only settles after season 1's transfers.
  const eosById = new Map(adjustedSeason1.map((r) => [r.storeId, r.eosInventory]));
  const rawSeason2: OtbSeasonRow[] = stores.map((store) => {
    const s2 = computeSeason2Result(store, horizon, eosById.get(store.id) ?? 0, outlookOf(store));
    return { ...baseOf(store), ...s2, otbUsd: null, transferAdjustment: 0 };
  });
  const adjustedSeason2 = applyOutletTransfers(rawSeason2, shares);

  const withUsd = (rows: OtbSeasonRow[]): OtbSeasonRow[] =>
    rows.map((r) => {
      const rate = r.currency === "USD" ? 1 : fxRates[r.currency];
      return { ...r, otbUsd: rate !== undefined ? r.otb * rate : null };
    });

  return { onHandAllocation, season1Rows: withUsd(adjustedSeason1), season2Rows: withUsd(adjustedSeason2), currentSeasonRows };
}
