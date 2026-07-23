"use client";

import type { OtbSeasonRow } from "@/lib/results";
import { computeSeasonSummary } from "@/lib/results";
import type { FxRateMap } from "@/lib/otb-engine";
import { formatAmount, formatPercent } from "@/lib/format";

interface SeasonSummaryCardsProps {
  rows: OtbSeasonRow[];
  seasonLabel: string;
  fxRates: FxRateMap;
}

function Card({ label, value, accent }: { label: string; value: React.ReactNode; accent?: "red" | "amber" }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold ${accent === "red" ? "text-red-600" : accent === "amber" ? "text-amber-600" : "text-slate-900"}`}
      >
        {value}
      </p>
    </div>
  );
}

export function SeasonSummaryCards({ rows, seasonLabel, fxRates }: SeasonSummaryCardsProps) {
  const summary = computeSeasonSummary(rows, fxRates);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700">{seasonLabel} Summary</h3>
      <div className="flex flex-wrap gap-3">
        <Card
          label="Total OTB (SRP)"
          value={
            summary.totalOtb.ok ? (
              <span className={summary.totalOtb.total < 0 ? "text-red-600" : ""}>
                {formatAmount(summary.totalOtb.total)} {summary.totalOtb.currency}
              </span>
            ) : (
              <span className="text-sm text-red-600">FX missing: {summary.totalOtb.missingCurrencies.join(", ")}</span>
            )
          }
          accent={summary.totalOtb.ok && summary.totalOtb.total < 0 ? "red" : undefined}
        />
        <Card
          label="Total Net Target"
          value={
            summary.totalNetTarget.ok ? (
              `${formatAmount(summary.totalNetTarget.total)} ${summary.totalNetTarget.currency}`
            ) : (
              <span className="text-sm text-red-600">FX missing</span>
            )
          }
        />
        <Card label="Weighted Avg Sell-Through" value={formatPercent(summary.weightedAvgSellThrough)} />
        <Card label="Weighted Avg Discount" value={formatPercent(summary.weightedAvgDiscount)} />
        <Card
          label="Overbought Stores"
          value={`${summary.overboughtCount} / ${summary.storeCount}`}
          accent={summary.overboughtCount > 0 ? "amber" : undefined}
        />
      </div>
    </div>
  );
}
