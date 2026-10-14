import type { SetupStep, SetupTab } from "@/lib/setup";

interface SetupChecklistProps {
  steps: SetupStep[];
  hasStores: boolean;
  onGo: (tab: SetupTab) => void;
  onLoadSample: () => void;
}

const MARK: Record<SetupStep["state"], { icon: string; cls: string }> = {
  done: { icon: "✓", cls: "bg-emerald-100 text-emerald-700" },
  warn: { icon: "!", cls: "bg-amber-100 text-amber-700" },
  todo: { icon: "", cls: "border border-slate-300 bg-white text-slate-400" },
};

export function SetupChecklist({ steps, hasStores, onGo, onLoadSample }: SetupChecklistProps) {
  const done = steps.filter((s) => s.state === "done").length;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{hasStores ? "Setup checklist" : "Get started"}</h2>
          <p className="text-xs text-slate-500">
            {hasStores ? `${done} of ${steps.length} steps look complete.` : "Five steps from a blank page to your OTB. Your work autosaves in this browser."}
          </p>
        </div>
        {!hasStores && (
          <button onClick={onLoadSample} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            Try it with sample data
          </button>
        )}
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s, i) => (
          <li key={s.tab}>
            <button
              onClick={() => onGo(s.tab)}
              className="flex h-full w-full items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-left hover:border-slate-400 hover:bg-slate-50"
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${MARK[s.state].cls}`}>
                {MARK[s.state].icon || i + 1}
              </span>
              <span>
                <span className="block text-sm font-medium text-slate-800">{s.label}</span>
                <span className="block text-xs text-slate-500">{s.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
