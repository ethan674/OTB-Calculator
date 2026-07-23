import { aggregateByCurrency, type FxRateMap, type AggregateResult } from "@/lib/otb-engine";

export interface OtbResultStore {
  storeId: string;
  storeCode: string;
  storeName: string;
  brand: string;
  channel: string;
  market: string;
  currency: string;
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
}

export interface GroupAggregate {
  groupKey: string;
  storeCount: number;
  otb: AggregateResult;
  netTarget: AggregateResult;
}

/** Groups rows by an arbitrary key and applies the currency aggregation rule to OTB and net target. */
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
        groupRows.map((r) => ({ value: r.otb, currency: r.currency })),
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
  totalOtb: AggregateResult;
  totalNetTarget: AggregateResult;
  weightedAvgSellThrough: number;
  weightedAvgDiscount: number;
  overboughtCount: number;
  storeCount: number;
}

export function computeSeasonSummary(rows: OtbSeasonRow[], fxRates: FxRateMap): SeasonSummary {
  const totalOtb = aggregateByCurrency(
    rows.map((r) => ({ value: r.otb, currency: r.currency })),
    fxRates
  );
  const totalNetTarget = aggregateByCurrency(
    rows.map((r) => ({ value: r.netRevenueTarget, currency: r.currency })),
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
    weightedAvgSellThrough,
    weightedAvgDiscount,
    overboughtCount: rows.filter((r) => r.overbought).length,
    storeCount: rows.length,
  };
}
