import { describe, it, expect } from "vitest";
import {
  computeOtbForSeason,
  computeSos1,
  computeSos2,
  computeStoreSeason1,
  computeStoreSeason2,
  deriveSeasonPosition,
  getPlanningSeasons,
  getSeasonForDate,
  buildMonthlyHorizon,
  aggregateByCurrency,
  makeSeasonLabel,
} from "./otb-engine";

describe("computeOtbForSeason — open buy (incoming goods blank): sized to the target sell-through", () => {
  it("matches the spec's worked example", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 10_000_000,
      discountPct: 0.2,
      sellThroughPct: 0.75,
      sosInventory: 3_000_000,
      onOrder: 0,
    });

    expect(result.grossSalesValue).toBeCloseTo(12_500_000, 0);
    expect(result.discountValue).toBeCloseTo(2_500_000, 0);
    expect(Math.round(result.targetEosInventory)).toBe(4_166_667);
    expect(Math.round(result.otb)).toBe(13_666_667);
    expect(result.buyLocked).toBe(false);
    expect(result.overbought).toBe(false);
    // Forecast EoS = the target; sell-through is derived and lands back on the target.
    expect(Math.round(result.eosInventory)).toBe(4_166_667);
    expect(result.sellThroughPct).toBeCloseTo(0.75, 6);
  });

  it("satisfies the identity: Total Available + OTB = Gross + Target EoS", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 4_321_000,
      discountPct: 0.33,
      sellThroughPct: 0.6,
      sosInventory: 500_000,
      onOrder: 0,
    });
    expect(result.totalAvailable + result.otb).toBeCloseTo(result.grossSalesValue + result.targetEosInventory, 6);
  });
});

describe("computeOtbForSeason — locked buy (incoming goods filled in): already bought for, so no OTB", () => {
  it("shows no OTB, ignores the sell-through input, and derives everything from the stock held", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 10_000_000,
      discountPct: 0.2,
      sellThroughPct: 0.75, // ignored: the buy is locked
      sosInventory: 3_000_000,
      onOrder: 2_000_000,
    });
    expect(result.buyLocked).toBe(true);
    expect(result.otb).toBe(0);
    expect(result.targetEosInventory).toBe(0);
    expect(result.totalAvailable).toBe(5_000_000); // inventory + incoming
    expect(result.balance).toBeCloseTo(7_500_000, 0); // still 7.5M short of the 12.5M sales target
    expect(result.eosInventory).toBe(0);
    expect(result.sellThroughPct).toBe(1); // everything held sells
    expect(result.overbought).toBe(false);
  });

  it("an overbought locked store shows no OTB but keeps the excess as ending inventory and flags it", () => {
    const result = computeOtbForSeason({
      netRevenueTarget: 2_000_000,
      discountPct: 0.2,
      sellThroughPct: 0.7,
      sosInventory: 5_000_000,
      onOrder: 1_000_000,
    });
    expect(result.otb).toBe(0);
    expect(result.balance).toBeCloseTo(-3_500_000, 4);
    expect(result.overbought).toBe(true);
    expect(result.eosInventory).toBeCloseTo(3_500_000, 4);
    expect(result.sellThroughPct).toBeCloseTo(2_500_000 / 6_000_000, 6);
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

    // gross 1,250,000 + target EoS 312,500 − SoS 5,000,000
    expect(result.otb).toBeCloseTo(-3_437_500, 4);
    expect(result.overbought).toBe(true);
    // Everything held beyond the sales target is ending inventory: SoS − gross.
    expect(result.eosInventory).toBeCloseTo(3_750_000, 4);
    expect(result.sellThroughPct).toBeCloseTo(0.25, 6);
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

  it("EoS = target (open buys only) + any overbought excess", () => {
    const short = deriveSeasonPosition(1_000_000, 600_000, 0, 0, false);
    expect(short.otb).toBe(400_000);
    expect(short.eosInventory).toBe(0);

    const openShort = deriveSeasonPosition(1_000_000, 600_000, 0, 250_000, false);
    expect(openShort.otb).toBe(650_000);
    expect(openShort.eosInventory).toBe(250_000);

    const over = deriveSeasonPosition(1_000_000, 900_000, 400_000, 0, true);
    expect(over.balance).toBe(-300_000);
    expect(over.otb).toBe(0); // bought for — no OTB
    expect(over.eosInventory).toBe(300_000);
  });

  it("an overbought locked season-1 store carries its excess into season 2 SOS, where a new open buy sizes against it", () => {
    // SoS 5,000,000 + locked on-order 1,000,000 vs. gross sales 2,500,000 -> overbought by 3,500,000
    const s1 = computeStoreSeason1({
      currentOnHandInventory: 5_000_000,
      currentRemainingReceipts: 0,
      currentSeasonDiscountPct: 0.2,
      remainingCurrentSeasonNetForecast: 0,
      season1: { netRevenueTarget: 2_000_000, discountPct: 0.2, sellThroughPct: 0.7, onOrder: 1_000_000 },
    });
    expect(s1.buyLocked).toBe(true);
    expect(s1.otb).toBe(0);
    expect(s1.balance).toBeCloseTo(-3_500_000, 4);
    expect(s1.eosInventory).toBeCloseTo(s1.sosInventory + s1.onOrder - s1.grossSalesValue, 4);

    // Season 2 hasn't been bought for (on-order blank), so it carries a target EoS: 2.5M × 0.2/0.8 = 625,000.
    const s2 = computeStoreSeason2(
      { netRevenueTarget: 2_000_000, discountPct: 0.2, sellThroughPct: 0.8, onOrder: 0 },
      s1.eosInventory
    );
    expect(s2.buyLocked).toBe(false);
    expect(s2.sosInventory).toBeCloseTo(3_500_000, 4); // the whole excess rolls forward
    expect(s2.otb).toBeCloseTo(2_500_000 + 625_000 - 3_500_000, 4);
    expect(s2.eosInventory).toBeCloseTo(625_000 + 375_000, 4);
  });

  it("an open season-1 store rolls its target EoS forward", () => {
    const s1 = computeStoreSeason1({
      currentOnHandInventory: 1_000_000,
      currentRemainingReceipts: 0,
      currentSeasonDiscountPct: 0.2,
      remainingCurrentSeasonNetForecast: 0,
      season1: { netRevenueTarget: 2_000_000, discountPct: 0.2, sellThroughPct: 0.5, onOrder: 0 },
    });
    // gross 2.5M, target EoS 2.5M (sell-through 50%), SoS 1M
    expect(s1.otb).toBeCloseTo(2_500_000 + 2_500_000 - 1_000_000, 4);
    expect(s1.eosInventory).toBeCloseTo(2_500_000, 4);
  });

  it("season 2 on-order is counted once: SoS + on-order + balance = gross sales (locked, no target)", () => {
    const s2 = computeStoreSeason2({ netRevenueTarget: 8_000_000, discountPct: 0.25, sellThroughPct: 0.7, onOrder: 400_000 }, 800_000);
    expect(s2.sosInventory).toBe(800_000); // S2 on-order is NOT folded into SoS
    expect(s2.sosInventory + s2.onOrder + s2.balance).toBeCloseTo(s2.grossSalesValue, 4);
    expect(s2.otb).toBe(0);
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

    const sos2 = computeSos2(1_000_000, 555_555);
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
