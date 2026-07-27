import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildOtbWorkbook, parseImportedWorkbook } from "./export";
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
        s1SellThroughPct: 0.6,
        s1DiscountPct: 0.5,
        s1OnOrder: 0,
        s1ManualSosOverride: null,
        s2SellThroughPct: 0.62,
        s2DiscountPct: 0.5,
        s2OnOrder: 0,
        s2ManualSosOverride: null,
      }),
    ];

    const brandInventory = { [brandMarketKey("On Running", "Taiwan")]: 9_000_000 };
    const fxRates = { TWD: 0.031, VND: 0.00004 };

    const wb = buildOtbWorkbook({
      stores,
      brandInventory,
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

    expect(b.storeName).toBe("Taipei Outlet");
    expect(b.storeType).toBe("Outlet");
    expect(b.s1DiscountPct).toBeCloseTo(0.5, 3);
    expect(b.s1ManualSosOverride).toBeNull();

    expect(imported.brandInventory[brandMarketKey("On Running", "Taiwan")]).toBeCloseTo(9_000_000, 2);
    expect(imported.fxRates).toEqual({ TWD: 0.031, VND: 0.00004 });
  });

  it("throws a clear error when the workbook has no stores", () => {
    const wb = buildOtbWorkbook({
      stores: [],
      brandInventory: {},
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
});
