import { useMemo, useState } from "react";
import { usePersistedState } from "@/lib/usePersistedState";
import { monthsOfCoverFor, type OtbSeasonRow } from "@/lib/results";
import { formatAmount, formatPercent } from "@/lib/format";
import { SEASON_MONTHS } from "@/lib/otb-engine";

interface ByStoreTableProps {
  rows: OtbSeasonRow[];
  /** Opens the step-by-step calculation for a store. */
  onOpenStore: (storeId: string) => void;
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
  if (key === "monthsCover") return monthsOfCoverFor(r) ?? -1; // no forward demand sorts last ascending
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

interface ColumnDef {
  key: SortKey;
  label: string;
  kind: "text" | "amount" | "percent";
  /** Shown in the "Essentials" preset. */
  essential?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "storeName", label: "Store", kind: "text", essential: true },
  { key: "netRevenueTarget", label: "Target", kind: "amount", essential: true },
  { key: "discountValue", label: "Discount Value", kind: "amount" },
  { key: "grossSalesValue", label: "Gross", kind: "amount" },
  { key: "sosInventory", label: "SoS Inv", kind: "amount" },
  { key: "transferAdjustment", label: "Transfer In/(Out)", kind: "amount" },
  { key: "onOrder", label: "Incoming Goods", kind: "amount" },
  { key: "totalAvailable", label: "Total Available", kind: "amount", essential: true },
  { key: "sellThroughPct", label: "Sell-Through", kind: "percent" },
  { key: "eosInventory", label: "EoS Inv", kind: "amount", essential: true },
  { key: "monthsCover", label: "Months Cover", kind: "amount", essential: true },
  { key: "otb", label: "Store OTB", kind: "amount", essential: true },
];

/** Opaque row backgrounds, so the frozen columns can match their row while content scrolls underneath. */
function rowTone(r: OtbSeasonRow): string {
  if (!r.isOutlet && !r.buyLocked && r.otb < -0.5) return "bg-red-50";
  if (r.overbought) return "bg-amber-50";
  if (r.isOutlet) return "bg-blue-50";
  if (r.buyLocked) return "bg-slate-100";
  return "bg-white";
}

const STICKY_LEFT = "sticky left-0 z-10 shadow-[1px_0_0_0_#e2e8f0]";
const STICKY_RIGHT = "sticky right-0 z-10 shadow-[-1px_0_0_0_#e2e8f0]";

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

const NUM = "num-cell border-b border-slate-100 px-3 py-1.5";

export function ByStoreTable({ rows, onOpenStore }: ByStoreTableProps) {
  const [brandFilter, setBrandFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("storeName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [preset, setPreset] = usePersistedState<"essentials" | "full">("bystore-preset", "full");

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

  const columns = preset === "essentials" ? COLUMNS.filter((c) => c.essential) : COLUMNS;
  const show = (key: SortKey) => columns.some((c) => c.key === key);
  const full = preset === "full";

  // Totals only make sense in one currency; the summary cards above convert mixed currencies to USD.
  const singleCurrency = sorted.length > 0 && sorted.every((r) => r.currency === sorted[0].currency);
  const sum = (f: (r: OtbSeasonRow) => number) => sorted.reduce((t, r) => t + f(r), 0);
  const totalEos = sum((r) => r.eosInventory);
  const totalForward = sum((r) => r.forwardGrossSales);
  const totals: Partial<Record<SortKey, React.ReactNode>> = singleCurrency
    ? {
        netRevenueTarget: formatAmount(sum((r) => r.netRevenueTarget)),
        discountValue: formatAmount(sum((r) => r.discountValue)),
        grossSalesValue: formatAmount(sum((r) => r.grossSalesValue)),
        sosInventory: formatAmount(sum(sosBeforeTransfer)),
        transferAdjustment: formatAmount(sum(transferInOut)),
        onOrder: formatAmount(sum((r) => r.onOrder)),
        totalAvailable: formatAmount(sum((r) => r.totalAvailable)),
        eosInventory: formatAmount(totalEos),
        monthsCover: totalForward > 0 ? (totalEos / (totalForward / SEASON_MONTHS)).toFixed(1) : "—",
        otb: formatAmount(sum((r) => r.otb)),
      }
    : {};

  const TotalsCells = ({ tone, bottom }: { tone: string; bottom?: boolean }) => {
    const pin = bottom ? " bottom-0" : "";
    return (
    <>
      {columns.map((c) =>
        c.key === "storeName" ? (
          <td key={c.key} className={`${STICKY_LEFT}${bottom ? " z-30" : ""}${pin} border-b border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 ${tone}`}>
            Total{singleCurrency ? ` (${sorted[0].currency})` : ""}
          </td>
        ) : (
          <td
            key={c.key}
            className={`num-cell border-b border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 ${tone} ${c.key === "otb" ? STICKY_RIGHT + (bottom ? " bottom-0 z-30" : "") : bottom ? "sticky bottom-0 z-20" : ""}`}
          >
            {totals[c.key] ?? <span className="text-slate-300">—</span>}
          </td>
        )
      )}
      {full && <td className={`border-b border-slate-200 ${tone}${bottom ? " sticky bottom-0 z-20" : ""}`} colSpan={2} />}
    </>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <FilterSelect label="Brand" value={brandFilter} options={brands} onChange={setBrandFilter} />
        <FilterSelect label="Channel" value={channelFilter} options={channels} onChange={setChannelFilter} />
        <FilterSelect label="Market" value={marketFilter} options={markets} onChange={setMarketFilter} />
        <span className="text-xs text-slate-400">{sorted.length} stores</span>
        <div className="ml-auto flex items-center gap-1 rounded-md bg-slate-100 p-0.5 text-xs" role="group" aria-label="Columns">
          {(["essentials", "full"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              aria-pressed={preset === p}
              className={`rounded px-2.5 py-1 font-medium ${preset === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              {p === "essentials" ? "Essentials" : "Full detail"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
        <span className="font-medium text-slate-600">Rows:</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-red-200 bg-red-50" />overstocked (negative OTB)</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-amber-200 bg-amber-50" />overbought</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-slate-300 bg-slate-100" />already bought</span>
        <span className="inline-flex items-center gap-1"><i className="h-2.5 w-2.5 rounded-sm border border-blue-200 bg-blue-50" />outlet</span>
        <span className="text-slate-400">· click a store for its calculation</span>
      </div>
      <div className="overflow-auto rounded-md border border-slate-200" style={{ maxHeight: "65vh" }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={`sticky top-0 cursor-pointer select-none border-b border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 ${
                    c.kind === "text" ? "text-left" : "text-right"
                  } ${c.key === "storeName" ? "left-0 z-30 shadow-[1px_0_0_0_#e2e8f0]" : c.key === "otb" ? "right-0 z-30 shadow-[-1px_0_0_0_#e2e8f0]" : "z-20"}`}
                >
                  {c.label}
                  {sortKey === c.key && (sortDir === "asc" ? " ▲" : " ▼")}
                </th>
              ))}
              {full && (
                <>
                  <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Currency</th>
                  <th className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">Flag</th>
                </>
              )}
            </tr>
            {sorted.length > 0 && (
              <tr>
                <TotalsCells tone="bg-slate-100" />
              </tr>
            )}
          </thead>
          <tbody>
            {sorted.map((r) => {
              const tone = rowTone(r);
              return (
                <tr key={r.storeId} className={tone}>
                  <td className={`${STICKY_LEFT} border-b border-slate-100 px-3 py-1.5 font-medium text-slate-800 ${tone}`}>
                    <button
                      onClick={() => onOpenStore(r.storeId)}
                      title="Show how this number was calculated"
                      className="text-left hover:underline hover:decoration-slate-400"
                    >
                      {r.storeName}
                    </button>
                    {r.isOutlet && <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Outlet</span>}
                  </td>
                  {show("netRevenueTarget") && <td className={NUM}>{formatAmount(r.netRevenueTarget)}</td>}
                  {show("discountValue") && <td className={NUM}>{formatAmount(r.discountValue)}</td>}
                  {show("grossSalesValue") && <td className={NUM}>{formatAmount(r.grossSalesValue)}</td>}
                  {show("sosInventory") && (
                    <td className={NUM}>
                      {formatAmount(sosBeforeTransfer(r))}
                      {r.sosOverridden && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] text-purple-700">override</span>}
                      {r.sosFloored && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">floored</span>}
                    </td>
                  )}
                  {show("transferAdjustment") && (
                    <td
                      className={`${NUM} ${transferInOut(r) > 0 ? "text-teal-700" : ""}`}
                      title={r.transferAdjustment !== 0 ? transferTooltip(r) : undefined}
                    >
                      {r.transferAdjustment !== 0 ? formatAmount(transferInOut(r)) : <span className="text-slate-300">—</span>}
                    </td>
                  )}
                  {show("onOrder") && <td className={NUM}>{formatAmount(r.onOrder)}</td>}
                  {show("totalAvailable") && <td className={NUM}>{formatAmount(r.totalAvailable)}</td>}
                  {show("sellThroughPct") && (
                    <td
                      className={NUM}
                      title={r.buyLocked ? "Buy locked (incoming goods filled in) — derived from the stock held" : "Open buy — derived; OTB is sized to the target sell-through"}
                    >
                      {formatPercent(r.sellThroughPct)}
                    </td>
                  )}
                  {show("eosInventory") && (
                    <td className={NUM} title={eosTooltip(r)}>
                      {formatAmount(r.eosInventory)}
                    </td>
                  )}
                  {show("monthsCover") && (
                    <td
                      className={NUM}
                      title={
                        monthsOfCoverFor(r) === null
                          ? undefined
                          : `EoS ÷ next season's average monthly gross sales (${formatAmount(r.forwardGrossSales / SEASON_MONTHS)})`
                      }
                    >
                      {monthsOfCoverFor(r) === null ? <span className="text-slate-300">—</span> : monthsOfCoverFor(r)!.toFixed(1)}
                    </td>
                  )}
                  <td className={`${STICKY_RIGHT} ${NUM} font-semibold ${tone} ${r.otb < 0 ? "text-red-600" : "text-slate-900"}`}>
                    {r.buyLocked ? (
                      <span
                        className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200"
                        title="Incoming goods are filled in, so this season is already bought for — no OTB"
                      >
                        bought
                      </span>
                    ) : (
                      formatAmount(r.otb)
                    )}
                  </td>
                  {full && (
                    <>
                      <td className="border-b border-slate-100 px-3 py-1.5 text-slate-600">{r.currency}</td>
                      <td className="border-b border-slate-100 px-3 py-1.5">
                        {r.overbought && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">Overbought</span>}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
          {sorted.length > 0 && (
            <tfoot>
              <tr>
                <TotalsCells tone="bg-slate-100" bottom />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!singleCurrency && sorted.length > 0 && (
        <p className="text-xs text-slate-400">Totals are hidden because these stores use more than one currency. The summary cards above convert to USD.</p>
      )}
    </div>
  );
}
