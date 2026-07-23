import type { CalcStore } from "@/types";
import type { HorizonMonth } from "@/lib/otb-engine";
import { sumHorizonBucket } from "@/lib/storePlan";

/** Key identifying a brand+market inventory pool. Stores split this pool by current-season sales share. */
export function brandMarketKey(brand: string, market: string): string {
  return `${brand}::${market}`;
}

export interface BrandMarketGroup {
  key: string;
  brand: string;
  market: string;
  currency: string;
  storeIds: string[];
}

/** One row per distinct (brand, market) combination present in the current store list. */
export function getBrandMarketGroups(stores: CalcStore[]): BrandMarketGroup[] {
  const groups = new Map<string, BrandMarketGroup>();
  for (const store of stores) {
    if (!store.brand || !store.market) continue;
    const key = brandMarketKey(store.brand, store.market);
    const existing = groups.get(key);
    if (existing) {
      existing.storeIds.push(store.id);
    } else {
      groups.set(key, { key, brand: store.brand, market: store.market, currency: store.currency, storeIds: [store.id] });
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.brand.localeCompare(b.brand) || a.market.localeCompare(b.market));
}

/**
 * Each store's proportional share (0-1) of its brand+market group's
 * current-season (S0) net revenue forecast. This is the single weighting
 * used both for splitting on-hand inventory (computeOnHandAllocation) and
 * for distributing an outlet's unmet need across full-price stores
 * (see lib/outletTransfer.ts) — one consistent proportion throughout.
 * If the whole group's forecast is 0 (e.g. forecasts not filled in yet),
 * shares split evenly instead of collapsing to 0 for everyone.
 */
export function computeGroupShares(stores: CalcStore[], horizon: HorizonMonth[]): Record<string, number> {
  const groups = getBrandMarketGroups(stores);
  const shares: Record<string, number> = {};

  for (const group of groups) {
    const groupStores = stores.filter((s) => group.storeIds.includes(s.id));
    const forecasts = groupStores.map((s) => ({
      id: s.id,
      forecast: sumHorizonBucket(s.monthlyForecast, horizon, "current"),
    }));
    const totalForecast = forecasts.reduce((sum, f) => sum + f.forecast, 0);

    for (const f of forecasts) {
      shares[f.id] = totalForecast > 0 ? f.forecast / totalForecast : 1 / forecasts.length;
    }
  }

  return shares;
}

/**
 * Splits each brand+market on-hand inventory pool across its stores by
 * computeGroupShares. Outlet stores participate in the same split as
 * full-price stores — this pool represents existing inventory, not new
 * buys.
 */
export function computeOnHandAllocation(
  stores: CalcStore[],
  brandInventory: Record<string, number>,
  horizon: HorizonMonth[]
): Record<string, number> {
  const groups = getBrandMarketGroups(stores);
  const shares = computeGroupShares(stores, horizon);
  const allocation: Record<string, number> = {};

  for (const group of groups) {
    const pool = brandInventory[group.key] ?? 0;
    for (const storeId of group.storeIds) {
      allocation[storeId] = pool * (shares[storeId] ?? 0);
    }
  }

  return allocation;
}
