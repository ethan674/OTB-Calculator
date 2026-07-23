import { describe, it, expect } from "vitest";
import {
  computeOtbForSeason,
  computeSos1,
  computeSos2,
  computeStorePlan,
  getPlanningSeasons,
  getSeasonForDate,
  buildMonthlyHorizon,
  aggregateByCurrency,
  makeSeasonLabel,
} from "./otb-engine";

describe("computeOtbForSeason — worked example (spec §2)", () => {
  it("matches the exact worked example", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 10_000_000,
      discountPct: 0.2,
      sellThroughPct: 0.75,
      sosInventory: 3_000_000,
      onOrder: 0,
    });

    expect(result.grossSalesValue).toBeCloseTo(12_500_000, 0);
    expect(result.discountValue).toBeCloseTo(2_500_000, 0);
    expect(Math.round(result.totalAvailable)).toBe(16_666_667);
    expect(Math.round(result.targetEosInventory)).toBe(4_166_667);
    expect(Math.round(result.otb)).toBe(13_666_667);
    expect(result.overbought).toBe(false);
  });

  it("satisfies the sanity-check identity: totalAvailable = (Net + Discount) + EOS", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 4_321_000,
      discountPct: 0.33,
      sellThroughPct: 0.6,
      sosInventory: 500_000,
      onOrder: 100_000,
    });
    const identity = result.netRevenueTarget + result.discountValue + result.targetEosInventory;
    expect(result.totalAvailable).toBeCloseTo(identity, 6);
  });
});

describe("negative OTB pass-through and flag", () => {
  it("does not clamp negative OTB to zero and sets overbought flag", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 1_000_000,
      discountPct: 0.2,
      sellThroughPct: 0.8,
      sosInventory: 5_000_000, // way more stock than needed -> negative OTB
      onOrder: 0,
    });

    expect(result.otb).toBeLessThan(0);
    expect(result.overbought).toBe(true);
  });

  it("flows negative store OTB into aggregate totals unchanged", () => {
    const overboughtStoreOtb = -250_000;
    const healthyStoreOtb = 1_000_000;
    const total = overboughtStoreOtb + healthyStoreOtb;
    expect(total).toBe(750_000);
  });
});

describe("season detection (spec §3)", () => {
  it("July 2026 -> current FW26 -> planning SS27, FW27", () => {
    const { current, planning1, planning2 } = getPlanningSeasons(new Date(2026, 6, 15));
    expect(current.label).toBe("FW26");
    expect(planning1.label).toBe("SS27");
    expect(planning2.label).toBe("FW27");
  });

  it("mid-January 2026 -> current SS26 -> planning FW26, SS27", () => {
    const { current, planning1, planning2 } = getPlanningSeasons(new Date(2026, 0, 15));
    expect(current.label).toBe("SS26");
    expect(planning1.label).toBe("FW26");
    expect(planning2.label).toBe("SS27");
  });

  it("edge date Jan 1 resolves to SS of that year", () => {
    const season = getSeasonForDate(new Date(2026, 0, 1));
    expect(season.label).toBe("SS26");
    const { planning1, planning2 } = getPlanningSeasons(new Date(2026, 0, 1));
    expect(planning1.label).toBe("FW26");
    expect(planning2.label).toBe("SS27");
  });

  it("edge date Jun 30 resolves to SS of that year", () => {
    const season = getSeasonForDate(new Date(2026, 5, 30));
    expect(season.label).toBe("SS26");
  });

  it("edge date Jul 1 resolves to FW of that year", () => {
    const season = getSeasonForDate(new Date(2026, 6, 1));
    expect(season.label).toBe("FW26");
    const { planning1, planning2 } = getPlanningSeasons(new Date(2026, 6, 1));
    expect(planning1.label).toBe("SS27");
    expect(planning2.label).toBe("FW27");
  });

  it("edge date Dec 31 resolves to FW of that year", () => {
    const season = getSeasonForDate(new Date(2026, 11, 31));
    expect(season.label).toBe("FW26");
  });

  it("makeSeasonLabel formats 2-digit years", () => {
    expect(makeSeasonLabel("SS", 2026)).toBe("SS26");
    expect(makeSeasonLabel("FW", 2099)).toBe("FW99");
  });
});

describe("monthly forecast horizon (spec §3)", () => {
  it("July 2026 today -> horizon Jul 2026 through Dec 2027", () => {
    const months = buildMonthlyHorizon(new Date(2026, 6, 15));
    expect(months[0].monthKey).toBe("2026-07");
    expect(months[months.length - 1].monthKey).toBe("2027-12");
    expect(months.length).toBe(18); // Jul26-Dec26 (6) + all SS27 (6) + all FW27 (6)
  });

  it("mid-Jan 2026 today -> horizon Jan 2026 through Jun 2027", () => {
    const months = buildMonthlyHorizon(new Date(2026, 0, 15));
    expect(months[0].monthKey).toBe("2026-01");
    expect(months[months.length - 1].monthKey).toBe("2027-06");
    expect(months.length).toBe(18);
  });

  it("tags each month with the correct planning bucket", () => {
    const months = buildMonthlyHorizon(new Date(2026, 6, 15));
    const currentMonths = months.filter((m) => m.bucket === "current");
    const p1Months = months.filter((m) => m.bucket === "planning1");
    const p2Months = months.filter((m) => m.bucket === "planning2");
    expect(currentMonths.every((m) => m.seasonLabel === "FW26")).toBe(true);
    expect(p1Months.every((m) => m.seasonLabel === "SS27")).toBe(true);
    expect(p2Months.every((m) => m.seasonLabel === "FW27")).toBe(true);
    expect(currentMonths.length).toBe(6);
    expect(p1Months.length).toBe(6);
    expect(p2Months.length).toBe(6);
  });
});

describe("two-season inventory roll-forward chain (spec §4)", () => {
  it("SOS(season1) derives from current on-hand + receipts - projected remaining sales", () => {
    const result = computeSos1({
      currentOnHandInventory: 2_000_000,
      currentRemainingReceipts: 500_000,
      remainingCurrentSeasonNetForecast: 1_200_000,
      currentSeasonDiscountPct: 0.25, // gross-up remaining sales
    });
    const expectedProjectedGross = 1_200_000 / 0.75;
    expect(result.projectedGrossSalesRemaining).toBeCloseTo(expectedProjectedGross, 4);
    expect(result.sos).toBeCloseTo(2_000_000 + 500_000 - expectedProjectedGross, 4);
    expect(result.floored).toBe(false);
  });

  it("floors SOS(season1) at 0 and flags when projected sell-down exceeds stock", () => {
    const result = computeSos1({
      currentOnHandInventory: 100_000,
      currentRemainingReceipts: 0,
      remainingCurrentSeasonNetForecast: 5_000_000,
      currentSeasonDiscountPct: 0.2,
    });
    expect(result.sos).toBe(0);
    expect(result.floored).toBe(true);
    expect(result.rawSos).toBeLessThan(0);
  });

  it("EOS of planning season 1 = SOS of planning season 2 minus committed on-order for season 2", () => {
    const plan = computeStorePlan({
      currentOnHandInventory: 3_000_000,
      currentRemainingReceipts: 0,
      currentSeasonDiscountPct: 0.2,
      remainingCurrentSeasonNetForecast: 0,
      season1: { netRevenueTarget: 10_000_000, discountPct: 0.2, sellThroughPct: 0.75, onOrder: 0 },
      season2: { netRevenueTarget: 8_000_000, discountPct: 0.25, sellThroughPct: 0.7, onOrder: 400_000 },
    });

    // SOS(season2) = Target EOS Inventory (season1) + On-Order committed for season2
    expect(plan.season2.sosInventory).toBeCloseTo(plan.season1.targetEosInventory + 400_000, 4);
  });

  it("manual SOS override wins over the derived value and is flagged", () => {
    const sos1 = computeSos1({
      currentOnHandInventory: 2_000_000,
      currentRemainingReceipts: 0,
      remainingCurrentSeasonNetForecast: 1_000_000,
      currentSeasonDiscountPct: 0.2,
      manualSosOverride: 999_999,
    });
    expect(sos1.sos).toBe(999_999);
    expect(sos1.overridden).toBe(true);

    const sos2 = computeSos2(1_000_000, 200_000, 555_555);
    expect(sos2.sos).toBe(555_555);
    expect(sos2.overridden).toBe(true);
  });
});

describe("currency aggregation rule (spec §6)", () => {
  it("single-currency aggregate stays native", () => {
    const result = aggregateByCurrency(
      [
        { value: 100, currency: "TWD" },
        { value: 200, currency: "TWD" },
      ],
      {}
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.currency).toBe("TWD");
      expect(result.total).toBe(300);
      expect(result.converted).toBe(false);
    }
  });

  it("mixed-currency aggregate converts to USD using FX rates", () => {
    const result = aggregateByCurrency(
      [
        { value: 1000, currency: "TWD" },
        { value: 2000, currency: "SGD" },
      ],
      { TWD: 0.031, SGD: 0.74 }
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.currency).toBe("USD");
      expect(result.converted).toBe(true);
      expect(result.total).toBeCloseTo(1000 * 0.031 + 2000 * 0.74, 6);
      expect(result.ratesUsed).toEqual({ TWD: 0.031, SGD: 0.74 });
    }
  });

  it("blocks the USD aggregate and reports missing currencies, never silently skipping stores", () => {
    const result = aggregateByCurrency(
      [
        { value: 1000, currency: "TWD" },
        { value: 2000, currency: "VND" },
        { value: 3000, currency: "SGD" },
      ],
      { TWD: 0.031 } // VND and SGD rates missing
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingCurrencies.sort()).toEqual(["SGD", "VND"]);
      expect(result.message).toMatch(/SGD/);
      expect(result.message).toMatch(/VND/);
    }
  });
});
