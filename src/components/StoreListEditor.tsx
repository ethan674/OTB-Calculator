import { CHANNELS, STORE_TYPES, type CalcStore } from "@/types";
import { MARKETS, MARKET_CURRENCY } from "@/data/markets";

interface StoreListEditorProps {
  stores: CalcStore[];
  onFieldChange: (storeId: string, field: string, value: string) => void;
  onMarketChange: (storeId: string, market: string) => void;
  onAddStore: () => void;
  onRemoveStore: (storeId: string) => void;
}

function TextCell({ value, onChange, width = "w-32" }: { value: string; onChange: (v: string) => void; width?: string }) {
  return (
    <input
      type="text"
      defaultValue={value}
      onBlur={(e) => {
        if (e.target.value !== value) onChange(e.target.value);
      }}
      className={`${width} rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-slate-400`}
    />
  );
}

export function StoreListEditor({ stores, onFieldChange, onMarketChange, onAddStore, onRemoveStore }: StoreListEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Stores ({stores.length})</h2>
        <button
          onClick={onAddStore}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          + Add Store
        </button>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Store Name</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Brand</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Channel</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Store Type</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Market</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600" />
            </tr>
          </thead>
          <tbody>
            {stores.map((store, i) => (
              <tr key={store.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <TextCell value={store.storeName} onChange={(v) => onFieldChange(store.id, "storeName", v)} width="w-48" />
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <TextCell value={store.brand} onChange={(v) => onFieldChange(store.id, "brand", v)} width="w-32" />
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <select
                    value={store.channel}
                    onChange={(e) => onFieldChange(store.id, "channel", e.target.value)}
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                  >
                    {CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <select
                    value={store.storeType}
                    onChange={(e) => onFieldChange(store.id, "storeType", e.target.value)}
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                  >
                    {STORE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <select
                    value={store.market}
                    onChange={(e) => onMarketChange(store.id, e.target.value)}
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                  >
                    {MARKETS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{MARKET_CURRENCY[store.market] ?? store.currency}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <button onClick={() => onRemoveStore(store.id)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Currency follows the market automatically. Add or edit stores here, then fill in the forecast and assumptions in
        the other tabs. Nothing is saved — refreshing the page resets everything.
      </p>
    </div>
  );
}
