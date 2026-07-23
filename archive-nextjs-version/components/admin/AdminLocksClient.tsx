"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format";

interface SeasonLockRow {
  label: string;
  locked: boolean;
  lockedAt: string | null;
}

export function AdminLocksClient({ currentLabel, seasons }: { currentLabel: string; seasons: SeasonLockRow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function toggleLock(season: SeasonLockRow) {
    setLoading(season.label);
    try {
      await fetch("/api/admin/season-locks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seasonLabel: season.label, locked: !season.locked }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        Locking a planning season freezes all drafts for that season — planners can no longer edit inputs that feed it.
        Current cycle: {currentLabel}.
      </p>
      <div className="flex flex-col gap-3">
        {seasons.map((season) => (
          <div key={season.label} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-800">{season.label}</p>
              <p className="text-xs text-slate-500">
                {season.locked ? `Locked${season.lockedAt ? ` on ${formatDateTime(season.lockedAt)}` : ""}` : "Open for editing"}
              </p>
            </div>
            <button
              onClick={() => toggleLock(season)}
              disabled={loading === season.label}
              className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                season.locked ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-red-600 text-white hover:bg-red-700"
              }`}
            >
              {loading === season.label ? "Updating…" : season.locked ? "Unlock" : "Lock Season"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
