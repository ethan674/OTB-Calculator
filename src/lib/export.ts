import * as XLSX from "xlsx";
import type { OtbSeasonRow } from "@/lib/results";
import { groupAndAggregate, computeSeasonSummary } from "@/lib/results";
import type { FxRateMap, HorizonMonth } from "@/lib/otb-engine";
import { brandMarketKey } from "@/lib/brandInventory";
import { MARKET_CURRENCY } from "@/data/markets";
import { CHANNELS, STORE_TYPES, emptyStore, type CalcStore } from "@/types";

const DETAIL_HEADERS = [
  "Store Name",
  "Brand",
  "Channel",
  "Store Type",
  "Market",
  "Currency",
  "Target",
  "Gross",
  "Discount Value",
  "SoS Inv",
  "Incoming Goods",
  "Sell-Through %",
  "EoS Inv",
  "Store OTB (native currency)",
  "Store OTB (USD equivalent)",
  "Transfer Adjustment",
  "Overbought",
  "SOS Overridden",
  "SOS Floored",
];

function detailRowToArray(r: OtbSeasonRow): (string | number | boolean)[] {
  return [
    r.storeName,
    r.brand,
    r.channel,
    r.isOutlet ? "Outlet" : "Full-Price",
    r.market,
    r.currency,
    round2(r.netRevenueTarget),
    round2(r.grossSalesValue),
    round2(r.discountValue),
    round2(r.sosInventory),
    round2(r.onOrder),
    Number((r.sellThroughPct * 100).toFixed(1)),
    round2(r.targetEosInventory),
    round2(r.otb),
    r.otbUsd !== null ? round2(r.otbUsd) : "N/A (missing FX rate)",
    r.transferAdjustment !== 0 ? round2(r.transferAdjustment) : "",
    r.overbought ? "OVERBOUGHT" : "",
    r.sosOverridden ? "override" : "",
    r.sosFloored ? "floored" : "",
  ];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round1Pct(n: number): number {
  return Number((n * 100).toFixed(1));
}

function buildSeasonSheet(rows: OtbSeasonRow[], fxRates: FxRateMap): XLSX.WorkSheet {
  const aoa: (string | number | boolean)[][] = [DETAIL_HEADERS, ...rows.map(detailRowToArray)];

  aoa.push([]);
  aoa.push(["Aggregates"]);
  for (const field of ["channel", "brand", "market"] as const) {
    aoa.push([]);
    aoa.push([`By ${field}`, "Stores", "Target", "OTB (SRP)"]);
    const groups = groupAndAggregate(rows, (r) => r[field], fxRates);
    for (const g of groups) {
      aoa.push([
        g.groupKey,
        g.storeCount,
        g.netTarget.ok ? `${round2(g.netTarget.total)} ${g.netTarget.currency}` : `MISSING FX: ${g.netTarget.missingCurrencies.join(", ")}`,
        g.otb.ok ? `${round2(g.otb.total)} ${g.otb.currency}` : `MISSING FX: ${g.otb.missingCurrencies.join(", ")}`,
      ]);
    }
  }
  const grand = groupAndAggregate(rows, () => "Grand Total", fxRates)[0];
  aoa.push([]);
  aoa.push([
    "Grand Total",
    grand?.storeCount ?? 0,
    grand?.netTarget.ok ? `${round2(grand.netTarget.total)} ${grand.netTarget.currency}` : grand ? "MISSING FX" : "0",
    grand?.otb.ok ? `${round2(grand.otb.total)} ${grand.otb.currency}` : grand ? "MISSING FX" : "0",
  ]);

  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildSummarySheet(
  season1Rows: OtbSeasonRow[],
  season2Rows: OtbSeasonRow[],
  planning1Label: string,
  planning2Label: string,
  fxRates: FxRateMap,
  fxAsOf: Record<string, string>
): XLSX.WorkSheet {
  const s1 = computeSeasonSummary(season1Rows, fxRates);
  const s2 = computeSeasonSummary(season2Rows, fxRates);

  const aoa: (string | number)[][] = [
    ["OTB Calculator — Season Summary"],
    [],
    ["Metric", planning1Label, planning2Label],
    ["Store count", s1.storeCount, s2.storeCount],
    [
      "Total OTB (SRP) — excludes outlet stores",
      s1.totalOtb.ok ? `${round2(s1.totalOtb.total)} ${s1.totalOtb.currency}` : "MISSING FX RATE",
      s2.totalOtb.ok ? `${round2(s2.totalOtb.total)} ${s2.totalOtb.currency}` : "MISSING FX RATE",
    ],
    [
      "Total Target",
      s1.totalNetTarget.ok ? `${round2(s1.totalNetTarget.total)} ${s1.totalNetTarget.currency}` : "MISSING FX RATE",
      s2.totalNetTarget.ok ? `${round2(s2.totalNetTarget.total)} ${s2.totalNetTarget.currency}` : "MISSING FX RATE",
    ],
    [
      "Forecast SoS Inventory",
      s1.totalSos.ok ? `${round2(s1.totalSos.total)} ${s1.totalSos.currency}` : "MISSING FX RATE",
      s2.totalSos.ok ? `${round2(s2.totalSos.total)} ${s2.totalSos.currency}` : "MISSING FX RATE",
    ],
    ["Blended Discount %", round1Pct(s1.weightedAvgDiscount), round1Pct(s2.weightedAvgDiscount)],
    ["Forecast Sell-Through %", round1Pct(s1.weightedAvgSellThrough), round1Pct(s2.weightedAvgSellThrough)],
    [
      "Forecast EoS Inventory",
      s1.totalEos.ok ? `${round2(s1.totalEos.total)} ${s1.totalEos.currency}` : "MISSING FX RATE",
      s2.totalEos.ok ? `${round2(s2.totalEos.total)} ${s2.totalEos.currency}` : "MISSING FX RATE",
    ],
    ["Overbought stores", s1.overboughtCount, s2.overboughtCount],
    [],
    ["FX Rates Used (currency -> USD)"],
    ["Currency", "Rate to USD", "As Of"],
    ...Object.entries(fxRates).map(([currency, rate]) => [currency, rate, fxAsOf[currency] ? new Date(fxAsOf[currency]).toDateString() : ""]),
  ];

  return XLSX.utils.aoa_to_sheet(aoa);
}

// ---------------------------------------------------------------------------
// Input sheets — a full snapshot of every raw input, so the workbook can be
// re-imported to exactly reconstruct app state (see parseImportedWorkbook).
// ---------------------------------------------------------------------------

function buildStoresInputSheet(stores: CalcStore[]): XLSX.WorkSheet {
  const aoa: string[][] = [
    ["Store Name", "Brand", "Channel", "Market", "Store Type"],
    ...stores.map((s) => [s.storeName, s.brand, s.channel, s.market, s.storeType]),
  ];
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildBrandInventoryInputSheet(brandInventory: Record<string, number>): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [["Brand", "Market", "Currency", "Current On-Hand Inventory (SRP)"]];
  for (const [key, amount] of Object.entries(brandInventory)) {
    const [brand, market] = key.split("::");
    aoa.push([brand ?? "", market ?? "", MARKET_CURRENCY[market] ?? "", amount]);
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildMonthlyForecastInputSheet(stores: CalcStore[], horizon: HorizonMonth[]): XLSX.WorkSheet {
  const monthKeys = horizon.map((m) => m.monthKey);
  const aoa: (string | number)[][] = [["Store Name", ...monthKeys]];
  for (const s of stores) {
    aoa.push([s.storeName, ...monthKeys.map((mk) => s.monthlyForecast[mk] ?? "")]);
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildAssumptionsInputSheet(stores: CalcStore[]): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [
    [
      "Store Name",
      "Incoming Goods (Current)",
      "Current Average Discount %",
      "S1 On-Order",
      "S1 Sell-Through %",
      "S1 Discount %",
      "S1 Manual SOS Override",
      "S2 On-Order",
      "S2 Sell-Through %",
      "S2 Discount %",
      "S2 Manual SOS Override",
    ],
  ];
  for (const s of stores) {
    aoa.push([
      s.storeName,
      s.currentRemainingReceipts,
      round1Pct(s.currentDiscountPct),
      s.s1OnOrder,
      round1Pct(s.s1SellThroughPct),
      round1Pct(s.s1DiscountPct),
      s.s1ManualSosOverride ?? "",
      s.s2OnOrder,
      round1Pct(s.s2SellThroughPct),
      round1Pct(s.s2DiscountPct),
      s.s2ManualSosOverride ?? "",
    ]);
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildFxRatesInputSheet(fxRates: FxRateMap): XLSX.WorkSheet {
  const aoa: (string | number)[][] = [["Currency", "Rate to USD"], ...Object.entries(fxRates).map(([c, r]) => [c, r])];
  return XLSX.utils.aoa_to_sheet(aoa);
}

export function buildOtbWorkbook(params: {
  stores: CalcStore[];
  brandInventory: Record<string, number>;
  horizon: HorizonMonth[];
  season1Rows: OtbSeasonRow[];
  season2Rows: OtbSeasonRow[];
  planning1Label: string;
  planning2Label: string;
  fxRates: FxRateMap;
  fxAsOf: Record<string, string>;
}): XLSX.WorkBook {
  const { stores, brandInventory, horizon, season1Rows, season2Rows, planning1Label, planning2Label, fxRates, fxAsOf } = params;
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildSummarySheet(season1Rows, season2Rows, planning1Label, planning2Label, fxRates, fxAsOf),
    "Summary"
  );
  XLSX.utils.book_append_sheet(wb, buildSeasonSheet(season1Rows, fxRates), planning1Label);
  XLSX.utils.book_append_sheet(wb, buildSeasonSheet(season2Rows, fxRates), planning2Label);

  // Raw inputs — everything needed to re-populate the app via Import Excel.
  XLSX.utils.book_append_sheet(wb, buildStoresInputSheet(stores), "Stores");
  XLSX.utils.book_append_sheet(wb, buildBrandInventoryInputSheet(brandInventory), "Brand Inventory");
  XLSX.utils.book_append_sheet(wb, buildMonthlyForecastInputSheet(stores, horizon), "Monthly Forecast");
  XLSX.utils.book_append_sheet(wb, buildAssumptionsInputSheet(stores), "Store Assumptions");
  XLSX.utils.book_append_sheet(wb, buildFxRatesInputSheet(fxRates), "FX Rates");

  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string) {
  XLSX.writeFile(wb, filename);
}

export function buildCsv(rows: OtbSeasonRow[]): string {
  const aoa = [DETAIL_HEADERS, ...rows.map(detailRowToArray)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  return XLSX.utils.sheet_to_csv(ws);
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import — reconstructs app state from a workbook built by buildOtbWorkbook.
// Only reads the raw-input sheets (Stores, Brand Inventory, Monthly Forecast,
// Store Assumptions, FX Rates); the computed Summary/season sheets are
// ignored on import since everything in them is re-derived from inputs.
// ---------------------------------------------------------------------------

export interface ImportedWorkbookData {
  stores: CalcStore[];
  brandInventory: Record<string, number>;
  fxRates: FxRateMap;
}

function sheetToAoa(ws: XLSX.WorkSheet | undefined): (string | number)[][] {
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as (string | number)[][];
}

function toNumberOrUndefined(v: string | number | undefined): number | undefined {
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseImportedWorkbook(wb: XLSX.WorkBook): ImportedWorkbookData {
  const storesSheet = sheetToAoa(wb.Sheets["Stores"]);
  if (storesSheet.length < 1) {
    throw new Error(
      "This file doesn't contain a \"Stores\" sheet — it may be from an older export, or not an OTB Calculator file."
    );
  }

  const stores: CalcStore[] = storesSheet
    .slice(1)
    .filter((row) => row[0])
    .map((row) => {
      const [storeName, brand, channel, market, storeType] = row;
      const store = emptyStore();
      store.storeName = String(storeName ?? "");
      store.brand = String(brand ?? "");
      store.channel = CHANNELS.includes(channel as (typeof CHANNELS)[number]) ? (channel as (typeof CHANNELS)[number]) : "Retail";
      store.market = String(market ?? store.market);
      store.currency = MARKET_CURRENCY[store.market] ?? store.currency;
      store.storeType = STORE_TYPES.includes(storeType as (typeof STORE_TYPES)[number])
        ? (storeType as (typeof STORE_TYPES)[number])
        : "Full-Price";
      return store;
    });

  if (stores.length === 0) {
    throw new Error("The \"Stores\" sheet has no store rows.");
  }

  const byName = new Map(stores.map((s) => [s.storeName, s]));

  const forecastSheet = sheetToAoa(wb.Sheets["Monthly Forecast"]);
  if (forecastSheet.length >= 1) {
    const monthKeys = forecastSheet[0].slice(1).map(String);
    for (const row of forecastSheet.slice(1)) {
      const store = byName.get(String(row[0] ?? ""));
      if (!store) continue;
      monthKeys.forEach((monthKey, i) => {
        const value = toNumberOrUndefined(row[i + 1]);
        if (monthKey && value !== undefined) store.monthlyForecast[monthKey] = value;
      });
    }
  }

  const assumptionsSheet = sheetToAoa(wb.Sheets["Store Assumptions"]);
  for (const row of assumptionsSheet.slice(1)) {
    const store = byName.get(String(row[0] ?? ""));
    if (!store) continue;
    const currentReceipts = toNumberOrUndefined(row[1]);
    if (currentReceipts !== undefined) store.currentRemainingReceipts = currentReceipts;
    const currentDiscount = toNumberOrUndefined(row[2]);
    if (currentDiscount !== undefined) store.currentDiscountPct = currentDiscount / 100;
    const s1OnOrder = toNumberOrUndefined(row[3]);
    if (s1OnOrder !== undefined) store.s1OnOrder = s1OnOrder;
    const s1SellThrough = toNumberOrUndefined(row[4]);
    if (s1SellThrough !== undefined) store.s1SellThroughPct = s1SellThrough / 100;
    const s1Discount = toNumberOrUndefined(row[5]);
    if (s1Discount !== undefined) store.s1DiscountPct = s1Discount / 100;
    store.s1ManualSosOverride = toNumberOrUndefined(row[6]) ?? null;
    const s2OnOrder = toNumberOrUndefined(row[7]);
    if (s2OnOrder !== undefined) store.s2OnOrder = s2OnOrder;
    const s2SellThrough = toNumberOrUndefined(row[8]);
    if (s2SellThrough !== undefined) store.s2SellThroughPct = s2SellThrough / 100;
    const s2Discount = toNumberOrUndefined(row[9]);
    if (s2Discount !== undefined) store.s2DiscountPct = s2Discount / 100;
    store.s2ManualSosOverride = toNumberOrUndefined(row[10]) ?? null;
  }

  const brandInventory: Record<string, number> = {};
  const brandInvSheet = sheetToAoa(wb.Sheets["Brand Inventory"]);
  for (const row of brandInvSheet.slice(1)) {
    const brand = row[0], market = row[1];
    const amount = toNumberOrUndefined(row[3]);
    if (brand && market && amount !== undefined) {
      brandInventory[brandMarketKey(String(brand), String(market))] = amount;
    }
  }

  const fxRates: FxRateMap = {};
  const fxSheet = sheetToAoa(wb.Sheets["FX Rates"]);
  for (const row of fxSheet.slice(1)) {
    const currency = row[0];
    const rate = toNumberOrUndefined(row[1]);
    if (currency && rate !== undefined) fxRates[String(currency)] = rate;
  }

  return { stores, brandInventory, fxRates };
}

export async function readWorkbookFile(file: File): Promise<XLSX.WorkBook> {
  const buffer = await file.arrayBuffer();
  return XLSX.read(buffer, { type: "array" });
}
