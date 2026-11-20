/**
 * A25 Divide and Conquer.
 *
 * Found while playing the hotseat: the card opened only a two-option "OR"
 * choice, then the engine added 2 to the *first* legal pacification space (or
 * removed the *first* rebel army on the whole map).  It never asked which
 * space, never rolled the printed pacification attempt, never placed or moved
 * the EF, and the errata's Egyptian special was not reachable at all.
 *
 * These cases drive the real `playCard` / `resolvePending` path with the printed
 * space choices and the printed two-dice roll.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {setSpaceControl} from "./engine/rules";
import {playCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 3,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const beginCard = (power: Power, card: string): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[power].flags.homeChosen = true;
  G.powers[power].hand = [card];
  return G;
};

const begin = (power: Power = "GE"): ImperialElegyState => beginCard(power, "IE-A025");

const options = (G: ImperialElegyState): string[] => G.pending?.options.map((o) => o.id) ?? [];

const answer = (G: ImperialElegyState, ctx: Ctx, id: string): void => {
  expect(resolvePending(G, ctx, id)).toBeUndefined();
};

describe("A25 Divide and Conquer", () => {
  test("pacify asks for the space, adds 2 before the roll, and succeeds on a high roll", () => {
    const G = begin("GE");
    // Saxony: GE influence, a GE army, no control marker, marker 0.
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    G.spaces.saxony.pacification = 0;
    placeUnit(G, "GE", "army", "saxony", 2);
    const ctx = makeCtx([6, 6], seat("GE"));

    playCard(G, ctx, "IE-A025", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G)).toContain("pacify:saxony");
    // Nothing happens until the player picks the space.
    expect(G.spaces.saxony.control).toBeNull();
    expect(G.spaces.saxony.pacification).toBe(0);

    answer(G, ctx, "pacify:saxony");
    // 2 (card) + 12 (dice) = 14, so the printed 10+ success replaces the
    // influence marker with control and clears the marker.
    expect(G.spaces.saxony.control).toBe("GE");
    expect(G.spaces.saxony.pacification).toBe(0);
    expect(G.log.some((entry) => entry.key === "pacified" && entry.args?.space === "saxony")).toBe(true);
    expect(G.log.some((entry) => entry.key === "divideAndConquer" && entry.args?.mode === "pacify")).toBe(true);
  });

  test("a low roll keeps the +2 and raises the marker by the printed +1 on failure", () => {
    const G = begin("GE");
    G.spaces.saxony.control = null;
    G.spaces.saxony.influence = "GE";
    G.spaces.saxony.pacification = 0;
    placeUnit(G, "GE", "army", "saxony", 2);
    const ctx = makeCtx([1, 1], seat("GE"));

    playCard(G, ctx, "IE-A025", "event");
    answer(G, ctx, "pacify:saxony");
    // 2 (card) + 2 (dice) = 4: failure raises the marker from 2 to 3.
    expect(G.spaces.saxony.control).toBeNull();
    expect(G.spaces.saxony.pacification).toBe(3);
  });

  test("rebel mode removes the chosen rebel, lets the player move an EF, then pacifies", () => {
    const G = begin("FR");
    G.spaces["west-africa"].control = null;
    G.spaces["west-africa"].influence = "FR";
    G.spaces["west-africa"].pacification = 0;
    const rebel = placeUnit(G, "REBEL:Tuareg", "rebelArmy", "west-africa", 2);
    const ef = placeUnit(G, "FR", "expeditionary", "algeria", 1);
    const ctx = makeCtx([6, 6], seat("FR"));

    playCard(G, ctx, "IE-A025", "event");
    expect(options(G)).toContain("rebel:west-africa");
    answer(G, ctx, "rebel:west-africa");
    // The rebel is gone and the EF choice is open; nothing is auto-moved.
    expect(G.units[rebel.id]).toBeUndefined();
    expect(G.units[ef.id].space).toBe("algeria");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(options(G)).toEqual(expect.arrayContaining(["new", "none", `move:${ef.id}`]));

    answer(G, ctx, `move:${ef.id}`);
    expect(G.units[ef.id].space).toBe("west-africa");
    expect(G.spaces["west-africa"].control).toBe("FR");
  });

  test("the Egyptian special needs an independent Egypt and a diplomacy marker", () => {
    const G = begin("FR");
    // Campaign starts with Egypt independent, but not with a FR diplomacy
    // marker.  Without the marker the special is not offered.
    expect(G.spaces.egypt.control).toBe("Egypt");
    const ctx = makeCtx([3, 3], seat("FR"));
    playCard(G, ctx, "IE-A025", "event");
    expect(options(G)).not.toContain("egypt");
  });

  test("the Egyptian special removes the Egyptian army and returns all Egyptian spaces to OT", () => {
    const G = begin("FR");
    G.spaces.egypt.control = "Egypt";
    G.spaces.egypt.diplomacy = "FR";
    G.spaces.egypt.ally = null;
    const egyptArmy = placeUnit(G, "Egypt", "army", "egypt", 2);
    const sinaiArmy = placeUnit(G, "Egypt", "army", "sinai", 1);
    const ctx = makeCtx([3, 3], seat("FR"));

    playCard(G, ctx, "IE-A025", "event");
    expect(options(G)).toContain("egypt");
    answer(G, ctx, "egypt");

    expect(G.units[egyptArmy.id]).toBeUndefined();
    expect(G.units[sinaiArmy.id]).toBeUndefined();
    for (const id of ["egypt", "great-sand-sea", "sinai"]) {
      expect(G.spaces[id].control).toBe("OT");
      expect(G.spaces[id].diplomacy).toBeNull();
    }
    expect(G.log.some((entry) => entry.key === "divideAndConquer" && entry.args?.mode === "egypt")).toBe(true);
  });
});


describe("A37 The Great Game", () => {
  test("the chosen space gets the printed pacification roll, not a flat +1", () => {
    const G = beginCard("UK", "IE-A037");
    G.spaces.afghanistan.control = null;
    G.spaces.afghanistan.influence = "UK";
    G.spaces.afghanistan.pacification = 0;
    const ctx = makeCtx([6, 6], seat("UK"));

    playCard(G, ctx, "IE-A037", "event");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    answer(G, ctx, "afghanistan");
    // 12 + 0 marker = 12: the roll succeeds and takes control.  The old
    // handler only added +1 to the marker and never rolled.
    expect(G.spaces.afghanistan.control).toBe("UK");
    expect(G.spaces.afghanistan.pacification).toBe(0);
    expect(placeUnitCount(G, "UK", "expeditionary", "afghanistan")).toBe(1);
  });

  test("another power's influence is not overwritten", () => {
    const G = beginCard("UK", "IE-A037");
    G.spaces.afghanistan.control = null;
    G.spaces.afghanistan.influence = "RU";
    const ctx = makeCtx([3, 3], seat("UK"));
    playCard(G, ctx, "IE-A037", "event");
    expect(options(G)).not.toContain("afghanistan");
  });
});

const placeUnitCount = (G: ImperialElegyState, owner: Power, kind: string, space: string): number =>
  Object.values(G.units).filter((unit) => unit.owner === owner && unit.kind === kind && unit.space === space).length;
