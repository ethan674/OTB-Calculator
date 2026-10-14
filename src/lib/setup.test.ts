import { describe, expect, it } from "vitest";
import { computeSetupStatus } from "./setup";
import { buildMonthlyHorizon } from "./otb-engine";
import { emptyStore } from "@/types";

const horizon = buildMonthlyHorizon(new Date("2026-10-14"));
const planningKey = horizon.find((m) => m.bucket === "planning1")!.monthKey;
const stateOf = (steps: ReturnType<typeof computeSetupStatus>, tab: string) => steps.find((s) => s.tab === tab)!.state;

describe("computeSetupStatus", () => {
  it("is all to-do on an empty app, with FX not needed", () => {
    const steps = computeSetupStatus([], {}, {}, horizon);
    expect(stateOf(steps, "stores")).toBe("todo");
    expect(stateOf(steps, "inventory")).toBe("todo");
    expect(stateOf(steps, "forecast")).toBe("todo");
    expect(stateOf(steps, "fx")).toBe("done");
  });

  it("warns about a nameless store, a missing inventory pool and no forecast", () => {
    const s = { ...emptyStore(), brand: "PXG" };
    const steps = computeSetupStatus([s], {}, {}, horizon);
    expect(stateOf(steps, "stores")).toBe("warn");
    expect(stateOf(steps, "inventory")).toBe("todo");
    expect(stateOf(steps, "forecast")).toBe("todo");
  });

  it("is complete once names, inventory and forecast are in", () => {
    const s = { ...emptyStore(), storeName: "A", brand: "PXG", monthlyForecast: { [planningKey]: 100 } };
    const steps = computeSetupStatus([s], { [`PXG::${s.market}`]: 0 }, {}, horizon);
    expect(steps.map((x) => x.state)).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("flags an invalid sell-through, except on a bought season", () => {
    const s = { ...emptyStore(), storeName: "A", brand: "PXG", s1SellThroughPct: 5, s2SellThroughPct: 0.7 };
    expect(stateOf(computeSetupStatus([s], {}, {}, horizon), "assumptions")).toBe("warn");
    expect(stateOf(computeSetupStatus([{ ...s, s1OnOrder: 100 }], {}, {}, horizon), "assumptions")).toBe("done");
  });

  it("asks for an FX rate only when currencies are mixed", () => {
    const a = { ...emptyStore(), storeName: "A", brand: "X", currency: "TWD" };
    const b = { ...emptyStore(), storeName: "B", brand: "X", currency: "VND" };
    expect(stateOf(computeSetupStatus([a, b], {}, { TWD: 0.03 }, horizon), "fx")).toBe("warn");
    expect(stateOf(computeSetupStatus([a, b], {}, { TWD: 0.03, VND: 0.00004 }, horizon), "fx")).toBe("done");
  });
});
