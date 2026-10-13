import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildCsv, buildOtbWorkbook, parseImportedWorkbook } from "./export";
import type { OtbSeasonRow } from "./results";
import { buildMonthlyHorizon } from "./otb-engine";
import { emptyStore, type CalcStore } from "@/types";
import { brandMarketKey } from "./brandInventory";

const horizon = buildMonthlyHorizon(new Date());

function makeStore(overrides: Partial<CalcStore>): CalcStore {
  return { ...emptyStore(), ...overrides };
}

describe("export/import round trip", () => {
  it("reconstructs stores, monthly forecast, assumptions, brand inventory, and FX rates exactly", () => {
    const stores: CalcStore[] = [
      makeStore({
        storeName: "Taipei 101 Flagship",
        brand: "On Running",
        channel: "Retail",
        market: "Taiwan",
        storeType: "Full-Price",
        currentRemainingReceipts: 2_000_000,
        currentDiscountPct: 0.2,
        monthlyForecast: { [horizon[0].monthKey]: 5_400_000, [horizon[6].monthKey]: 6_000_000 },
        s1SellThroughPct: 0.78,
        s1DiscountPct: 0.2,
        s1OnOrder: 4_000_000,
        s1ManualSosOverride: 1_234_567.89,
        s2SellThroughPct: 0.75,
        s2DiscountPct: 0.22,
        s2OnOrder: 3_500_000,
        s2ManualSosOverride: null,
        forwardMonthlySales: 250_000,
      }),
      makeStore({
        storeName: "Taipei Outlet",
        brand: "On Running",
        channel: "Retail",
        market: "Taiwan",
        storeType: "Outlet",
        currentRemainingReceipts: 0,
        currentDiscountPct: 0.15,
        monthlyForecast: { [horizon[6].monthKey]: 1_500_000 },
        s1DiscountPct: 0.5,
        s1OnOrder: 0,
        s1ManualSosOverride: null,
        s2DiscountPct: 0.5,
        s2OnOrder: 0,
        s2ManualSosOverride: null,
      }),
    ];

    const brandInventory = { [brandMarketKey("On Running", "Taiwan")]: 9_000_000 };
    const brandOutlook = { [brandMarketKey("On Running", "Taiwan")]: -15, [brandMarketKey("Other", "Taiwan")]: 10 };
    const fxRates = { TWD: 0.031, VND: 0.00004 };

    const wb = buildOtbWorkbook({
      stores,
      brandInventory,
      brandOutlook,
      horizon,
      season1Rows: [],
      season2Rows: [],
      planning1Label: "SS27",
      planning2Label: "FW27",
      fxRates,
      fxAsOf: {},
    });

    const imported = parseImportedWorkbook(wb);

    expect(imported.stores).toHaveLength(2);
    const [a, b] = imported.stores;

    expect(a.storeName).toBe("Taipei 101 Flagship");
    expect(a.brand).toBe("On Running");
    expect(a.channel).toBe("Retail");
    expect(a.market).toBe("Taiwan");
    expect(a.currency).toBe("TWD");
    expect(a.storeType).toBe("Full-Price");
    expect(a.currentRemainingReceipts).toBe(2_000_000);
    expect(a.currentDiscountPct).toBeCloseTo(0.2, 6);
    expect(a.monthlyForecast[horizon[0].monthKey]).toBeCloseTo(5_400_000, 2);
    expect(a.monthlyForecast[horizon[6].monthKey]).toBeCloseTo(6_000_000, 2);
    expect(a.s1SellThroughPct).toBeCloseTo(0.78, 3);
    expect(a.s1DiscountPct).toBeCloseTo(0.2, 3);
    expect(a.s1OnOrder).toBe(4_000_000);
    expect(a.s1ManualSosOverride).toBeCloseTo(1_234_567.89, 2);
    expect(a.s2SellThroughPct).toBeCloseTo(0.75, 3);
    expect(a.s2DiscountPct).toBeCloseTo(0.22, 3);
    expect(a.s2OnOrder).toBe(3_500_000);
    expect(a.s2ManualSosOverride).toBeNull();
    expect(a.forwardMonthlySales).toBe(250_000);
    expect(imported.stores[1].forwardMonthlySales).toBeNull();
    // Month columns are read as months; the forward-sales column must not leak in as one.
    expect(Object.keys(a.monthlyForecast).every((k) => /^\d{4}-\d{2}$/.test(k))).toBe(true);

    expect(b.storeName).toBe("Taipei Outlet");
    expect(b.storeType).toBe("Outlet");
    expect(b.s1DiscountPct).toBeCloseTo(0.5, 3);
    expect(b.s1ManualSosOverride).toBeNull();

    expect(imported.brandInventory[brandMarketKey("On Running", "Taiwan")]).toBeCloseTo(9_000_000, 2);
    expect(imported.brandOutlook).toEqual(brandOutlook);
    expect(imported.fxRates).toEqual({ TWD: 0.031, VND: 0.00004 });
  });

  it("throws a clear error when the workbook has no stores", () => {
    const wb = buildOtbWorkbook({
      stores: [],
      brandInventory: {},
      brandOutlook: {},
      horizon,
      season1Rows: [],
      season2Rows: [],
      planning1Label: "SS27",
      planning2Label: "FW27",
      fxRates: {},
      fxAsOf: {},
    });
    expect(() => parseImportedWorkbook(wb)).toThrow(/no store rows/i);
  });

  it("throws a clear error when the file isn't an OTB Calculator export at all", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Random", "Data"], [1, 2]]), "Sheet1");
    expect(() => parseImportedWorkbook(wb)).toThrow(/doesn't contain a "Stores" sheet/i);
  });

  it("reads assumption columns by header name, so column order and extra columns don't matter", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Store Name", "Brand", "Channel", "Market", "Store Type"], ["A", "B", "Retail", "Taiwan", "Full-Price"]]), "Stores");
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["Store Name", "Incoming Goods (Current)", "Current Average Discount %", "S1 On-Order", "S1 Sell-Through %", "S1 Discount %", "S1 Manual SOS Override", "S2 On-Order", "S2 Sell-Through %", "S2 Discount %", "S2 Manual SOS Override"],
        ["A", 10, 25, 1000, 65, 30, "", 2000, 70, 35, 999],
      ]),
      "Store Assumptions"
    );
    const [a] = parseImportedWorkbook(wb).stores;
    expect(a.currentRemainingReceipts).toBe(10);
    expect(a.currentDiscountPct).toBeCloseTo(0.25, 6);
    expect(a.s1OnOrder).toBe(1000);
    expect(a.s1SellThroughPct).toBeCloseTo(0.65, 6);
    expect(a.s1DiscountPct).toBeCloseTo(0.3, 6);
    expect(a.s1ManualSosOverride).toBeNull();
    expect(a.s2OnOrder).toBe(2000);
    expect(a.s2SellThroughPct).toBeCloseTo(0.7, 6);
    expect(a.s2DiscountPct).toBeCloseTo(0.35, 6);
    expect(a.s2ManualSosOverride).toBe(999);
  });

  it("detail export shows SoS before the transfer and the transfer in its own column", () => {
    const base: OtbSeasonRow = {
      storeId: "x", storeName: "Supplier", brand: "B", channel: "Retail", market: "Taiwan", currency: "TWD", isOutlet: false,
      netRevenueTarget: 800, grossSalesValue: 1000, discountValue: 200, totalAvailable: 0, eosInventory: 0, targetEosInventory: 0, forwardGrossSales: 0,
      buyLocked: false, sosInventory: 0, onOrder: 100, otb: 0, balance: 0, overbought: false, sellThroughPct: 1, discountPct: 0.2,
      sosFloored: false, sosOverridden: false, otbUsd: null, transferAdjustment: 0,
    };
    // Supplier gave 300 to an outlet (post-transfer SoS 700 = 1,000 before); outlet received 300 (post-transfer SoS 300 = 0 before).
    const supplier = { ...base, sosInventory: 700, transferAdjustment: 300, totalAvailable: 800 };
    const outlet = { ...base, storeName: "Outlet", isOutlet: true, sosInventory: 300, onOrder: 0, transferAdjustment: -300, totalAvailable: 300 };

    const [header, ...lines] = buildCsv([supplier, outlet]).trim().split("\n").map((l) => l.split(","));
    const col = (name: string) => header.indexOf(name);
    const sos = col("SoS Inv (before transfer)"), tr = col("Transfer In/(Out)"), inc = col("Incoming Goods"), ta = col("Total Available (SoS + Transfer + Incoming)");

    const [sup, out] = lines;
    expect([sup[sos], sup[tr]]).toEqual(["1000", "-300"]); // supplier: before-transfer SoS, 300 out
    expect([out[sos], out[tr]]).toEqual(["0", "300"]); // outlet: nothing before, 300 in
    for (const l of [sup, out]) expect(Number(l[sos]) + Number(l[tr]) + Number(l[inc])).toBeCloseTo(Number(l[ta]), 6);
  });
});
