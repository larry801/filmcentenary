/**
 * 12.11.2 — pacification markers in controlled spaces and the two special
 * counters (Graveyard of Empires 12+, Boers 11+).
 *
 * The live gate only accepted an influence marker, so an event marker placed in
 * a player-controlled space (A13/A14 Colonial Conflict, A86 Boer Wars) could
 * never be removed: the controller has control, not influence.  A86 also added
 * +2 to the normal 10+ marker, making the Boers easier than the printed 11+,
 * and neither special counter's raised target was read.
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {pacificationProblem} from "./engine/pacification";
import {playCard, pacify, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3},
    events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
    turn: 3,
    phase: "action",
  } as unknown as Ctx;
};

const seat = (power: Power): string => String(POWERS.indexOf(power));

const begin = (power: Power = "UK"): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = 8;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers[power].flags.homeChosen = true;
  return G;
};

describe("12.11.2 pacification in a controlled space", () => {
  test("the controller can clear an event marker without an influence marker", () => {
    const G = begin("UK");
    G.spaces["south-africa"].control = "UK";
    G.spaces["south-africa"].influence = null;
    G.spaces["south-africa"].pacification = 0;
    placeUnit(G, "UK", "army", "south-africa", 2);
    expect(pacificationProblem(G, "UK", "south-africa")).toBeNull();

    const ctx = makeCtx([6, 6], seat("UK"));
    expect(pacify(G, ctx, "south-africa")).toBeUndefined();
    expect(G.spaces["south-africa"].control).toBe("UK");
    expect(G.spaces["south-africa"].pacification).toBe(0);
  });

  test("another power cannot clear the controller's marker", () => {
    const G = begin("UK");
    G.spaces["south-africa"].control = "FR";
    G.spaces["south-africa"].pacification = 0;
    placeUnit(G, "UK", "army", "south-africa", 2);
    expect(pacificationProblem(G, "UK", "south-africa")).toBe("not-controller");
  });
});

describe("12.11.2 special counters", () => {
  test("A86 places the Boer marker at 0, not +2", () => {
    const G = begin("UK");
    G.spaces["south-africa"].control = "UK";
    G.spaces["south-africa"].pacification = 0;
    placeUnit(G, "UK", "army", "south-africa", 2);
    G.powers.UK.hand = ["IE-A086"];
    G.cpRemaining = 0;
    const ctx = makeCtx([3, 3], seat("UK"));
    playCard(G, ctx, "IE-A086", "event");
    expect(G.spaces["south-africa"].pacification).toBe(0);
    expect(G.persistent.boers).toBe("south-africa");
  });

  test("the Boers need 11+: a 10 fails and an 11 clears the counter", () => {
    const G = begin("UK");
    G.spaces["south-africa"].control = "UK";
    G.spaces["south-africa"].influence = null;
    G.spaces["south-africa"].pacification = 0;
    placeUnit(G, "UK", "army", "south-africa", 2);
    G.persistent.boers = "south-africa";
    const ctx = makeCtx([5, 5], seat("UK"));
    expect(pacify(G, ctx, "south-africa")).toBeUndefined();
    expect(G.persistent.boers).toBe("south-africa");
    expect(G.spaces["south-africa"].pacification).toBe(1);

    // A fresh impulse can retry; 6 + 5 = 11 succeeds against the special 11+.
    delete G.powers.UK.flags["pacifiedThisImpulse:south-africa"];
    G.cpRemaining = 8;
    const retry = makeCtx([6, 5], seat("UK"));
    expect(pacify(G, retry, "south-africa")).toBeUndefined();
    expect(G.persistent.boers).toBeUndefined();
    expect(G.spaces["south-africa"].pacification).toBe(0);
  });

  test("Graveyard of Empires needs 12+: an 11 fails and a 12 clears it", () => {
    const G = begin("UK");
    G.spaces.afghanistan.control = null;
    G.spaces.afghanistan.influence = "UK";
    G.spaces.afghanistan.pacification = 0;
    placeUnit(G, "UK", "army", "afghanistan", 2);
    G.persistent.goe = "afghanistan";
    const ctx = makeCtx([6, 5], seat("UK"));
    expect(pacify(G, ctx, "afghanistan")).toBeUndefined();
    expect(G.persistent.goe).toBe("afghanistan");
    expect(G.spaces.afghanistan.pacification).toBe(1);

    delete G.powers.UK.flags["pacifiedThisImpulse:afghanistan"];
    G.cpRemaining = 8;
    const retry = makeCtx([6, 6], seat("UK"));
    expect(pacify(G, retry, "afghanistan")).toBeUndefined();
    expect(G.persistent.goe).toBeUndefined();
    expect(G.spaces.afghanistan.control).toBe("UK");
  });
});
