/**
 * OTB Planner calculation engine.
 *
 * Pure, framework-free TypeScript. No React, no Prisma, no I/O — everything
 * here is deterministic functions over plain data so it can be unit tested
 * in isolation and reused identically on the server and in the browser.
 *
 * All monetary values are SRP (retail) value. There is no cost conversion
 * and no intake margin anywhere in this module.
 */

// ---------------------------------------------------------------------------
// Seasons
// ---------------------------------------------------------------------------

export type SeasonType = "SS" | "FW";

export interface SeasonInfo {
  type: SeasonType;
  /** Full calendar year, e.g. 2026 */
  year: number;
  /** Short label, e.g. "SS26" or "FW26" */
  label: string;
}

export function makeSeasonLabel(type: SeasonType, year: number): string {
  const shortYear = ((year % 100) + 100) % 100;
  return `${type}${String(shortYear).padStart(2, "0")}`;
}

export function makeSeasonInfo(type: SeasonType, year: number): SeasonInfo {
  return { type, year, label: makeSeasonLabel(type, year) };
}

/**
 * SS = Jan 1 - Jun 30, FW = Jul 1 - Dec 31, of the given calendar year.
 * Fixed globally; not configurable per brand.
 */
export function getSeasonForDate(date: Date): SeasonInfo {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-12
  const type: SeasonType = month <= 6 ? "SS" : "FW";
  return makeSeasonInfo(type, year);
}

export function getSeasonForMonth(year: number, month: number): SeasonInfo {
  const type: SeasonType = month <= 6 ? "SS" : "FW";
  return makeSeasonInfo(type, year);
}

/** Inclusive calendar start/end dates for a season. */
export function getSeasonDateRange(season: SeasonInfo): { start: Date; end: Date } {
  if (season.type === "SS") {
    return {
      start: new Date(season.year, 0, 1),
      end: new Date(season.year, 5, 30),
    };
  }
  return {
    start: new Date(season.year, 6, 1),
    end: new Date(season.year, 11, 31),
  };
}

/** The season immediately following the given season. */
export function getNextSeason(season: SeasonInfo): SeasonInfo {
  if (season.type === "SS") return makeSeasonInfo("FW", season.year);
  return makeSeasonInfo("SS", season.year + 1);
}

export interface PlanningSeasons {
  current: SeasonInfo;
  planning1: SeasonInfo;
  planning2: SeasonInfo;
}

/**
 * The app always plans the next two seasons after the current one. The
 * current season's OTB is treated as already finalized and is never a
 * planning target.
 */
export function getPlanningSeasons(today: Date): PlanningSeasons {
  const current = getSeasonForDate(today);
  const planning1 = getNextSeason(current);
  const planning2 = getNextSeason(planning1);
  return { current, planning1, planning2 };
}

// ---------------------------------------------------------------------------
// Monthly horizon
// ---------------------------------------------------------------------------

export type MonthKey = string; // "YYYY-MM"

export function makeMonthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export type HorizonBucket = "current" | "planning1" | "planning2";

export interface HorizonMonth {
  year: number;
  month: number; // 1-12
  monthKey: MonthKey;
  seasonLabel: string;
  bucket: HorizonBucket;
}

/**
 * Monthly revenue forecast input window: from the current month through the
 * end of the second planning season. Each month is tagged with the planning
 * bucket it belongs to (remaining current-season months are only used for
 * the inventory roll-forward, not as an OTB planning target).
 */
export function buildMonthlyHorizon(today: Date): HorizonMonth[] {
  const { current, planning1, planning2 } = getPlanningSeasons(today);
  const { end: horizonEnd } = getSeasonDateRange(planning2);

  const months: HorizonMonth[] = [];
  let year = today.getFullYear();
  let month = today.getMonth() + 1;

  while (year < horizonEnd.getFullYear() || (year === horizonEnd.getFullYear() && month <= 12 && new Date(year, month - 1, 1) <= horizonEnd)) {
    const season = getSeasonForMonth(year, month);
    let bucket: HorizonBucket;
    if (season.label === current.label) bucket = "current";
    else if (season.label === planning1.label) bucket = "planning1";
    else bucket = "planning2";

    months.push({ year, month, monthKey: makeMonthKey(year, month), seasonLabel: season.label, bucket });

    if (season.label === planning2.label && month === getSeasonDateRange(planning2).end.getMonth() + 1) {
      break;
    }
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }

  return months;
}

// ---------------------------------------------------------------------------
// Core OTB formula
// ---------------------------------------------------------------------------

export interface OtbSeasonInputs {
  /** Net revenue forecast for the season (sum of the season's monthly forecasts) */
  netRevenueTarget: number;
  /** Blended discount rate, as a decimal 0-1 */
  discountPct: number;
  /** Sell-through rate, as a decimal 0-1 */
  sellThroughPct: number;
  /** Start-of-season inventory at SRP (derived via roll-forward, or manual override) */
  sosInventory: number;
  /** On-order for the season at SRP */
  onOrder: number;
}

export interface OtbSeasonResult extends OtbSeasonInputs {
  grossSalesValue: number;
  discountValue: number;
  totalAvailable: number;
  targetEosInventory: number;
  otb: number;
  overbought: boolean;
}

/**
 * OTB (SRP) = Net Sales Target + Discount Value + Target EOS Inventory
 *             - Start-of-Season Inventory - On-Order
 *
 * Implemented via the derivation in the spec so every intermediate term is
 * internally consistent:
 *   Gross = Net / (1 - discount%)
 *   Discount value = Gross - Net
 *   Total available = Gross / sellThrough%
 *   Target EOS = Total available * (1 - sellThrough%)
 *   OTB = Total available - SOS - OnOrder
 */
export function computeOtbForSeason(inputs: OtbSeasonInputs): OtbSeasonResult {
  const { netRevenueTarget, discountPct, sellThroughPct, sosInventory, onOrder } = inputs;

  const grossSalesValue = netRevenueTarget / (1 - discountPct);
  const discountValue = grossSalesValue - netRevenueTarget;
  const totalAvailable = grossSalesValue / sellThroughPct;
  const targetEosInventory = totalAvailable * (1 - sellThroughPct);
  const otb = totalAvailable - sosInventory - onOrder;

  return {
    netRevenueTarget,
    discountPct,
    sellThroughPct,
    sosInventory,
    onOrder,
    grossSalesValue,
    discountValue,
    totalAvailable,
    targetEosInventory,
    otb,
    // Negative OTB is displayed as-is (never clamped) and flagged.
    overbought: otb < 0,
  };
}

// ---------------------------------------------------------------------------
// Inventory roll-forward (chains SOS across the two planning seasons)
// ---------------------------------------------------------------------------

export interface RollForwardSeason1Inputs {
  currentOnHandInventory: number;
  currentRemainingReceipts: number;
  /** Sum of remaining current-season monthly net revenue forecast */
  remainingCurrentSeasonNetForecast: number;
  /** Current season's blended discount rate, as a decimal 0-1 */
  currentSeasonDiscountPct: number;
  /** Admin-only manual override; when set, wins over the derived value */
  manualSosOverride?: number | null;
}

export interface RollForwardSeason1Result {
  sos: number;
  /** Un-floored, un-overridden derived value, useful for diagnostics */
  rawSos: number;
  projectedGrossSalesRemaining: number;
  floored: boolean;
  overridden: boolean;
}

/**
 * SOS (planning season 1) = Current On-Hand + Remaining Planned Receipts
 *   (current season) - Projected Gross Sales Remaining (current season),
 *   where projected gross sales remaining = remaining current-season
 *   monthly net forecast / (1 - current-season discount %).
 * Floored at 0 with a warning if projected sell-down exceeds available stock.
 */
export function computeSos1(inputs: RollForwardSeason1Inputs): RollForwardSeason1Result {
  const {
    currentOnHandInventory,
    currentRemainingReceipts,
    remainingCurrentSeasonNetForecast,
    currentSeasonDiscountPct,
    manualSosOverride,
  } = inputs;

  const projectedGrossSalesRemaining =
    remainingCurrentSeasonNetForecast / (1 - currentSeasonDiscountPct);

  const rawSos = currentOnHandInventory + currentRemainingReceipts - projectedGrossSalesRemaining;
  const floored = rawSos < 0;
  const derivedSos = Math.max(0, rawSos);

  const overridden = manualSosOverride !== undefined && manualSosOverride !== null;
  const sos = overridden ? (manualSosOverride as number) : derivedSos;

  return { sos, rawSos, projectedGrossSalesRemaining, floored, overridden };
}

export interface RollForwardSeason2Result {
  sos: number;
  rawSos: number;
  overridden: boolean;
}

/**
 * SOS (planning season 2) = Target EOS Inventory (planning season 1)
 *   + On-Order already committed for planning season 2.
 */
export function computeSos2(
  targetEosInventorySeason1: number,
  onOrderSeason2: number,
  manualSosOverride?: number | null
): RollForwardSeason2Result {
  const rawSos = targetEosInventorySeason1 + onOrderSeason2;
  const overridden = manualSosOverride !== undefined && manualSosOverride !== null;
  const sos = overridden ? (manualSosOverride as number) : rawSos;
  return { sos, rawSos, overridden };
}

// ---------------------------------------------------------------------------
// Full per-store, two-season plan
// ---------------------------------------------------------------------------

export interface StorePlanSeasonInputs {
  netRevenueTarget: number;
  discountPct: number;
  sellThroughPct: number;
  onOrder: number;
  manualSosOverride?: number | null;
}

export interface StorePlanInputs {
  currentOnHandInventory: number;
  currentRemainingReceipts: number;
  currentSeasonDiscountPct: number;
  remainingCurrentSeasonNetForecast: number;
  season1: StorePlanSeasonInputs;
  season2: StorePlanSeasonInputs;
}

export interface StorePlanSeasonOutput extends OtbSeasonResult {
  sosFloored: boolean;
  sosOverridden: boolean;
}

export interface StorePlanResult {
  season1: StorePlanSeasonOutput;
  season2: StorePlanSeasonOutput;
}

/**
 * Chains the roll-forward and OTB formula across both planning seasons for
 * a single store. This is the single entry point results pages and the
 * submission snapshot should use, so the chain is always computed
 * consistently.
 */
export function computeStorePlan(inputs: StorePlanInputs): StorePlanResult {
  const sos1 = computeSos1({
    currentOnHandInventory: inputs.currentOnHandInventory,
    currentRemainingReceipts: inputs.currentRemainingReceipts,
    remainingCurrentSeasonNetForecast: inputs.remainingCurrentSeasonNetForecast,
    currentSeasonDiscountPct: inputs.currentSeasonDiscountPct,
    manualSosOverride: inputs.season1.manualSosOverride,
  });

  const otb1 = computeOtbForSeason({
    netRevenueTarget: inputs.season1.netRevenueTarget,
    discountPct: inputs.season1.discountPct,
    sellThroughPct: inputs.season1.sellThroughPct,
    sosInventory: sos1.sos,
    onOrder: inputs.season1.onOrder,
  });

  const sos2 = computeSos2(
    otb1.targetEosInventory,
    inputs.season2.onOrder,
    inputs.season2.manualSosOverride
  );

  const otb2 = computeOtbForSeason({
    netRevenueTarget: inputs.season2.netRevenueTarget,
    discountPct: inputs.season2.discountPct,
    sellThroughPct: inputs.season2.sellThroughPct,
    sosInventory: sos2.sos,
    onOrder: inputs.season2.onOrder,
  });

  return {
    season1: { ...otb1, sosFloored: sos1.floored, sosOverridden: sos1.overridden },
    season2: { ...otb2, sosFloored: false, sosOverridden: sos2.overridden },
  };
}

// ---------------------------------------------------------------------------
// Currency aggregation
// ---------------------------------------------------------------------------

export interface CurrencyValue {
  value: number;
  currency: string;
}

/** Map of currency code -> rate to convert 1 unit of that currency to USD. */
export type FxRateMap = Record<string, number>;

export type AggregateResult =
  | { ok: true; currency: string; total: number; converted: boolean; ratesUsed?: FxRateMap }
  | { ok: false; missingCurrencies: string[]; message: string };

/**
 * If all items share one currency, the aggregate stays in that currency.
 * If the items span multiple currencies, every item is converted to USD
 * using the provided FX table. If a needed rate is missing, the aggregate
 * is blocked (never silently skips stores) and the missing currencies are
 * reported so the caller can show the admin exactly what to add.
 */
export function aggregateByCurrency(items: CurrencyValue[], fxRates: FxRateMap): AggregateResult {
  if (items.length === 0) {
    return { ok: true, currency: "USD", total: 0, converted: false };
  }

  const currencies = Array.from(new Set(items.map((i) => i.currency)));

  if (currencies.length === 1) {
    const total = items.reduce((sum, i) => sum + i.value, 0);
    return { ok: true, currency: currencies[0], total, converted: false };
  }

  const missingCurrencies = currencies.filter((c) => fxRates[c] === undefined);
  if (missingCurrencies.length > 0) {
    return {
      ok: false,
      missingCurrencies,
      message: `Missing FX rate(s) for: ${missingCurrencies.join(", ")}. Add these rates in Admin → FX Rates before this aggregate can be shown in USD.`,
    };
  }

  const ratesUsed: FxRateMap = {};
  let total = 0;
  for (const item of items) {
    const rate = fxRates[item.currency];
    ratesUsed[item.currency] = rate;
    total += item.value * rate;
  }

  return { ok: true, currency: "USD", total, converted: true, ratesUsed };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface FieldValidation {
  errors: string[];
  warnings: string[];
}

/** Sell-through rate: valid range 1-100%. Warn (non-blocking) below 40% or above 95%. */
export function validateSellThroughPct(pctAsPercent: number): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (pctAsPercent === null || pctAsPercent === undefined || Number.isNaN(pctAsPercent)) {
    errors.push("Sell-through rate is required.");
  } else {
    if (pctAsPercent < 1 || pctAsPercent > 100) {
      errors.push("Sell-through rate must be between 1% and 100%.");
    } else if (pctAsPercent < 40) {
      warnings.push("Sell-through rate is below 40%.");
    } else if (pctAsPercent > 95) {
      warnings.push("Sell-through rate is above 95%.");
    }
  }
  return { errors, warnings };
}

/** Blended discount %: valid range 0-90%. Warn above 50%. Blocking error at 100%. */
export function validateDiscountPct(pctAsPercent: number): FieldValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (pctAsPercent === null || pctAsPercent === undefined || Number.isNaN(pctAsPercent)) {
    errors.push("Discount % is required.");
  } else {
    if (pctAsPercent >= 100) {
      errors.push("Discount % cannot be 100% or more.");
    } else if (pctAsPercent < 0 || pctAsPercent > 90) {
      errors.push("Discount % must be between 0% and 90%.");
    } else if (pctAsPercent > 50) {
      warnings.push("Discount % is above 50%.");
    }
  }
  return { errors, warnings };
}
