import { PrismaClient, Channel } from "@prisma/client";
import { buildMonthlyHorizon, getPlanningSeasons, type HorizonMonth } from "../lib/otb-engine";

const prisma = new PrismaClient();

// Deterministic seasonal multipliers so re-seeding produces the same data.
const MULTIPLIERS = [0.9, 1.0, 1.15, 1.05, 0.95, 1.0];

function monthlySeries(months: HorizonMonth[], base: number): Record<string, number> {
  const series: Record<string, number> = {};
  months.forEach((m, i) => {
    series[m.monthKey] = Math.round(base * MULTIPLIERS[i % MULTIPLIERS.length]);
  });
  return series;
}

function sumBucket(series: Record<string, number>, months: HorizonMonth[], bucket: HorizonMonth["bucket"]) {
  return months.filter((m) => m.bucket === bucket).reduce((sum, m) => sum + (series[m.monthKey] ?? 0), 0);
}

interface SeedStoreDef {
  storeCode: string;
  storeName: string;
  brand: string;
  channel: Channel;
  market: string;
  currency: string;
  baseMonthlyRevenue: number;
  currentOnHandInventory: number;
  currentRemainingReceipts: number;
  currentDiscountPct: number;
  s1SellThroughPct: number;
  s1DiscountPct: number;
  s1OnOrder: number;
  s2SellThroughPct: number;
  s2DiscountPct: number;
  s2OnOrder: number;
  overbought?: boolean;
}

const STORE_DEFS: SeedStoreDef[] = [
  {
    storeCode: "TW-RT-001",
    storeName: "Taipei 101 Flagship",
    brand: "On Running",
    channel: "Retail",
    market: "Taiwan",
    currency: "TWD",
    baseMonthlyRevenue: 6_000_000,
    currentOnHandInventory: 9_000_000,
    currentRemainingReceipts: 2_000_000,
    currentDiscountPct: 0.2,
    s1SellThroughPct: 0.78,
    s1DiscountPct: 0.2,
    s1OnOrder: 4_000_000,
    s2SellThroughPct: 0.75,
    s2DiscountPct: 0.22,
    s2OnOrder: 3_500_000,
  },
  {
    storeCode: "TW-EC-002",
    storeName: "On Running Online TW",
    brand: "On Running",
    channel: "EC",
    market: "Taiwan",
    currency: "TWD",
    baseMonthlyRevenue: 4_200_000,
    currentOnHandInventory: 5_500_000,
    currentRemainingReceipts: 1_200_000,
    currentDiscountPct: 0.25,
    s1SellThroughPct: 0.82,
    s1DiscountPct: 0.25,
    s1OnOrder: 2_800_000,
    s2SellThroughPct: 0.8,
    s2DiscountPct: 0.24,
    s2OnOrder: 2_600_000,
  },
  {
    storeCode: "TW-WS-003",
    storeName: "Taipei Golf Partner (PXG)",
    brand: "PXG",
    channel: "Wholesale",
    market: "Taiwan",
    currency: "TWD",
    baseMonthlyRevenue: 5_000_000,
    currentOnHandInventory: 7_000_000,
    currentRemainingReceipts: 1_500_000,
    currentDiscountPct: 0.15,
    s1SellThroughPct: 0.6,
    s1DiscountPct: 0.15,
    s1OnOrder: 3_000_000,
    s2SellThroughPct: 0.62,
    s2DiscountPct: 0.17,
    s2OnOrder: 2_900_000,
  },
  {
    storeCode: "VN-RT-004",
    storeName: "Ho Chi Minh City Store",
    brand: "K-Swiss",
    channel: "Retail",
    market: "Vietnam",
    currency: "VND",
    baseMonthlyRevenue: 5_500_000_000,
    currentOnHandInventory: 8_000_000_000,
    currentRemainingReceipts: 1_800_000_000,
    currentDiscountPct: 0.22,
    s1SellThroughPct: 0.65,
    s1DiscountPct: 0.22,
    s1OnOrder: 3_200_000_000,
    s2SellThroughPct: 0.68,
    s2DiscountPct: 0.2,
    s2OnOrder: 3_000_000_000,
  },
  {
    storeCode: "VN-EC-005",
    storeName: "Hanoi Online (PXG)",
    brand: "PXG",
    channel: "EC",
    market: "Vietnam",
    currency: "VND",
    baseMonthlyRevenue: 3_200_000_000,
    currentOnHandInventory: 4_000_000_000,
    currentRemainingReceipts: 900_000_000,
    currentDiscountPct: 0.3,
    s1SellThroughPct: 0.7,
    s1DiscountPct: 0.28,
    s1OnOrder: 1_800_000_000,
    s2SellThroughPct: 0.72,
    s2DiscountPct: 0.26,
    s2OnOrder: 1_700_000_000,
  },
  {
    storeCode: "VN-WS-006",
    storeName: "Da Nang Distributor (On Running)",
    brand: "On Running",
    channel: "Wholesale",
    market: "Vietnam",
    currency: "VND",
    baseMonthlyRevenue: 4_500_000_000,
    currentOnHandInventory: 6_500_000_000,
    currentRemainingReceipts: 1_400_000_000,
    currentDiscountPct: 0.18,
    s1SellThroughPct: 0.58,
    s1DiscountPct: 0.18,
    s1OnOrder: 2_600_000_000,
    s2SellThroughPct: 0.6,
    s2DiscountPct: 0.19,
    s2OnOrder: 2_500_000_000,
  },
  {
    storeCode: "SG-RT-007",
    storeName: "Orchard Road (K-Swiss)",
    brand: "K-Swiss",
    channel: "Retail",
    market: "Singapore",
    currency: "SGD",
    baseMonthlyRevenue: 320_000,
    currentOnHandInventory: 480_000,
    currentRemainingReceipts: 90_000,
    currentDiscountPct: 0.2,
    s1SellThroughPct: 0.8,
    s1DiscountPct: 0.2,
    s1OnOrder: 200_000,
    s2SellThroughPct: 0.78,
    s2DiscountPct: 0.21,
    s2OnOrder: 190_000,
  },
  {
    storeCode: "SG-EC-008",
    storeName: "On Running Singapore Online",
    brand: "On Running",
    channel: "EC",
    market: "Singapore",
    currency: "SGD",
    baseMonthlyRevenue: 260_000,
    currentOnHandInventory: 340_000,
    currentRemainingReceipts: 70_000,
    currentDiscountPct: 0.27,
    s1SellThroughPct: 0.85,
    s1DiscountPct: 0.26,
    s1OnOrder: 150_000,
    s2SellThroughPct: 0.83,
    s2DiscountPct: 0.25,
    s2OnOrder: 145_000,
  },
  {
    storeCode: "SG-WS-009",
    storeName: "Marina Bay Partner (PXG)",
    brand: "PXG",
    channel: "Wholesale",
    market: "Singapore",
    currency: "SGD",
    baseMonthlyRevenue: 210_000,
    currentOnHandInventory: 300_000,
    currentRemainingReceipts: 60_000,
    currentDiscountPct: 0.16,
    s1SellThroughPct: 0.63,
    s1DiscountPct: 0.16,
    s1OnOrder: 130_000,
    s2SellThroughPct: 0.65,
    s2DiscountPct: 0.18,
    s2OnOrder: 125_000,
  },
  {
    // Deliberately overbought: on-hand inventory and on-order are far
    // larger than the demand implied by the forecast/sell-through, so
    // planning season 1 OTB comes out negative on first run.
    storeCode: "TW-RT-010",
    storeName: "Kaohsiung Store (K-Swiss)",
    brand: "K-Swiss",
    channel: "Retail",
    market: "Taiwan",
    currency: "TWD",
    baseMonthlyRevenue: 1_800_000,
    currentOnHandInventory: 40_000_000,
    currentRemainingReceipts: 8_000_000,
    currentDiscountPct: 0.2,
    s1SellThroughPct: 0.55,
    s1DiscountPct: 0.2,
    s1OnOrder: 6_000_000,
    s2SellThroughPct: 0.58,
    s2DiscountPct: 0.2,
    s2OnOrder: 1_000_000,
    overbought: true,
  },
];

async function main() {
  console.log("Seeding OTB Planner database...");

  const admin = await prisma.user.upsert({
    where: { name: "admin" },
    update: {},
    create: { name: "admin", role: "admin" },
  });

  const planner1 = await prisma.user.upsert({
    where: { name: "planner1" },
    update: {},
    create: { name: "planner1", role: "planner" },
  });

  console.log(`Users ready: ${admin.name} (admin), ${planner1.name} (planner)`);

  const fxRates: { currency: string; rateToUsd: number }[] = [
    { currency: "TWD", rateToUsd: 0.031 },
    { currency: "VND", rateToUsd: 0.00004 },
    { currency: "SGD", rateToUsd: 0.74 },
  ];
  const asOfDate = new Date();
  for (const rate of fxRates) {
    await prisma.fxRate.upsert({
      where: { currency: rate.currency },
      update: { rateToUsd: rate.rateToUsd, asOfDate },
      create: { currency: rate.currency, rateToUsd: rate.rateToUsd, asOfDate },
    });
  }
  console.log(`FX rates ready: ${fxRates.map((r) => r.currency).join(", ")} -> USD`);

  const today = new Date();
  const { current, planning1, planning2 } = getPlanningSeasons(today);
  const horizon = buildMonthlyHorizon(today);
  console.log(
    `Current: ${current.label} -> Planning: ${planning1.label}, ${planning2.label} (${horizon.length} horizon months)`
  );

  for (const def of STORE_DEFS) {
    const store = await prisma.store.upsert({
      where: { storeCode: def.storeCode },
      update: {
        storeName: def.storeName,
        brand: def.brand,
        channel: def.channel,
        market: def.market,
        currency: def.currency,
        ownerId: planner1.id,
        active: true,
      },
      create: {
        storeCode: def.storeCode,
        storeName: def.storeName,
        brand: def.brand,
        channel: def.channel,
        market: def.market,
        currency: def.currency,
        ownerId: planner1.id,
        active: true,
      },
    });

    const series = monthlySeries(horizon, def.baseMonthlyRevenue);

    await prisma.planningInput.upsert({
      where: { storeId_cycleLabel: { storeId: store.id, cycleLabel: current.label } },
      update: {
        userId: planner1.id,
        planningSeason1: planning1.label,
        planningSeason2: planning2.label,
        currentOnHandInventory: def.currentOnHandInventory,
        currentRemainingReceipts: def.currentRemainingReceipts,
        currentDiscountPct: def.currentDiscountPct,
        monthlyForecastJson: JSON.stringify(series),
        s1SellThroughPct: def.s1SellThroughPct,
        s1DiscountPct: def.s1DiscountPct,
        s1OnOrder: def.s1OnOrder,
        s2SellThroughPct: def.s2SellThroughPct,
        s2DiscountPct: def.s2DiscountPct,
        s2OnOrder: def.s2OnOrder,
      },
      create: {
        storeId: store.id,
        userId: planner1.id,
        cycleLabel: current.label,
        planningSeason1: planning1.label,
        planningSeason2: planning2.label,
        currentOnHandInventory: def.currentOnHandInventory,
        currentRemainingReceipts: def.currentRemainingReceipts,
        currentDiscountPct: def.currentDiscountPct,
        monthlyForecastJson: JSON.stringify(series),
        s1SellThroughPct: def.s1SellThroughPct,
        s1DiscountPct: def.s1DiscountPct,
        s1OnOrder: def.s1OnOrder,
        s2SellThroughPct: def.s2SellThroughPct,
        s2DiscountPct: def.s2DiscountPct,
        s2OnOrder: def.s2OnOrder,
      },
    });

    const s1Target = sumBucket(series, horizon, "planning1");
    const s2Target = sumBucket(series, horizon, "planning2");
    console.log(
      `  ${def.storeCode} ${def.storeName}: S1 target ${s1Target.toLocaleString()}, S2 target ${s2Target.toLocaleString()} ${def.currency}${def.overbought ? " [overbought]" : ""}`
    );
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
