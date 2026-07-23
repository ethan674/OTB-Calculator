import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import type { PlanningInput, Store } from "@prisma/client";
import {
  buildMonthlyHorizon,
  getPlanningSeasons,
  type HorizonMonth,
  type StorePlanInputs,
} from "@/lib/otb-engine";

/** Stores visible to the current user: admins see all active stores, planners see only their own. */
export async function getVisibleStores(session: SessionPayload): Promise<Store[]> {
  if (session.role === "admin") {
    return prisma.store.findMany({ where: { active: true }, orderBy: { storeName: "asc" } });
  }
  return prisma.store.findMany({
    where: { active: true, ownerId: session.userId },
    orderBy: { storeName: "asc" },
  });
}

/**
 * Ensures a Draft PlanningInput row exists for every given store for the
 * current planning cycle, creating zeroed defaults where missing (e.g. the
 * first time a new season cycle rolls around).
 */
export async function ensurePlanningInputs(
  stores: Store[],
  cycleLabel: string,
  planning1Label: string,
  planning2Label: string
): Promise<PlanningInput[]> {
  const existing = await prisma.planningInput.findMany({
    where: { storeId: { in: stores.map((s) => s.id) }, cycleLabel },
  });
  const existingByStore = new Map(existing.map((p) => [p.storeId, p]));

  const missing = stores.filter((s) => !existingByStore.has(s.id));
  if (missing.length > 0) {
    await prisma.$transaction(
      missing.map((s) =>
        prisma.planningInput.create({
          data: {
            storeId: s.id,
            userId: s.ownerId ?? stores[0].ownerId ?? "",
            cycleLabel,
            planningSeason1: planning1Label,
            planningSeason2: planning2Label,
            monthlyForecastJson: "{}",
          },
        })
      )
    );
    const refreshed = await prisma.planningInput.findMany({
      where: { storeId: { in: stores.map((s) => s.id) }, cycleLabel },
    });
    return refreshed;
  }

  return existing;
}

export function parseMonthlyForecast(json: string): Record<string, number> {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) return parsed as Record<string, number>;
    return {};
  } catch {
    return {};
  }
}

export function sumHorizonBucket(
  forecast: Record<string, number>,
  horizon: HorizonMonth[],
  bucket: HorizonMonth["bucket"]
): number {
  return horizon
    .filter((m) => m.bucket === bucket)
    .reduce((sum, m) => sum + (forecast[m.monthKey] ?? 0), 0);
}

/** Converts a raw PlanningInput row into the engine's StorePlanInputs shape. */
export function toStorePlanInputs(row: PlanningInput, horizon: HorizonMonth[]): StorePlanInputs {
  const forecast = parseMonthlyForecast(row.monthlyForecastJson);
  return {
    currentOnHandInventory: row.currentOnHandInventory,
    currentRemainingReceipts: row.currentRemainingReceipts,
    currentSeasonDiscountPct: row.currentDiscountPct,
    remainingCurrentSeasonNetForecast: sumHorizonBucket(forecast, horizon, "current"),
    season1: {
      netRevenueTarget: sumHorizonBucket(forecast, horizon, "planning1"),
      discountPct: row.s1DiscountPct,
      sellThroughPct: row.s1SellThroughPct,
      onOrder: row.s1OnOrder,
      manualSosOverride: row.s1ManualSosOverride,
    },
    season2: {
      netRevenueTarget: sumHorizonBucket(forecast, horizon, "planning2"),
      discountPct: row.s2DiscountPct,
      sellThroughPct: row.s2SellThroughPct,
      onOrder: row.s2OnOrder,
      manualSosOverride: row.s2ManualSosOverride,
    },
  };
}

export async function getSeasonLockMap(labels: string[]): Promise<Record<string, boolean>> {
  const locks = await prisma.seasonLock.findMany({ where: { seasonLabel: { in: labels } } });
  const map: Record<string, boolean> = {};
  for (const label of labels) map[label] = false;
  for (const lock of locks) map[lock.seasonLabel] = lock.locked;
  return map;
}

export function currentPlanningContext(today: Date = new Date()) {
  const { current, planning1, planning2 } = getPlanningSeasons(today);
  const horizon = buildMonthlyHorizon(today);
  return { current, planning1, planning2, horizon };
}
