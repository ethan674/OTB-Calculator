# OTB Planner

Internal web app for a multi-brand sports retail distribution company to input store-level (PoS) forecast data, calculate Open-to-Buy (OTB) budgets per store and in aggregate, and submit finalized plans for reference.

Built with Next.js 14+ (App Router), TypeScript, Tailwind CSS, and Prisma over SQLite.

## Setup

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Log in with:

- `admin` / team password (see `.env` → `TEAM_PASSWORD`, defaults to `otb-team-2026`) — full access, manages stores/FX rates/locks, sees all submissions.
- `planner1` / same team password — inputs and submits for the 10 seeded stores.

This runs locally on `localhost` only. To make it reachable by your team (including remote/hybrid teammates) over the internet, see **[DEPLOYMENT.md](DEPLOYMENT.md)** — a Docker + Caddy setup that gets you a real HTTPS URL on a small VPS.

Run the engine's unit test suite:

```bash
npm test
```

## Tech stack

- **Next.js 14+ App Router, TypeScript, Tailwind CSS.**
- **SQLite via Prisma.** The datasource is declared once in `prisma/schema.prisma`; switching to Postgres later is a one-line change (`provider = "postgresql"`) plus a `DATABASE_URL` pointing at a Postgres instance. No model changes required.
- **Session auth**: shared team password (`.env` → `TEAM_PASSWORD`) plus a per-user name. Sessions are signed JWTs (`SESSION_SECRET` in `.env`) in an httpOnly cookie, verified in `middleware.ts` on every request. Two roles: `planner` and `admin`.
- **Calculation engine**: [`lib/otb-engine.ts`](lib/otb-engine.ts) — pure, framework-free TypeScript. No React, no Prisma, no I/O. Every other part of the app (Input Grid, OTB Results, Submissions snapshots) calls into this module so the math is defined exactly once. Tested in [`lib/otb-engine.test.ts`](lib/otb-engine.test.ts) with Vitest.
- **Excel/CSV export**: [`xlsx`](https://www.npmjs.com/package/xlsx) (SheetJS), client-side.
- **Charts**: Recharts.

## The OTB formula

All values are at **SRP (retail) value** throughout the entire application — there is no cost conversion and no intake margin anywhere. The canonical formula:

```
OTB (SRP) = Net Sales Target + Discount Value + Target End-of-Season Inventory − Start-of-Season Inventory − On-Order
```

Implemented via this derivation so every intermediate term is internally consistent (`computeOtbForSeason` in `lib/otb-engine.ts`):

1. `Gross Sales Value = Net Revenue Forecast ÷ (1 − Blended Discount %)`
2. `Discount Value = Gross Sales Value − Net Revenue Forecast`
3. `Total Available for Sale = Gross Sales Value ÷ Sell-Through Rate`
4. `Target EOS Inventory = Total Available × (1 − Sell-Through Rate)`
5. `OTB (SRP) = Total Available − SOS Inventory − On-Order`

**Negative OTB is never clamped to zero.** It's displayed as-is (in red, parenthesized, e.g. `(1,234,567)`), flagged "Overbought" on the store row, and flows into aggregates unchanged. Aggregate views show a count of overbought stores.

## Season logic

Exactly two seasons per year, fixed globally (not configurable per brand): **SS = Jan 1–Jun 30**, **FW = Jul 1–Dec 31**.

The app detects today's date and always plans the **next two seasons after the current one** — the current season is treated as already finalized. E.g. today in July 2026 → current season is FW26 → planning targets are SS27 and FW27. See `getPlanningSeasons` in `lib/otb-engine.ts`.

The monthly revenue forecast input window runs from the current month through the end of the second planning season. Each month is tagged with which season it belongs to (`buildMonthlyHorizon`); current-season months feed only the inventory roll-forward, never an OTB target directly.

## Inventory roll-forward

Carryover inventory flows forward across the two planning seasons without double counting (`computeSos1` / `computeSos2` / `computeStorePlan` in `lib/otb-engine.ts`):

- **SOS (planning season 1)** = Current On-Hand Inventory + Remaining Planned Receipts (current season) − Projected Gross Sales Remaining (current season), where projected gross sales remaining = remaining current-season monthly net forecast ÷ (1 − current-season discount %). Floored at 0, with a "floored" flag shown when the projected sell-down exceeds available stock.
- **SOS (planning season 2)** = Target EOS Inventory (planning season 1) + On-Order already committed for planning season 2.
- Admins can manually override the derived SOS per store per season (`s1ManualSosOverride` / `s2ManualSosOverride`); overrides are visibly flagged wherever they're used and stored so historical submissions remain reproducible even if the override changes later.

## Currency rule

Each store's inputs are entered in its own selected currency. For any aggregate view (brand, channel, market, grand total):

- If every store in the aggregation shares one currency, the aggregate stays in that currency.
- If the aggregation spans multiple currencies, every store is converted to USD using the admin-maintained FX rate table (`FxRate` model — currency → USD rate, with an "as of" date) and the aggregate is shown in USD, labeled as converted.
- If a needed FX rate is missing, the aggregate is **blocked** with a message naming exactly which currency rate to add — stores are never silently skipped. See `aggregateByCurrency` in `lib/otb-engine.ts`.
- Store-level rows in the By-Store Detail table always show both their native-currency OTB and a USD-equivalent column, so native and converted values are visible side by side even outside a mixed aggregate.
- The OTB-by-brand chart always renders in USD (bars in different native currencies aren't visually comparable), and excludes any brand missing a required FX rate with a note explaining why.

## Submission workflow

- Planners work in a **Draft** (`PlanningInput`) that autosaves per field, debounced ~700ms after the last edit.
- **Submit** creates an immutable, versioned `Submission` snapshot (v1, v2, …) with submitter name, timestamp, and an optional comment. The snapshot freezes the full input set, the FX rates in effect at that moment, and the fully computed output for both planning seasons — so historical submissions stay reproducible even if the formula or FX rates change later. Planners can keep editing the draft and submit again as a new version.
- Admins see all stores' submissions (filterable by brand/market), can compare any two versions of the same store side by side (deltas on net target, OTB, and SOS per season), and can lock a planning season (Admin → Locks) to freeze all drafts feeding it — locked stores become read-only for planners; admins can still edit.

## Assumptions made

The spec said to make reasonable assumptions rather than ask — here's what was assumed and why:

- **Store ownership.** The spec says planners "input and submit for own stores" but doesn't define how a store gets assigned to a planner. Added `Store.ownerId` (nullable, FK to `User`). All seeded stores are assigned to `planner1`. Admins can reassign ownership in Admin → Stores; unassigned stores aren't visible to any planner until assigned.
- **Login accounts are admin-provisioned, not self-service.** The spec's auth is "name + shared team password" with no mention of account creation. Users must already exist in the `User` table (seeded: `admin`, `planner1`); there's no self-registration. Add teammates by inserting `User` rows (see below).
- **Planning cycle keying.** `PlanningInput` and `Submission` are keyed by `(storeId, cycleLabel)` where `cycleLabel` is the *current* (finalized) season label at the time the plan was generated (e.g. `"FW26"`). When the calendar rolls into a new current season, a fresh zeroed `PlanningInput` row is auto-created per store on first visit to the Input Grid (`ensurePlanningInputs` in `lib/planning.ts`) — nothing carries over from the prior cycle's draft, only from its computed EOS via the roll-forward math once the planner re-enters current-season figures.
- **Season locks apply to the whole cycle, not per-field.** Locking either planning season (Admin → Locks) makes every field for that store's current-cycle draft read-only for planners, not just the fields that feed the locked season specifically. This matches the spec's language ("freeze all drafts") more literally than a partial-field lock would.
- **FX rate table has one rate per currency**, not a rate history. `asOfDate` records when the current rate was set; saving a new rate for a currency overwrites the old one (upsert by currency). Submission snapshots still capture the rate in effect at submit time, so past submissions remain reproducible even after a rate changes.
- **Chart currency.** OTB-by-brand is always shown in USD (see Currency rule above) even though the by-brand aggregate table follows the "stay native if single-currency" rule — a bar chart comparing different currencies side by side wouldn't be meaningful otherwise.
- **No cost/margin fields anywhere.** Per the spec, everything is SRP value only; there's intentionally no cost or intake-margin field on `Store` or in the engine.
- **Discount = 100% is a blocking error**, 0–90% is the valid range, and >50% is a non-blocking warning, per the spec. Sell-through valid range is 1–100%, with non-blocking warnings below 40% or above 95%.
- **Channels are a fixed enum** (`Retail`, `EC`, `Wholesale`, `Outlet`) since the spec lists exactly these four; brands and markets are free-form strings, matching the spec's "free-form list" language for brands and its market examples.

## Adding a brand, store, or FX rate

- **Brand**: brands are free-form text on `Store.brand` — just create or edit a store with the new brand name (Admin → Stores). No separate brand table to update.
- **Store**: Admin → Stores → "+ Add Store". Requires store code, name, brand, channel, market, currency, and optionally an owning planner. A zeroed Draft `PlanningInput` for the current cycle is created automatically the first time anyone opens the Input Grid after adding the store.
- **FX rate**: Admin → FX Rates → enter the 3-letter currency code, the rate to convert 1 unit of that currency to USD, and an as-of date, then Save. If a mixed-currency aggregate is blocked because a rate is missing, the page names the exact currency to add.

## Seed data

`npm run seed` (`prisma/seed.ts`) creates:

- Users `admin` (role `admin`) and `planner1` (role `planner`).
- FX rates for TWD, VND, SGD → USD.
- 10 stores across 3 brands (On Running, PXG, K-Swiss), 3 markets (Taiwan/TWD, Vietnam/VND, Singapore/SGD), and 3 channels (Retail, EC, Wholesale), each with a realistic monthly forecast, on-hand inventory, sell-through (55–85%), and discount (15–35%) for the current horizon (computed dynamically from today's date via the engine's own season logic — reseeding after time passes regenerates the horizon correctly).
- One deliberately overbought store (`TW-RT-010`, Kaohsiung Store) with on-hand inventory and on-order far larger than its forecast implies, so the negative-OTB pass-through and "Overbought" flag are visible on first run.

Reseeding is idempotent (upserts by unique key) and safe to re-run at any time; it does not touch existing `Submission` snapshots or `SeasonLock` rows.

## Definition of done checklist

- `npm install && npx prisma migrate dev && npm run seed && npm run dev` → working app.
- `npm test` → all engine unit tests pass, including the exact worked example from the spec, negative-OTB pass-through, season detection for the four edge dates (Jan 1 / Jun 30 / Jul 1 / Dec 31) plus two ordinary dates, the two-season inventory chain, and all three currency-aggregation cases (native / converted / blocked-missing-rate).
- `npm run build` → clean production build, no type errors, no lint errors.
