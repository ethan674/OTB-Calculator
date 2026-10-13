const LEGEND_ITEMS: { label: string; className: string; description: string }[] = [
  { label: "Outlet", className: "bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700", description: "doesn't buy new-season product — stock needed to operate is covered by transfer instead" },
  { label: "Transfer", className: "bg-teal-100 px-1 text-teal-700", description: "stock moved in (+) or out (−) of a store so an outlet's need or surplus nets against full-price stores in the same brand+market group; SoS Inv is shown before it, Total Available after" },
  { label: "floored", className: "bg-amber-100 px-1 text-amber-700", description: "projected inventory would go negative given the sell-down assumptions — shown as 0" },
  { label: "Months Cover", className: "bg-sky-100 px-1.5 py-0.5 font-medium text-sky-700", description: "forecast EoS ÷ next season's average monthly gross sales — how long the ending stock lasts into the next season (open seasons only)" },
  { label: "bought", className: "bg-slate-100 px-1.5 py-0.5 font-medium text-slate-500", description: "incoming goods are filled in, so the season is already bought for — no OTB is shown" },
  { label: "override", className: "bg-purple-100 px-1 text-purple-700", description: "a manual SOS override is in use instead of the derived roll-forward value" },
  { label: "Overbought", className: "bg-red-100 px-1.5 py-0.5 font-semibold text-red-700", description: "holding more stock (on hand + on order) than the sales target needs; the excess stays in EoS Inv and carries into next season's SoS" },
];

export function BadgeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
      <span className="font-medium text-slate-600">Flags:</span>
      {LEGEND_ITEMS.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className={`rounded text-[10px] ${item.className}`}>{item.label}</span>
          {item.description}
        </span>
      ))}
    </div>
  );
}
