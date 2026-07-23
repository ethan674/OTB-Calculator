import type { OtbSeasonRow } from "./results";
import { brandMarketKey } from "./brandInventory";

/**
 * Outlet stores don't place new-season buys, but they still have a
 * sell-through target — so a positive outlet OTB is real inventory it
 * needs, and since it can't be bought new, it has to come from a transfer
 * out of the full-price stores in the same brand+market group.
 *
 * This redistributes that need: each full-price store's SOS drops (and its
 * OTB rises by the same amount, since OTB = Total Available − SOS − On-Order
 * and neither Total Available nor Target EOS depend on SOS) by its share of
 * the group's total outlet need, using the exact same proportional shares
 * as the on-hand inventory split. The satisfied outlet's own SOS rises to
 * match, so its OTB lands at exactly 0 — the inventory just moved, the
 * group's total buying need is unchanged.
 *
 * An outlet with negative OTB (already overstocked) triggers no transfer
 * and has no effect on other stores — see README for the reasoning.
 */
export function applyOutletTransfers(rows: OtbSeasonRow[], shares: Record<string, number>): OtbSeasonRow[] {
  const groups = new Map<string, OtbSeasonRow[]>();
  for (const row of rows) {
    const key = brandMarketKey(row.brand, row.market);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const result: OtbSeasonRow[] = [];

  for (const groupRows of groups.values()) {
    const outlets = groupRows.filter((r) => r.isOutlet);
    const fullPrice = groupRows.filter((r) => !r.isOutlet);
    const outletNeed = outlets.reduce((sum, r) => sum + Math.max(0, r.otb), 0);

    if (outletNeed <= 0 || fullPrice.length === 0) {
      result.push(...groupRows.map((r) => ({ ...r, transferAdjustment: 0 })));
      continue;
    }

    const fullPriceShareTotal = fullPrice.reduce((sum, r) => sum + (shares[r.storeId] ?? 0), 0);

    for (const r of groupRows) {
      if (r.isOutlet) {
        if (r.otb > 0) {
          const delta = -r.otb;
          const otb = 0;
          result.push({ ...r, otb, sosInventory: r.sosInventory + r.otb, overbought: otb < 0, transferAdjustment: delta });
        } else {
          result.push({ ...r, transferAdjustment: 0 });
        }
      } else {
        const rawShare = shares[r.storeId] ?? 0;
        const weight = fullPriceShareTotal > 0 ? rawShare / fullPriceShareTotal : 1 / fullPrice.length;
        const delta = outletNeed * weight;
        const otb = r.otb + delta;
        result.push({ ...r, otb, sosInventory: r.sosInventory - delta, overbought: otb < 0, transferAdjustment: delta });
      }
    }
  }

  return result;
}
