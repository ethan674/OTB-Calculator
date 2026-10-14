import type { CurrentSeasonRow } from "@/lib/results";
import { formatAmount, formatPercent } from "@/lib/format";

interface CurrentSeasonTableProps {
  rows: CurrentSeasonRow[];
}

export function CurrentSeasonTable({ rows }: CurrentSeasonTableProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        The roll-forward from where each store stands today into its Season 1 starting inventory.
      </p>
      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Store</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Current Season Inventory
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Current Incoming Goods
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Current Remaining Target
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Current Discount Rate
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Projected EoS Inventory (Current Season)
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Flag</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.storeId} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium text-slate-800">
                  {r.storeName}
                  {r.isOutlet && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Outlet</span>}
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.currentSeasonInventory)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.currentIncomingGoods)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.currentRemainingTarget)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatPercent(r.currentDiscountRate)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5 font-semibold">
                  {formatAmount(r.projectedEosInventory)}
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{r.currency}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  {r.overridden && <span className="mr-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700">override</span>}
                  {r.floored && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">floored</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
