import { useCallback, useState } from "react";

/** useState backed by localStorage, for per-viewer UI preferences (collapsed sections, column preset, dismissed tips). */
export function usePersistedState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`otb-calculator:ui:${key}`);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(`otb-calculator:ui:${key}`, JSON.stringify(next));
      } catch {
        // preference just won't persist
      }
    },
    [key]
  );
  return [value, set];
}
