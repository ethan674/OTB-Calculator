import { useState } from "react";
import { validateSellThroughPct, validateDiscountPct, type FieldValidation } from "@/lib/otb-engine";
import { formatAmount } from "@/lib/format";
import type { CalcStore } from "@/types";

interface AssumptionsTableProps {
  stores: CalcStore[];
  onHandAllocation: Record<string, number>;
  onFieldChange: (storeId: string, field: string, value: number | null) => void;
}

interface ColumnDef {
  key: keyof CalcStore;
  label: string;
  kind: "amount" | "percent";
  validate?: (pct: number) => FieldValidation;
  optional?: boolean;
  /** Locked to 0 and disabled for Outlet stores — they don't receive new-season product. */
  lockedForOutlet?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "currentRemainingReceipts", label: "Incoming Goods (Current)", kind: "amount" },
  { key: "currentDiscountPct", label: "Current Average Discount", kind: "percent", validate: validateDiscountPct },
  { key: "s1OnOrder", label: "Incoming Goods (Next Season)", kind: "amount", lockedForOutlet: true },
  { key: "s1SellThroughPct", label: "Forecast Sell-Through % (Next Season)", kind: "percent", validate: validateSellThroughPct },
  { key: "s1DiscountPct", label: "Forecast Discount % (Next Season)", kind: "percent", validate: validateDiscountPct },
  { key: "s1ManualSosOverride", label: "S1 Manual SOS Override", kind: "amount", optional: true },
  { key: "s2OnOrder", label: "Incoming Goods (Following Season)", kind: "amount", lockedForOutlet: true },
  { key: "s2SellThroughPct", label: "Forecast Sell-Through % (Following Season)", kind: "percent", validate: validateSellThroughPct },
  { key: "s2DiscountPct", label: "Forecast Discount % (Following Season)", kind: "percent", validate: validateDiscountPct },
  { key: "s2ManualSosOverride", label: "S2 Manual SOS Override", kind: "amount", optional: true },
];

function Cell({
  store,
  col,
  onFieldChange,
}: {
  store: CalcStore;
  col: ColumnDef;
  onFieldChange: AssumptionsTableProps["onFieldChange"];
}) {
  const locked = col.lockedForOutlet && store.storeType === "Outlet";
  const rawValue = locked ? 0 : (store[col.key] as number | null);
  const isPercent = col.kind === "percent";
  const displayValue = rawValue === null || rawValue === undefined ? "" : isPercent ? (rawValue * 100).toFixed(1) : String(rawValue);
  const [text, setText] = useState(displayValue);

  const numericForValidation = isPercent ? Number(text) : null;
  const validation: FieldValidation | null =
    col.validate && text !== "" && !Number.isNaN(numericForValidation) ? col.validate(numericForValidation as number) : null;

  function commit(nextText: string) {
    if (nextText.trim() === "") {
      onFieldChange(store.id, col.key, col.optional ? null : 0);
      return;
    }
    const num = Number(nextText);
    if (!Number.isFinite(num)) return;
    const stored = isPercent ? num / 100 : num;
    onFieldChange(store.id, col.key, stored);
  }

  const hasError = validation && validation.errors.length > 0;
  const hasWarning = validation && !hasError && validation.warnings.length > 0;

  return (
    <td className="border-b border-slate-200 p-1">
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={locked ? "0" : text}
          disabled={locked}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => commit(text)}
          placeholder={locked ? "outlet" : col.optional ? "derived" : undefined}
          className={`num-cell w-full min-w-[110px] rounded border px-2 py-1 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
            hasError
              ? "border-red-400 bg-red-50"
              : hasWarning
                ? "border-amber-400 bg-amber-50"
                : "border-slate-200 focus:border-slate-400"
          }`}
        />
        {!locked && (hasError || hasWarning) && (
          <div
            title={[...(validation?.errors ?? []), ...(validation?.warnings ?? [])].join(" ")}
            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${hasError ? "bg-red-500" : "bg-amber-500"}`}
          />
        )}
      </div>
    </td>
  );
}

export function AssumptionsTable({ stores, onHandAllocation, onFieldChange }: AssumptionsTableProps) {
  if (stores.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
        No stores yet. Add one in the Stores tab, or load the sample data.
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-md border border-slate-200" style={{ maxHeight: "70vh" }}>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left align-bottom text-xs font-semibold text-slate-600"
            >
              Store
            </th>
            <th className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100 px-2 py-1 text-center text-xs font-semibold text-slate-500" colSpan={3}>
              Current Season
            </th>
            <th className="sticky top-0 z-20 border-b border-slate-200 bg-blue-50 px-2 py-1 text-center text-xs font-semibold text-blue-700" colSpan={4}>
              Planning Season 1
            </th>
            <th className="sticky top-0 z-20 border-b border-slate-200 bg-emerald-50 px-2 py-1 text-center text-xs font-semibold text-emerald-700" colSpan={4}>
              Planning Season 2
            </th>
          </tr>
          <tr>
            <th className="sticky top-[29px] z-20 min-w-[150px] border-b border-slate-200 bg-white px-2 py-2 text-right text-xs font-semibold text-slate-600">
              Current On-Hand Inv. (SRP Value)
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="sticky top-[29px] z-20 min-w-[110px] border-b border-slate-200 bg-white px-2 py-2 text-right text-xs font-semibold text-slate-600"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stores.map((store, row) => (
            <tr key={store.id} className={row % 2 === 1 ? "bg-slate-50/50" : ""}>
              <td
                className={`sticky left-0 z-10 min-w-[220px] border-b border-r border-slate-200 px-3 py-1.5 align-top ${row % 2 === 1 ? "bg-slate-50" : "bg-white"}`}
              >
                <div className="font-medium text-slate-800">
                  {store.storeName || "(unnamed store)"}
                  {store.storeType === "Outlet" && (
                    <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Outlet</span>
                  )}
                </div>
                <div className="text-xs text-slate-400">
                  {store.market} · {store.currency}
                </div>
              </td>
              <td className="num-cell border-b border-slate-200 bg-slate-50 px-2 py-2 text-slate-600" title="Derived from Brand Inventory tab">
                {formatAmount(onHandAllocation[store.id] ?? 0)}
              </td>
              {COLUMNS.map((c) => (
                <Cell key={c.key} store={store} col={c} onFieldChange={onFieldChange} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
