const LEGEND_ITEMS: { label: string; className: string; description: string }[] = [
  { label: "Outlet", className: "bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-700", description: "doesn't buy new-season product — stock needed to operate is covered by transfer instead" },
  { label: "transfer", className: "bg-teal-100 px-1 text-teal-700", description: "SoS/OTB adjusted to net an outlet's need or surplus against full-price stores in the same brand+market group" },
  { label: "floored", className: "bg-amber-100 px-1 text-amber-700", description: "projected inventory would go negative given the sell-down assumptions — shown as 0" },
  { label: "override", className: "bg-purple-100 px-1 text-purple-700", description: "a manual SOS override is in use instead of the derived roll-forward value" },
  { label: "Overbought", className: "bg-red-100 px-1.5 py-0.5 font-semibold text-red-700", description: "negative OTB — more stock on hand and on order than the plan needs" },
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
