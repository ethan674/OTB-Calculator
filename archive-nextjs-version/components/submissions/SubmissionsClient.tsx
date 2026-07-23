"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@prisma/client";
import { formatAmount, formatDateTime } from "@/lib/format";
import type { StorePlanResult } from "@/lib/otb-engine";

export interface SubmissionSummary {
  id: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  brand: string;
  channel: string;
  market: string;
  version: number;
  submittedBy: string;
  submittedAt: string;
  comment: string | null;
  outputs: StorePlanResult;
  planningSeason1: string;
  planningSeason2: string;
}

export interface StoreSummary {
  storeId: string;
  storeCode: string;
  storeName: string;
  brand: string;
  channel: string;
  market: string;
  draftUpdatedAt: string | null;
}

interface SubmissionsClientProps {
  role: Role;
  currentLabel: string;
  stores: StoreSummary[];
  submissions: SubmissionSummary[];
}

function SubmitButton({ storeId, onSubmitted }: { storeId: string; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, comment: comment || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submit failed");
      setOpen(false);
      setComment("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
      >
        Submit New Version
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional comment"
        className="w-64 rounded border border-slate-300 px-2 py-1 text-xs"
        rows={2}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Submitting…" : "Confirm Submit"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

function DeltaCell({ before, after }: { before: number; after: number }) {
  const delta = after - before;
  return (
    <span className="flex flex-col items-end">
      <span>{formatAmount(after)}</span>
      <span className={`text-[10px] ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-600" : "text-slate-400"}`}>
        {delta === 0 ? "no change" : `${delta > 0 ? "+" : ""}${formatAmount(delta)}`}
      </span>
    </span>
  );
}

function CompareView({ submissions }: { submissions: SubmissionSummary[] }) {
  const storeOptions = useMemo(() => Array.from(new Set(submissions.map((s) => s.storeId))), [submissions]);
  const [storeId, setStoreId] = useState(storeOptions[0] ?? "");
  const versionsForStore = submissions.filter((s) => s.storeId === storeId).sort((a, b) => a.version - b.version);
  const [versionA, setVersionA] = useState<number | null>(null);
  const [versionB, setVersionB] = useState<number | null>(null);

  const subA = versionsForStore.find((s) => s.version === versionA);
  const subB = versionsForStore.find((s) => s.version === versionB);

  if (storeOptions.length === 0) {
    return <p className="text-sm text-slate-500">No submissions yet to compare.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={storeId}
          onChange={(e) => {
            setStoreId(e.target.value);
            setVersionA(null);
            setVersionB(null);
          }}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {storeOptions.map((id) => {
            const s = submissions.find((sub) => sub.storeId === id)!;
            return (
              <option key={id} value={id}>
                {s.storeName}
              </option>
            );
          })}
        </select>
        <select value={versionA ?? ""} onChange={(e) => setVersionA(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1 text-sm">
          <option value="">Version A</option>
          {versionsForStore.map((s) => (
            <option key={s.version} value={s.version}>
              v{s.version} ({formatDateTime(s.submittedAt)})
            </option>
          ))}
        </select>
        <select value={versionB ?? ""} onChange={(e) => setVersionB(Number(e.target.value))} className="rounded border border-slate-300 px-2 py-1 text-sm">
          <option value="">Version B</option>
          {versionsForStore.map((s) => (
            <option key={s.version} value={s.version}>
              v{s.version} ({formatDateTime(s.submittedAt)})
            </option>
          ))}
        </select>
      </div>

      {subA && subB && (
        <div className="overflow-auto rounded-md border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Metric</th>
                <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                  v{subA.version} → v{subB.version} ({subA.planningSeason1})
                </th>
                <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">
                  v{subA.version} → v{subB.version} ({subA.planningSeason2})
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium">Net Target</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  <DeltaCell before={subA.outputs.season1.netRevenueTarget} after={subB.outputs.season1.netRevenueTarget} />
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  <DeltaCell before={subA.outputs.season2.netRevenueTarget} after={subB.outputs.season2.netRevenueTarget} />
                </td>
              </tr>
              <tr>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium">OTB (SRP)</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  <DeltaCell before={subA.outputs.season1.otb} after={subB.outputs.season1.otb} />
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  <DeltaCell before={subA.outputs.season2.otb} after={subB.outputs.season2.otb} />
                </td>
              </tr>
              <tr>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium">SOS Inventory</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  <DeltaCell before={subA.outputs.season1.sosInventory} after={subB.outputs.season1.sosInventory} />
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  <DeltaCell before={subA.outputs.season2.sosInventory} after={subB.outputs.season2.sosInventory} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function SubmissionsClient({ role, currentLabel, stores, submissions }: SubmissionsClientProps) {
  const router = useRouter();
  const [brandFilter, setBrandFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [tab, setTab] = useState<"list" | "compare">("list");

  const brands = useMemo(() => Array.from(new Set(stores.map((s) => s.brand))).sort(), [stores]);
  const markets = useMemo(() => Array.from(new Set(stores.map((s) => s.market))).sort(), [stores]);

  const filteredStores = stores.filter(
    (s) => (!brandFilter || s.brand === brandFilter) && (!marketFilter || s.market === marketFilter)
  );

  const latestByStore = new Map<string, SubmissionSummary>();
  for (const sub of submissions) {
    const existing = latestByStore.get(sub.storeId);
    if (!existing || sub.version > existing.version) latestByStore.set(sub.storeId, sub);
  }

  function refresh() {
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-md bg-slate-100 p-1 w-fit">
        <button
          onClick={() => setTab("list")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${tab === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
        >
          Stores &amp; Submissions
        </button>
        <button
          onClick={() => setTab("compare")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${tab === "compare" ? "bg-white shadow-sm text-slate-900" : "text-slate-600"}`}
        >
          Compare Versions
        </button>
      </div>

      {tab === "list" ? (
        <>
          {role === "admin" && (
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                Brand
                <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="">All</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                Market
                <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} className="rounded border border-slate-300 px-2 py-1 text-xs">
                  <option value="">All</option>
                  {markets.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="overflow-auto rounded-md border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Store</th>
                  <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Draft Updated</th>
                  <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Latest Submission</th>
                  <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((store, i) => {
                  const latest = latestByStore.get(store.storeId);
                  return (
                    <tr key={store.storeId} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <div className="font-medium text-slate-800">{store.storeName}</div>
                        <div className="text-xs text-slate-400">
                          {store.storeCode} · {store.brand} · {store.market}
                        </div>
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                        {store.draftUpdatedAt ? formatDateTime(store.draftUpdatedAt) : "—"}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-500">
                        {latest ? (
                          <div>
                            <div className="font-medium text-slate-700">
                              v{latest.version} by {latest.submittedBy}
                            </div>
                            <div>{formatDateTime(latest.submittedAt)}</div>
                            {latest.comment && <div className="italic text-slate-400">&ldquo;{latest.comment}&rdquo;</div>}
                          </div>
                        ) : (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">Not submitted yet</span>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-3 py-2">
                        <SubmitButton storeId={store.storeId} onSubmitted={refresh} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">Cycle {currentLabel}. Submitted snapshots are immutable and versioned.</p>
        </>
      ) : (
        <CompareView submissions={submissions} />
      )}
    </div>
  );
}
