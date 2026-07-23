import { aggregateByCurrency, type FxRateMap, type AggregateResult } from "@/lib/otb-engine";

export interface OtbResultStore {
  storeId: string;
  storeName: string;
  brand: string;
  channel: string;
  market: string;
  currency: string;
  /** Outlet stores don't buy new-season product — their OTB is excluded from budget totals (see below). */
  isOutlet: boolean;
}

export interface OtbSeasonRow extends OtbResultStore {
  netRevenueTarget: number;
  grossSalesValue: number;
  discountValue: number;
  totalAvailable: number;
  targetEosInventory: number;
  sosInventory: number;
  onOrder: number;
  otb: number;
  overbought: boolean;
  sellThroughPct: number;
  discountPct: number;
  sosFloored: boolean;
  sosOverridden: boolean;
  otbUsd: number | null; // null when FX rate missing for this store's currency
  /**
   * Amount added to this store's OTB (and subtracted from its SOS) by the
   * outlet-transfer mechanism (see lib/outletTransfer.ts). Positive for a
   * full-price store that supplied an outlet's need; negative for an
   * outlet whose need was covered by transfer; 0 otherwise.
   */
  transferAdjustment: number;
}

/** Per-store snapshot of the current (finalized) season's roll-forward into planning season 1. */
export interface CurrentSeasonRow extends OtbResultStore {
  currentSeasonInventory: number;
  currentIncomingGoods: number;
  currentRemainingTarget: number;
  currentDiscountRate: number;
  projectedEosInventory: number;
  floored: boolean;
  overridden: boolean;
}

export interface GroupAggregate {
  groupKey: string;
  storeCount: number;
  /** Excludes outlet stores — an outlet's result is stock needed to operate, not new-buy dollars. */
  otb: AggregateResult;
  netTarget: AggregateResult;
}

/**
 * Groups rows by an arbitrary key and applies the currency aggregation rule
 * to OTB and net target. `netTarget` includes every store; `otb` excludes
 * outlet stores since their computed figure represents inventory needed to
 * operate, not a new purchase — see the Outlet store-type note in README.
 */
export function groupAndAggregate(
  rows: OtbSeasonRow[],
  groupBy: (row: OtbSeasonRow) => string,
  fxRates: FxRateMap
): GroupAggregate[] {
  const groups = new Map<string, OtbSeasonRow[]>();
  for (const row of rows) {
    const key = groupBy(row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return Array.from(groups.entries())
    .map(([groupKey, groupRows]) => ({
      groupKey,
      storeCount: groupRows.length,
      otb: aggregateByCurrency(
        groupRows.filter((r) => !r.isOutlet).map((r) => ({ value: r.otb, currency: r.currency })),
        fxRates
      ),
      netTarget: aggregateByCurrency(
        groupRows.map((r) => ({ value: r.netRevenueTarget, currency: r.currency })),
        fxRates
      ),
    }))
    .sort((a, b) => a.groupKey.localeCompare(b.groupKey));
}

/** Always converts to USD (for charting, where every bar must share one unit), reporting any missing rates. */
export function sumToUsd(items: { value: number; currency: string }[], fxRates: FxRateMap): { value: number; missingCurrencies: string[] } {
  const missing = new Set<string>();
  let value = 0;
  for (const item of items) {
    const rate = fxRates[item.currency];
    if (rate === undefined) {
      missing.add(item.currency);
      continue;
    }
    value += item.value * rate;
  }
  return { value, missingCurrencies: Array.from(missing) };
}

export interface SeasonSummary {
  /** Excludes outlet stores. */
  totalOtb: AggregateResult;
  totalNetTarget: AggregateResult;
  totalSos: AggregateResult;
  totalEos: AggregateResult;
  weightedAvgSellThrough: number;
  weightedAvgDiscount: number;
  overboughtCount: number;
  storeCount: number;
}

export function computeSeasonSummary(rows: OtbSeasonRow[], fxRates: FxRateMap): SeasonSummary {
  const totalOtb = aggregateByCurrency(
    rows.filter((r) => !r.isOutlet).map((r) => ({ value: r.otb, currency: r.currency })),
    fxRates
  );
  const totalNetTarget = aggregateByCurrency(
    rows.map((r) => ({ value: r.netRevenueTarget, currency: r.currency })),
    fxRates
  );
  const totalSos = aggregateByCurrency(
    rows.map((r) => ({ value: r.sosInventory, currency: r.currency })),
    fxRates
  );
  const totalEos = aggregateByCurrency(
    rows.map((r) => ({ value: r.targetEosInventory, currency: r.currency })),
    fxRates
  );

  const totalAvailable = rows.reduce((sum, r) => sum + r.totalAvailable, 0);
  const weightedAvgSellThrough =
    totalAvailable > 0 ? rows.reduce((sum, r) => sum + r.sellThroughPct * r.totalAvailable, 0) / totalAvailable : 0;
  const totalGross = rows.reduce((sum, r) => sum + r.grossSalesValue, 0);
  const weightedAvgDiscount =
    totalGross > 0 ? rows.reduce((sum, r) => sum + r.discountPct * r.grossSalesValue, 0) / totalGross : 0;

  return {
    totalOtb,
    totalNetTarget,
    totalSos,
    totalEos,
    weightedAvgSellThrough,
    weightedAvgDiscount,
    overboughtCount: rows.filter((r) => r.overbought).length,
    storeCount: rows.length,
  };
}
