import * as XLSX from "xlsx";
import type { OtbSeasonRow } from "@/lib/results";
import { groupAndAggregate, computeSeasonSummary } from "@/lib/results";
import type { FxRateMap } from "@/lib/otb-engine";

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
    grand.storeCount,
    grand.netTarget.ok ? `${round2(grand.netTarget.total)} ${grand.netTarget.currency}` : "MISSING FX",
    grand.otb.ok ? `${round2(grand.otb.total)} ${grand.otb.currency}` : "MISSING FX",
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
    ["Forecast Sell-Through %", Number((s1.weightedAvgSellThrough * 100).toFixed(1)), Number((s2.weightedAvgSellThrough * 100).toFixed(1))],
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

export function buildOtbWorkbook(params: {
  season1Rows: OtbSeasonRow[];
  season2Rows: OtbSeasonRow[];
  planning1Label: string;
  planning2Label: string;
  fxRates: FxRateMap;
  fxAsOf: Record<string, string>;
}): XLSX.WorkBook {
  const { season1Rows, season2Rows, planning1Label, planning2Label, fxRates, fxAsOf } = params;
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    buildSummarySheet(season1Rows, season2Rows, planning1Label, planning2Label, fxRates, fxAsOf),
    "Summary"
  );
  XLSX.utils.book_append_sheet(wb, buildSeasonSheet(season1Rows, fxRates), planning1Label);
  XLSX.utils.book_append_sheet(wb, buildSeasonSheet(season2Rows, fxRates), planning2Label);

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
