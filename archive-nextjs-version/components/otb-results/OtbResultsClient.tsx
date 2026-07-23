"use client";

import { useState } from "react";
import type { OtbSeasonRow } from "@/lib/results";
import type { FxRateMap } from "@/lib/otb-engine";
import { SeasonSummaryCards } from "./SeasonSummaryCards";
import { ByStoreTable } from "./ByStoreTable";
import { AggregateTables } from "./AggregateTables";
import { OtbBarChart } from "./OtbBarChart";
import { buildOtbWorkbook, downloadWorkbook, buildCsv, downloadCsv } from "@/lib/export";

interface OtbResultsClientProps {
  season1Rows: OtbSeasonRow[];
  season2Rows: OtbSeasonRow[];
  planning1Label: string;
  planning2Label: string;
  currentLabel: string;
  fxRates: FxRateMap;
  fxAsOf: Record<string, string>;
}

type SeasonTab = "s1" | "s2";

export function OtbResultsClient({
  season1Rows,
  season2Rows,
  planning1Label,
  planning2Label,
  currentLabel,
  fxRates,
  fxAsOf,
}: OtbResultsClientProps) {
  const [seasonTab, setSeasonTab] = useState<SeasonTab>("s1");
  const activeRows = seasonTab === "s1" ? season1Rows : season2Rows;
  const activeLabel = seasonTab === "s1" ? planning1Label : planning2Label;

  function handleExportExcel() {
    const wb = buildOtbWorkbook({ season1Rows, season2Rows, planning1Label, planning2Label, fxRates, fxAsOf });
    downloadWorkbook(wb, `otb-planner_${currentLabel}_${planning1Label}-${planning2Label}.xlsx`);
  }

  function handleExportCsv() {
    const csv = buildCsv(activeRows);
    downloadCsv(csv, `otb-planner_${activeLabel}.csv`);
  }

  if (season1Rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No stores to show results for yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-md bg-slate-100 p-1">
          <button
            onClick={() => setSeasonTab("s1")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${seasonTab === "s1" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
          >
            {planning1Label}
          </button>
          <button
            onClick={() => setSeasonTab("s2")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${seasonTab === "s2" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
          >
            {planning2Label}
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

      <SeasonSummaryCards rows={activeRows} seasonLabel={activeLabel} fxRates={fxRates} />

      <OtbBarChart
        season1Rows={season1Rows}
        season2Rows={season2Rows}
        planning1Label={planning1Label}
        planning2Label={planning2Label}
        fxRates={fxRates}
      />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">By-Store Detail — {activeLabel}</h3>
        <ByStoreTable rows={activeRows} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">Aggregates — {activeLabel}</h3>
        <AggregateTables rows={activeRows} fxRates={fxRates} />
      </div>
    </div>
  );
}
