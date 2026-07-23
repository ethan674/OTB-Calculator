# Claude Code Prompt — OTB Budget Web App (v2)

Copy everything below the line into Claude Code as a single prompt.

---

Build a complete, production-ready internal web application called **OTB Planner** for a multi-brand sports retail distribution company. The team will use it to input store-level (PoS-level) forecast data, calculate Open-To-Buy (OTB) budgets per store and in aggregate, and submit finalized plans for reference. Do not stop to ask me questions — make reasonable assumptions, document them in the README, and deliver a fully working app.

## 1. Tech stack and project setup

- **Next.js 14+ (App Router) with TypeScript**, Tailwind CSS for styling.
- **SQLite via Prisma** as the database (zero-config for internal deployment on a single machine). Structure the Prisma schema so switching to Postgres later is a one-line datasource change.
- Simple session auth: users log in with name + shared team password (stored in `.env`). Two roles: `planner` (input and submit for own stores) and `admin` (see everything, manage stores/FX rates, lock submissions).
- Include seed data (see §8), a README with setup/run instructions, and unit tests (Vitest) for the entire calculation engine.
- All calculation logic must live in a pure, framework-free TypeScript module (`/lib/otb-engine.ts`) so it is independently testable. No calculation logic in React components.

## 2. Core OTB calculation (this must be exact)

All values are at **SRP (retail) value** throughout the entire application. There is no cost conversion and no intake margin anywhere — inputs, calculations, and outputs are all at SRP. The canonical formula:

```
OTB (SRP) = Net Sales Target + Discount Value + Target End-of-Season Inventory − Start-of-Season Inventory − On-Order
```

Implement it via this derivation so every term is internally consistent:

1. `Gross Sales Value = Net Revenue Forecast ÷ (1 − Blended Discount %)`
2. `Discount Value = Gross Sales Value − Net Revenue Forecast`
3. `Total Available for Sale = Gross Sales Value ÷ Sell-Through Rate`
4. `Target EOS Inventory = Total Available × (1 − Sell-Through Rate)`
5. `OTB (SRP) = Total Available − SOS Inventory − On-Order`

Sanity check the equivalence in tests: `Total Available − SOS = (Net + Discount) + EOS − SOS`.

**Worked example (must be a passing unit test):** Net revenue target = 10,000,000; discount = 20% → Gross = 12,500,000; Discount value = 2,500,000. Sell-through = 75% → Total available = 16,666,667; Target EOS = 4,166,667. SOS = 3,000,000; On-order = 0. **OTB = 13,666,667.**

**Negative OTB:** if the formula yields a negative number, **display the negative value as-is** (do not clamp to zero), accompanied by a prominent "Overbought" flag on that store row and in aggregates. Negative store OTBs flow into aggregate totals unchanged. Aggregate views also show a count of overbought stores.

## 3. Season logic and horizon

- Exactly **two seasons per year**, universal across all brands: **SS = Jan 1 – Jun 30**, **FW = Jul 1 – Dec 31**. This is fixed — do not build per-brand season configurability.
- The app auto-detects today's date and plans the **next two seasons after the current one**. The current season's OTB is treated as already finalized, so it is never a planning target. Examples that must be unit-tested:
  - Today = July 2026 → current season FW26 → planning output for **SS27 and FW27**.
  - Today = mid-January 2026 → current season SS26 → planning output for **FW26 and SS27**.
  - Edge dates: Jan 1, Jun 30, Jul 1, Dec 31 must resolve to the correct current season and planning pair.
- Revenue forecast input window: **monthly, from the current month through the end of the second planning season** (e.g., July 2026 → Jul 2026 through Dec 2027; mid-Jan 2026 → Jan 2026 through Jun 2027). Each month maps to its season automatically. Current-season months are used only for the inventory roll-forward, not as an OTB planning target.

## 4. Inventory roll-forward (chain the seasons — this is the most common source of OTB errors, get it right)

Carryover inventory must flow forward without double counting:

- `SOS (planning season 1) = Current On-Hand Inventory + Remaining Planned Receipts (current season) − Projected Gross Sales Remaining (current season)`, where projected gross sales remaining = remaining current-season monthly net forecast ÷ (1 − current-season discount %). Floor at 0 with a warning if projected sell-down exceeds available stock.
- `SOS (planning season 2) = Target EOS Inventory (planning season 1) + On-Order already committed for planning season 2`.
- Never let a user manually enter SOS for the planning seasons by default; it is always derived. Provide an admin-only "manual SOS override" field per store per season for exceptional cases, visibly flagged when used.

## 5. Inputs (per store / PoS)

Store master data (admin-managed): store name, store code, **brand** (free-form list, e.g., On Running, PXG, K-Swiss, 2XU, WAAC), **channel** (Retail / EC / Wholesale / Outlet), **market** (e.g., Taiwan, Vietnam, Singapore, Malaysia, Hong Kong), **currency** (selected per store at input, e.g., TWD, VND, SGD, MYR, HKD, USD), active/inactive.

Planner inputs per store:

- **Monthly net revenue forecast** for every month in the horizon (spreadsheet-style grid, one row per store, one column per month; supports paste from Excel — parse tab-separated clipboard data).
- **Current on-hand inventory at SRP value** (as of today).
- **Remaining planned receipts** for the current season (SRP value).
- **Sell-through rate** per planning season (the two seasons can differ), entered as %, valid range 1–100. Warn (non-blocking) below 40% or above 95%.
- **Blended discount %** per planning season and for the current season (current-season discount is needed for the roll-forward), valid range 0–90. Warn above 50%.
- **On-order** per planning season (SRP value), default 0.
- Current-season discount % and the current-season months of the forecast grid feed the SOS derivation only.

Validation is inline and immediate. Blocking errors: missing required fields, out-of-range values, discount = 100%. Non-blocking warnings render as yellow badges with tooltips.

## 6. Currency handling and outputs

**Currency rule:** each store's inputs are in its own selected currency. For any aggregate view (brand, channel, market, grand total):

- If **all stores in the aggregation share one currency**, output the aggregate in that currency.
- If the aggregation spans **multiple currencies**, convert every store to **USD** using an admin-maintained FX rate table (currency → USD, manually entered, with an "as of" date) and output the aggregate in USD, clearly labeled with the rates used. Store-level rows always remain in their native currency alongside their USD-converted value when a USD aggregate is shown.
- If a needed FX rate is missing, block the USD aggregate with a clear message telling the admin which rate to add — never silently skip stores.

**Output views:**

- **By-store OTB table** per planning season: Net target, Gross, Discount value, Total available, Target EOS, SOS (derived), On-order, **OTB (SRP)**, sell-through, discount %, currency, and flags (Overbought, SOS override, SOS floored). Sortable and filterable by brand, channel, market.
- **Aggregate views**: roll-ups by brand, by channel, by market, and grand total, following the currency rule above.
- **Season summary cards** per planning season: total OTB, total net target, weighted-average sell-through and discount, count of overbought stores.
- Simple bar chart of OTB by brand per planning season (use Recharts).
- **Export to Excel (.xlsx)** of both the by-store detail and the aggregates, one sheet per planning season plus a summary sheet. Also CSV export. Exports preserve native currencies and include the USD-converted columns and the FX rates used.

## 7. Submission workflow

- Planners work in **Draft** state; autosave on edit.
- **Submit** creates an immutable, versioned snapshot (v1, v2, …) with submitter name, timestamp, and an optional comment. Submitted snapshots are read-only; planners can keep editing the draft and re-submit as a new version.
- Admins see a submissions list (filter by brand/market/user), can open any snapshot, compare two versions side by side (show deltas on OTB per store), and can **lock** a planning season to freeze all drafts.
- Every snapshot stores the full input set, the FX rates in effect, AND the computed outputs, so historical submissions remain reproducible even if formulas or rates change later.

## 8. Seed data

Seed ~10 example stores across 3 brands, 3 markets (Taiwan/TWD, Vietnam/VND, Singapore/SGD), and 3 channels, with realistic monthly forecasts, inventory, sell-through (55–85%), and discounts (15–35%). Include one deliberately overbought store so the negative OTB and flag are visible on first run. Seed an FX table (TWD, VND, SGD → USD). Seed two users: `admin` and `planner1`.

## 9. UI expectations

- Clean, dense, data-first design — this is a finance/merchandising tool, not a marketing site. Numbers right-aligned, thousands separators, no decimals on currency amounts, one decimal on percentages. Negative OTB values shown in red with parentheses formatting, e.g., (1,234,567).
- Main navigation: **Input Grid** / **OTB Results** / **Submissions** / **Admin** (stores, FX rates, locks).
- The input grid must be genuinely usable: keyboard navigation between cells, Excel paste, sticky store-name column, sticky header row, per-row validation state.
- Show the current season and the two planning seasons prominently in the header (e.g., "Current: FW26 (finalized) → Planning: SS27, FW27").

## 10. Definition of done

- `npm install && npx prisma migrate dev && npm run seed && npm run dev` gets a working app.
- All engine unit tests pass, including: the worked example in §2, the negative-OTB pass-through and flag, season detection for at least 4 different "today" dates including the four edge dates in §3, the two-season inventory chain (EOS of planning season 1 = SOS of planning season 2 plus committed on-order), and the currency aggregation rule (single-currency aggregate stays native; mixed-currency aggregate converts to USD; missing rate blocks with a message).
- README documents the formula, the roll-forward logic, the currency rule, all assumptions you made, and how to add a brand/store/FX rate.

Build the entire application now, end to end, without asking clarifying questions.
