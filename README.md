# OTB Calculator

A single-page Open-to-Buy (OTB) budget calculator for a multi-brand sports retail distribution company. Add stores, enter monthly revenue forecasts and season assumptions, and see computed OTB budgets per store and in aggregate — all in one sitting.

**Fully client-side. No server, no database, no login.** Everything lives in memory in your browser tab; refreshing the page resets it. It's a template/calculator, not a system of record — use "Export Excel" or "Export CSV" to save a result you want to keep.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)), then click **Load Sample Data** to see it populated with 10 example stores, or **+ Add Store** to start from scratch.

Run the calculation engine's unit tests:

```bash
npm test
```

Build the static site (outputs to `dist/`):

```bash
npm run build
```

## How to use it

1. **Stores** — add/remove stores and set their name, brand, channel (Retail / E-Commerce), market, and store type (Full-Price / Outlet). Currency follows market automatically.
2. **Brand Inventory** — enter total current on-hand inventory once per brand+market (not per store — see "Brand-level inventory allocation" below). Rows appear automatically based on what brands/markets your stores use.
3. **Monthly Forecast** — a spreadsheet-style grid, one row per store, one column per month. Supports paste from Excel (select a block in Excel, copy, click the top-left target cell here, paste) and arrow-key/Enter navigation between cells.
4. **Store Assumptions** — per-store, per-season inputs: incoming goods, discount %, sell-through %, and an optional manual SOS override. Current On-Hand Inv. is shown read-only here — it's derived from the Brand Inventory tab.
5. **FX Rates** — only needed if your stores span more than one currency; add a currency → USD rate here so aggregates spanning multiple currencies can convert.
6. **OTB Results** — the computed output: season summary cards, a current-season roll-forward table, an OTB-by-brand table, a sortable/filterable by-store table, and channel/brand/market aggregates. Export to Excel (both planning seasons + a summary sheet) or CSV.

## Tech stack

Vite + React + TypeScript + Tailwind CSS, [xlsx](https://www.npmjs.com/package/xlsx) (SheetJS) for Excel/CSV export. No backend framework, no database — deliberately, since nothing needs to persist. See "Why no backend" below.

## The OTB formula

All values are at **SRP (retail) value** throughout — there is no cost conversion and no intake margin anywhere. The canonical formula:

```
OTB (SRP) = Net Sales Target + Discount Value + Target End-of-Season Inventory − Start-of-Season Inventory − On-Order
```

Implemented via this derivation so every intermediate term is internally consistent (`computeOtbForSeason` in `src/lib/otb-engine.ts`):

1. `Gross Sales Value = Net Revenue Forecast ÷ (1 − Blended Discount %)`
2. `Discount Value = Gross Sales Value − Net Revenue Forecast`
3. `Total Available for Sale = Gross Sales Value ÷ Sell-Through Rate`
4. `Target EOS Inventory = Total Available × (1 − Sell-Through Rate)`
5. `OTB (SRP) = Total Available − SOS Inventory − On-Order`

**Negative OTB is never clamped to zero.** It's displayed as-is (in red, parenthesized, e.g. `(1,234,567)`), flagged "Overbought" on the store row, and flows into aggregates unchanged.

## Season logic

Exactly two seasons per year, fixed globally: **SS = Jan 1–Jun 30**, **FW = Jul 1–Dec 31**. The app detects today's date and always plans the **next two seasons after the current one** — the current season is treated as already finalized (e.g. today in July 2026 → current season FW26 → planning targets SS27 and FW27). See `getPlanningSeasons` in `src/lib/otb-engine.ts`.

The monthly forecast grid spans from the current month through the end of the second planning season; current-season months feed only the inventory roll-forward, never an OTB target directly.

## Inventory roll-forward

Carryover inventory flows forward across the two planning seasons without double counting (`src/lib/otb-engine.ts` + `src/lib/storePlan.ts`):

- **SOS (planning season 1)** = Current On-Hand Inventory + Incoming Goods (Current) − Projected Gross Sales Remaining (current season), where projected gross sales remaining = remaining current-season monthly net forecast ÷ (1 − current-season discount %). Floored at 0, flagged when the projected sell-down exceeds available stock.
- **SOS (planning season 2)** = Target EOS Inventory (planning season 1) + Incoming Goods (Following Season) already committed.
- A manual SOS override per store per season is available if you need to substitute a derived value with your own number; it's visibly flagged wherever used.

## Brand-level inventory allocation

Current On-Hand Inventory is **not** entered per store — stock transfers between stores of the same brand constantly, so a store-level number goes stale immediately. Instead:

- On the **Brand Inventory** tab, enter one total per **brand + market** (e.g. "On Running – Taiwan"), in that market's currency. Rows are generated automatically from whatever brands/markets your stores use.
- That pool is split across the group's stores by each store's share of the **group's current-season net revenue forecast** — a store forecasting a bigger share of the brand's current-season sales in that market is assumed to be carrying a proportionally bigger share of its on-hand stock.
  ```
  store's share = store's current-season forecast ÷ sum of current-season forecasts across the brand+market group
  store's on-hand inventory = brand+market pool total × store's share
  ```
- If every store in a group has a 0 current-season forecast (e.g. the forecast grid hasn't been filled in yet), the pool splits evenly across the group instead of collapsing to 0 everywhere.
- Outlet stores participate in this same split — the pool represents existing inventory in the network, not a new purchase, so outlets share in it too.
- See `src/lib/brandInventory.ts`. The result is shown read-only on the Store Assumptions tab and in the Current Season results table.

## Outlet vs. Full-Price stores

Each store has an independent **Store Type** (Full-Price / Outlet) on the Stores tab, separate from Channel:

- Outlet stores don't receive new-season buys, so their **Incoming Goods (Next Season)** and **Incoming Goods (Following Season)** fields are locked to 0 and disabled on the Store Assumptions tab (also enforced defensively in `toStorePlanInputs` in `src/lib/storePlan.ts`, regardless of what's in state).
- They still run through the exact same OTB formula as full-price stores — with On-Order forced to 0, the resulting figure represents **stock needed to operate**, not a new purchase.
- That figure is **excluded from the OTB budget**: the Total OTB summary card, the OTB column in Aggregates, and OTB by Brand all skip outlet stores. Everything else (Target, Forecast SoS/EoS Inventory, the Current Season table, and their own By-Store Detail row) still includes them, since those reflect real inventory/sales activity, not new-buy dollars. Outlet rows carry a blue "Outlet" badge wherever they appear. See `groupAndAggregate` and `computeSeasonSummary` in `src/lib/results.ts`.

### Where an outlet's need actually goes

An outlet still has a sell-through target, so a positive OTB there is real, unmet demand — and since it can't place a new order, that demand has to be covered by **transfer** from the full-price stores in the same brand+market group (`src/lib/outletTransfer.ts`, applied independently per season):

```
outlet need = sum of positive OTB across outlets in the brand+market group
each full-price store absorbs: outlet need × (its on-hand-allocation share ÷ sum of shares among full-price stores in the group)
that store's SOS drops by its absorbed amount; its OTB rises by the same amount
  (OTB = Total Available − SOS − On-Order, and neither Total Available nor Target EOS depend on SOS,
  so this is the only place a transfer needs to touch)
the outlet's own SOS rises by the amount it received, landing its OTB at exactly 0
```

The upshot: the group's **grand total OTB is unchanged** by the outlet/full-price distinction — the same total dollars need spending either way — only *who's* responsible for placing the order shifts, from the outlet (which can't buy) onto the full-price stores that will actually supply it. Rows touched by this get a teal "transfer" badge next to SoS Inv (hover for the amount and direction), and the CSV/Excel export includes a `Transfer Adjustment` column.

An outlet with a **negative** OTB (already overstocked) triggers no transfer and has no effect on other stores — its own row just shows the negative figure as-is, same as any other overbought/understocked case. In practice this shouldn't come up much: on-hand inventory is allocated to the outlet proportionally to its current-season sales share, and SOS floors at 0 whenever projected sell-down exceeds on-hand stock (the common case in this data), which alone guarantees a non-negative OTB. It's not a hard guarantee though — an unusually large brand+market pool relative to the outlet's own next-season demand could still produce one. If it does, the behavior above is intentional, not a gap to fix: transfers were treated as one-directional (full-price → outlet) by design, not automatic in both directions.

## Currency rule

Each store's inputs are in its own currency. For any aggregate (brand, channel, market, grand total):

- If every store in the aggregation shares one currency, the aggregate stays in that currency.
- If it spans multiple currencies, every store is converted to USD using the rates you enter on the FX Rates tab, and the aggregate is labeled as converted.
- If a needed rate is missing, the aggregate is **blocked** with a message naming exactly which currency to add — stores are never silently skipped.
- The OTB-by-brand table always renders in USD, since figures in different native currencies aren't directly comparable; it excludes any brand missing a required rate, with a note.

## Why no backend

This started as a full team web app (login, roles, a shared database, an admin panel, submission history) — see `archive-nextjs-version/` for that build, kept for reference. It turned out the actual need was simpler: input some numbers, see the OTB result, move on, no data shared between people or sessions. Given that, a server and a database would only add things to deploy, secure, and pay for without adding value — so this version is a fully static site: open the page, it runs entirely in your browser, and there's nothing to host except plain files.

That's also why it deploys anywhere that serves static files, for free — GitHub Pages, Cloudflare Pages, Netlify, Vercel, or just opening `dist/index.html` locally after `npm run build`. There's no database file, so the "SQLite needs a persistent disk" constraint that ruled out serverless platforms for the earlier version simply doesn't apply here — there's no database at all.

## Assumptions made

- **Nothing persists across a refresh, by design.** No localStorage, no backend. "Load Sample Data" and "Clear All" are the only two ways state changes outside of direct edits.
- **No login, no roles.** Anyone who has the page can use it; there's nothing to protect since there's no shared or stored data.
- **FX rates, stores, and brand inventory pools are all just editable in-page state**, not admin-managed — there's no concept of an admin here since there are no other users.
- **Channels are a fixed set** (`Retail`, `E-Commerce`); Store Type is a fixed set (`Full-Price`, `Outlet`), independent of Channel. Brands, markets, and currencies are free-form text fields (markets are a fixed dropdown so currency can auto-derive — see `src/data/markets.ts`).
- **Discount = 100% is a blocking error**, 0–90% is the valid range, >50% is a non-blocking warning. Sell-through valid range is 1–100%, with warnings below 40% or above 95%.
- **Even split when a brand+market group's current-season forecast is 0.** Rather than leaving every store's derived on-hand inventory at 0 before forecasts are filled in, the pool splits evenly across the group as a starting point.
