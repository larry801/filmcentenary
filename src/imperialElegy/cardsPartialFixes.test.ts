/**
 * Fixes from the printed-rule audit of §§9–12 (2026-11-23, round 4).
 *
 * - 10.3: plus/minus card markers are discarded after all cards are dealt;
 *   A094's Boxer marker is the printed exception and lasts until the last
 *   Boxer army is eliminated.
 * - 10.4: the UK may discard a random card during prep to flip India stable.
 * - 12.2: a newly built EC must be placed with an army that has a LoC.
 * - 12.6: the once-per-impulse removal bar is printed for influence only.
 * - 12.17 (errata): an ordinary declaration must spend the whole card played
 *   this impulse.
 */
import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {canRecruitIn} from "./engine/characteristics";
import {cardsToDraw} from "./engine/rules";
import {ImperialElegyGameDef} from "./game";
import {buildForMinor, declareWar, discardForIndianStability, playCard, redeploy, removeInfluence, resolvePending} from "./moves";
import {CARDS} from "./constant/cards.data";

type PhaseHooks = Record<string, {onBegin?: (G: ImperialElegyState, ctx: Ctx) => void}>;

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
      Shuffle: (items: unknown[]) => items,
    },
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));
const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const runPrep = (G: ImperialElegyState): void => {
  const phases = ImperialElegyGameDef.phases as unknown as PhaseHooks;
  G.turn = 2;
  G.phase = "prep";
  phases.prep.onBegin!(G, makeCtx());
};

describe("10.3 card-marker lifetime", () => {
  test("a transient marker affects one deal and is then discarded", () => {
    const G = fresh();
    const base = cardsToDraw(G, "GE");
    G.powers.GE.cardMarkers = 1;
    expect(cardsToDraw(G, "GE")).toBe(base + 1);
    runPrep(G);
    // The deal happened and 10.3's cleanup discarded the transient marker.
    expect(G.powers.GE.cardMarkers).toBe(0);
  });

  test("A094's Boxer marker persists until the last Boxer army is eliminated", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.turn = 4;
    G.pending = null;
    G.spaces.shanghai.control = "GE";
    G.spaces.guangzhou.control = "FR";
    G.powers.GE.hand.push("IE-A094");
    expect(playCard(G, makeCtx([], seat("GE")), "IE-A094", "event")).toBeUndefined();
    expect(G.powers.GE.persistentCardMarkers).toBe(-1);
    expect(G.powers.FR.persistentCardMarkers).toBe(-1);
    expect(G.powers.UK.persistentCardMarkers ?? 0).toBe(0);

    const boxers = Object.values(G.units).filter((unit) => unit.owner === "REBEL:Boxer").map((unit) => unit.id);
    expect(boxers.length).toBeGreaterThan(0);
    for (const id of boxers) removeUnit(G, id);
    // The last elimination removes the persistent marker from every marked power.
    expect(G.powers.GE.persistentCardMarkers ?? 0).toBe(0);
    expect(G.powers.FR.persistentCardMarkers ?? 0).toBe(0);
  });
});

describe("10.4 the UK's Indian Stability discard", () => {
  test("the UK discards a random card to flip India stable, once per prep", () => {
    const G = fresh();
    G.phase = "prep";
    G.activePower = "UK";
    G.powers.UK.indiaStable = false;
    G.pending = null;
    const before = G.powers.UK.hand.length;
    expect(discardForIndianStability(G, makeCtx([1], seat("UK")))).toBeUndefined();
    expect(G.powers.UK.indiaStable).toBe(true);
    expect(G.powers.UK.hand.length).toBe(before - 1);
    expect(discardForIndianStability(G, makeCtx([1], seat("UK")))).toBe(INVALID_MOVE);
    // Another power cannot use the UK's action.
    G.phase = "prep";
    G.powers.UK.indiaStable = false;
    expect(discardForIndianStability(G, makeCtx([1], seat("FR")))).toBe(INVALID_MOVE);
  });
});

describe("12.2 an EC needs an army with a LoC", () => {
  test("a supplied army accepts the EC; an unsupplied one does not", () => {
    const G = fresh();
    placeUnit(G, "GE", "army", "berlin", 2);
    expect(canRecruitIn(G, "GE", "berlin", "eliteCorps").allowed).toBe(true);

    placeUnit(G, "GE", "army", "paris", 2);
    const cutOff = canRecruitIn(G, "GE", "paris", "eliteCorps");
    expect(cutOff.allowed).toBe(false);
    expect(cutOff.reasons.join(" ")).toMatch(/line of communication/);
  });
});

describe("12.6 the removal bar is influence-only", () => {
  test("diplomacy markers may be removed more than once per impulse", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 20;
    G.pending = null;
    G.spaces.belgium.diplomacy = "GE";
    G.spaces.netherlands.diplomacy = "GE";
    expect(removeInfluence(G, makeCtx([], seat("GE")), "belgium")).toBeUndefined();
    expect(removeInfluence(G, makeCtx([], seat("GE")), "netherlands")).toBeUndefined();
  });

  test("influence removal still has its once-per-impulse bar", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 20;
    G.pending = null;
    G.spaces.belgium.influence = "GE";
    G.spaces.netherlands.influence = "GE";
    expect(removeInfluence(G, makeCtx([], seat("GE")), "belgium")).toBeUndefined();
    expect(removeInfluence(G, makeCtx([], seat("GE")), "netherlands")).toBe(INVALID_MOVE);
  });
});

describe("12.17 errata: the whole card pays for the war", () => {
  const declare = (G: ImperialElegyState, cp: number) =>
    declareWar(G, makeCtx([], seat("GE")), "AU", "conquest", ["bohemia"], cp);

  test("a 4-CP card cannot fund a 1-CP declaration", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.wtt = 1;
    G.pending = null;
    const four = CARDS.actions.find((card) => card.cp === 4 && card.kind === "action" && card.type === "event")!;
    G.powers.GE.hand.push(four.id);
    expect(playCard(G, makeCtx([], seat("GE")), four.id, "cp")).toBeUndefined();
    expect(G.cpRemaining).toBe(4);
    expect(declare(G, 1)).toBe(INVALID_MOVE);
    expect(G.war).toBeNull();
    // Spending the whole card is the printed declaration.
    expect(declare(G, 4)).toBeUndefined();
    expect(G.war?.attacker).toBe("GE");
    expect(G.cpRemaining).toBe(0);
  });
});

describe("12.8 generic minor EC build", () => {
  test("an allied minor builds one MP-marked EC and no more", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 6;
    G.pending = null;
    G.spaces.bavaria.control = "Bavaria";
    G.spaces.bavaria.ally = "GE";
    placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    expect(buildForMinor(G, makeCtx([], seat("GE")), "Bavaria", "eliteCorps", "bavaria", 2)).toBeUndefined();
    const ec = Object.values(G.units).find((unit) => unit.owner === "Bavaria" && unit.kind === "eliteCorps");
    expect(ec).toBeDefined();
    expect(ec?.flags?.mp).toBe(true);
    expect(G.cpRemaining).toBe(4);
    // 12.8: minor powers can only have 1 EC.
    expect(buildForMinor(G, makeCtx([], seat("GE")), "Bavaria", "eliteCorps", "bavaria", 2)).toBe(INVALID_MOVE);
  });
});

describe("12.15 Special Redeployment through naval boxes", () => {
  test("an EC reaches a friendly army by sea; a port without one is refused", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 4;
    G.pending = null;
    const ec = placeUnit(G, "GE", "eliteCorps", "north-atlantic", 1);
    G.spaces.brittany.control = "GE";
    G.spaces.brittany.occupiedBy = null;
    for (const id of [...G.spaces.brittany.units]) removeUnit(G, id);
    const hostless = placeUnit(G, "GE", "eliteCorps", "north-atlantic", 1);
    G.spaces.aquitaine.control = "GE";
    G.spaces.aquitaine.occupiedBy = null;
    for (const id of [...G.spaces.aquitaine.units]) removeUnit(G, id);
    // Aquitaine is a friendly port with no army: refused.
    expect(redeploy(G, makeCtx([], seat("GE")), hostless.id, "aquitaine")).toBe(INVALID_MOVE);
    // Brittany holds a friendly army: the naval-box route is legal.
    placeUnit(G, "GE", "army", "brittany", 2);
    expect(redeploy(G, makeCtx([], seat("GE")), ec.id, "brittany")).toBeUndefined();
    expect(G.units[ec.id].space).toBe("brittany");
    expect(G.cpRemaining).toBe(3);
  });
});

describe("9.1.4 a discarded mandatory event still triggers", () => {
  test("A073's random discard resolves the discarded mandatory event", () => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "GE";
    G.cpRemaining = 0;
    G.pending = null;
    G.turn = 4;
    // A094 The Boxer Rebellion is a mandatory event; it is the only card FR
    // can discard, and its handler places Boxer rebels in Qing China.
    G.spaces.shanghai.control = "GE";
    for (const power of POWERS) G.powers[power].hand = [];
    G.powers.FR.hand = ["IE-A094"];
    G.powers.GE.hand = ["IE-A073"];
    expect(playCard(G, makeCtx([], seat("GE")), "IE-A073", "event")).toBeUndefined();
    // Every uneliminated player is asked, in print order — GE first, even with
    // an empty hand (its "discard" then converts to the -1 card marker).
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("GE");
    const geMarkers = G.powers.GE.cardMarkers;
    expect(resolvePending(G, makeCtx([], seat("GE")), "discard")).toBeUndefined();
    // GE chose to discard but has no card: the printed -1 card marker.
    expect(G.powers.GE.cardMarkers).toBe(geMarkers - 1);
    // UK is next (print order), also with an empty hand.
    expect(G.pending?.power).toBe("UK");
    expect(resolvePending(G, makeCtx([], seat("UK")), "discard")).toBeUndefined();
    // FR is next and still holds A094; AU, RU and OT follow with empty hands.
    expect(G.pending?.power).toBe("FR");
    expect(resolvePending(G, makeCtx([], seat("FR")), "discard")).toBeUndefined();
    for (const power of ["AU", "RU", "OT"] as const) {
      expect(G.pending?.power).toBe(power);
      expect(resolvePending(G, makeCtx([], seat(power)), "discard")).toBeUndefined();
    }
    expect(G.pending).toBeNull();
    // The discarded mandatory event resolved: the Boxers are on the map.
    expect(G.spaces.shanghai.rebellion).not.toBeNull();
    expect(G.discard).toContain("IE-A094");
    expect(G.resolvingCard).toBeNull();
  });
});
