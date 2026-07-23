"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StoreRow {
  id: string;
  storeCode: string;
  storeName: string;
  brand: string;
  channel: string;
  market: string;
  currency: string;
  active: boolean;
  ownerId: string | null;
}

interface Planner {
  id: string;
  name: string;
}

const CHANNELS = ["Retail", "EC", "Wholesale", "Outlet"];

const EMPTY_FORM = { storeCode: "", storeName: "", brand: "", channel: "Retail", market: "", currency: "", ownerId: "" };

export function AdminStoresClient({ stores, planners }: { stores: StoreRow[]; planners: Planner[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create store");
      setForm(EMPTY_FORM);
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create store");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(store: StoreRow) {
    await fetch(`/api/admin/stores/${store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !store.active }),
    });
    router.refresh();
  }

  async function reassignOwner(store: StoreRow, ownerId: string) {
    await fetch(`/api/admin/stores/${store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerId: ownerId || null }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Stores ({stores.length})</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
        >
          {showForm ? "Cancel" : "+ Add Store"}
        </button>
      </div>

      {showForm && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Store Code</label>
            <input value={form.storeCode} onChange={(e) => setForm({ ...form, storeCode: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Store Name</label>
            <input value={form.storeName} onChange={(e) => setForm({ ...form, storeName: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Brand</label>
            <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Channel</label>
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Market</label>
            <input value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Currency</label>
            <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="e.g. TWD" className="w-20 rounded border border-slate-300 px-2 py-1 text-sm" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Owner (planner)</label>
            <select value={form.ownerId} onChange={(e) => setForm({ ...form, ownerId: e.target.value })} className="rounded border border-slate-300 px-2 py-1 text-sm">
              <option value="">Unassigned</option>
              {planners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Create"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      <div className="overflow-auto rounded-md border border-slate-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Store</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Brand</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Channel</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Market</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Owner</th>
              <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Active</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store, i) => (
              <tr key={store.id} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <div className="font-medium text-slate-800">{store.storeName}</div>
                  <div className="text-xs text-slate-400">{store.storeCode}</div>
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5">{store.brand}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">{store.channel}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">{store.market}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">{store.currency}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <select
                    defaultValue={store.ownerId ?? ""}
                    onChange={(e) => reassignOwner(store, e.target.value)}
                    className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {planners.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  <button
                    onClick={() => toggleActive(store)}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      store.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {store.active ? "Active" : "Inactive"}
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
