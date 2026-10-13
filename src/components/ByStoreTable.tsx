import { useMemo, useState } from "react";
import { monthsOfCoverFor, type OtbSeasonRow } from "@/lib/results";
import { formatAmount, formatPercent } from "@/lib/format";
import { SEASON_MONTHS } from "@/lib/otb-engine";

interface ByStoreTableProps {
  rows: OtbSeasonRow[];
}

function eosTooltip(r: OtbSeasonRow): string | undefined {
  const excess = Math.max(0, r.eosInventory - r.targetEosInventory);
  if (excess > 0.005) {
    const target = r.targetEosInventory > 0.005 ? `Target ${formatAmount(r.targetEosInventory)} + ` : "";
    return `${target}${formatAmount(excess)} overbought excess — carries into next season's SoS`;
  }
  if (r.targetEosInventory > 0.005) return "Target ending inventory the open buy is sized to reach";
  return undefined;
}

function sortValue(r: OtbSeasonRow, key: SortKey): string | number {
  if (key === "sosInventory") return sosBeforeTransfer(r);
  if (key === "transferAdjustment") return transferInOut(r);
  if (key === "monthsCover") return monthsOfCoverFor(r) ?? -1; // bought seasons sort last ascending
  return r[key];
}

function transferTooltip(r: OtbSeasonRow): string {
  const amount = formatAmount(Math.abs(r.transferAdjustment));
  if (r.isOutlet) {
    return r.transferAdjustment < 0
      ? `${amount} received via transfer from full-price stores`
      : `${amount} surplus credited back to full-price stores in this brand+market`;
  }
  return r.transferAdjustment > 0
    ? `${amount} supplied to a needy outlet in this brand+market`
    : `${amount} credited from an outlet's surplus in this brand+market`;
}

/**
 * SoS is shown before any outlet transfer, so it ties back to last season's
 * EoS; the transfer has its own column. A row's stored SoS is after the
 * transfer, and transferAdjustment is the amount that moved out (full-price
 * supplier, +) or in (outlet, −) — so adding it back gives the pre-transfer SoS.
 */
function sosBeforeTransfer(r: OtbSeasonRow): number {
  return r.sosInventory + r.transferAdjustment;
}

/** Stock moved in (+) or out (−) of this store by the transfer: the effect on SoS. */
function transferInOut(r: OtbSeasonRow): number {
  return -r.transferAdjustment;
}

type SortKey = keyof Pick<
  OtbSeasonRow,
  | "storeName"
  | "netRevenueTarget"
  | "discountValue"
  | "grossSalesValue"
  | "sosInventory"
  | "transferAdjustment"
  | "onOrder"
  | "totalAvailable"
  | "sellThroughPct"
  | "eosInventory"
  | "otb"
> | "monthsCover";

const COLUMNS: { key: SortKey; label: string; kind: "text" | "amount" | "percent" }[] = [
  { key: "storeName", label: "Store", kind: "text" },
  { key: "netRevenueTarget", label: "Target", kind: "amount" },
  { key: "discountValue", label: "Discount Value", kind: "amount" },
  { key: "grossSalesValue", label: "Gross", kind: "amount" },
  { key: "sosInventory", label: "SoS Inv", kind: "amount" },
  { key: "transferAdjustment", label: "Transfer In/(Out)", kind: "amount" },
  { key: "onOrder", label: "Incoming Goods", kind: "amount" },
  { key: "totalAvailable", label: "Total Available", kind: "amount" },
  { key: "sellThroughPct", label: "Sell-Through", kind: "percent" },
  { key: "eosInventory", label: "EoS Inv", kind: "amount" },
  { key: "monthsCover", label: "Months Cover", kind: "amount" },
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
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
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
                  {formatAmount(sosBeforeTransfer(r))}
                  {r.sosOverridden && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] text-purple-700">override</span>}
                  {r.sosFloored && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">floored</span>}
                </td>
                <td
                  className={`num-cell border-b border-slate-100 px-3 py-1.5 ${transferInOut(r) > 0 ? "text-teal-700" : ""}`}
                  title={r.transferAdjustment !== 0 ? transferTooltip(r) : undefined}
                >
                  {r.transferAdjustment !== 0 ? formatAmount(transferInOut(r)) : <span className="text-slate-300">—</span>}
                </td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.onOrder)}</td>
                <td className="num-cell border-b border-slate-100 px-3 py-1.5">{formatAmount(r.totalAvailable)}</td>
                <td
                  className="num-cell border-b border-slate-100 px-3 py-1.5"
                  title={r.buyLocked ? "Buy locked (incoming goods filled in) — derived from the stock held" : "Open buy — derived; OTB is sized to the target sell-through"}
                >
                  {formatPercent(r.sellThroughPct)}
                </td>
                <td
                  className="num-cell border-b border-slate-100 px-3 py-1.5"
                  title={eosTooltip(r)}
                >
                  {formatAmount(r.eosInventory)}
                </td>
                <td
                  className="num-cell border-b border-slate-100 px-3 py-1.5"
                  title={
                    monthsOfCoverFor(r) === null
                      ? undefined
                      : `EoS ÷ next season's average monthly gross sales (${formatAmount(r.forwardGrossSales / SEASON_MONTHS)})`
                  }
                >
                  {monthsOfCoverFor(r) === null ? <span className="text-slate-300">—</span> : monthsOfCoverFor(r)!.toFixed(1)}
                </td>
                <td
                  className={`num-cell border-b border-slate-100 px-3 py-1.5 font-semibold ${r.otb < 0 ? "text-red-600" : "text-slate-900"}`}
                >
                  {r.buyLocked ? (
                    <span
                      className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                      title="Incoming goods are filled in, so this season is already bought for — no OTB"
                    >
                      bought
                    </span>
                  ) : (
                    formatAmount(r.otb)
                  )}
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
