"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";
import type { OtbSeasonRow } from "@/lib/results";
import { sumToUsd } from "@/lib/results";
import type { FxRateMap } from "@/lib/otb-engine";
import { formatAmount } from "@/lib/format";

interface OtbBarChartProps {
  season1Rows: OtbSeasonRow[];
  season2Rows: OtbSeasonRow[];
  planning1Label: string;
  planning2Label: string;
  fxRates: FxRateMap;
}

export function OtbBarChart({ season1Rows, season2Rows, planning1Label, planning2Label, fxRates }: OtbBarChartProps) {
  const { data, missingCurrencies } = useMemo(() => {
    const brands = Array.from(new Set([...season1Rows.map((r) => r.brand), ...season2Rows.map((r) => r.brand)])).sort();
    const missing = new Set<string>();

    const data = brands.map((brand) => {
      const s1 = sumToUsd(
        season1Rows.filter((r) => r.brand === brand).map((r) => ({ value: r.otb, currency: r.currency })),
        fxRates
      );
      const s2 = sumToUsd(
        season2Rows.filter((r) => r.brand === brand).map((r) => ({ value: r.otb, currency: r.currency })),
        fxRates
      );
      s1.missingCurrencies.forEach((c) => missing.add(c));
      s2.missingCurrencies.forEach((c) => missing.add(c));
      return { brand, [planning1Label]: Math.round(s1.value), [planning2Label]: Math.round(s2.value) };
    });

    return { data, missingCurrencies: Array.from(missing) };
  }, [season1Rows, season2Rows, planning1Label, planning2Label, fxRates]);

  // Recharts' ResponsiveContainer relies on a ResizeObserver callback that
  // doesn't reliably fire on first mount in this app's React 19 setup, so
  // the chart width is tracked manually instead.
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-700">OTB by Brand (USD)</h3>
      {missingCurrencies.length > 0 && (
        <p className="text-xs text-amber-600">
          Chart excludes stores missing FX rates for: {missingCurrencies.join(", ")}
        </p>
      )}
      <div ref={containerRef} className="h-72 rounded-lg border border-slate-200 bg-white p-3">
        {width > 0 && (
          <BarChart width={width - 24} height={256} data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="brand" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatAmount(v)} />
            <Tooltip formatter={(v) => `${formatAmount(Number(v))} USD`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={planning1Label} fill="#2563eb" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey={planning2Label} fill="#10b981" radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        )}
      </div>
    </div>
  );
}
