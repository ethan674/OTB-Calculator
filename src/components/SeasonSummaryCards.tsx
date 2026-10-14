import type { OtbSeasonRow } from "@/lib/results";
import { computeSeasonSummary } from "@/lib/results";
import type { FxRateMap, AggregateResult } from "@/lib/otb-engine";
import { formatAmount, formatPercent } from "@/lib/format";

interface SeasonSummaryCardsProps {
  rows: OtbSeasonRow[];
  seasonLabel: string;
  fxRates: FxRateMap;
}

function Metric({ label, value, help }: { label: string; value: React.ReactNode; help: string }) {
  return (
    <div className="flex-1 basis-40 rounded-lg border border-slate-200 bg-white px-4 py-3" title={help}>
      <p className="text-xs font-medium text-slate-500">
        {label} <span className="text-slate-300">ⓘ</span>
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function amountText(result: AggregateResult): React.ReactNode {
  if (!result.ok) return <span className="text-sm text-red-600">FX missing: {result.missingCurrencies.join(", ")}</span>;
  return <span className={result.total < 0 ? "text-red-600" : ""}>{formatAmount(result.total)}</span>;
}

export function SeasonSummaryCards({ rows, seasonLabel, fxRates }: SeasonSummaryCardsProps) {
  const summary = computeSeasonSummary(rows, fxRates);
  const currency = summary.totalOtb.ok ? summary.totalOtb.currency : "";

  const fullPrice = rows.filter((r) => !r.isOutlet);
  const bought = fullPrice.filter((r) => r.buyLocked).length;
  const overbought = fullPrice.filter((r) => r.overbought).length;
  const negative = summary.totalOtb.ok && summary.totalOtb.total < 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h3 className="text-sm font-semibold text-slate-700">{seasonLabel} Summary</h3>
        {currency && <span className="text-xs text-slate-400">All amounts in {currency}</span>}
      </div>
      <div className="flex flex-wrap gap-3">
        <div
          className="flex min-w-[15rem] flex-1 basis-64 flex-col justify-between rounded-lg border-2 border-slate-900 bg-white px-5 py-4"
          title="The open-to-buy for full-price stores: retail value still to be bought. Outlets are excluded; they net against full-price stores."
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total OTB (SRP)</p>
          <p className={`mt-1 text-3xl font-bold ${negative ? "text-red-600" : "text-slate-900"}`}>{amountText(summary.totalOtb)}</p>
          <p className="mt-2 text-xs text-slate-500">
            {fullPrice.length === 0
              ? "No full-price stores"
              : `${bought} of ${fullPrice.length} full-price stores already bought · ${fullPrice.length - bought} open${overbought ? ` · ${overbought} overbought` : ""}`}
          </p>
        </div>
        <div className="flex flex-[3] basis-[30rem] flex-wrap gap-3">
          <Metric label="Total Target" value={amountText(summary.totalNetTarget)} help="Net sales target across all stores, after discounts" />
          <Metric label="Starting Inventory" value={amountText(summary.totalSos)} help="Forecast SoS: stock on hand at the start of the season (after outlet transfers net out)" />
          <Metric label="Ending Inventory" value={amountText(summary.totalEos)} help="Forecast EoS: what is left after the season's sales; rolls into the next season's SoS" />
          <Metric label="Blended Discount" value={formatPercent(summary.weightedAvgDiscount)} help="Average discount weighted by gross sales, outlets included" />
          <Metric label="Sell-Through" value={formatPercent(summary.weightedAvgSellThrough)} help="Share of available stock that sells during the season, weighted across stores" />
        </div>
      </div>
    </div>
  );
}
