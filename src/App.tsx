import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { buildMonthlyHorizon, getPlanningSeasons } from "@/lib/otb-engine";
import type { FxRateMap } from "@/lib/otb-engine";
import { computePlan } from "@/lib/plan";
import { buildSampleStores, SAMPLE_FX_RATES, SAMPLE_BRAND_INVENTORY } from "@/data/sampleStores";
import { MARKET_CURRENCY } from "@/data/markets";
import { emptyStore, type CalcStore } from "@/types";
import { StoreListEditor } from "@/components/StoreListEditor";
import { BrandInventoryEditor } from "@/components/BrandInventoryEditor";
import { ForecastGrid } from "@/components/ForecastGrid";
import { AssumptionsTable } from "@/components/AssumptionsTable";
import { FxRatesEditor } from "@/components/FxRatesEditor";
import { SeasonSummaryCards } from "@/components/SeasonSummaryCards";
import { BadgeLegend } from "@/components/BadgeLegend";
import { SensitivityPanel } from "@/components/SensitivityPanel";
import { CurrentSeasonTable } from "@/components/CurrentSeasonTable";
import { ByStoreTable } from "@/components/ByStoreTable";
import { AggregateTables } from "@/components/AggregateTables";
import { Collapsible } from "@/components/Collapsible";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { NeedsAttention } from "@/components/NeedsAttention";
import { SetupChecklist } from "@/components/SetupChecklist";
import { StoreCalcPanel } from "@/components/StoreCalcPanel";
import { TabHelp } from "@/components/TabHelp";
import { computeAttention } from "@/lib/attention";
import { clearSession, loadSession, saveSession, type Session } from "@/lib/persist";
import { computeSetupStatus } from "@/lib/setup";
import { buildOtbWorkbook, downloadWorkbook, buildCsv, downloadCsv, readWorkbookFile, parseImportedWorkbook, type ImportedWorkbookData } from "@/lib/export";

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
  const [brandOutlook, setBrandOutlook] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<Tab>("stores");
  const [resultsSeasonTab, setResultsSeasonTab] = useState<"s1" | "s2">("s1");
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // A previous session found in this browser: offered for restore, and autosave stays off until the user chooses.
  const [pendingRestore, setPendingRestore] = useState<Session | null>(() => loadSession());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirtySinceExport, setDirtySinceExport] = useState(false);
  const skipDirty = useRef(true);
  const [confirm, setConfirm] = useState<null | { kind: "clear" } | { kind: "sample" } | { kind: "import"; data: ImportedWorkbookData; fileName: string }>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [openStoreId, setOpenStoreId] = useState<string | null>(null);

  const { current, planning1, planning2 } = useMemo(() => getPlanningSeasons(new Date()), []);
  const horizon = useMemo(() => buildMonthlyHorizon(new Date()), []);

  function applyData(data: { stores: CalcStore[]; brandInventory: Record<string, number>; fxRates: FxRateMap; brandOutlook: Record<string, number> }) {
    skipDirty.current = true; // freshly loaded data isn't an unexported edit
    setStores(data.stores);
    setBrandInventory(data.brandInventory);
    setFxRates(data.fxRates);
    setBrandOutlook(data.brandOutlook);
    setOpenStoreId(null);
  }

  function loadSampleData() {
    applyData({ stores: buildSampleStores(), brandInventory: SAMPLE_BRAND_INVENTORY, fxRates: SAMPLE_FX_RATES, brandOutlook: {} });
  }

  function clearAll() {
    applyData({ stores: [], brandInventory: {}, fxRates: {}, brandOutlook: {} });
    clearSession();
    setSavedAt(null);
  }

  function requestLoadSample() {
    setMoreOpen(false);
    if (stores.length > 0) setConfirm({ kind: "sample" });
    else loadSampleData();
  }

  function requestClear() {
    setMoreOpen(false);
    if (stores.length > 0) setConfirm({ kind: "clear" });
    else clearAll();
  }

  function restoreSession() {
    if (!pendingRestore) return;
    applyData(pendingRestore);
    setSavedAt(pendingRestore.savedAt);
    setPendingRestore(null);
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

  function handleBrandOutlookChange(key: string, value: number | null) {
    setBrandOutlook((prev) => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  function handleForwardChange(storeId: string, value: number | null) {
    setStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, forwardMonthlySales: value } : s)));
  }

  function handleFxChange(currency: string, rateToUsd: number | null) {
    setFxRates((prev) => {
      const next = { ...prev };
      if (rateToUsd === null) delete next[currency];
      else next[currency] = rateToUsd;
      return next;
    });
  }

  const { onHandAllocation, season1Rows, season2Rows, currentSeasonRows } = useMemo(
    () => computePlan(stores, brandInventory, horizon, fxRates, brandOutlook),
    [stores, brandInventory, horizon, fxRates, brandOutlook]
  );

  const activeRows = resultsSeasonTab === "s1" ? season1Rows : season2Rows;
  const activeLabel = resultsSeasonTab === "s1" ? planning1.label : planning2.label;

  function handleExportExcel() {
    const wb = buildOtbWorkbook({
      stores,
      brandInventory,
      brandOutlook,
      horizon,
      season1Rows,
      season2Rows,
      planning1Label: planning1.label,
      planning2Label: planning2.label,
      fxRates,
      fxAsOf: {},
    });
    downloadWorkbook(wb, `otb-calculator_${current.label}_${planning1.label}-${planning2.label}.xlsx`);
    setDirtySinceExport(false);
  }

  function handleExportCsv() {
    downloadCsv(buildCsv(activeRows), `otb-calculator_${activeLabel}.csv`);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const wb = await readWorkbookFile(file);
      const imported = parseImportedWorkbook(wb);
      setImportError(null);
      if (stores.length > 0) setConfirm({ kind: "import", data: imported, fileName: file.name });
      else applyData(imported);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not read this file — make sure it's an OTB Calculator export.");
    }
  }

  // Keep the sticky season bar on the Results tab just below the (variable-height) header.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const update = () => document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Autosave to this browser (debounced). Held off while a previous session is waiting to be restored or dismissed.
  useEffect(() => {
    if (pendingRestore) return;
    if (stores.length === 0) return;
    const t = window.setTimeout(() => {
      setSavedAt(saveSession({ stores, brandInventory, fxRates, brandOutlook }));
    }, 400);
    return () => window.clearTimeout(t);
  }, [stores, brandInventory, fxRates, brandOutlook, pendingRestore]);

  useEffect(() => {
    if (skipDirty.current) {
      skipDirty.current = false;
      setDirtySinceExport(false);
      return;
    }
    setDirtySinceExport(true);
  }, [stores, brandInventory, fxRates, brandOutlook]);

  const setupSteps = useMemo(() => computeSetupStatus(stores, brandInventory, fxRates, horizon), [stores, brandInventory, fxRates, horizon]);
  const attention = useMemo(() => computeAttention(activeRows), [activeRows]);
  const openRow = openStoreId ? activeRows.find((r) => r.storeId === openStoreId) ?? null : null;

  const usedCurrencies = useMemo(() => Array.from(new Set(stores.map((s) => s.currency))).filter(Boolean), [stores]);

  const tabBadge = (tab: Tab) => {
    if (stores.length === 0) return null;
    const step = setupSteps.find((st) => st.tab === tab);
    return step && step.state !== "done" ? step : null;
  };
  const savedTime = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  const showChecklist = stores.length === 0 || setupSteps.some((st) => st.state !== "done");

  return (
    <div className="min-h-screen bg-slate-50">
      <header ref={headerRef} className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-2">
          <div className="flex items-center gap-6">
            <span className="text-sm font-semibold text-slate-900">OTB Calculator</span>
            <nav className="flex items-center gap-1">
              {TABS.map((t) => {
                const badge = t.key === "results" ? null : tabBadge(t.key);
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
                      tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {t.label}
                    {badge && (
                      <span
                        title={badge.detail}
                        aria-label={`Needs attention: ${badge.detail}`}
                        className="h-2 w-2 rounded-full bg-amber-500"
                      />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleImportFile} className="hidden" />
            <button
              onClick={handleImportClick}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Import Excel
            </button>
            <button
              onClick={handleExportExcel}
              disabled={stores.length === 0}
              title={stores.length === 0 ? "Nothing to export yet" : "Download every input and both seasons' results as one workbook"}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Export Excel
            </button>
            <div className="relative">
              <button
                onClick={() => setMoreOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                aria-label="More actions"
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                ⋯
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div role="menu" className="absolute right-0 z-50 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <button role="menuitem" onClick={requestLoadSample} className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50">
                      Load sample data
                    </button>
                    <button role="menuitem" onClick={requestClear} className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                      Clear all data…
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 border-t border-slate-100 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600">
          <span>
            Current: {current.label} (finalized) → Planning: {planning1.label}, {planning2.label}
          </span>
          <span className="font-normal text-slate-400">
            {savedTime ? `Autosaved ${savedTime} in this browser` : stores.length > 0 ? "Autosave unavailable in this browser" : "Your work autosaves in this browser"}
          </span>
          {dirtySinceExport && stores.length > 0 && (
            <span className="inline-flex items-center gap-1 font-normal text-amber-700" title="You've changed something since the last Excel export or import">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Changes not exported
            </span>
          )}
        </div>
        {pendingRestore && (
          <div className="flex flex-wrap items-center gap-3 border-t border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-900">
            <span>
              Found a saved session: <strong>{pendingRestore.stores.length} stores</strong>, last saved{" "}
              {new Date(pendingRestore.savedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}.
            </span>
            <button onClick={restoreSession} className="rounded-md bg-sky-700 px-2.5 py-1 font-medium text-white hover:bg-sky-800">
              Restore it
            </button>
            <button
              onClick={() => {
                clearSession();
                setPendingRestore(null);
              }}
              className="rounded-md border border-sky-300 px-2.5 py-1 font-medium text-sky-800 hover:bg-sky-100"
            >
              Start fresh
            </button>
          </div>
        )}
        {importError && (
          <div className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-xs font-medium text-red-700">
            Import failed: {importError}
          </div>
        )}
      </header>

      <main className="px-4 py-6">
        {stores.length === 0 && tab !== "stores" && tab !== "results" && (
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
          <div className="flex flex-col gap-4">
            {showChecklist && (
              <SetupChecklist steps={setupSteps} hasStores={stores.length > 0} onGo={(t) => setTab(t)} onLoadSample={loadSampleData} />
            )}
            <StoreListEditor
              stores={stores}
              onFieldChange={handleFieldChange}
              onMarketChange={handleMarketChange}
              onAddStore={handleAddStore}
              onRemoveStore={handleRemoveStore}
            />
          </div>
        )}

        {tab === "inventory" && (
          <div className="flex flex-col gap-4">
            <TabHelp id="inventory" title="What to fill in here">
              One number per brand and market: the total retail value of stock on hand today. It is split across that
              group's stores by their share of current-season sales. Enter 0 if a pool has nothing. Optionally add the
              expected change in sales after {planning2.label}.
            </TabHelp>
            <BrandInventoryEditor
              stores={stores}
              brandInventory={brandInventory}
              onChange={handleBrandInventoryChange}
              brandOutlook={brandOutlook}
              onOutlookChange={handleBrandOutlookChange}
              lastSeasonLabel={planning2.label}
            />
          </div>
        )}

        {tab === "forecast" && (
          <div className="flex flex-col gap-4">
            <TabHelp id="forecast" title="What to fill in here">
              Net sales target per store per month, for the current season and both planning seasons. Paste straight from
              Excel, and use the arrow keys and Enter to move around. The optional last column sets average monthly sales
              after {planning2.label}; leave it blank to reuse {planning2.label}'s own average.
            </TabHelp>
            <ForecastGrid
              stores={stores}
              horizon={horizon}
              onCellChange={handleForecastChange}
              lastSeasonLabel={planning2.label}
              onForwardChange={handleForwardChange}
              seasonLabels={{ current: current.label, planning1: planning1.label, planning2: planning2.label }}
            />
          </div>
        )}

        {tab === "assumptions" && (
          <div className="flex flex-col gap-4">
            <TabHelp id="assumptions" title="What to fill in here">
              <strong>Incoming goods</strong> decide whether a season is bought: filled in means the buy is locked and the
              OTB is 0; blank or 0 means it is still open, and the target sell-through sizes the OTB. The badge under each
              store shows which seasons are bought or open. Discounts convert net targets to retail value.
            </TabHelp>
            <AssumptionsTable
              stores={stores}
              onHandAllocation={onHandAllocation}
              onFieldChange={handleFieldChange}
              season1Label={planning1.label}
              season2Label={planning2.label}
            />
          </div>
        )}

        {tab === "fx" && (
          <FxRatesEditor fxRates={fxRates} onChange={handleFxChange} usedCurrencies={usedCurrencies} />
        )}

        {tab === "results" && (
          <div className="flex flex-col gap-6">
            <div
              className="sticky z-30 -mx-4 flex items-center justify-between border-b border-slate-200 bg-slate-50/95 px-4 py-2 backdrop-blur"
              style={{ top: "var(--header-h, 0px)" }}
            >
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

            {stores.length === 0 ? (
              <SetupChecklist steps={setupSteps} hasStores={false} onGo={(t) => setTab(t)} onLoadSample={loadSampleData} />
            ) : (
              <>
                <SeasonSummaryCards rows={activeRows} seasonLabel={activeLabel} fxRates={fxRates} />
                <NeedsAttention items={attention} onOpenStore={setOpenStoreId} />
                <Collapsible id="bystore" title={`By-Store Detail — ${activeLabel}`}>
                  <ByStoreTable rows={activeRows} onOpenStore={setOpenStoreId} />
                </Collapsible>
                <Collapsible id="aggregates" title={`Aggregates — ${activeLabel}`}>
                  <AggregateTables rows={activeRows} fxRates={fxRates} />
                </Collapsible>
                <Collapsible id="sensitivity" title={`Sensitivity — ${activeLabel} Total OTB`} hint="how the number moves with sell-through and sales" defaultOpen={false}>
                  <SensitivityPanel
                    stores={stores}
                    brandInventory={brandInventory}
                    brandOutlook={brandOutlook}
                    horizon={horizon}
                    fxRates={fxRates}
                    season={resultsSeasonTab}
                    seasonLabel={activeLabel}
                  />
                </Collapsible>
                <Collapsible id="current" title={`Current Season — ${current.label}`} hint="the roll-forward into starting inventory" defaultOpen={false}>
                  <CurrentSeasonTable rows={currentSeasonRows} />
                </Collapsible>
                <Collapsible id="legend" title="Flag legend" hint="what the badges mean" defaultOpen={false}>
                  <BadgeLegend />
                </Collapsible>
              </>
            )}
          </div>
        )}
      </main>

      {openRow && (
        <StoreCalcPanel
          row={openRow}
          seasonLabel={activeLabel}
          coverLabel={resultsSeasonTab === "s1" ? planning2.label : `the season after ${planning2.label}`}
          onClose={() => setOpenStoreId(null)}
        />
      )}

      {confirm?.kind === "clear" && (
        <ConfirmDialog
          title="Clear all data?"
          message="This removes every store, inventory pool, forecast and FX rate, including the autosaved copy in this browser. Export to Excel first if you may want it back."
          confirmLabel="Clear everything"
          danger
          onConfirm={() => {
            clearAll();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "sample" && (
        <ConfirmDialog
          title="Replace your data with the sample?"
          message="Your current stores and inputs will be replaced. Export to Excel first if you want to keep them."
          confirmLabel="Load sample data"
          onConfirm={() => {
            loadSampleData();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === "import" && (
        <ConfirmDialog
          title="Replace your data with this file?"
          message={
            <>
              <strong>{confirm.fileName}</strong> has {confirm.data.stores.length} stores. Your current {stores.length} stores and inputs will be replaced.
            </>
          }
          confirmLabel="Import and replace"
          danger
          onConfirm={() => {
            applyData(confirm.data);
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
