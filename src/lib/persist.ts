import type { FxRateMap } from "@/lib/otb-engine";
import { emptyStore, type CalcStore } from "@/types";

/** Browser-only autosave. Nothing leaves the machine; it can be unavailable (private mode, blocked storage), so every access is guarded. */
const SESSION_KEY = "otb-calculator:session:v1";

export interface Session {
  stores: CalcStore[];
  brandInventory: Record<string, number>;
  fxRates: FxRateMap;
  brandOutlook: Record<string, number>;
  /** ISO timestamp of the last save. */
  savedAt: string;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed || !Array.isArray(parsed.stores) || parsed.stores.length === 0) return null;
    return {
      // Merge over a blank store so sessions saved by an older version pick up new fields.
      stores: parsed.stores.map((s) => ({ ...emptyStore(), ...s })),
      brandInventory: parsed.brandInventory ?? {},
      fxRates: parsed.fxRates ?? {},
      brandOutlook: parsed.brandOutlook ?? {},
      savedAt: parsed.savedAt ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

/** Returns the save time, or null if storage isn't available. */
export function saveSession(data: Omit<Session, "savedAt">): string | null {
  try {
    const savedAt = new Date().toISOString();
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...data, savedAt }));
    return savedAt;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing to clear
  }
}
