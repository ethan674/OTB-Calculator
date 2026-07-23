import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getVisibleStores,
  ensurePlanningInputs,
  currentPlanningContext,
  toStorePlanInputs,
} from "@/lib/planning";
import { computeStorePlan } from "@/lib/otb-engine";
import type { OtbSeasonRow } from "@/lib/results";
import { OtbResultsClient } from "@/components/otb-results/OtbResultsClient";

export default async function OtbResultsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { current, planning1, planning2, horizon } = currentPlanningContext();
  const stores = await getVisibleStores(session);
  const planningInputs = await ensurePlanningInputs(stores, current.label, planning1.label, planning2.label);
  const inputByStoreId = new Map(planningInputs.map((p) => [p.storeId, p]));

  const fxRateRows = await prisma.fxRate.findMany();
  const fxRates: Record<string, number> = {};
  const fxAsOf: Record<string, string> = {};
  for (const r of fxRateRows) {
    fxRates[r.currency] = r.rateToUsd;
    fxAsOf[r.currency] = r.asOfDate.toISOString();
  }

  const season1Rows: OtbSeasonRow[] = [];
  const season2Rows: OtbSeasonRow[] = [];

  for (const store of stores) {
    const row = inputByStoreId.get(store.id);
    if (!row) continue;
    const plan = computeStorePlan(toStorePlanInputs(row, horizon));
    const base = {
      storeId: store.id,
      storeCode: store.storeCode,
      storeName: store.storeName,
      brand: store.brand,
      channel: store.channel,
      market: store.market,
      currency: store.currency,
    };
    const rate = fxRates[store.currency];

    season1Rows.push({
      ...base,
      ...plan.season1,
      otbUsd: rate !== undefined ? plan.season1.otb * rate : null,
    });
    season2Rows.push({
      ...base,
      ...plan.season2,
      otbUsd: rate !== undefined ? plan.season2.otb * rate : null,
    });
  }

  return (
    <OtbResultsClient
      season1Rows={season1Rows}
      season2Rows={season2Rows}
      planning1Label={planning1.label}
      planning2Label={planning2.label}
      currentLabel={current.label}
      fxRates={fxRates}
      fxAsOf={fxAsOf}
    />
  );
}
