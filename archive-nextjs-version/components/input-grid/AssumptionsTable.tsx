"use client";

import { useState } from "react";
import { validateSellThroughPct, validateDiscountPct, type FieldValidation } from "@/lib/otb-engine";
import type { InputGridStore } from "./InputGridClient";
import type { SaveStatus } from "./useAutosave";

interface AssumptionsTableProps {
  stores: InputGridStore[];
  isAdmin: boolean;
  onFieldChange: (storeId: string, field: string, value: number | null) => void;
  status: Record<string, SaveStatus>;
}

interface ColumnDef {
  key: keyof InputGridStore;
  label: string;
  kind: "amount" | "percent";
  validate?: (pct: number) => FieldValidation;
  adminOnly?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "currentOnHandInventory", label: "Current On-Hand Inv.", kind: "amount" },
  { key: "currentRemainingReceipts", label: "Remaining Receipts", kind: "amount" },
  { key: "currentDiscountPct", label: "Current Discount %", kind: "percent", validate: validateDiscountPct },
  { key: "s1SellThroughPct", label: "S1 Sell-Through %", kind: "percent", validate: validateSellThroughPct },
  { key: "s1DiscountPct", label: "S1 Discount %", kind: "percent", validate: validateDiscountPct },
  { key: "s1OnOrder", label: "S1 On-Order", kind: "amount" },
  { key: "s1ManualSosOverride", label: "S1 Manual SOS Override", kind: "amount", adminOnly: true },
  { key: "s2SellThroughPct", label: "S2 Sell-Through %", kind: "percent", validate: validateSellThroughPct },
  { key: "s2DiscountPct", label: "S2 Discount %", kind: "percent", validate: validateDiscountPct },
  { key: "s2OnOrder", label: "S2 On-Order", kind: "amount" },
  { key: "s2ManualSosOverride", label: "S2 Manual SOS Override", kind: "amount", adminOnly: true },
];

function Cell({
  store,
  col,
  onFieldChange,
}: {
  store: InputGridStore;
  col: ColumnDef;
  onFieldChange: AssumptionsTableProps["onFieldChange"];
}) {
  const rawValue = store[col.key] as number | null;
  const isPercent = col.kind === "percent";
  const displayValue = rawValue === null || rawValue === undefined ? "" : isPercent ? (rawValue * 100).toFixed(1) : String(rawValue);
  const [text, setText] = useState(displayValue);
  const [touched, setTouched] = useState(false);

  const numericForValidation = isPercent ? Number(text) : null;
  const validation: FieldValidation | null =
    col.validate && text !== "" && !Number.isNaN(numericForValidation) ? col.validate(numericForValidation as number) : null;

  function commit(nextText: string) {
    if (nextText.trim() === "") {
      onFieldChange(store.storeId, col.key, col.adminOnly ? null : 0);
      return;
    }
    const num = Number(nextText);
    if (!Number.isFinite(num)) return;
    const stored = isPercent ? num / 100 : num;
    onFieldChange(store.storeId, col.key, stored);
  }

  const hasError = validation && validation.errors.length > 0;
  const hasWarning = validation && !hasError && validation.warnings.length > 0;

  return (
    <td className="border-b border-slate-200 p-1">
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          disabled={store.locked}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setTouched(true)}
          onBlur={() => commit(text)}
          placeholder={col.adminOnly ? "derived" : undefined}
          className={`num-cell w-full min-w-[110px] rounded border px-2 py-1 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
            hasError
              ? "border-red-400 bg-red-50"
              : hasWarning
                ? "border-amber-400 bg-amber-50"
                : "border-slate-200 focus:border-slate-400"
          }`}
        />
        {isPercent && <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 text-xs text-slate-400">%</span>}
        {touched && (hasError || hasWarning) && (
          <div
            title={[...(validation?.errors ?? []), ...(validation?.warnings ?? [])].join(" ")}
            className={`absolute -right-1 -top-1 h-2 w-2 rounded-full ${hasError ? "bg-red-500" : "bg-amber-500"}`}
          />
        )}
      </div>
    </td>
  );
}

export function AssumptionsTable({ stores, isAdmin, onFieldChange, status }: AssumptionsTableProps) {
  const columns = COLUMNS.filter((c) => !c.adminOnly || isAdmin);

  return (
    <div className="overflow-auto rounded-md border border-slate-200" style={{ maxHeight: "70vh" }}>
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600">
              Store
            </th>
            {columns.map((c) => (
              <th
                key={c.key}
                className="sticky top-0 z-20 min-w-[110px] border-b border-slate-200 bg-white px-2 py-2 text-right text-xs font-semibold text-slate-600"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stores.map((store, row) => (
            <tr key={store.storeId} className={row % 2 === 1 ? "bg-slate-50/50" : ""}>
              <td className="sticky left-0 z-10 min-w-[220px] border-b border-r border-slate-200 bg-inherit px-3 py-1.5 align-top">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-800">{store.storeName}</span>
                  {status[store.storeId] === "saving" && <span className="text-[10px] text-slate-400">saving…</span>}
                  {status[store.storeId] === "saved" && <span className="text-[10px] text-emerald-600">saved</span>}
                  {status[store.storeId] === "error" && <span className="text-[10px] text-red-600">error</span>}
                </div>
                <div className="text-xs text-slate-400">
                  {store.storeCode} · {store.currency}
                  {store.locked && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">locked</span>}
                </div>
              </td>
              {columns.map((c) => (
                <Cell key={c.key} store={store} col={c} onFieldChange={onFieldChange} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
