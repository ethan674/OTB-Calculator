import { buildMonthlyHorizon, type HorizonMonth } from "@/lib/otb-engine";
import { makeId, type CalcStore, type StoreType } from "@/types";
import { MARKET_CURRENCY } from "@/data/markets";
import { brandMarketKey } from "@/lib/brandInventory";

// Deterministic seasonal multipliers so sample data looks realistic.
const MULTIPLIERS = [0.9, 1.0, 1.15, 1.05, 0.95, 1.0];

function monthlySeries(months: HorizonMonth[], base: number): Record<string, number> {
  const series: Record<string, number> = {};
  months.forEach((m, i) => {
    series[m.monthKey] = Math.round(base * MULTIPLIERS[i % MULTIPLIERS.length]);
  });
  return series;
}

interface SampleDef {
  storeName: string;
  brand: string;
  channel: CalcStore["channel"];
  market: string;
  storeType: StoreType;
  baseMonthlyRevenue: number;
  /** Contributes to this brand+market's SAMPLE_BRAND_INVENTORY pool total (see below) — not stored per store anymore. */
  onHandContribution: number;
  currentRemainingReceipts: number;
  currentDiscountPct: number;
  s1SellThroughPct: number;
  s1DiscountPct: number;
  s1OnOrder: number;
  s2SellThroughPct: number;
  s2DiscountPct: number;
  s2OnOrder: number;
}

const SAMPLE_DEFS: SampleDef[] = [
  {
    storeName: "Taipei 101 Flagship",
    brand: "On Running",
    channel: "Retail",
    market: "Taiwan",
    storeType: "Full-Price",
    baseMonthlyRevenue: 6_000_000,
    onHandContribution: 9_000_000,
    currentRemainingReceipts: 2_000_000,
    currentDiscountPct: 0.2,
    s1SellThroughPct: 0.78,
    s1DiscountPct: 0.2,
    s1OnOrder: 4_000_000,
    s2SellThroughPct: 0.75,
    s2DiscountPct: 0.22,
    s2OnOrder: 0,
  },
  {
    storeName: "On Running Online TW",
    brand: "On Running",
    channel: "E-Commerce",
    market: "Taiwan",
    storeType: "Full-Price",
    baseMonthlyRevenue: 4_200_000,
    onHandContribution: 5_500_000,
    currentRemainingReceipts: 1_200_000,
    currentDiscountPct: 0.25,
    s1SellThroughPct: 0.82,
    s1DiscountPct: 0.25,
    s1OnOrder: 0,
    s2SellThroughPct: 0.8,
    s2DiscountPct: 0.24,
    s2OnOrder: 0,
  },
  {
    // Full-price peer for the Taipei Outlet below, in the same brand+market
    // group — needed so there's someone to supply the outlet's transfer
    // demand from (an outlet with no full-price peer in its group can't
    // receive a transfer at all; see lib/outletTransfer.ts).
    storeName: "Taipei Golf Pro Shop (PXG)",
    brand: "PXG",
    channel: "Retail",
    market: "Taiwan",
    storeType: "Full-Price",
    baseMonthlyRevenue: 4_500_000,
    onHandContribution: 5_000_000,
    currentRemainingReceipts: 1_000_000,
    currentDiscountPct: 0.15,
    s1SellThroughPct: 0.65,
    s1DiscountPct: 0.15,
    s1OnOrder: 0,
    s2SellThroughPct: 0.66,
    s2DiscountPct: 0.16,
    s2OnOrder: 0,
  },
  {
    // Outlet demo: carries stock to operate but doesn't receive new-season
    // buys — its on-order is locked to 0. Since it shares a brand+market
    // group with the full-price store above, its unmet need transfers in
    // from that store rather than just vanishing.
    storeName: "Taipei Outlet (PXG)",
    brand: "PXG",
    channel: "Retail",
    market: "Taiwan",
    storeType: "Outlet",
    baseMonthlyRevenue: 5_000_000,
    onHandContribution: 7_000_000,
    currentRemainingReceipts: 1_500_000,
    currentDiscountPct: 0.15,
    s1SellThroughPct: 0.6,
    s1DiscountPct: 0.15,
    s1OnOrder: 0,
    s2SellThroughPct: 0.62,
    s2DiscountPct: 0.17,
    s2OnOrder: 0,
  },
  {
    storeName: "Ho Chi Minh City Store",
    brand: "K-Swiss",
    channel: "Retail",
    market: "Vietnam",
    storeType: "Full-Price",
    baseMonthlyRevenue: 5_500_000_000,
    onHandContribution: 8_000_000_000,
    currentRemainingReceipts: 1_800_000_000,
    currentDiscountPct: 0.22,
    s1SellThroughPct: 0.65,
    s1DiscountPct: 0.22,
    s1OnOrder: 3_200_000_000,
    s2SellThroughPct: 0.68,
    s2DiscountPct: 0.2,
    s2OnOrder: 0,
  },
  {
    storeName: "Hanoi Online (PXG)",
    brand: "PXG",
    channel: "E-Commerce",
    market: "Vietnam",
    storeType: "Full-Price",
    baseMonthlyRevenue: 3_200_000_000,
    onHandContribution: 4_000_000_000,
    currentRemainingReceipts: 900_000_000,
    currentDiscountPct: 0.3,
    s1SellThroughPct: 0.7,
    s1DiscountPct: 0.28,
    s1OnOrder: 0,
    s2SellThroughPct: 0.72,
    s2DiscountPct: 0.26,
    s2OnOrder: 0,
  },
  {
    storeName: "Da Nang Store (On Running)",
    brand: "On Running",
    channel: "Retail",
    market: "Vietnam",
    storeType: "Full-Price",
    baseMonthlyRevenue: 4_500_000_000,
    onHandContribution: 6_500_000_000,
    currentRemainingReceipts: 1_400_000_000,
    currentDiscountPct: 0.18,
    s1SellThroughPct: 0.58,
    s1DiscountPct: 0.18,
    s1OnOrder: 2_600_000_000,
    s2SellThroughPct: 0.6,
    s2DiscountPct: 0.19,
    s2OnOrder: 0,
  },
  {
    storeName: "Orchard Road (K-Swiss)",
    brand: "K-Swiss",
    channel: "Retail",
    market: "Singapore",
    storeType: "Full-Price",
    baseMonthlyRevenue: 320_000,
    onHandContribution: 480_000,
    currentRemainingReceipts: 90_000,
    currentDiscountPct: 0.2,
    s1SellThroughPct: 0.8,
    s1DiscountPct: 0.2,
    s1OnOrder: 0,
    s2SellThroughPct: 0.78,
    s2DiscountPct: 0.21,
    s2OnOrder: 0,
  },
  {
    storeName: "On Running Singapore Online",
    brand: "On Running",
    channel: "E-Commerce",
    market: "Singapore",
    storeType: "Full-Price",
    baseMonthlyRevenue: 260_000,
    onHandContribution: 340_000,
    currentRemainingReceipts: 70_000,
    currentDiscountPct: 0.27,
    s1SellThroughPct: 0.85,
    s1DiscountPct: 0.26,
    s1OnOrder: 0,
    s2SellThroughPct: 0.83,
    s2DiscountPct: 0.25,
    s2OnOrder: 0,
  },
  {
    storeName: "Marina Bay Partner (PXG)",
    brand: "PXG",
    channel: "Retail",
    market: "Singapore",
    storeType: "Full-Price",
    baseMonthlyRevenue: 210_000,
    onHandContribution: 300_000,
    currentRemainingReceipts: 60_000,
    currentDiscountPct: 0.16,
    s1SellThroughPct: 0.63,
    s1DiscountPct: 0.16,
    s1OnOrder: 0,
    s2SellThroughPct: 0.65,
    s2DiscountPct: 0.18,
    s2OnOrder: 0,
  },
  {
    // Deliberately overbought: on-hand inventory and the (already bought)
    // on-order are far larger than the sales target needs, so it shows no
    // OTB, an overbought flag, and a big ending inventory that carries into
    // planning season 2's SoS.
    storeName: "Kaohsiung Store (K-Swiss)",
    brand: "K-Swiss",
    channel: "Retail",
    market: "Taiwan",
    storeType: "Full-Price",
    baseMonthlyRevenue: 1_800_000,
    onHandContribution: 40_000_000,
    currentRemainingReceipts: 8_000_000,
    currentDiscountPct: 0.2,
    s1SellThroughPct: 0.55,
    s1DiscountPct: 0.2,
    s1OnOrder: 6_000_000,
    s2SellThroughPct: 0.58,
    s2DiscountPct: 0.2,
    s2OnOrder: 0,
  },
];

export const SAMPLE_FX_RATES: Record<string, number> = {
  TWD: 0.031,
  VND: 0.00004,
  SGD: 0.74,
};

/** Brand+market on-hand inventory pools, summed from each group's sample stores. */
export const SAMPLE_BRAND_INVENTORY: Record<string, number> = SAMPLE_DEFS.reduce<Record<string, number>>((acc, def) => {
  const key = brandMarketKey(def.brand, def.market);
  acc[key] = (acc[key] ?? 0) + def.onHandContribution;
  return acc;
}, {});

export function buildSampleStores(): CalcStore[] {
  const horizon = buildMonthlyHorizon(new Date());
  return SAMPLE_DEFS.map((def) => ({
    id: makeId(),
    storeName: def.storeName,
    brand: def.brand,
    channel: def.channel,
    market: def.market,
    currency: MARKET_CURRENCY[def.market],
    storeType: def.storeType,
    currentRemainingReceipts: def.currentRemainingReceipts,
    currentDiscountPct: def.currentDiscountPct,
    monthlyForecast: monthlySeries(horizon, def.baseMonthlyRevenue),
    s1SellThroughPct: def.s1SellThroughPct,
    s1DiscountPct: def.s1DiscountPct,
    s1OnOrder: def.s1OnOrder,
    s1ManualSosOverride: null,
    s2SellThroughPct: def.s2SellThroughPct,
    s2DiscountPct: def.s2DiscountPct,
    s2OnOrder: def.s2OnOrder,
    s2ManualSosOverride: null,
    forwardMonthlySales: null,
  }));
}
