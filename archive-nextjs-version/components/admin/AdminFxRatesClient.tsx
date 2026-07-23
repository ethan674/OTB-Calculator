"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format";

interface FxRateRow {
  currency: string;
  rateToUsd: number;
  asOfDate: string;
}

export function AdminFxRatesClient({ rates, missingCurrencies }: { rates: FxRateRow[]; missingCurrencies: string[] }) {
  const router = useRouter();
  const [currency, setCurrency] = useState("");
  const [rateToUsd, setRateToUsd] = useState("");
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fx-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, rateToUsd: Number(rateToUsd), asOfDate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save rate");
      setCurrency("");
      setRateToUsd("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save rate");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {missingCurrencies.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Missing FX rate for: <span className="font-semibold">{missingCurrencies.join(", ")}</span>. Add a rate below so
          mixed-currency aggregates can convert to USD.
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Add / Update Rate (currency → USD)</h2>
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Currency</label>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              placeholder="e.g. TWD"
              maxLength={3}
              className="w-20 rounded border border-slate-300 px-2 py-1 text-sm uppercase"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Rate to USD</label>
            <input
              value={rateToUsd}
              onChange={(e) => setRateToUsd(e.target.value)}
              placeholder="e.g. 0.031"
              inputMode="decimal"
              className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">As Of Date</label>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !currency || !rateToUsd}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Rate"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">Rate to USD</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">As Of</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r, i) => (
              <tr key={r.currency} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium">{r.currency}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{r.rateToUsd}</td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-500">{formatDate(r.asOfDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
