import type { OtbSeasonRow } from "./results";
import { brandMarketKey } from "./brandInventory";
import { positionFromBalance } from "./otb-engine";

/**
 * Re-derives everything that follows from a row's new SoS and balance: total
 * available (SoS + on-order), OTB (open seasons only), forecast EoS (target +
 * any overbought excess), sell-through, and the overbought flag.
 */
function positionAfter(r: OtbSeasonRow, sosInventory: number, balance: number) {
  return {
    sosInventory,
    ...positionFromBalance(r.grossSalesValue, sosInventory + r.onOrder, r.targetEosInventory, r.buyLocked, balance),
  };
}

/**
 * Outlet stores don't place new-season buys, but they still have a sales
 * target — so a positive outlet balance is real inventory it needs, and a
 * negative one is real surplus it's already carrying. Neither should just
 * sit unfunded (or discarded) on the outlet's own row: the need has to be
 * covered by a transfer out of the full-price stores in the same
 * brand+market group, and the surplus should credit back to those same
 * stores — otherwise the group would look like it needs to buy more than it
 * actually does, since a store elsewhere is already sitting on excess from
 * the exact same shared inventory pool.
 *
 * This nets the group's outlets against each other first (a surplus at one
 * outlet can fund a need at another), then passes whatever remains —
 * positive (net need) or negative (net surplus) — to the full-price
 * stores: each one's SOS moves by its share of that net amount (and its
 * balance by the same amount in the opposite direction, since
 * balance = Gross + Target EoS − SOS − On-Order and neither gross sales nor
 * target EoS depend on SOS), using the same proportional shares as the
 * on-hand inventory split. Every outlet's own balance lands at exactly 0
 * once it has a full-price peer to net against — it never carries a need or
 * a surplus on its own books.
 *
 * It works on the balance rather than OTB because a full-price store whose
 * season is already bought for reports no OTB, yet still holds (or gives up)
 * real stock. Its reported OTB stays 0; the transfer shows up in its SoS,
 * EoS and overbought flag.
 *
 * An outlet with no full-price peer in its group has nowhere to net
 * against, so it's left untouched — see README for the reasoning.
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

    if (fullPrice.length === 0) {
      result.push(...groupRows.map((r) => ({ ...r, transferAdjustment: 0 })));
      continue;
    }

    const netOutletPosition = outlets.reduce((sum, r) => sum + r.balance, 0);
    const fullPriceShareTotal = fullPrice.reduce((sum, r) => sum + (shares[r.storeId] ?? 0), 0);

    for (const r of groupRows) {
      if (r.isOutlet) {
        const delta = -r.balance;
        result.push({
          ...r,
          ...positionAfter(r, r.sosInventory + r.balance, 0),
          transferAdjustment: delta,
        });
      } else {
        const rawShare = shares[r.storeId] ?? 0;
        const weight = fullPriceShareTotal > 0 ? rawShare / fullPriceShareTotal : 1 / fullPrice.length;
        const delta = netOutletPosition * weight;
        result.push({
          ...r,
          ...positionAfter(r, r.sosInventory - delta, r.balance + delta),
          transferAdjustment: delta,
        });
      }
    }
  }

  return result;
}
