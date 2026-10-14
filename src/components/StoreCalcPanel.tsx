import { useEffect } from "react";
import { monthsOfCoverFor, type OtbSeasonRow } from "@/lib/results";
import { formatAmount, formatPercent } from "@/lib/format";
import { SEASON_MONTHS } from "@/lib/otb-engine";

interface StoreCalcPanelProps {
  row: OtbSeasonRow;
  seasonLabel: string;
  /** What this season's ending stock has to cover, e.g. "FW27" or "the season after FW27". */
  coverLabel: string;
  onClose: () => void;
}

interface Step {
  label: string;
  /** The arithmetic in words/symbols; shown under the label. */
  how?: string;
  value: string;
  emphasis?: boolean;
  tone?: "red" | "amber";
}

function verdict(r: OtbSeasonRow, seasonLabel: string): { text: string; cls: string } {
  const cur = r.currency;
  if (r.isOutlet) {
    return { text: `Outlets don't place new-season buys. Any need or surplus nets against the full-price stores in this brand and market, so ${seasonLabel} OTB is 0.`, cls: "border-blue-200 bg-blue-50 text-blue-900" };
  }
  if (r.buyLocked) {
    if (r.balance < -0.5) return { text: `Already bought. It holds ${formatAmount(-r.balance)} ${cur} more than its sales need, and that excess carries into next season's starting inventory.`, cls: "border-amber-200 bg-amber-50 text-amber-900" };
    if (r.balance > 0.5) return { text: `Already bought, but ${formatAmount(r.balance)} ${cur} short of what its sales need. There is no open buy to fix it.`, cls: "border-sky-200 bg-sky-50 text-sky-900" };
    return { text: "Already bought, and the stock matches what its sales need.", cls: "border-slate-200 bg-slate-50 text-slate-700" };
  }
  if (r.otb < -0.5) return { text: `Don't buy. It already holds ${formatAmount(-r.otb)} ${cur} more than it needs to hit its target, and stock can't move between full-price stores.`, cls: "border-red-200 bg-red-50 text-red-800" };
  if (r.otb > 0.5) return { text: `Buy ${formatAmount(r.otb)} ${cur} (at retail value) to hit the sell-through target.`, cls: "border-emerald-200 bg-emerald-50 text-emerald-900" };
  return { text: "Nothing to buy: the stock on hand already matches the target.", cls: "border-slate-200 bg-slate-50 text-slate-700" };
}

function buildSteps(r: OtbSeasonRow, coverLabel: string): Step[] {
  const cur = r.currency;
  const money = (v: number) => `${formatAmount(v)} ${cur}`;
  const sosBefore = r.sosInventory + r.transferAdjustment;
  const transferIn = -r.transferAdjustment;
  const steps: Step[] = [
    { label: "Net sales target", how: "From the Monthly Forecast tab", value: money(r.netRevenueTarget) },
    {
      label: "Gross sales needed",
      how: `Target ÷ (1 − ${formatPercent(r.discountPct)} discount): inventory is valued at full retail`,
      value: money(r.grossSalesValue),
      emphasis: true,
    },
    {
      label: "Starting inventory (SoS)",
      how: r.sosOverridden ? "Manual override" : r.sosFloored ? "Roll-forward from last season, floored at 0" : "Last season's ending inventory, before any outlet transfer",
      value: money(sosBefore),
    },
  ];
  if (Math.abs(transferIn) > 0.5) {
    steps.push({
      label: transferIn > 0 ? "Outlet transfer in" : "Outlet transfer out",
      how: transferIn > 0 ? "Stock supplied to this outlet from full-price stores" : "Stock this store supplies to an outlet (or takes back from an outlet's surplus)",
      value: `${transferIn > 0 ? "+" : "−"}${money(Math.abs(transferIn))}`,
    });
  }
  steps.push(
    { label: "Incoming goods", how: r.buyLocked ? "Filled in, so the season is already bought" : "Blank or 0, so the season is still open", value: money(r.onOrder) },
    { label: "Total available", how: "SoS + transfer + incoming goods", value: money(r.totalAvailable), emphasis: true }
  );

  if (r.buyLocked) {
    steps.push({ label: "Target ending inventory", how: "None: a bought season has no sell-through target", value: "—" });
  } else {
    const f = r.forwardGrossSales;
    const st = f + r.targetEosInventory > 0 ? f / (f + r.targetEosInventory) : null;
    steps.push({
      label: "Target ending inventory",
      how: st === null ? "No sales ahead, so nothing needs to be left over" : `${formatPercent(st)} sell-through: leaves enough to cover ${coverLabel}'s ${money(f)} of gross sales (${money(f / SEASON_MONTHS)} a month)`,
      value: money(r.targetEosInventory),
      emphasis: true,
    });
  }

  steps.push({
    label: "Balance",
    how: "Gross sales + target ending inventory − total available",
    value: money(r.balance),
    tone: r.balance < -0.5 ? "amber" : undefined,
  });
  steps.push({
    label: `${r.isOutlet ? "Outlet" : "Store"} OTB`,
    how: r.isOutlet ? "Outlets don't buy: the balance is settled by transfer" : r.buyLocked ? "Already bought, so no OTB is shown" : "The open buy: equals the balance, and can be negative if overstocked",
    value: r.buyLocked || r.isOutlet ? "0" : money(r.otb),
    emphasis: true,
    tone: !r.buyLocked && !r.isOutlet && r.otb < -0.5 ? "red" : undefined,
  });

  const cover = monthsOfCoverFor(r);
  steps.push({
    label: "Forecast ending inventory",
    how: r.buyLocked || r.balance < -0.5 ? "Target ending inventory + any overbought excess. It becomes next season's SoS" : "Target ending inventory. It becomes next season's SoS",
    value: money(r.eosInventory),
  });
  steps.push({
    label: "Months of cover",
    how: `Ending inventory ÷ ${coverLabel}'s average monthly gross sales`,
    value: cover === null ? "—" : `${cover.toFixed(1)} months`,
  });
  return steps;
}

export function StoreCalcPanel({ row, seasonLabel, coverLabel, onClose }: StoreCalcPanelProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const v = verdict(row, seasonLabel);
  const steps = buildSteps(row, coverLabel);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${row.storeName} calculation`}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-medium text-slate-400">{seasonLabel} · how the number was reached</p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-900">{row.storeName}</h2>
            <p className="text-xs text-slate-500">
              {row.brand} · {row.market} · {row.channel} · {row.isOutlet ? "Outlet" : "Full-price"} · {row.currency}
            </p>
          </div>
          <button onClick={onClose} autoFocus aria-label="Close" className="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-4 px-5 py-4">
          <p className={`rounded-md border px-3 py-2 text-sm ${v.cls}`}>{v.text}</p>
          <ol className="flex flex-col">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-start gap-3 border-b border-slate-100 py-2.5 last:border-0">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-500">{i + 1}</span>
                <div className="flex-1">
                  <p className={`text-sm ${s.emphasis ? "font-semibold text-slate-900" : "text-slate-700"}`}>{s.label}</p>
                  {s.how && <p className="mt-0.5 text-xs text-slate-400">{s.how}</p>}
                </div>
                <span
                  className={`num-cell whitespace-nowrap text-sm ${s.emphasis ? "font-semibold" : ""} ${s.tone === "red" ? "text-red-600" : s.tone === "amber" ? "text-amber-700" : "text-slate-800"}`}
                >
                  {s.value}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
