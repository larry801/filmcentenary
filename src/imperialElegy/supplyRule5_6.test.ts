/**
 * 5.6 / 5.6.3 — supply is traced from a controlled home **key**, and a broken
 * peacetime LoC is repaired *immediately*, not at the next impulse.
 *
 * Two defects were live in the shared engine:
 *
 *  1. `locFriendlySpace` accepted any space the power or a wartime ally merely
 *     *held*, home territory included.  A player could therefore draw supply
 *     from an ordinary home space (or from an ally's home territory) even
 *     though it controlled no home key there.  Britain holding Shanghai (a
 *     foreign key) sat in supply.
 *  2. `displacePeacetimeBrokenLoc` only ran at the start of the owning player's
 *     impulse, so an army stranded by an event or a treaty stayed out of supply
 *     for the rest of the turn.  5.6.3 prints "immediately displace".
 */
import type {Ctx} from "boardgame.io";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {
  beginImpulseUpkeep,
  hasLoc,
  isSupplySource,
  repairBrokenLinesOfCommunication,
} from "./engine/rules";
import {resolvePending} from "./moves";

const makeCtx = (): Ctx => ({
  playerID: "0",
  random: {Die: () => 3},
  events: {
    setPhase: () => undefined,
    setActivePlayers: () => undefined,
    endGame: () => undefined,
    endTurn: () => undefined,
  },
  turn: 1,
  phase: "action",
} as unknown as Ctx);

const blank = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  G.phase = "action";
  G.units = {};
  for (const state of Object.values(G.spaces)) {
    state.control = null;
    state.occupiedBy = null;
    state.ally = null;
    state.influence = null;
    state.homeOverride = null;
    state.keyTypeOverride = undefined;
    state.units = [];
  }
  for (const power of POWERS) G.powers[power].alliance = "neutral";
  return G;
};

const own = (G: ImperialElegyState, power: Power, ...spaces: string[]) => {
  for (const space of spaces) G.spaces[space].control = power;
};

const war = (G: ImperialElegyState, attacker: Power = "GE", defender: Power = "FR") => {
  G.phase = "wartime";
  G.war = {
    attacker, defender, attackerAllies: [], defenderAllies: [], attackerMinors: [], defenderMinors: [],
    warAim: "conquest", objectives: [], status: "maneuver", budgets: {}, initiative: [], treaties: [],
    victor: null, truceTurns: 2, passed: [], startedTurn: 1,
  } as unknown as WarState;
};

// ---------------------------------------------------------------------------
// 5.6 — sources must be controlled home KEYS
// ---------------------------------------------------------------------------

test("a foreign key a power holds with no home key there gives no supply", () => {
  const G = blank();
  // UK holds London (its own home key) and Shanghai (Qing China's key).  The
  // Shanghai garrison has no British home key behind it.
  own(G, "UK", "london");
  G.spaces.shanghai.occupiedBy = "UK";
  expect(isSupplySource(G, "UK", "shanghai", false)).toBe(false);
});

test("an occupied foreign home territory is not a source for the occupier", () => {
  const G = blank();
  // Russia holds two home keys and occupies Galicia, an Austrian home space.
  own(G, "RU", "moscow", "sevastopol");
  G.spaces.galicia.occupiedBy = "RU";
  expect(isSupplySource(G, "RU", "galicia", false)).toBe(false);
});

test("wartime supply does not run through an ally's ordinary home territory", () => {
  const G = blank();
  war(G);
  own(G, "GE", "berlin");
  own(G, "AU", "galicia");
  G.war!.attackerAllies.push("AU");
  expect(hasLoc(G, "GE", "galicia")).toBe(false);
});

test("wartime supply runs through an ally's controlled home key it could not use at peace", () => {
  const G = blank();
  own(G, "GE", "berlin", "silesia");
  own(G, "AU", "saxony");
  G.spaces.saxony.occupiedBy = "GE";
  // The peacetime trace only follows German control, so the occupied
  // Austrian key next to Silesia cannot certify a second source.
  expect(isSupplySource(G, "GE", "silesia")).toBe(false);
  war(G, "GE", "FR");
  // The occupied ally key is friendly during the war; it still cannot be a
  // *second source* for Germany itself, which needs a German home key.
  expect(isSupplySource(G, "GE", "saxony", false)).toBe(false);
  // Austria's entry makes its occupied home key a friendly corridor.
  G.war!.attackerAllies.push("AU");
  const army = placeUnit(G, "GE", "army", "silesia", 2);
  expect(isSupplySource(G, "GE", "silesia")).toBe(true);
  expect(hasLoc(G, "GE", "silesia")).toBe(true);
  expect(G.units[army.id].space).toBe("silesia");
});

// ---------------------------------------------------------------------------
// 5.6.3 — broken lines repair immediately
// ---------------------------------------------------------------------------

test("repairBrokenLinesOfCommunication displaces a stranded army at once", () => {
  const G = blank();
  own(G, "GE", "berlin", "pomerania");
  // Galicia is Austrian: the German army standing there has no German home key
  // it can reach, so it is out of supply and must leave.
  const army = placeUnit(G, "GE", "army", "galicia", 2);
  expect(hasLoc(G, "GE", "galicia")).toBe(false);
  const moved = repairBrokenLinesOfCommunication(G, "GE");
  expect(moved).toBe(1);
  expect(G.units[army.id].space).not.toBe("galicia");
  expect(hasLoc(G, "GE", G.units[army.id].space!)).toBe(true);
});

test("the impulse upkeep still repairs a peacetime broken LoC", () => {
  const G = blank();
  own(G, "GE", "berlin", "pomerania");
  const army = placeUnit(G, "GE", "army", "galicia", 2);
  expect(beginImpulseUpkeep(G, makeCtx(), "GE")).toBe(false);
  expect(G.units[army.id].space).not.toBe("galicia");
  // 5.6.3 is a displacement, never a step loss.
  expect(G.units[army.id].steps).toBe(2);
});

// ---------------------------------------------------------------------------
// 5.6.3 — the live move layer repairs a broken LoC in the same resolution
// ---------------------------------------------------------------------------

const moveCtx = (): Ctx => ({
  playerID: "0",
  random: {Die: () => 3},
  events: {setPhase: () => undefined, setActivePlayers: () => undefined, endGame: () => undefined, endTurn: () => undefined},
  turn: 1,
  phase: "action",
} as unknown as Ctx);

test("a resolved event does not move an army that is still in supply", () => {
  const G = blank();
  own(G, "GE", "pomerania", "silesia");
  const army = placeUnit(G, "GE", "army", "silesia", 2);
  expect(hasLoc(G, "GE", "silesia")).toBe(true);
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 4;
  G.pending = {
    kind: "eventTargetSpace",
    power: "GE",
    prompt: "Choose a space",
    promptZh: "选择一个空间",
    options: [{id: "hanover", label: "Hanover", labelZh: "汉诺威"}],
    context: {special: "removeAnyMinorAlliance"},
  } as unknown as ImperialElegyState["pending"];
  // The event hands Hanover to France; Silesia's own supply is untouched.
  G.powers.GE.hand = [];
  own(G, "FR", "hanover");
  expect(resolvePending(G, moveCtx(), "hanover")).toBeUndefined();
  expect(G.units[army.id].space).toBe("silesia");
  expect(G.log.some((entry) => entry.key === "brokenLocDisplaced")).toBe(false);
});
