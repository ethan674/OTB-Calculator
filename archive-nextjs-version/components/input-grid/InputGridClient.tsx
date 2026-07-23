"use client";

import { useState } from "react";
import type { HorizonMonth } from "@/lib/otb-engine";
import type { Role } from "@prisma/client";
import { ForecastGrid } from "./ForecastGrid";
import { AssumptionsTable } from "./AssumptionsTable";
import { useAutosave } from "./useAutosave";

export interface InputGridStore {
  storeId: string;
  storeCode: string;
  storeName: string;
  brand: string;
  channel: string;
  market: string;
  currency: string;
  cycleLabel: string;
  locked: boolean;
  currentOnHandInventory: number;
  currentRemainingReceipts: number;
  currentDiscountPct: number;
  monthlyForecast: Record<string, number>;
  s1SellThroughPct: number;
  s1DiscountPct: number;
  s1OnOrder: number;
  s1ManualSosOverride: number | null;
  s2SellThroughPct: number;
  s2DiscountPct: number;
  s2OnOrder: number;
  s2ManualSosOverride: number | null;
}

interface InputGridClientProps {
  stores: InputGridStore[];
  horizon: HorizonMonth[];
  currentLabel: string;
  planning1Label: string;
  planning2Label: string;
  role: Role;
}

type Tab = "forecast" | "assumptions";

export function InputGridClient({
  stores: initialStores,
  horizon,
  currentLabel,
  planning1Label,
  planning2Label,
  role,
}: InputGridClientProps) {
  const [stores, setStores] = useState(initialStores);
  const [tab, setTab] = useState<Tab>("forecast");
  const { queueChange, status, errors } = useAutosave(currentLabel);

  function handleForecastChange(storeId: string, monthKey: string, value: number) {
    setStores((prev) =>
      prev.map((s) => (s.storeId === storeId ? { ...s, monthlyForecast: { ...s.monthlyForecast, [monthKey]: value } } : s))
    );
    queueChange(storeId, { monthlyForecastPatch: { [monthKey]: value } });
  }

  function handleFieldChange(storeId: string, field: string, value: number | null) {
    setStores((prev) => prev.map((s) => (s.storeId === storeId ? { ...s, [field]: value } : s)));
    queueChange(storeId, { [field]: value });
  }

  if (stores.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No stores are assigned to you yet. Ask an admin to assign stores in Admin → Stores.
      </div>
    );
  }

  const anyError = Object.values(errors).find((e) => e);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          <button
            onClick={() => setTab("forecast")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${tab === "forecast" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
          >
            Monthly Forecast
          </button>
          <button
            onClick={() => setTab("assumptions")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${tab === "assumptions" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
          >
            Store Assumptions
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Draft autosaves as you type. Paste tab-separated data from Excel directly into the forecast grid.
        </p>
      </div>

      {anyError && <p className="text-sm text-red-600">{anyError}</p>}

      {tab === "forecast" ? (
        <ForecastGrid stores={stores} horizon={horizon} onCellChange={handleForecastChange} status={status} />
      ) : (
        <AssumptionsTable stores={stores} isAdmin={role === "admin"} onFieldChange={handleFieldChange} status={status} />
      )}

      <p className="text-xs text-slate-400">
        Cycle {currentLabel} · Planning {planning1Label} &amp; {planning2Label}
      </p>
    </div>
  );
}
