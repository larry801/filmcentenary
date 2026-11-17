import {stackSummary, tokenKindOf} from "./stackSummary";
import type {Unit} from "../types";

const unit = (id: string, over: Partial<Unit>): Unit => ({
  id,
  kind: "army",
  owner: "GE",
  steps: 2,
  space: "berlin",
  ...over,
});

describe("stackSummary", () => {
  test("groups identical counters and keeps distinct ones apart", () => {
    const units: Unit[] = [
      unit("a1", {kind: "army", owner: "GE", steps: 2}),
      unit("a2", {kind: "army", owner: "GE", steps: 2}),
      unit("a3", {kind: "army", owner: "GE", steps: 1}),
      unit("b1", {kind: "eliteCorps", owner: "GE", steps: 1}),
      unit("c1", {kind: "army", owner: "FR"}),
    ];
    const summary = stackSummary(units, "berlin");
    expect(summary).toEqual([
      {power: "GE", kind: "army", count: 2, reduced: false},
      {power: "GE", kind: "army", count: 1, reduced: true},
      {power: "GE", kind: "eliteCorps", count: 1, reduced: false},
      {power: "FR", kind: "army", count: 1, reduced: false},
    ]);
  });

  test("orders by power, then the printed counter family", () => {
    const summary = stackSummary([
      unit("a", {owner: "OT", kind: "army"}),
      unit("b", {owner: "GE", kind: "squadron", naval: true}),
      unit("c", {owner: "GE", kind: "army"}),
      unit("d", {owner: "GE", kind: "reserveArmy"}),
      unit("e", {owner: "GE", kind: "eliteCorps", steps: 1}),
    ], "berlin");
    expect(summary.map((entry) => `${entry.power}:${entry.kind}`)).toEqual([
      "GE:army",
      "GE:reserveArmy",
      "GE:eliteCorps",
      "GE:squadron",
      "OT:army",
    ]);
  });

  test("only units in the named space are counted", () => {
    const summary = stackSummary([
      unit("a", {space: "berlin"}),
      unit("b", {space: "vienna"}),
      unit("c", {space: null}),
    ], "berlin");
    expect(summary).toHaveLength(1);
    expect(summary[0].count).toBe(1);
  });

  test("owners without a counter colour are left to the space overlay", () => {
    expect(stackSummary([
      unit("a", {owner: "REBEL:bavaria" as never}),
      unit("b", {owner: "IT"}),
      unit("c", {owner: "GE"}),
    ], "berlin").map((entry) => entry.power)).toEqual(["GE"]);
  });

  test("one-step counters never print as reduced", () => {
    const summary = stackSummary([
      unit("a", {kind: "eliteCorps", steps: 1}),
      unit("b", {kind: "expeditionary", steps: 1}),
    ], "berlin");
    expect(summary.every((entry) => entry.reduced === false)).toBe(true);
  });

  test("token shapes follow the rulebook's counter family", () => {
    expect(tokenKindOf("army")).toBe("army");
    expect(tokenKindOf("reserveArmy")).toBe("army");
    expect(tokenKindOf("eliteCorps")).toBe("elite");
    expect(tokenKindOf("expeditionary")).toBe("ef");
    expect(tokenKindOf("squadron")).toBe("ship");
    expect(tokenKindOf("dreadnought")).toBe("ship");
  });
});
