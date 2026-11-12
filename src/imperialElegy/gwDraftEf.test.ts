/**
 * 27.5.2 EF substitution in a Great War draft.
 *
 * "When a player takes a draft action, instead of placing two reduced armies
 * they can substitute 1 EF for an army.  That EF may be placed in a controlled
 * home key or in a controlled colonial home key with a LoC (in both cases the
 * spaces cannot contain a trench marker).  Players can also rebuild Elite
 * Colonial EFs in this manner."
 *
 * The first drafted army is placed by `gwDraft`; the second placement is the
 * `gwDraft` pending whose options are army spaces plus `ef:<space>` /
 * `eliteEf:<space>` substitutions.
 */
import type {Ctx} from "boardgame.io";
import type {GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {gwDraft, resolvePending} from "./moves";
import {gwDraftEfChoices} from "./engine/greatWarFlow";
import {INVALID_MOVE} from "boardgame.io/core";

const ctxFor = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: () => 3, Number: () => 1, Shuffle: (a: unknown[]) => a},
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "gwManeuver",
  }) as unknown as Ctx;

const baseGw = (): ImperialElegyState => {
  const G = setupImperialElegy(ctxFor());
  G.gw = {
    active: true,
    turn: 1,
    order: ["GE"],
    belligerents: ["GE"],
    neutrals: ["UK", "FR", "AU", "RU", "OT"],
    te: [],
    ta: ["GE"],
    usIn: false,
    italyIn: false,
    usStability: 3,
    usManpower: 3,
    usBudget: 4,
    italyStability: 3,
    italyManpower: 3,
    italyBudget: 2,
    trenches: {},
    lastColonialWar: null,
    victor: null,
    outbreakDone: true,
    nationalWillDone: true,
    bonusImpulses: [],
  } as GreatWarState;
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers.GE.gwBudget = 3;
  G.powers.GE.manpower = 3;
  G.spaces.berlin.control = "GE";
  return G;
};

const unitsOfKind = (G: ImperialElegyState, owner: Power, kind: string) =>
  Object.values(G.units).filter((unit) => unit.owner === owner && unit.kind === kind);

describe("27.5.2 draft EF substitution", () => {
  test("the second-placement options include EF replacements for home keys", () => {
    const G = baseGw();
    const choices = gwDraftEfChoices(G, "GE", "berlin");
    expect(choices.length).toBeGreaterThan(0);
    // Every offered choice is a controlled home key and not the first space.
    for (const choice of choices) {
      expect(choice.space).not.toBe("berlin");
      expect(G.spaces[choice.space].control).toBe("GE");
    }
    expect(choices.some((choice) => choice.kind === "expeditionary")).toBe(true);
  });

  test("choosing ef:<space> places an EF and no second army", () => {
    const G = baseGw();
    const beforeEf = unitsOfKind(G, "GE", "expeditionary").length;
    const ctx = ctxFor();
    expect(gwDraft(G, ctx, "berlin")).toBeUndefined();
    const pending = G.pending;
    expect(pending?.kind).toBe("gwDraft");
    const efOptions = pending!.options.filter((o) => o.id.startsWith("ef:"));
    expect(efOptions.length).toBeGreaterThan(0);
    const target = efOptions[0].id.slice("ef:".length);
    const armiesBefore = Object.values(G.units).filter(
      (unit) => unit.owner === "GE" && unit.kind === "army" && unit.space === target,
    ).length;

    expect(resolvePending(G, ctx, efOptions[0].id)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(unitsOfKind(G, "GE", "expeditionary").length).toBe(beforeEf + 1);
    // The first drafted army is in Berlin; the substitute is an EF, not an army.
    expect(Object.values(G.units).filter(
      (unit) => unit.owner === "GE" && unit.kind === "army" && unit.space === target,
    ).length).toBe(armiesBefore);
    expect(G.powers.GE.manpower).toBe(2);
    expect(G.powers.GE.gwBudget).toBe(2);
  });

  test("an illegal substitution id is rejected and the decision stays open", () => {
    const G = baseGw();
    const ctx = ctxFor();
    expect(gwDraft(G, ctx, "berlin")).toBeUndefined();
    const pending = G.pending;
    expect(pending?.kind).toBe("gwDraft");
    // Berlin is the first space: it can never be the second placement.
    expect(resolvePending(G, ctx, "ef:berlin")).toBe(INVALID_MOVE);
    expect(G.pending).toBe(pending);
    // A bogus space is rejected too.
    expect(resolvePending(G, ctx, "ef:nowhere")).toBe(INVALID_MOVE);
    expect(G.pending).toBe(pending);
  });

});
