/**
 * Errata pass — `IE_ERRATA_-_Mar_20_2026.pdf` (last updated Mar. 13, 2026).
 *
 * Five printed clauses the errata changes, each pinned here:
 *
 *  - 33.6 OT EC limit: "OT is limited to building one EC until the play of the
 *    Young Turks mandatory event."  Rule 12.2 has no per-player EC ceiling, so
 *    every other power is limited only by its printed counter chart (4.2) —
 *    GE four, FR three, UK/AU/RU two.
 *  - Cards 23/24 New Rifles / New Artillery: "This modifier is a total of +1,
 *    not +1 per army" and it applies to whichever side the owner fights on.
 *  - 19.1/19.8: units using naval movement in European Waters may continue the
 *    interrupted move only "if they won a decisive victory".
 *  - 3.2.5.2: "Egypt starts the campaign game as a dual home space", so a war
 *    of liberation cannot target it (13.1's dual-home exception).
 *  - Card 96 Empire of the Sun: "Playable after Meiji Restoration and if Japan
 *    is not controlled by another player."
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit, removeUnit} from "./engine/effects";
import {validateWarAim} from "./engine/limitedWar";
import {beginLandBattle} from "./engine/combat";
import {canRecruitIn, eliteCorpsCap} from "./engine/characteristics";
import {eventPlayability} from "./engine/playability";
import {navalUnitsIn} from "./engine/rules";
import {recruit, navalMove, playResponseCard, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "1"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
      Number: () => 1,
      Shuffle: (a: unknown[]) => a,
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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const seat = (power: Power): string => String(POWERS.indexOf(power));

const startAction = (G: ImperialElegyState, power: Power, cp = 8): void => {
  G.phase = "action";
  G.activePower = power;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

const ecCount = (G: ImperialElegyState, power: Power): number =>
  Object.values(G.units).filter((unit) => unit.owner === power && unit.kind === "eliteCorps").length;

// ---------------------------------------------------------------------------
// Errata 33.6 / rule 12.2 — elite corps ceilings
// ---------------------------------------------------------------------------
describe("errata 33.6: the one-EC ceiling is the Ottomans' alone", () => {
  test("GE builds up to its four printed counters, not one", () => {
    const G = fresh();
    startAction(G, "GE");
    expect(eliteCorpsCap(G, "GE")).toBeNull();
    const start = ecCount(G, "GE"); // the campaign setup prints one GE EC
    for (let i = start; i < 4; i += 1) {
      expect(recruit(G, makeCtx([], seat("GE")), "berlin", "eliteCorps")).toBeUndefined();
    }
    expect(ecCount(G, "GE")).toBe(4);
    // The fifth is refused by the printed counter pool (4.2), not by a rule cap.
    expect(recruit(G, makeCtx([], seat("GE")), "berlin", "eliteCorps")).toBe(INVALID_MOVE);
  });

  test("the Orders-panel gate agrees with the move", () => {
    const G = fresh();
    startAction(G, "OT");
    expect(canRecruitIn(G, "OT", "istanbul", "eliteCorps").allowed).toBe(true);
    expect(recruit(G, makeCtx([], seat("OT")), "istanbul", "eliteCorps")).toBeUndefined();
    const blocked = canRecruitIn(G, "OT", "istanbul", "eliteCorps");
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons.join(" ")).toContain("33.6");
    G.persistent.otTwoElite = true;
    expect(canRecruitIn(G, "OT", "istanbul", "eliteCorps").allowed).toBe(true);
  });

  test("the Ottomans build one EC until The Young Turks, then two", () => {
    const G = fresh();
    startAction(G, "OT");
    expect(eliteCorpsCap(G, "OT")).toBe(1);
    expect(recruit(G, makeCtx([], seat("OT")), "istanbul", "eliteCorps")).toBeUndefined();
    expect(recruit(G, makeCtx([], seat("OT")), "istanbul", "eliteCorps")).toBe(INVALID_MOVE);
    expect(ecCount(G, "OT")).toBe(1);

    G.persistent.otTwoElite = true;
    expect(eliteCorpsCap(G, "OT")).toBe(2);
    expect(recruit(G, makeCtx([], seat("OT")), "istanbul", "eliteCorps")).toBeUndefined();
    expect(recruit(G, makeCtx([], seat("OT")), "istanbul", "eliteCorps")).toBe(INVALID_MOVE);
    expect(ecCount(G, "OT")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cards 23/24 — the war-long +1 follows its owner's side
// ---------------------------------------------------------------------------
const warState = (attacker: Power, defender: Power): WarState =>
  ({
    attacker,
    defender,
    attackerAllies: [],
    defenderAllies: [],
    attackerMinors: [],
    defenderMinors: [],
    warAim: "conquest",
    objectives: [],
    status: "maneuver",
    budgets: {},
    initiative: [],
    treaties: [],
    victor: null,
    truceTurns: 2,
    passed: [],
    startedTurn: 1,
  }) as unknown as WarState;

/** GE holds Berlin with two armies; AU attacks it from Saxony. */
const defenceBattle = (G: ImperialElegyState) => {
  G.war = warState("AU", "GE");
  G.phase = "wartime";
  G.activePower = "AU";
  G.pending = null;
  placeUnit(G, "GE", "army", "berlin", 2);
  placeUnit(G, "GE", "army", "berlin", 2);
  placeUnit(G, "AU", "army", "saxony", 2);
  return beginLandBattle(G, makeCtx([], seat("AU")), "AU", "saxony", "berlin");
};

describe("cards 23/24: the war DRM is a total +1 for its owner's side", () => {
  test("the owner's +1 applies when it defends, and it is not per army", () => {
    const baseline = fresh();
    const baselineBattle = defenceBattle(baseline);
    expect(baselineBattle).not.toBeNull();

    const withCard = fresh();
    withCard.war = warState("AU", "GE");
    withCard.phase = "wartime";
    withCard.activePower = "GE";
    withCard.pending = null;
    withCard.powers.GE.hand.push("IE-A023");
    expect(playResponseCard(withCard, makeCtx([], seat("GE")), "IE-A023")).toBeUndefined();
    expect(withCard.flags.warLandDrm).toBe(1);
    expect(withCard.powers.GE.flags.warLandDrm).toBe(true);

    const boostedBattle = defenceBattle(withCard);
    expect(boostedBattle).not.toBeNull();
    // Two defending armies still add exactly one to the defence total.
    expect(boostedBattle!.defenderDrm).toBe(baselineBattle!.defenderDrm + 1);
    // The attacker (AU) gets nothing from GE's card.
    expect(boostedBattle!.attackerDrm).toBe(baselineBattle!.attackerDrm);
  });

  test("the owner's +1 still applies when it attacks", () => {
    const baseline = fresh();
    baseline.war = warState("GE", "AU");
    baseline.phase = "wartime";
    baseline.activePower = "GE";
    baseline.pending = null;
    placeUnit(baseline, "AU", "army", "saxony", 2);
    const baselineBattle = beginLandBattle(baseline, makeCtx([], seat("GE")), "GE", "berlin", "saxony");
    expect(baselineBattle).not.toBeNull();

    const withCard = fresh();
    withCard.war = warState("GE", "AU");
    withCard.phase = "wartime";
    withCard.activePower = "GE";
    withCard.pending = null;
    withCard.powers.GE.hand.push("IE-A024");
    expect(playResponseCard(withCard, makeCtx([], seat("GE")), "IE-A024")).toBeUndefined();
    placeUnit(withCard, "AU", "army", "saxony", 2);
    const boostedBattle = beginLandBattle(withCard, makeCtx([], seat("GE")), "GE", "berlin", "saxony");
    expect(boostedBattle).not.toBeNull();
    expect(boostedBattle!.attackerDrm).toBe(baselineBattle!.attackerDrm + 1);
  });
});

// ---------------------------------------------------------------------------
// Errata 19.1/19.8 — continuation only after a decisive victory
// ---------------------------------------------------------------------------
const clearNaval = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** UK (seat 1) moves into the North Atlantic where FR ships wait, with a FR
 *  port (Brittany) able to attempt a 19.1 interception. */
const contact = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "UK";
  G.passed = [];
  G.pending = null;
  G.pendingStack = [];
  G.battle = null;
  G.cpRemaining = 6;
  G.war = warState("UK", "FR");
  for (const power of POWERS) {
    G.powers[power].hand = [];
    G.powers[power].gwCard = null;
  }
  for (const space of ["north-atlantic", "brittany", "london", "western-mediterranean"]) {
    clearNaval(G, space);
  }
  placeUnit(G, "FR", "squadron", "north-atlantic", 2);
  placeUnit(G, "FR", "squadron", "brittany", 2);
  const ship = placeUnit(G, "UK", "squadron", "london", 2).id;
  expect(navalMove(G, makeCtx([], seat("UK")), [ship], "north-atlantic")).toBeUndefined();
  expect(G.pending?.kind).toBe("navalInterception");
  return G;
};

describe("errata 19.1/19.8: only a decisive victory continues the move", () => {
  test("a plain win ends the interrupted naval movement", () => {
    const G = contact();
    // The interception roll fails, the contacted FR squadron chooses to fight,
    // and the dice (2 vs 1, plus the UK port edge) give a plain two-point win —
    // not the errata's decisive victory.
    expect(resolvePending(G, makeCtx([1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalAvoid");
    expect(resolvePending(G, makeCtx([2, 1], seat("FR")), "fight")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.log.some((entry) => entry.key === "battleEnded" && entry.args?.winner === "attacker")).toBe(true);
    expect(G.log.some((entry) => entry.key === "battleEnded" && entry.args?.decisive === true)).toBe(false);
    // 19.8's port move is unconditional, so it may still open.
    if (G.pending?.kind === "navalPortContinuation") {
      expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    }
    expect(G.pending?.kind).not.toBe("navalContinuation");
    expect(G.navalContinuation).toBeNull();
  });

  test("a decisive win still offers the continuation", () => {
    const G = contact();
    // 6 vs 1 is a differential of five: the CRT's decisive battle (18.8).
    expect(resolvePending(G, makeCtx([5, 6, 1], seat("FR")), "intercept:brittany")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.pending?.kind).toBe("navalPortContinuation");
    expect(resolvePending(G, makeCtx([], seat("UK")), "stay")).toBeUndefined();
    expect(G.pending?.kind).toBe("navalContinuation");
    expect(G.navalContinuation).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Errata 3.2.5.2 — Egypt starts as a dual home space
// ---------------------------------------------------------------------------
describe("errata 3.2.5.2: Egypt is a dual home space from setup", () => {
  test("a war of liberation cannot target Egypt", () => {
    const G = fresh();
    G.spaces.egypt.control = "UK";
    const result = validateWarAim(G, "OT", "UK", "liberation", ["egypt"]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "liberation-dual-home")).toBe(true);
  });

  test("a war of conquest still may", () => {
    const G = fresh();
    G.spaces.egypt.control = "UK";
    expect(validateWarAim(G, "OT", "UK", "conquest", ["egypt"]).ok).toBe(true);
  });

  test("an ordinary home space is still liberatable", () => {
    const G = fresh();
    G.spaces.tripoli.control = "UK";
    expect(validateWarAim(G, "OT", "UK", "liberation", ["tripoli"]).ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Card 96 — Japan must not be controlled by another player
// ---------------------------------------------------------------------------
describe("card 96 Empire of the Sun: Japan must be free", () => {
  test("blocked while another player controls Japan", () => {
    const G = fresh();
    G.persistent.meiji = true;
    G.spaces.japan.control = "UK";
    expect(eventPlayability(G, "FR", "IE-A096")).toEqual({ok: false, reason: "japan-controlled"});
    // The controlling player may still play it.
    expect(eventPlayability(G, "UK", "IE-A096").ok).toBe(true);
  });

  test("allowed while Japan stands on its own", () => {
    const G = fresh();
    G.persistent.meiji = true;
    G.spaces.japan.control = "Japan";
    expect(eventPlayability(G, "FR", "IE-A096").ok).toBe(true);
  });

  test("Meiji Restoration is still required first", () => {
    const G = fresh();
    G.spaces.japan.control = "Japan";
    expect(eventPlayability(G, "FR", "IE-A096")).toEqual({ok: false, reason: "meiji"});
  });
});
