"use client";

import { useMemo, useState } from "react";
import type { OtbSeasonRow } from "@/lib/results";
import { groupAndAggregate } from "@/lib/results";
import type { FxRateMap, AggregateResult } from "@/lib/otb-engine";
import { formatAmount } from "@/lib/format";

interface AggregateTablesProps {
  rows: OtbSeasonRow[];
  fxRates: FxRateMap;
}

type GroupField = "brand" | "channel" | "market";

const GROUP_FIELDS: { key: GroupField; label: string }[] = [
  { key: "brand", label: "By Brand" },
  { key: "channel", label: "By Channel" },
  { key: "market", label: "By Market" },
];

function AggregateCell({ result }: { result: AggregateResult }) {
  if (!result.ok) {
    return (
      <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700" title={result.message}>
        FX rate missing: {result.missingCurrencies.join(", ")}
      </span>
    );
  }
  return (
    <span className={result.total < 0 ? "text-red-600" : ""}>
      {formatAmount(result.total)} {result.currency}
      {result.converted && <span className="ml-1 text-[10px] text-slate-400">(converted)</span>}
    </span>
  );
}

function GroupTable({ rows, groupField, fxRates }: { rows: OtbSeasonRow[]; groupField: GroupField; fxRates: FxRateMap }) {
  const aggregates = useMemo(
    () => groupAndAggregate(rows, (r) => r[groupField], fxRates),
    [rows, groupField, fxRates]
  );

  const grandTotal = useMemo(
    () => groupAndAggregate(rows, () => "Grand Total", fxRates)[0],
    [rows, fxRates]
  );

  return (
    <div className="overflow-auto rounded-md border border-slate-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-600">
              {GROUP_FIELDS.find((g) => g.key === groupField)?.label}
            </th>
            <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">Stores</th>
            <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">Net Target</th>
            <th className="border-b border-slate-200 bg-white px-3 py-2 text-right text-xs font-semibold text-slate-600">OTB (SRP)</th>
          </tr>
        </thead>
        <tbody>
          {aggregates.map((g, i) => (
            <tr key={g.groupKey} className={i % 2 === 1 ? "bg-slate-50/50" : ""}>
              <td className="border-b border-slate-100 px-3 py-1.5 font-medium text-slate-800">{g.groupKey}</td>
              <td className="num-cell border-b border-slate-100 px-3 py-1.5">{g.storeCount}</td>
              <td className="num-cell border-b border-slate-100 px-3 py-1.5">
                <AggregateCell result={g.netTarget} />
              </td>
              <td className="num-cell border-b border-slate-100 px-3 py-1.5 font-semibold">
                <AggregateCell result={g.otb} />
              </td>
            </tr>
          ))}
          {grandTotal && (
            <tr className="bg-slate-100 font-semibold">
              <td className="px-3 py-1.5">Grand Total</td>
              <td className="num-cell px-3 py-1.5">{grandTotal.storeCount}</td>
              <td className="num-cell px-3 py-1.5">
                <AggregateCell result={grandTotal.netTarget} />
              </td>
              <td className="num-cell px-3 py-1.5">
                <AggregateCell result={grandTotal.otb} />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AggregateTables({ rows, fxRates }: AggregateTablesProps) {
  const [groupField, setGroupField] = useState<GroupField>("brand");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 rounded-md bg-slate-100 p-1 w-fit">
        {GROUP_FIELDS.map((g) => (
          <button
            key={g.key}
            onClick={() => setGroupField(g.key)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${
              groupField === g.key ? "bg-white shadow-sm text-slate-900" : "text-slate-600"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <GroupTable rows={rows} groupField={groupField} fxRates={fxRates} />
    </div>
  );
}
