/** Formatting helpers shared by all data views. Numbers only — no JSX here. */

/** Thousands separators, no decimals. Negative values shown in parentheses, e.g. (1,234,567). */
export function formatAmount(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const formatted = rounded.toLocaleString("en-US");
  return value < 0 ? `(${formatted})` : formatted;
}

export function formatAmountWithCurrency(value: number, currency: string): string {
  return `${formatAmount(value)} ${currency}`;
}

/** One decimal place, e.g. 75.0%. Input is a decimal (0-1). */
export function formatPercent(decimalValue: number): string {
  return `${(decimalValue * 100).toFixed(1)}%`;
}

/** One decimal place, e.g. 75.0%. Input is already a percent number (0-100). */
export function formatPercentFromPercentValue(percentValue: number): string {
  return `${percentValue.toFixed(1)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
