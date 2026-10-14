import { usePersistedState } from "@/lib/usePersistedState";

interface TabHelpProps {
  /** Stable id: dismissal is remembered per viewer. */
  id: string;
  title: string;
  children: React.ReactNode;
}

/** A short "what to fill in here" note at the top of an input tab; dismissible, and can be brought back. */
export function TabHelp({ id, title, children }: TabHelpProps) {
  const [dismissed, setDismissed] = usePersistedState(`help-dismissed:${id}`, false);

  if (dismissed) {
    return (
      <button onClick={() => setDismissed(false)} className="self-start text-xs text-slate-400 hover:text-slate-600">
        ⓘ Show help for this tab
      </button>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-900">
      <span aria-hidden className="mt-0.5 text-sky-500">ⓘ</span>
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <div className="mt-0.5 text-xs leading-relaxed text-sky-800">{children}</div>
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Dismiss help" className="text-xs text-sky-600 hover:text-sky-900">
        Dismiss
      </button>
    </div>
  );
}
