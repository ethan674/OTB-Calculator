import { useRef } from "react";
import type { HorizonMonth } from "@/lib/otb-engine";
import type { CalcStore } from "@/types";

interface ForecastGridProps {
  stores: CalcStore[];
  horizon: HorizonMonth[];
  onCellChange: (storeId: string, monthKey: string, value: number) => void;
}

function parseNumberInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (cleaned === "" || cleaned === "-") return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

const BUCKET_LABEL: Record<HorizonMonth["bucket"], string> = {
  current: "Current (roll-forward only)",
  planning1: "Planning Season 1",
  planning2: "Planning Season 2",
};

const BUCKET_CLASS: Record<HorizonMonth["bucket"], string> = {
  current: "bg-slate-100 text-slate-500",
  planning1: "bg-blue-50 text-blue-700",
  planning2: "bg-emerald-50 text-emerald-700",
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function ForecastGrid({ stores, horizon, onCellChange }: ForecastGridProps) {
  const cellRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  function key(row: number, col: number) {
    return `${row}:${col}`;
  }

  function focusCell(row: number, col: number) {
    if (row < 0 || row >= stores.length || col < 0 || col >= horizon.length) return;
    const el = cellRefs.current.get(key(row, col));
    el?.focus();
    el?.select();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        focusCell(row + 1, col);
        break;
      case "ArrowUp":
        e.preventDefault();
        focusCell(row - 1, col);
        break;
      case "ArrowLeft":
        if ((e.target as HTMLInputElement).selectionStart === 0) {
          e.preventDefault();
          focusCell(row, col - 1);
        }
        break;
      case "ArrowRight": {
        const input = e.target as HTMLInputElement;
        if (input.selectionEnd === input.value.length) {
          e.preventDefault();
          focusCell(row, col + 1);
        }
        break;
      }
      case "Enter":
        e.preventDefault();
        focusCell(e.shiftKey ? row - 1 : row + 1, col);
        break;
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, row: number, col: number) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.includes("\t") && !text.includes("\n")) return; // let default single-value paste happen
    e.preventDefault();

    const rows = text.split(/\r\n|\n|\r/).filter((_, i, arr) => !(i === arr.length - 1 && arr[i] === ""));
    rows.forEach((line, ri) => {
      const cells = line.split("\t");
      cells.forEach((cellText, ci) => {
        const targetRow = row + ri;
        const targetCol = col + ci;
        if (targetRow >= stores.length || targetCol >= horizon.length) return;
        const store = stores[targetRow];
        const value = parseNumberInput(cellText);
        if (value !== null) {
          // Inputs are uncontrolled for smooth typing, so pasted cells that
          // aren't the currently-focused one need their DOM value set
          // directly — React state alone won't re-render them.
          const el = cellRefs.current.get(key(targetRow, targetCol));
          if (el) el.value = String(value);
          onCellChange(store.id, horizon[targetCol].monthKey, value);
        }
      });
    });
  }

  // group horizon months into contiguous season buckets for the header
  const seasonGroups: { bucket: HorizonMonth["bucket"]; label: string; start: number; count: number }[] = [];
  horizon.forEach((m, i) => {
    const last = seasonGroups[seasonGroups.length - 1];
    if (last && last.bucket === m.bucket) {
      last.count += 1;
    } else {
      seasonGroups.push({ bucket: m.bucket, label: BUCKET_LABEL[m.bucket], start: i, count: 1 });
    }
  });

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
            <th className="sticky left-0 top-0 z-30 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left" />
            {seasonGroups.map((g, gi) => (
              <th
                key={gi}
                colSpan={g.count}
                className={`sticky top-0 z-20 border-b border-slate-200 px-2 py-1 text-center text-xs font-semibold ${BUCKET_CLASS[g.bucket]}`}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            <th className="sticky left-0 top-[29px] z-30 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600">
              Store
            </th>
            {horizon.map((m) => (
              <th
                key={m.monthKey}
                className="sticky top-[29px] z-20 min-w-[92px] border-b border-slate-200 bg-white px-2 py-2 text-right text-xs font-semibold text-slate-600"
              >
                {MONTH_NAMES[m.month - 1]} {String(m.year).slice(2)}
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
                <div className="font-medium text-slate-800">{store.storeName || "(unnamed store)"}</div>
                <div className="text-xs text-slate-400">
                  {store.market} · {store.currency}
                </div>
              </td>
              {horizon.map((m, col) => {
                const value = store.monthlyForecast[m.monthKey];
                return (
                  <td key={m.monthKey} className={`border-b border-slate-200 p-0 ${BUCKET_CLASS[m.bucket]} bg-opacity-30`}>
                    <input
                      ref={(el) => {
                        if (el) cellRefs.current.set(key(row, col), el);
                        else cellRefs.current.delete(key(row, col));
                      }}
                      type="text"
                      inputMode="decimal"
                      defaultValue={value ?? ""}
                      onKeyDown={(e) => handleKeyDown(e, row, col)}
                      onPaste={(e) => handlePaste(e, row, col)}
                      onBlur={(e) => {
                        const parsed = parseNumberInput(e.target.value);
                        if (parsed !== null && parsed !== value) {
                          onCellChange(store.id, m.monthKey, parsed);
                        }
                      }}
                      className="num-cell w-full min-w-[92px] bg-transparent px-2 py-1.5 text-sm text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-slate-400"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
