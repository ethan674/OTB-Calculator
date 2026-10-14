import { usePersistedState } from "@/lib/usePersistedState";

interface CollapsibleProps {
  /** Stable id: the open/closed choice is remembered per viewer. */
  id: string;
  title: React.ReactNode;
  /** One line shown next to the title while collapsed, e.g. a headline number. */
  hint?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Collapsible({ id, title, hint, defaultOpen = true, children }: CollapsibleProps) {
  const [open, setOpen] = usePersistedState(`open:${id}`, defaultOpen);
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex items-center gap-2 text-left text-sm font-semibold text-slate-700 hover:text-slate-900"
      >
        <span className={`inline-block text-[10px] text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
        {title}
        {!open && hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
      </button>
      {open && children}
    </section>
  );
}
