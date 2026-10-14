import type { AttentionItem, AttentionKind } from "@/lib/attention";
import { formatAmount } from "@/lib/format";

interface NeedsAttentionProps {
  items: AttentionItem[];
  onOpenStore: (storeId: string) => void;
}

const GROUPS: { kind: AttentionKind; title: string; hint: string; chip: string }[] = [
  {
    kind: "negative",
    title: "Overstocked — negative OTB",
    hint: "Holds more than it needs; stock can't move between full-price stores, so don't buy for it.",
    chip: "border-red-200 bg-red-50 text-red-700",
  },
  {
    kind: "overbought",
    title: "Overbought",
    hint: "Bought more than its sales need; the excess carries into next season's SoS.",
    chip: "border-amber-200 bg-amber-50 text-amber-800",
  },
  {
    kind: "short",
    title: "Bought but short",
    hint: "Incoming goods won't cover the sales target — a risk of lost sales, with no open buy to fix it.",
    chip: "border-sky-200 bg-sky-50 text-sky-800",
  },
];

export function NeedsAttention({ items, onOpenStore }: NeedsAttentionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        ✓ Nothing needs attention — no overstocked, overbought, or short full-price stores this season.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5">
      <h3 className="text-sm font-semibold text-slate-700">Needs attention</h3>
      {GROUPS.map((g) => {
        const rows = items.filter((i) => i.kind === g.kind);
        if (rows.length === 0) return null;
        return (
          <div key={g.kind} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="min-w-[11rem] text-xs font-medium text-slate-600" title={g.hint}>
              {g.title}
            </span>
            {rows.map((i) => (
              <button
                key={i.storeId}
                onClick={() => onOpenStore(i.storeId)}
                title={`${g.hint} Click for the calculation.`}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium hover:brightness-95 ${g.chip}`}
              >
                {i.storeName} · {formatAmount(i.amount)} {i.currency}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}
