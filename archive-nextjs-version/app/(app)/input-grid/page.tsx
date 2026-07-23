import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getVisibleStores,
  ensurePlanningInputs,
  parseMonthlyForecast,
  currentPlanningContext,
  getSeasonLockMap,
} from "@/lib/planning";
import { InputGridClient, type InputGridStore } from "@/components/input-grid/InputGridClient";

export default async function InputGridPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { current, planning1, planning2, horizon } = currentPlanningContext();
  const stores = await getVisibleStores(session);
  const planningInputs = await ensurePlanningInputs(stores, current.label, planning1.label, planning2.label);
  const lockMap = await getSeasonLockMap([planning1.label, planning2.label]);

  const inputByStoreId = new Map(planningInputs.map((p) => [p.storeId, p]));

  const gridStores: InputGridStore[] = stores.map((store) => {
    const row = inputByStoreId.get(store.id)!;
    const seasonLocked = lockMap[planning1.label] || lockMap[planning2.label];
    return {
      storeId: store.id,
      storeCode: store.storeCode,
      storeName: store.storeName,
      brand: store.brand,
      channel: store.channel,
      market: store.market,
      currency: store.currency,
      cycleLabel: current.label,
      locked: row.isLocked || seasonLocked,
      currentOnHandInventory: row.currentOnHandInventory,
      currentRemainingReceipts: row.currentRemainingReceipts,
      currentDiscountPct: row.currentDiscountPct,
      monthlyForecast: parseMonthlyForecast(row.monthlyForecastJson),
      s1SellThroughPct: row.s1SellThroughPct,
      s1DiscountPct: row.s1DiscountPct,
      s1OnOrder: row.s1OnOrder,
      s1ManualSosOverride: row.s1ManualSosOverride,
      s2SellThroughPct: row.s2SellThroughPct,
      s2DiscountPct: row.s2DiscountPct,
      s2OnOrder: row.s2OnOrder,
      s2ManualSosOverride: row.s2ManualSosOverride,
    };
  });

  return (
    <InputGridClient
      stores={gridStores}
      horizon={horizon}
      currentLabel={current.label}
      planning1Label={planning1.label}
      planning2Label={planning2.label}
      role={session.role}
    />
  );
}
