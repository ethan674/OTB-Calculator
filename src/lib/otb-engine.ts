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

/** A planning season is six months, so 6 × average monthly sales = a season's sales. */
export const SEASON_MONTHS = 6;

export interface OtbSeasonInputs {
  /** Net revenue forecast for the season (sum of the season's monthly forecasts) */
  netRevenueTarget: number;
  /** Blended discount rate, as a decimal 0-1 */
  discountPct: number;
  /**
   * Target sell-through, as a decimal 0-1. Only used while the buy is still
   * open (no incoming goods filled in); once the buy is locked it's ignored
   * and sell-through is derived from the stock actually held.
   */
  sellThroughPct: number;
  /**
   * Gross sales the ending inventory has to cover — the next season's demand,
   * at retail. Only sizes the target EoS of an open buy; defaults to this
   * season's own gross sales (6 months of cover scaled by sell-through).
   */
  forwardGrossSales?: number;
  /** Start-of-season inventory at SRP (derived via roll-forward, or manual override) */
  sosInventory: number;
  /**
   * Incoming goods for the season at SRP. A filled-in (> 0) amount is a
   * confirmed, locked buy; blank/0 means the season hasn't been bought for yet.
   */
  onOrder: number;
}

/** A season is "bought for" once incoming goods are filled in; blank/0 means OTB is still being calculated. */
export function isBuyLocked(onOrder: number): boolean {
  return onOrder > 0;
}

/** What a store holds against its sales target. All derived — nothing here is an input. */
export interface SeasonPosition {
  /** Inventory + incoming: SoS + on-order (stock already held or committed). */
  totalAvailable: number;
  /**
   * Signed gap between what the season needs (gross sales + target EoS) and
   * what's held: positive = shortfall, negative = excess. Drives EoS and
   * outlet transfers for every season, bought or not.
   */
  balance: number;
  /**
   * Open-to-buy amount. Only an open season (no incoming goods) has one: once
   * incoming goods are filled in the season is already bought for, so OTB is 0.
   */
  otb: number;
  /** Forecast ending inventory: the target (open buys only) plus any overbought excess. */
  eosInventory: number;
  /** Share of available stock sold: min(gross sales, available) ÷ available. */
  sellThroughPct: number;
  /** Holding more than the sales target needs (locked incoming goods can't be un-bought). */
  overbought: boolean;
}

export interface OtbSeasonResult extends OtbSeasonInputs, SeasonPosition {
  grossSalesValue: number;
  discountValue: number;
  /** Ending inventory the open buy is sized to reach; 0 once the buy is locked. */
  targetEosInventory: number;
  buyLocked: boolean;
}

/**
 * Target ending inventory for a season that hasn't been bought for yet. The
 * brand's sell-through expectation fixes the months of cover — (1 − ST) ÷ ST
 * seasons' worth, e.g. 65% ≈ 3.2 months of a 6-month season — and the gross
 * sales the stock must cover set how big that is. Locked buys have no target.
 */
export function targetEosFor(forwardGrossSales: number, sellThroughPct: number, buyLocked: boolean): number {
  if (buyLocked || !(sellThroughPct > 0)) return 0;
  return (forwardGrossSales * (1 - sellThroughPct)) / sellThroughPct;
}

/**
 * Everything that follows from a store's signed balance. Split out from
 * deriveSeasonPosition so outlet transfers, which shift a balance directly,
 * re-derive the rest the same way.
 */
export function positionFromBalance(
  grossSalesValue: number,
  totalAvailable: number,
  targetEosInventory: number,
  buyLocked: boolean,
  balance: number
): SeasonPosition {
  const available = totalAvailable + (buyLocked ? 0 : Math.max(0, balance));
  return {
    totalAvailable,
    balance,
    otb: buyLocked ? 0 : balance,
    eosInventory: targetEosInventory + Math.max(0, -balance),
    sellThroughPct: grossSalesValue > 0 && available > 0 ? Math.min(grossSalesValue, available) / available : 0,
    // Negative balance is displayed as-is (never clamped) and flagged.
    overbought: balance < 0,
  };
}

export function deriveSeasonPosition(
  grossSalesValue: number,
  sosInventory: number,
  onOrder: number,
  targetEosInventory: number,
  buyLocked: boolean
): SeasonPosition {
  const totalAvailable = sosInventory + onOrder;
  const balance = grossSalesValue + targetEosInventory - totalAvailable;
  return positionFromBalance(grossSalesValue, totalAvailable, targetEosInventory, buyLocked, balance);
}

/**
 * Open season (incoming goods blank/0) — OTB is solved to reach the target:
 *   Gross sales      = Net / (1 - discount%)
 *   Target EoS       = Forward gross × (1 − sell-through%) ÷ sell-through%
 *                      (forward gross = next season's sales; own gross if none)
 *   OTB (SRP)        = Gross + Target EoS − SOS − On-Order
 *
 * Locked season (incoming goods filled in) — already bought for, so there is
 * no OTB and no target; sell-through and EoS are derived from the stock held.
 * An overbought store (balance < 0) keeps its excess as ending inventory
 * either way, since a locked buy can't be un-bought.
 */
export function computeOtbForSeason(inputs: OtbSeasonInputs): OtbSeasonResult {
  const { netRevenueTarget, discountPct, sellThroughPct, forwardGrossSales, sosInventory, onOrder } = inputs;

  const grossSalesValue = netRevenueTarget / (1 - discountPct);
  const discountValue = grossSalesValue - netRevenueTarget;
  const buyLocked = isBuyLocked(onOrder);
  const targetEosInventory = targetEosFor(forwardGrossSales ?? grossSalesValue, sellThroughPct, buyLocked);

  return {
    netRevenueTarget,
    discountPct,
    sosInventory,
    onOrder,
    grossSalesValue,
    discountValue,
    targetEosInventory,
    buyLocked,
    ...deriveSeasonPosition(grossSalesValue, sosInventory, onOrder, targetEosInventory, buyLocked),
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
 * SOS (planning season 2) = forecast EoS Inventory of planning season 1 —
 * the target ending inventory (if season 1 was still an open buy) plus any
 * overbought excess (on-order is a locked buy). Season 2's own on-order is
 * NOT part of SOS; it's counted once, in Total Available (SOS + On-Order).
 */
export function computeSos2(
  eosSeason1: number,
  manualSosOverride?: number | null
): RollForwardSeason2Result {
  const rawSos = eosSeason1;
  const overridden = manualSosOverride !== undefined && manualSosOverride !== null;
  const sos = overridden ? (manualSosOverride as number) : rawSos;
  return { sos, rawSos, overridden };
}

// ---------------------------------------------------------------------------
// Per-store season plans
// ---------------------------------------------------------------------------

export interface StorePlanSeasonInputs {
  netRevenueTarget: number;
  discountPct: number;
  sellThroughPct: number;
  forwardGrossSales?: number;
  onOrder: number;
  manualSosOverride?: number | null;
}

export interface Season1PlanInputs {
  currentOnHandInventory: number;
  currentRemainingReceipts: number;
  currentSeasonDiscountPct: number;
  remainingCurrentSeasonNetForecast: number;
  season1: StorePlanSeasonInputs;
}

export interface StorePlanSeasonOutput extends OtbSeasonResult {
  sosFloored: boolean;
  sosOverridden: boolean;
}

/**
 * Planning season 1 for a single store: derives SOS from the current-season
 * roll-forward, then runs the OTB formula.
 */
export function computeStoreSeason1(inputs: Season1PlanInputs): StorePlanSeasonOutput {
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
    forwardGrossSales: inputs.season1.forwardGrossSales,
    sosInventory: sos1.sos,
    onOrder: inputs.season1.onOrder,
  });

  return { ...otb1, sosFloored: sos1.floored, sosOverridden: sos1.overridden };
}

/**
 * Planning season 2 for a single store. Its SOS is season 1's forecast EoS —
 * which includes any overbought excess — so it takes that as an input
 * rather than recomputing it: season 1's final OTB (and so its EoS) only
 * settles after outlet transfers, which happen across stores.
 */
export function computeStoreSeason2(season2: StorePlanSeasonInputs, eosSeason1: number): StorePlanSeasonOutput {
  const sos2 = computeSos2(eosSeason1, season2.manualSosOverride);

  const otb2 = computeOtbForSeason({
    netRevenueTarget: season2.netRevenueTarget,
    discountPct: season2.discountPct,
    sellThroughPct: season2.sellThroughPct,
    forwardGrossSales: season2.forwardGrossSales,
    sosInventory: sos2.sos,
    onOrder: season2.onOrder,
  });

  return { ...otb2, sosFloored: false, sosOverridden: sos2.overridden };
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

/** Sell-through target: valid range 1-100%. Warn (non-blocking) below 40% or above 95%. */
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
