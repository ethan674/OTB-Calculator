import type { OtbSeasonRow } from "@/lib/results";
import { computeSeasonSummary } from "@/lib/results";
import type { FxRateMap, AggregateResult } from "@/lib/otb-engine";
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

function AmountValue({ result }: { result: AggregateResult }) {
  if (!result.ok) {
    return <span className="text-sm text-red-600">FX missing: {result.missingCurrencies.join(", ")}</span>;
  }
  return (
    <span className={result.total < 0 ? "text-red-600" : ""}>
      {formatAmount(result.total)} {result.currency}
    </span>
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
          value={<AmountValue result={summary.totalOtb} />}
          accent={summary.totalOtb.ok && summary.totalOtb.total < 0 ? "red" : undefined}
        />
        <Card label="Total Target" value={<AmountValue result={summary.totalNetTarget} />} />
        <Card label="Forecast SoS Inventory" value={<AmountValue result={summary.totalSos} />} />
        <Card label="Blended Discount %" value={formatPercent(summary.weightedAvgDiscount)} />
        <Card label="Forecast Sell-Through %" value={formatPercent(summary.weightedAvgSellThrough)} />
        <Card label="Forecast EoS Inventory" value={<AmountValue result={summary.totalEos} />} />
      </div>
    </div>
  );
}
