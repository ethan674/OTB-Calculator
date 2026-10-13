import { MARKETS, MARKET_CURRENCY } from "@/data/markets";

export const CHANNELS = ["Retail", "E-Commerce"] as const;
export type Channel = (typeof CHANNELS)[number];

export const STORE_TYPES = ["Full-Price", "Outlet"] as const;
export type StoreType = (typeof STORE_TYPES)[number];

/** One store's full input set. Lives only in browser memory — nothing persists. */
export interface CalcStore {
  id: string;
  storeName: string;
  brand: string;
  channel: Channel;
  /** Auto-determines `currency` — see src/data/markets.ts */
  market: string;
  currency: string;
  /** Outlet stores don't receive new-season buys — see src/lib/brandInventory.ts */
  storeType: StoreType;

  /**
   * Derived, not stored here: on-hand inventory is entered once per
   * brand+market (see the Brand Inventory tab / src/lib/brandInventory.ts)
   * and split across that group's stores by current-season sales share.
   */
  currentRemainingReceipts: number;
  currentDiscountPct: number; // decimal 0-1

  /** "YYYY-MM" -> net revenue forecast for that month */
  monthlyForecast: Record<string, number>;

  s1SellThroughPct: number; // decimal 0-1
  s1DiscountPct: number; // decimal 0-1
  /** Locked to 0 for Outlet stores — they don't receive new-season product. */
  s1OnOrder: number;
  s1ManualSosOverride: number | null;

  s2SellThroughPct: number; // decimal 0-1
  s2DiscountPct: number; // decimal 0-1
  /** Locked to 0 for Outlet stores — they don't receive new-season product. */
  s2OnOrder: number;
  s2ManualSosOverride: number | null;

  /**
   * Per-store override: average monthly NET sales after the last planning
   * season, used to size that season's target ending inventory. Blank (null)
   * falls back to the season's own monthly average, adjusted by the brand's
   * outlook % — see lib/storePlan.ts.
   */
  forwardMonthlySales: number | null;
}

export function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function emptyStore(): CalcStore {
  const market = MARKETS[0];
  return {
    id: makeId(),
    storeName: "",
    brand: "",
    channel: "Retail",
    market,
    currency: MARKET_CURRENCY[market],
    storeType: "Full-Price",
    currentRemainingReceipts: 0,
    currentDiscountPct: 0.2,
    monthlyForecast: {},
    s1SellThroughPct: 0.7,
    s1DiscountPct: 0.2,
    s1OnOrder: 0,
    s1ManualSosOverride: null,
    s2SellThroughPct: 0.7,
    s2DiscountPct: 0.2,
    s2OnOrder: 0,
    s2ManualSosOverride: null,
    forwardMonthlySales: null,
  };
}
