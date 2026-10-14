import { getBrandMarketGroups } from "@/lib/brandInventory";
import type { CalcStore } from "@/types";

interface BrandInventoryEditorProps {
  stores: CalcStore[];
  brandInventory: Record<string, number>;
  onChange: (key: string, value: number) => void;
  /** Per brand+market: expected % change in sales after the last planning season vs. that season. */
  brandOutlook: Record<string, number>;
  onOutlookChange: (key: string, value: number | null) => void;
  lastSeasonLabel: string;
}

export function BrandInventoryEditor({ stores, brandInventory, onChange, brandOutlook, onOutlookChange, lastSeasonLabel }: BrandInventoryEditorProps) {
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
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                Sales after {lastSeasonLabel} vs. {lastSeasonLabel} (%)
              </th>
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
                    placeholder="enter 0 if none"
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      const num = Number(raw);
                      if (raw !== "" && Number.isFinite(num)) onChange(g.key, num);
                    }}
                    className={`num-cell w-full min-w-[160px] rounded border px-2 py-1 text-sm outline-none ${
                      brandInventory[g.key] === undefined
                        ? "border-amber-400 bg-amber-50 placeholder:text-amber-600/70 focus:border-amber-500"
                        : brandInventory[g.key] < 0
                          ? "border-red-400 bg-red-50"
                          : "border-slate-200 focus:border-slate-400"
                    }`}
                  />
                  {brandInventory[g.key] !== undefined && brandInventory[g.key] < 0 && (
                    <p className="mt-0.5 text-left text-[10px] text-red-600">Can't be negative.</p>
                  )}
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{g.currency}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    defaultValue={brandOutlook[g.key] ?? ""}
                    placeholder="0"
                    title={`Expected change in this brand's monthly sales after ${lastSeasonLabel}, vs. ${lastSeasonLabel}. Sizes ${lastSeasonLabel}'s target ending inventory. Blank = same as ${lastSeasonLabel}.`}
                    onBlur={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === "") return onOutlookChange(g.key, null);
                      const num = Number(raw);
                      if (Number.isFinite(num)) onOutlookChange(g.key, num);
                    }}
                    className="num-cell w-full min-w-[90px] rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        <span className="font-medium text-slate-600">Sales after {lastSeasonLabel}:</span> {lastSeasonLabel}'s ending
        inventory has to cover the demand of the season that follows it, but nothing is forecast beyond {lastSeasonLabel}.
        Enter how much that brand's monthly sales are expected to differ after {lastSeasonLabel} (e.g. −15 or 10); blank
        means the same as {lastSeasonLabel}. A single store can override it with its own average monthly sales on the
        Monthly Forecast tab.
      </p>
      <p className="text-xs text-slate-400">
        See each store's resulting share on the Store Assumptions tab (Current On-Hand Inv. column, read-only there).
      </p>
    </div>
  );
}
