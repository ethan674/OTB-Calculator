import type { OtbSeasonRow } from "@/lib/results";

export type AttentionKind = "negative" | "overbought" | "short";

export interface AttentionItem {
  storeId: string;
  storeName: string;
  currency: string;
  kind: AttentionKind;
  /** Always positive: the size of the overstock / excess / shortfall in the store's own currency. */
  amount: number;
}

const EPSILON = 0.5;

/**
 * The rows a planner should look at first:
 *  - negative: an open full-price store that holds more than it needs (stock can't move between full-price stores)
 *  - overbought: a bought store holding more than its sales need — the excess carries into next season
 *  - short: a bought store that will run out before its sales target is met
 * Outlets are excluded — their need or surplus nets against full-price stores.
 */
export function computeAttention(rows: OtbSeasonRow[]): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const r of rows) {
    if (r.isOutlet) continue;
    const base = { storeId: r.storeId, storeName: r.storeName, currency: r.currency };
    if (!r.buyLocked && r.otb < -EPSILON) items.push({ ...base, kind: "negative", amount: -r.otb });
    else if (r.overbought && r.balance < -EPSILON) items.push({ ...base, kind: "overbought", amount: -r.balance });
    else if (r.buyLocked && r.balance > EPSILON) items.push({ ...base, kind: "short", amount: r.balance });
  }
  return items;
}
