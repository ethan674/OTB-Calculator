"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error";

type PendingPatch = Record<string, unknown> & {
  monthlyForecastPatch?: Record<string, number>;
};

/** Debounced per-store autosave: merges rapid edits and PATCHes once activity settles. */
export function useAutosave(cycleLabel: string) {
  const pendingRef = useRef<Map<string, PendingPatch>>(new Map());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [status, setStatus] = useState<Record<string, SaveStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const flush = useCallback(
    async (storeId: string) => {
      const patch = pendingRef.current.get(storeId);
      if (!patch) return;
      pendingRef.current.delete(storeId);
      setStatus((s) => ({ ...s, [storeId]: "saving" }));
      try {
        const res = await fetch(`/api/planning-inputs/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleLabel, ...patch }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Save failed");
        }
        setStatus((s) => ({ ...s, [storeId]: "saved" }));
        setErrors((e) => ({ ...e, [storeId]: "" }));
        setTimeout(() => {
          setStatus((s) => (s[storeId] === "saved" ? { ...s, [storeId]: "idle" } : s));
        }, 1500);
      } catch (err) {
        setStatus((s) => ({ ...s, [storeId]: "error" }));
        setErrors((e) => ({ ...e, [storeId]: err instanceof Error ? err.message : "Save failed" }));
      }
    },
    [cycleLabel]
  );

  const queueChange = useCallback(
    (storeId: string, patch: PendingPatch) => {
      const existing = pendingRef.current.get(storeId) ?? {};
      const merged: PendingPatch = { ...existing, ...patch };
      if (existing.monthlyForecastPatch || patch.monthlyForecastPatch) {
        merged.monthlyForecastPatch = {
          ...(existing.monthlyForecastPatch ?? {}),
          ...(patch.monthlyForecastPatch ?? {}),
        };
      }
      pendingRef.current.set(storeId, merged);
      setStatus((s) => ({ ...s, [storeId]: "pending" }));

      const existingTimer = timersRef.current.get(storeId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => flush(storeId), 700);
      timersRef.current.set(storeId, timer);
    },
    [flush]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  return { queueChange, status, errors };
}
