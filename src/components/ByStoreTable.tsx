import { useMemo, useState } from "react";
import type { OtbSeasonRow } from "@/lib/results";
import { formatAmount, formatPercent } from "@/lib/format";

interface ByStoreTableProps {
  rows: OtbSeasonRow[];
}

type SortKey = keyof Pick<
  OtbSeasonRow,
  | "storeName"
  | "netRevenueTarget"
  | "discountValue"
  | "grossSalesValue"
  | "sosInventory"
  | "onOrder"
  | "sellThroughPct"
  | "targetEosInventory"
  | "otb"
>;

const COLUMNS: { key: SortKey; label: string; kind: "text" | "amount" | "percent" }[] = [
  { key: "storeName", label: "Store", kind: "text" },
  { key: "netRevenueTarget", label: "Target", kind: "amount" },
  { key: "discountValue", label: "Discount Value", kind: "amount" },
  { key: "grossSalesValue", label: "Gross", kind: "amount" },
  { key: "sosInventory", label: "SoS Inv", kind: "amount" },
  { key: "onOrder", label: "Incoming Goods", kind: "amount" },
  { key: "sellThroughPct", label: "Sell-Through", kind: "percent" },
  { key: "targetEosInventory", label: "EoS Inv", kind: "amount" },
  { key: "otb", label: "Store OTB", kind: "amount" },
];

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-slate-600">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ByStoreTable({ rows }: ByStoreTableProps) {
  const [brandFilter, setBrandFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("storeName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const brands = useMemo(() => Array.from(new Set(rows.map((r) => r.brand))).sort(), [rows]);
  const channels = useMemo(() => Array.from(new Set(rows.map((r) => r.channel))).sort(), [rows]);
  const markets = useMemo(() => Array.from(new Set(rows.map((r) => r.market))).sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!brandFilter || r.brand === brandFilter) &&
          (!channelFilter || r.channel === channelFilter) &&
          (!marketFilter || r.market === marketFilter)
      ),
    [rows, brandFilter, channelFilter, marketFilter]
  );

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Brand" value={brandFilter} options={brands} onChange={setBrandFilter} />
        <FilterSelect label="Channel" value={channelFilter} options={channels} onChange={setChannelFilter} />
        <FilterSelect label="Market" value={marketFilter} options={markets} onChange={setMarketFilter} />
        <span className="text-xs text-slate-400">{sorted.length} stores</span>
      </div>
      <div className="overflow-auto rounded-md border border-slate-200" style={{ maxHeight: "65vh" }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`sticky top-0 z-10 cursor-pointer select-none border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 ${
                    c.kind === "text" ? "text-left" : "text-right"
                  }`}
                >
                  {c.label}
                  {sortKey === c.key && (sortDir === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Currency
              </th>
              <th className="sticky top-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">
                Flag
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.storeId} className={r.overbought ? "bg-red-50" : i % 2 === 1 ? "bg-slate-50/50" : ""}>
                <td className="border-b border-slate-100 px-3 py-1.5 font-medium text-slate-800">
                  {r.storeName}
                  {r.isOutlet && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Outlet</span>}
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.netRevenueTarget)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.discountValue)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.grossSalesValue)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                  {formatAmount(r.sosInventory)}
                  {r.sosOverridden && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] text-purple-700">override</span>}
                  {r.sosFloored && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">floored</span>}
                  {r.transferAdjustment !== 0 && (
                    <span
                      className="ml-1 rounded bg-teal-100 px-1 text-[10px] text-teal-700"
                      title={
                        r.transferAdjustment > 0
                          ? `${formatAmount(r.transferAdjustment)} transferred to an outlet in this brand+market`
                          : `${formatAmount(-r.transferAdjustment)} received via transfer from full-price stores`
                      }
                    >
                      transfer
                    </span>
                  )}
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.onOrder)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatPercent(r.sellThroughPct)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.targetEosInventory)}</td>
                <td
                  className={`num-cell border-b border-slate-100 px-3 py-1.5 font-semibold ${r.otb < 0 ? "text-red-600" : "text-slate-900"}`}
                >
                  {formatAmount(r.otb)}
                </td>
                <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{r.currency}</td>
                <td className="border-b border-slate-100 px-3 py-1.5">
                  {r.overbought && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Overbought</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
