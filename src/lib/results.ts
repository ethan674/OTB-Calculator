import { aggregateByCurrency, monthsOfCover, type FxRateMap, type AggregateResult } from "@/lib/otb-engine";

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
  /**
   * Forecast ending inventory: what's left after sales from inventory plus
   * incoming (on-order is a locked buy). Rolls into the next season's SoS.
   */
  eosInventory: number;
  /** Gross sales the ending inventory has to cover (next season's demand). */
  forwardGrossSales: number;
  /** Ending inventory the open buy was sized to reach; 0 once incoming goods are filled in. */
  targetEosInventory: number;
  /** Incoming goods filled in: the buy is confirmed, so no sell-through target applies. */
  buyLocked: boolean;
  sosInventory: number;
  onOrder: number;
  /** Open-to-buy; 0 for a season that's already bought for (incoming goods filled in). */
  otb: number;
  /** Signed gap vs. what the season needs: positive = shortfall, negative = excess. Drives EoS and transfers. */
  balance: number;
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

/**
 * Months of next-season sales the forecast EoS covers. Shown for every
 * season: for an open buy it should sit on the sell-through target's cover,
 * and for a bought season it shows how long the leftover stock lasts.
 */
export function monthsOfCoverFor(r: OtbSeasonRow): number | null {
  return monthsOfCover(r.eosInventory, r.forwardGrossSales);
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
    rows.map((r) => ({ value: r.eosInventory, currency: r.currency })),
    fxRates
  );

  // Sell-through is an output: stock sold ÷ stock available to sell (what's held plus any open buy).
  const availableOf = (r: OtbSeasonRow) => r.totalAvailable + (r.buyLocked ? 0 : Math.max(0, r.balance));
  const soldBase = rows.reduce((sum, r) => sum + Math.min(r.grossSalesValue, availableOf(r)), 0);
  const availableBase = rows.reduce((sum, r) => sum + availableOf(r), 0);
  const weightedAvgSellThrough = availableBase > 0 ? soldBase / availableBase : 0;
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
