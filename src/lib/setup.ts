import { getBrandMarketGroups } from "@/lib/brandInventory";
import { validateDiscountPct, validateSellThroughPct, type FxRateMap, type HorizonMonth } from "@/lib/otb-engine";
import type { CalcStore } from "@/types";

export type SetupTab = "stores" | "inventory" | "forecast" | "assumptions" | "fx";
export type StepState = "done" | "warn" | "todo";

export interface SetupStep {
  tab: SetupTab;
  label: string;
  state: StepState;
  detail: string;
}

/** Where each input tab stands: drives the first-run checklist and the badges on the tab labels. */
export function computeSetupStatus(
  stores: CalcStore[],
  brandInventory: Record<string, number>,
  fxRates: FxRateMap,
  horizon: HorizonMonth[]
): SetupStep[] {
  const n = stores.length;

  const incomplete = stores.filter((s) => !s.storeName.trim() || !s.brand.trim()).length;
  const storesStep: SetupStep =
    n === 0
      ? { tab: "stores", label: "Stores", state: "todo", detail: "Add your stores" }
      : incomplete > 0
        ? { tab: "stores", label: "Stores", state: "warn", detail: `${incomplete} store${incomplete > 1 ? "s" : ""} missing a name or brand` }
        : { tab: "stores", label: "Stores", state: "done", detail: `${n} store${n > 1 ? "s" : ""}` };

  const groups = getBrandMarketGroups(stores);
  const entered = groups.filter((g) => brandInventory[g.key] !== undefined).length;
  const inventoryStep: SetupStep =
    groups.length === 0
      ? { tab: "inventory", label: "Brand Inventory", state: "todo", detail: "Needs stores first" }
      : entered === groups.length
        ? { tab: "inventory", label: "Brand Inventory", state: "done", detail: `${entered} of ${groups.length} pools entered` }
        : { tab: "inventory", label: "Brand Inventory", state: entered === 0 ? "todo" : "warn", detail: `${entered} of ${groups.length} brand+market pools entered` };

  const planningKeys = horizon.filter((m) => m.bucket !== "current").map((m) => m.monthKey);
  const withForecast = stores.filter((s) => planningKeys.some((k) => (s.monthlyForecast[k] ?? 0) > 0)).length;
  const forecastStep: SetupStep =
    n === 0
      ? { tab: "forecast", label: "Monthly Forecast", state: "todo", detail: "Needs stores first" }
      : withForecast === n
        ? { tab: "forecast", label: "Monthly Forecast", state: "done", detail: `${withForecast} of ${n} stores forecast` }
        : { tab: "forecast", label: "Monthly Forecast", state: withForecast === 0 ? "todo" : "warn", detail: `${withForecast} of ${n} stores have a planning-season forecast` };

  const badAssumptions = stores.filter((s) => {
    const pcts = [s.s1DiscountPct, s.s2DiscountPct, s.currentDiscountPct].map((p) => validateDiscountPct(p * 100));
    const sts = [
      s.s1OnOrder > 0 ? null : validateSellThroughPct(s.s1SellThroughPct * 100),
      s.s2OnOrder > 0 ? null : validateSellThroughPct(s.s2SellThroughPct * 100),
    ];
    const negative = [s.s1OnOrder, s.s2OnOrder, s.currentRemainingReceipts].some((v) => v < 0);
    return negative || [...pcts, ...sts].some((v) => v && v.errors.length > 0);
  }).length;
  const assumptionsStep: SetupStep =
    n === 0
      ? { tab: "assumptions", label: "Store Assumptions", state: "todo", detail: "Needs stores first" }
      : badAssumptions > 0
        ? { tab: "assumptions", label: "Store Assumptions", state: "warn", detail: `${badAssumptions} store${badAssumptions > 1 ? "s" : ""} with an invalid value` }
        : { tab: "assumptions", label: "Store Assumptions", state: "done", detail: "Sell-through, discounts and incoming goods look valid" };

  const currencies = Array.from(new Set(stores.map((s) => s.currency))).filter(Boolean);
  const missing = currencies.filter((c) => c !== "USD" && fxRates[c] === undefined);
  const fxStep: SetupStep =
    currencies.length <= 1
      ? { tab: "fx", label: "FX Rates", state: "done", detail: "Not needed — a single currency" }
      : missing.length > 0
        ? { tab: "fx", label: "FX Rates", state: "warn", detail: `Missing rate for ${missing.join(", ")}` }
        : { tab: "fx", label: "FX Rates", state: "done", detail: "All currencies have a rate" };

  return [storesStep, inventoryStep, forecastStep, assumptionsStep, fxStep];
}
