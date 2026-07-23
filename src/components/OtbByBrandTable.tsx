import { useMemo } from "react";
import type { OtbSeasonRow } from "@/lib/results";
import { sumToUsd } from "@/lib/results";
import type { FxRateMap } from "@/lib/otb-engine";
import { formatAmount } from "@/lib/format";

interface OtbByBrandTableProps {
  season1Rows: OtbSeasonRow[];
  season2Rows: OtbSeasonRow[];
  planning1Label: string;
  planning2Label: string;
  fxRates: FxRateMap;
}

export function OtbByBrandTable({ season1Rows, season2Rows, planning1Label, planning2Label, fxRates }: OtbByBrandTableProps) {
  const { rows, missingCurrencies } = useMemo(() => {
    const brands = Array.from(new Set([...season1Rows.map((r) => r.brand), ...season2Rows.map((r) => r.brand)])).sort();
    const missing = new Set<string>();

    const rows = brands.map((brand) => {
      const s1 = sumToUsd(
        season1Rows.filter((r) => r.brand === brand && !r.isOutlet).map((r) => ({ value: r.otb, currency: r.currency })),
        fxRates
      );
      const s2 = sumToUsd(
        season2Rows.filter((r) => r.brand === brand && !r.isOutlet).map((r) => ({ value: r.otb, currency: r.currency })),
        fxRates
      );
      s1.missingCurrencies.forEach((c) => missing.add(c));
      s2.missingCurrencies.forEach((c) => missing.add(c));
      return { brand, s1: s1.value, s2: s2.value };
    });

    return { rows, missingCurrencies: Array.from(missing) };
  }, [season1Rows, season2Rows, fxRates]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700">OTB by Brand (USD)</h3>
      <p className="text-xs text-slate-400">
        Outlet stores don't count separately — their inventory need is covered by transfer from full-price stores in
        the same brand+market group, so it's already folded into the full-price figures above.
      </p>
      {missingCurrencies.length > 0 && (
        <p className="text-xs text-amber-600">Excludes stores missing FX rates for: {missingCurrencies.join(", ")}</p>
      )}
      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Brand</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                {planning1Label} OTB (USD)
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                {planning2Label} OTB (USD)
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.brand} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium text-slate-800">{r.brand}</td>
                <td className={`num-cell border-b border-slate-100 px-3 py-1.5 ${r.s1 < 0 ? "text-red-600" : ""}`}>
                  {formatAmount(r.s1)}
                </td>
                <td className={`num-cell border-b border-slate-100 px-3 py-1.5 ${r.s2 < 0 ? "text-red-600" : ""}`}>
                  {formatAmount(r.s2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
