import { useState } from "react";
import type { FxRateMap } from "@/lib/otb-engine";

interface FxRatesEditorProps {
  fxRates: FxRateMap;
  onChange: (currency: string, rateToUsd: number | null) => void;
  usedCurrencies: string[];
}

export function FxRatesEditor({ fxRates, onChange, usedCurrencies }: FxRatesEditorProps) {
  const [newCurrency, setNewCurrency] = useState("");
  const [newRate, setNewRate] = useState("");

  const missingCurrencies = usedCurrencies.filter((c) => c !== "USD" && fxRates[c] === undefined);

  function addRate() {
    const rate = Number(newRate);
    if (!newCurrency.trim() || !Number.isFinite(rate) || rate <= 0) return;
    onChange(newCurrency.trim().toUpperCase(), rate);
    setNewCurrency("");
    setNewRate("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") addRate();
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">
        Used to convert store-level OTB into USD whenever an aggregate (brand, channel, market, or grand total) spans
        more than one currency. Not needed for stores that share a single currency.
      </p>

      {missingCurrencies.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Missing rate for: <span className="font-semibold">{missingCurrencies.join(", ")}</span> — add it below so
          mixed-currency aggregates can convert to USD.
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Currency</label>
          <input
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            placeholder="e.g. TWD"
            maxLength={3}
            className="w-20 rounded border border-slate-300 px-2 py-1 text-sm uppercase"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Rate to USD</label>
          <input
            value={newRate}
            onChange={(e) => setNewRate(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. 0.031"
            inputMode="decimal"
            className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </div>
        <button
          onClick={addRate}
          disabled={!newCurrency || !newRate}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Save Rate
        </button>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">Rate to USD</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600" />
            </tr>
          </thead>
          <tbody>
            {Object.entries(fxRates).map(([currency, rate], i) => (
              <tr key={currency} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium">{currency}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{rate}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <button onClick={() => onChange(currency, null)} className="text-xs text-red-600 hover:underline">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
