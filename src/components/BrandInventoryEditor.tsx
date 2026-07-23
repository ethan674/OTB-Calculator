import { getBrandMarketGroups } from "@/lib/brandInventory";
import type { CalcStore } from "@/types";

interface BrandInventoryEditorProps {
  stores: CalcStore[];
  brandInventory: Record<string, number>;
  onChange: (key: string, value: number) => void;
}

export function BrandInventoryEditor({ stores, brandInventory, onChange }: BrandInventoryEditorProps) {
  const groups = getBrandMarketGroups(stores);

  if (groups.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No stores yet. Add stores in the Stores tab first — inventory pools are grouped by each store's brand and market.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Current On-Hand Inventory by Brand &amp; Market</h2>
        <p className="mt-1 text-sm text-slate-500">
          Enter one total per brand+market — it's automatically split across that group's stores by their share of
          current-season forecasted sales. This replaces entering on-hand inventory per store, since stock transfers
          between stores constantly and a single store-level number goes stale immediately.
        </p>
      </div>
      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Brand</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Market</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Stores</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Total Current On-Hand Inv. (SRP Value)
              </th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g, i) => (
              <tr key={g.key} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium text-slate-800">{g.brand}</td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{g.market}</td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-500">{g.storeIds.length}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={brandInventory[g.key] ?? ""}
                    onBlur={(e) => {
                      const num = Number(e.target.value);
                      if (Number.isFinite(num)) onChange(g.key, num);
                    }}
                    className="num-cell w-full min-w-[160px] rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
                  />
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{g.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        See each store's resulting share on the Store Assumptions tab (Current On-Hand Inv. column, read-only there).
      </p>
    </div>
  );
}
