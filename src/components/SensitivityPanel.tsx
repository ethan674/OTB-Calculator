import { useMemo } from "react";
import type { CalcStore } from "@/types";
import type { FxRateMap, HorizonMonth } from "@/lib/otb-engine";
import { SALES_CHANGES, SELL_THROUGH_DELTAS, computeSensitivityGrid } from "@/lib/sensitivity";
import { formatAmount } from "@/lib/format";

interface SensitivityPanelProps {
  stores: CalcStore[];
  brandInventory: Record<string, number>;
  brandOutlook: Record<string, number>;
  horizon: HorizonMonth[];
  fxRates: FxRateMap;
  season: "s1" | "s2";
  seasonLabel: string;
}

const signed = (n: number, prefix = "") => `${n > 0 ? "+" : n < 0 ? "−" : ""}${prefix}${Math.abs(n)}`;

export function SensitivityPanel({ stores, brandInventory, brandOutlook, horizon, fxRates, season, seasonLabel }: SensitivityPanelProps) {
  const grid = useMemo(
    () => computeSensitivityGrid(stores, brandInventory, horizon, fxRates, season, brandOutlook),
    [stores, brandInventory, horizon, fxRates, season, brandOutlook]
  );

  const baseRow = SELL_THROUGH_DELTAS.indexOf(0);
  const baseCol = SALES_CHANGES.indexOf(0);
  const base = grid[baseRow][baseCol].totalOtb;
  const allZero = grid.every((row) => row.every((c) => c.totalOtb.ok && c.totalOtb.total === 0));
  const currency = base.ok ? base.currency : "";

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700">Sensitivity — {seasonLabel} Total OTB</h3>
      <p className="text-xs text-slate-500">
        How soft the number is. Each cell re-runs the whole plan with every open store's target sell-through shifted by
        the row's points and every planning-season sales forecast scaled by the column's %. Stores already bought for
        (incoming goods filled in) ignore sell-through, and the current season is left alone.
      </p>
      {allZero ? (
        <div className="rounded-md border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
          Every store is already bought for in {seasonLabel}, so there's no OTB to flex. Switch to a season that's still open.
        </div>
      ) : (
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">
                  Target sell-through ↓ &nbsp;/&nbsp; Sales →
                </th>
                {SALES_CHANGES.map((c) => (
                  <th key={c} className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                    {c === 0 ? "Base sales" : `${signed(c)}%`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, ri) => (
                <tr key={SELL_THROUGH_DELTAS[ri]}>
                  <td className="border-b border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {SELL_THROUGH_DELTAS[ri] === 0 ? "Base sell-through" : `${signed(SELL_THROUGH_DELTAS[ri])} pts`}
                  </td>
                  {row.map((cell, ci) => {
                    const isBase = ri === baseRow && ci === baseCol;
                    const diff = cell.totalOtb.ok && base.ok ? cell.totalOtb.total - base.total : null;
                    return (
                      <td
                        key={cell.salesChangePct}
                        className={`num-cell border-b border-slate-100 px-3 py-1.5 ${isBase ? "bg-slate-100 font-semibold" : ""}`}
                      >
                        {cell.totalOtb.ok ? (
                          <>
                            <div className={cell.totalOtb.total < 0 ? "text-red-600" : ""}>{formatAmount(cell.totalOtb.total)}</div>
                            {!isBase && diff !== null && (
                              <div className="text-[10px] font-normal text-slate-400">
                                {diff > 0 ? "+" : diff < 0 ? "−" : ""}
                                {formatAmount(Math.abs(diff))}
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-red-600">FX missing</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!allZero && currency && <p className="text-xs text-slate-400">Amounts in {currency}; grey figures are the change vs. the base case.</p>}
    </div>
  );
}
