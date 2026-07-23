import { useMemo, useState } from "react";
import { buildMonthlyHorizon, getPlanningSeasons } from "@/lib/otb-engine";
import type { FxRateMap } from "@/lib/otb-engine";
import { computeStoreResult, sumHorizonBucket } from "@/lib/storePlan";
import { computeOnHandAllocation, computeGroupShares } from "@/lib/brandInventory";
import { applyOutletTransfers } from "@/lib/outletTransfer";
import type { OtbSeasonRow, CurrentSeasonRow } from "@/lib/results";
import { buildSampleStores, SAMPLE_FX_RATES, SAMPLE_BRAND_INVENTORY } from "@/data/sampleStores";
import { MARKET_CURRENCY } from "@/data/markets";
import { emptyStore, type CalcStore } from "@/types";
import { StoreListEditor } from "@/components/StoreListEditor";
import { BrandInventoryEditor } from "@/components/BrandInventoryEditor";
import { ForecastGrid } from "@/components/ForecastGrid";
import { AssumptionsTable } from "@/components/AssumptionsTable";
import { FxRatesEditor } from "@/components/FxRatesEditor";
import { SeasonSummaryCards } from "@/components/SeasonSummaryCards";
import { CurrentSeasonTable } from "@/components/CurrentSeasonTable";
import { OtbByBrandTable } from "@/components/OtbByBrandTable";
import { ByStoreTable } from "@/components/ByStoreTable";
import { AggregateTables } from "@/components/AggregateTables";
import { buildOtbWorkbook, downloadWorkbook, buildCsv, downloadCsv } from "@/lib/export";

type Tab = "stores" | "inventory" | "forecast" | "assumptions" | "fx" | "results";

const TABS: { key: Tab; label: string }[] = [
  { key: "stores", label: "Stores" },
  { key: "inventory", label: "Brand Inventory" },
  { key: "forecast", label: "Monthly Forecast" },
  { key: "assumptions", label: "Store Assumptions" },
  { key: "fx", label: "FX Rates" },
  { key: "results", label: "OTB Results" },
];

export default function App() {
  const [stores, setStores] = useState<CalcStore[]>([]);
  const [brandInventory, setBrandInventory] = useState<Record<string, number>>({});
  const [fxRates, setFxRates] = useState<FxRateMap>({});
  const [tab, setTab] = useState<Tab>("stores");
  const [resultsSeasonTab, setResultsSeasonTab] = useState<"s1" | "s2">("s1");

  const { current, planning1, planning2 } = useMemo(() => getPlanningSeasons(new Date()), []);
  const horizon = useMemo(() => buildMonthlyHorizon(new Date()), []);

  function loadSampleData() {
    setStores(buildSampleStores());
    setBrandInventory(SAMPLE_BRAND_INVENTORY);
    setFxRates(SAMPLE_FX_RATES);
  }

  function clearAll() {
    setStores([]);
    setBrandInventory({});
    setFxRates({});
  }

  function handleForecastChange(storeId: string, monthKey: string, value: number) {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, monthlyForecast: { ...s.monthlyForecast, [monthKey]: value } } : s))
    );
  }

  function handleFieldChange(storeId: string, field: string, value: number | string | null) {
    setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, [field]: value } : s)));
  }

  function handleAddStore() {
    setStores((prev) => [...prev, emptyStore()]);
  }

  function handleRemoveStore(storeId: string) {
    setStores((prev) => prev.filter((s) => s.id !== storeId));
  }

  function handleMarketChange(storeId: string, market: string) {
    setStores((prev) =>
      prev.map((s) => (s.id === storeId ? { ...s, market, currency: MARKET_CURRENCY[market] ?? s.currency } : s))
    );
  }

  function handleBrandInventoryChange(key: string, value: number) {
    setBrandInventory((prev) => ({ ...prev, [key]: value }));
  }

  function handleFxChange(currency: string, rateToUsd: number | null) {
    setFxRates((prev) => {
      const next = { ...prev };
      if (rateToUsd === null) delete next[currency];
      else next[currency] = rateToUsd;
      return next;
    });
  }

  const onHandAllocation = useMemo(() => computeOnHandAllocation(stores, brandInventory, horizon), [stores, brandInventory, horizon]);

  const { season1Rows, season2Rows, currentSeasonRows } = useMemo(() => {
    const rawSeason1: OtbSeasonRow[] = [];
    const rawSeason2: OtbSeasonRow[] = [];
    const currentSeasonRows: CurrentSeasonRow[] = [];

    for (const store of stores) {
      const currentOnHandInventory = onHandAllocation[store.id] ?? 0;
      const plan = computeStoreResult(store, horizon, currentOnHandInventory);
      const base = {
        storeId: store.id,
        storeName: store.storeName,
        brand: store.brand,
        channel: store.channel,
        market: store.market,
        currency: store.currency,
        isOutlet: store.storeType === "Outlet",
      };

      rawSeason1.push({ ...base, ...plan.season1, otbUsd: null, transferAdjustment: 0 });
      rawSeason2.push({ ...base, ...plan.season2, otbUsd: null, transferAdjustment: 0 });

      currentSeasonRows.push({
        ...base,
        currentSeasonInventory: currentOnHandInventory,
        currentIncomingGoods: store.currentRemainingReceipts,
        currentRemainingTarget: sumHorizonBucket(store.monthlyForecast, horizon, "current"),
        currentDiscountRate: store.currentDiscountPct,
        projectedEosInventory: plan.season1.sosInventory,
        floored: plan.season1.sosFloored,
        overridden: plan.season1.sosOverridden,
      });
    }

    // Outlet stores still have a sell-through target but can't place new
    // buys, so any positive OTB they'd otherwise show is real, unmet
    // demand. It gets covered by transfer from full-price stores in the
    // same brand+market group — see lib/outletTransfer.ts.
    const shares = computeGroupShares(stores, horizon);
    const adjustedSeason1 = applyOutletTransfers(rawSeason1, shares);
    const adjustedSeason2 = applyOutletTransfers(rawSeason2, shares);

    function withUsd(rows: OtbSeasonRow[]): OtbSeasonRow[] {
      return rows.map((r) => {
        const rate = r.currency === "USD" ? 1 : fxRates[r.currency];
        return { ...r, otbUsd: rate !== undefined ? r.otb * rate : null };
      });
    }

    return { season1Rows: withUsd(adjustedSeason1), season2Rows: withUsd(adjustedSeason2), currentSeasonRows };
  }, [stores, horizon, fxRates, onHandAllocation]);

  const activeRows = resultsSeasonTab === "s1" ? season1Rows : season2Rows;
  const activeLabel = resultsSeasonTab === "s1" ? planning1.label : planning2.label;

  function handleExportExcel() {
    const wb = buildOtbWorkbook({
      season1Rows,
      season2Rows,
      planning1Label: planning1.label,
      planning2Label: planning2.label,
      fxRates,
      fxAsOf: {},
    });
    downloadWorkbook(wb, `otb-calculator_${current.label}_${planning1.label}-${planning2.label}.xlsx`);
  }

  function handleExportCsv() {
    downloadCsv(buildCsv(activeRows), `otb-calculator_${activeLabel}.csv`);
  }

  const usedCurrencies = useMemo(() => Array.from(new Set(stores.map((s) => s.currency))).filter(Boolean), [stores]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-slate-900">OTB Calculator</span>
            <nav className="flex items-center gap-1">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                    tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex gap-2">
            <button
              onClick={loadSampleData}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Load Sample Data
            </button>
            <button
              onClick={clearAll}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Clear All
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600">
          Current: {current.label} (finalized) → Planning: {planning1.label}, {planning2.label} · Nothing is saved —
          refreshing the page resets everything.
        </div>
      </header>

      <main className="px-4 py-6">
        {stores.length === 0 && tab !== "stores" && (
          <div className="mb-4 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
            No stores yet.{" "}
            <button onClick={() => setTab("stores")} className="font-medium text-slate-700 underline">
              Add one
            </button>{" "}
            or{" "}
            <button onClick={loadSampleData} className="font-medium text-slate-700 underline">
              load sample data
            </button>
            .
          </div>
        )}

        {tab === "stores" && (
          <StoreListEditor
            stores={stores}
            onFieldChange={handleFieldChange}
            onMarketChange={handleMarketChange}
            onAddStore={handleAddStore}
            onRemoveStore={handleRemoveStore}
          />
        )}

        {tab === "inventory" && (
          <BrandInventoryEditor stores={stores} brandInventory={brandInventory} onChange={handleBrandInventoryChange} />
        )}

        {tab === "forecast" && <ForecastGrid stores={stores} horizon={horizon} onCellChange={handleForecastChange} />}

        {tab === "assumptions" && (
          <AssumptionsTable stores={stores} onHandAllocation={onHandAllocation} onFieldChange={handleFieldChange} />
        )}

        {tab === "fx" && <FxRatesEditor fxRates={fxRates} onChange={handleFxChange} usedCurrencies={usedCurrencies} />}

        {tab === "results" && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 rounded-md bg-slate-100 p-1">
                <button
                  onClick={() => setResultsSeasonTab("s1")}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${resultsSeasonTab === "s1" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
                >
                  {planning1.label}
                </button>
                <button
                  onClick={() => setResultsSeasonTab("s2")}
                  className={`rounded px-3 py-1.5 text-sm font-medium ${resultsSeasonTab === "s2" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
                >
                  {planning2.label}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCsv}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Export CSV ({activeLabel})
                </button>
                <button
                  onClick={handleExportExcel}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Export Excel (both seasons)
                </button>
              </div>
            </div>

            {stores.length > 0 && (
              <>
                <SeasonSummaryCards rows={activeRows} seasonLabel={activeLabel} fxRates={fxRates} />
                <CurrentSeasonTable rows={currentSeasonRows} currentLabel={current.label} />
                <OtbByBrandTable
                  season1Rows={season1Rows}
                  season2Rows={season2Rows}
                  planning1Label={planning1.label}
                  planning2Label={planning2.label}
                  fxRates={fxRates}
                />
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">By-Store Detail — {activeLabel}</h3>
                  <p className="mb-2 text-xs text-slate-500">
                    Outlet stores (blue badge) don't buy new-season product — if they need stock, it's transferred from
                    full-price stores in the same brand+market group (teal "transfer" badge on SoS Inv), so the outlet's
                    own OTB nets to 0 and the totals above already reflect who's actually doing the buying.
                  </p>
                  <ByStoreTable rows={activeRows} />
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700">Aggregates — {activeLabel}</h3>
                  <AggregateTables rows={activeRows} fxRates={fxRates} />
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
