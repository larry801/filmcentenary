import type {Ctx} from "boardgame.io";
import type {
  BattleState,
  GreatWarState,
  ImperialElegyState,
  Power,
  WarState,
} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  beginLandBattle,
  chooseGwReroll,
  chooseSupport,
  chooseSupportDeny,
  finishBattle,
  playCombatCard,
  supportCandidates,
} from "./engine/combat";
import {
  availableCombatCards,
  facedownGwCombatCards,
  faceupCombatCardIdsInFront,
  gwCombatCardsInFront,
} from "./engine/combatCards";
import {
  beginGwTurn,
  chooseGw05FlipCard,
  faceupCombatCards,
  flipFaceDownGwCombatCard,
} from "./engine/greatWarFlow";
import {placeUnit, removeUnit, resolveEffects} from "./engine/effects";
import {resolvePending} from "./moves";
import {landUnitsIn} from "./engine/rules";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3,
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

const clearHands = (G: ImperialElegyState): void => {
  for (const power of POWERS) G.powers[power].hand = [];
};

const warState = (attacker: Power, defender: Power): WarState => ({
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
} as unknown as WarState);

const gwState = (turn: number): GreatWarState => ({
  active: true,
  turn,
  order: ["GE", "FR"],
  belligerents: ["GE", "FR"],
  neutrals: ["UK", "AU", "RU", "OT"],
  te: ["FR"],
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
  combatCardsInFront: [],
});

const clearLandUnits = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space)]) removeUnit(G, unit.id);
};

/** Clear every support window; a minor defender auto-commits without one. */
const finishSupportWindows = (G: ImperialElegyState, ctx: Ctx): void => {
  let guard = 0;
  while (G.pending?.kind === "combatSupport" && guard++ < 6) chooseSupport(G, ctx, "done");
};

const cardOptions = (G: ImperialElegyState): string[] =>
  (G.pending?.options ?? []).map((entry) => String(entry.id)).filter((id) => id.startsWith("card:"));

const unitOwners = (G: ImperialElegyState, candidate: {units: string[]}): string[] =>
  candidate.units.map((id) => String(G.units[id]?.owner));

/**
 * A normal three-army-vs-three-army land battle with both sides' printed DRM
 * flags neutralised so dice comparisons stay deterministic.
 */
const stageEvenBattle = (
  G: ImperialElegyState,
  ctx: Ctx,
): {battle: BattleState; attackIds: string[]; defenceIds: string[]} => {
  clearLandUnits(G, "berlin");
  clearLandUnits(G, "saxony");
  const attackIds: string[] = [];
  const defenceIds: string[] = [];
  for (let i = 0; i < 3; i += 1) attackIds.push(placeUnit(G, "GE", "army", "berlin", 2).id);
  for (let i = 0; i < 3; i += 1) defenceIds.push(placeUnit(G, "FR", "army", "saxony", 2).id);
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  if (!battle) throw new Error("battle did not start");
  battle.attackerDrm = 0;
  battle.defenderDrm = 0;
  return {battle, attackIds, defenceIds};
};

// ---------------------------------------------------------------------------
// 1. Minor-defender support
// ---------------------------------------------------------------------------

describe("minor-defender support", () => {
  test("auto-commits independent minor support and never offers a defender window to the attacker", () => {
    const G = fresh();
    G.phase = "wartime";
    clearHands(G);
    G.powers.GE.hand = ["IE-A060"];
    // A German army adjacent to Saxony must never appear in the defender's
    // support candidates: the minor is defending, not the attacker.
    placeUnit(G, "GE", "army", "hanover", 2);
    const ctx = makeCtx([3, 3]);

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(battle?.notes).toContain("minorDefender");
    // The existing fallback remains: no player defender, so the battle state
    // still carries a power for the loss/retreat helpers.
    expect(battle?.defender).toBe("GE");

    const defenderSupport = supportCandidates(G, "GE", battle!, "defender");
    for (const candidate of defenderSupport) {
      expect(unitOwners(G, candidate)).not.toContain("GE");
    }

    // The attacker's support window is real; after it closes the minor's
    // legal support is committed automatically and the next window is the
    // attacker's card window, not a defender decision.
    expect(G.pending?.kind).toBe("combatSupport");
    expect(G.pending?.power).toBe("GE");
    chooseSupport(G, ctx, "done");

    expect(battle?.notes).toContain("minorAutoSupport");
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.side).toBeUndefined();
    expect(cardOptions(G)).toEqual(["card:IE-A060"]);
  });

  test("a minor's controlling ally gets the defender support/card window and the attacker's units are excluded", () => {
    const G = fresh();
    G.phase = "wartime";
    clearHands(G);
    // FR controls Saxony; only FR has a combat card.
    G.spaces.saxony.ally = "FR";
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "bavaria");
    placeUnit(G, "FR", "army", "bavaria", 2);
    // A German unit in an adjacent space must not leak into defender support.
    placeUnit(G, "GE", "army", "hanover", 2);
    const ctx = makeCtx([3, 3]);

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    expect(battle?.defender).toBe("FR");
    // The note still records that a minor was attacked; the actual decision
    // power now comes from the controlling ally.
    expect(battle?.notes).toContain("minorDefender");

    const defenderSupport = supportCandidates(G, "FR", battle!, "defender");
    expect(defenderSupport.map((entry) => entry.space)).toContain("bavaria");
    // Hanover holds a German army, but also an independent Hanoverian minor
    // army: only the attacker's own units are excluded, other minors may
    // support (halved).
    for (const candidate of defenderSupport) {
      expect(unitOwners(G, candidate)).not.toContain("GE");
    }

    chooseSupport(G, ctx, "done");
    expect(G.pending?.kind).toBe("combatSupport");
    expect(G.pending?.power).toBe("FR");

    chooseSupport(G, ctx, "bavaria");
    expect(battle?.supportDefense.map((entry) => entry.space)).toContain("bavaria");
    // A second supporting space is still legal; decline it.
    chooseSupport(G, ctx, "done");
    // The card window belongs to FR, never to the attacker.
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("FR");
    expect(cardOptions(G)).toEqual(["card:IE-A060"]);
  });
});

// ---------------------------------------------------------------------------
// 2. A058 Siege Guns
// ---------------------------------------------------------------------------

describe("A058 Siege Guns", () => {
  test("reduces the battle-space fort by two levels and queues an end-of-battle draw", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A058"];
    // FR holds a card so the battle stays live after the attacker's play.
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    G.spaces.saxony.fort = {power: "FR", level: 3};
    const ctx = makeCtx([3, 3]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    expect(G.pending?.kind).toBe("combatCard");
    expect(cardOptions(G)).toContain("card:IE-A058");
    playCombatCard(G, ctx, "IE-A058");

    // Played before the dice: level 3 -> level 1.
    expect(G.spaces.saxony.fort?.level).toBe(1);
    expect(G.battle?.notes).toContain("siegeGunsApplied");
    // The defender's response window keeps the battle live.
    expect(G.battle).not.toBeNull();
    expect(G.battle?.extraDraws).toEqual(["GE"]);
    const handAfterPlay = G.powers.GE.hand.length;
    expect(handAfterPlay).toBe(0);

    finishBattle(G, ctx);
    expect(G.powers.GE.hand.length).toBe(handAfterPlay + 1);
  });

  test("a level-2 fort is removed when reduced by two levels", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A058"];
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    G.spaces.saxony.fort = {power: "FR", level: 2};
    const ctx = makeCtx([3, 3]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    playCombatCard(G, ctx, "IE-A058");
    expect(G.spaces.saxony.fort).toBeNull();
  });

  test("if the fort was the only defender, the battle ends without dice", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A058"];
    clearLandUnits(G, "saxony");
    G.spaces.saxony.control = "FR";
    G.spaces.saxony.fort = {power: "FR", level: 2};
    const ctx = makeCtx([6, 6]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    playCombatCard(G, ctx, "IE-A058");

    // No defenders and no fort: no dice, attacker wins and advances.
    expect(G.spaces.saxony.fort).toBeNull();
    expect(G.battle).toBeNull();
    expect(landUnitsIn(G, "saxony").some((unit) => unit.owner === "GE")).toBe(true);
    // The card's end-of-battle draw still happens.
    expect(G.powers.GE.hand).toHaveLength(1);
  });

  test("a defender is not offered Siege Guns for its own fort", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A058"];
    G.powers.FR.hand = ["IE-A058"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    G.spaces.saxony.fort = {power: "FR", level: 2};
    const ctx = makeCtx([3, 3]);

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    if (!battle) throw new Error("battle did not start");
    expect(availableCombatCards(G, "FR", {...battle, cardSide: "defender"})).not.toContain("IE-A058");
    // The attacker still sees it, because the fort is enemy to GE.
    expect(availableCombatCards(G, "GE", {...battle, cardSide: "attacker"})).toContain("IE-A058");
  });
});

// ---------------------------------------------------------------------------
// 3. A059 Flank Attack
// ---------------------------------------------------------------------------

describe("A059 Flank Attack", () => {
  test("inflicts a pre-dice step loss, wins decisively on the last step, and queues a draw", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A059"];
    clearLandUnits(G, "saxony");
    G.spaces.saxony.control = "FR";
    const loneDefender = placeUnit(G, "FR", "army", "saxony", 1);
    const ctx = makeCtx([3, 3]);

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle?.mainDefense).toEqual([loneDefender.id]);
    finishSupportWindows(G, ctx);

    playCombatCard(G, ctx, "IE-A059");

    // The last step in the space is gone: the battle ends immediately as an
    // attacker decisive victory, without touching the war-level result.
    expect(G.units[loneDefender.id]).toBeUndefined();
    expect(landUnitsIn(G, "saxony").filter((unit) => unit.owner === "FR")).toHaveLength(0);
    expect(G.battle).toBeNull();
    expect(G.flags.decisiveBattle).toBe("saxony");
    expect(G.war?.victor).toBeNull();
    // The card's end-of-battle draw still happens.
    expect(G.powers.GE.hand).toHaveLength(1);
  });

  test("only targets an army, not an EC/EF, in the main defense", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A059"];
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "saxony");
    const defender = placeUnit(G, "FR", "army", "saxony", 2);
    const ec = placeUnit(G, "FR", "eliteCorps", "saxony", 1);
    const ctx = makeCtx([3, 3]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    playCombatCard(G, ctx, "IE-A059");

    expect(G.units[defender.id]?.steps).toBe(1);
    expect(G.units[ec.id]).toBeDefined();
    expect(G.battle).not.toBeNull();
  });

  test("a non-eliminating flank loss does not win the battle", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A059"];
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "saxony");
    const defender = placeUnit(G, "FR", "army", "saxony", 2);
    const ctx = makeCtx([3, 3]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    playCombatCard(G, ctx, "IE-A059");

    expect(G.units[defender.id]?.steps).toBe(1);
    expect(G.battle).not.toBeNull();
    expect(G.flags.decisiveBattle).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. A062 Miscommunication
// ---------------------------------------------------------------------------

describe("A062 Miscommunication", () => {
  test("prompts for a denied space, removes its support and queues a draw", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A062"];
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    const ctx = makeCtx([3, 3]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    expect(G.pending?.kind).toBe("combatCard");

    playCombatCard(G, ctx, "IE-A062");

    // The card opens an explicit space decision, not a silent note.  The
    // applied card lives on a fresh battle object, so read G.battle.
    const battle = G.battle!;
    expect(G.pending?.kind).toBe("combatSupport");
    expect(G.pending?.context?.supportDeny).toBe(true);
    expect(G.pending?.options.map((entry) => entry.id)).toContain("bavaria");
    expect(battle.pendingSupportDeny).toBe(true);
    // Pretend support from Bavaria was already committed; denying it must
    // remove the support from this battle.
    battle.supportAttack.push({space: "bavaria", units: [], fp: 2});
    const handAfterPlay = G.powers.GE.hand.length;

    chooseSupportDeny(G, ctx, "bavaria");

    expect(battle.supportDenied).toEqual(["bavaria"]);
    expect(battle.supportAttack.map((entry) => entry.space)).not.toContain("bavaria");
    expect(battle.pendingSupportDeny).toBe(false);
    for (const side of ["attacker", "defender"] as const) {
      const candidates = supportCandidates(G, side === "attacker" ? "GE" : "FR", battle, side);
      expect(candidates.map((entry) => entry.space)).not.toContain("bavaria");
    }
    expect(battle.extraDraws).toEqual(["GE"]);
    // The defender's response window is next; the battle continues.
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.battle).not.toBeNull();

    finishBattle(G, ctx);
    expect(G.powers.GE.hand.length).toBe(handAfterPlay + 1);
  });
});

// ---------------------------------------------------------------------------
// 5. GW-05 Capable Commander
// ---------------------------------------------------------------------------

describe("GW-05 Capable Commander", () => {
  test("offers a side choice, rerolls that die and recomputes the CRT result once", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = gwState(2);
    clearHands(G);
    G.powers.GE.gwCard = "IE-GW-05";
    // Dial 1: initial dice 4/3, then the defender's reroll is a 1.
    const ctx = makeCtx([4, 3, 1]);
    const {battle} = stageEvenBattle(G, ctx);
    finishSupportWindows(G, ctx);
    // GW-05 is after-dice, so it is not in the pre-dice window: the roll
    // happens, then the post-dice window appears.
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("GE");
    expect(cardOptions(G)).toEqual(["card:IE-GW-05"]);
    expect(battle.attackerRoll).toBe(4);
    expect(battle.defenderRoll).toBe(3);
    expect(battle.diff).toBe(1);

    playCombatCard(G, ctx, "IE-GW-05");

    expect(G.battle?.rerollPending).toBe(true);
    expect(G.pending?.kind).toBe("combatSupport");
    expect(G.pending?.context?.gwReroll).toBe(true);
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["attacker", "defender"]);

    chooseGwReroll(G, ctx, "defender");

    const after = G.battle!;
    expect(after.defenderRoll).toBe(1);
    expect(after.attackerRoll).toBe(4);
    expect(after.attackDrmTotal).toBe(0);
    expect(after.defenceDrmTotal).toBe(0);
    // (4 + 0) - (1 + 0) = +3 -> attacker 1 loss / defender 2 losses.
    expect(after.diff).toBe(3);
    expect(after.attackerLosses).toBe(1);
    expect(after.defenderLosses).toBe(2);
    expect(after.winner).toBe("attacker");
    expect(after.rerollUsed).toBe(true);
    expect(after.rerollPending).toBe(false);
    // The battle continues exactly once into the loss step.
    expect(G.pending?.kind).toBe("combatLosses");
    expect(G.pending?.power).toBe("GE");
    expect(after.stage).toBe("lossesAttack");
  });
});

// ---------------------------------------------------------------------------
// 5b. GW-05 must not double the 19.4 mine hits
// ---------------------------------------------------------------------------

test("a GW-05 reroll keeps mine hits outside the decisive doubling", () => {
  const G = fresh();
  G.phase = "gwManeuver";
  G.gw = gwState(2);
  clearHands(G);
  G.powers.GE.gwCard = "IE-GW-05";
  const ctx = makeCtx([4, 3, 1, 6]);
  const {battle} = stageEvenBattle(G, ctx);
  finishSupportWindows(G, ctx);
  playCombatCard(G, ctx, "IE-GW-05");
  expect(G.battle?.rerollPending).toBe(true);

  // Force the rerolled differential to -5 (a decisive defender win) and give
  // the port three mine hits: 2 CRT losses doubled + 3 mine hits = 7, never
  // (2 + 3) doubled = 10.
  const current = G.battle!;
  current.kind = "naval";
  current.mines = 3;
  current.attackerRoll = 1;
  current.defenderRoll = 3;
  current.notes.push("minefield");
  current.attackDrmTotal = 0;
  current.defenceDrmTotal = 0;

  chooseGwReroll(G, makeCtx([6]), "defender");

  // `afterCombatCardWindow` may finish the battle and clear `G.battle`; the
  // recorded result on the same object is what matters for the doubling rule.
  expect(current.diff).toBe(-5);
  expect(current.attackerLosses).toBe(7);
  expect(current.defenderLosses).toBe(0);
});

// ---------------------------------------------------------------------------
// 6. GW-03/GW-04 face-down lifecycle
// ---------------------------------------------------------------------------

describe("GW combat card face-down lifecycle", () => {
  test("GW-03 is placed facedown in front of the opponent after the battle and can be flipped faceup", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = gwState(3);
    clearHands(G);
    G.powers.GE.gwCard = "IE-GW-03";
    G.powers.FR.hand = ["IE-A060"];
    const ctx = makeCtx([3, 3]);
    const {battle} = stageEvenBattle(G, ctx);
    finishSupportWindows(G, ctx);
    expect(cardOptions(G)).toEqual(["card:IE-GW-03"]);

    playCombatCard(G, ctx, "IE-GW-03");
    // The defender's window keeps the battle live; the card waits for the end
    // of the battle rather than going to the discard pile.
    expect(G.battle).not.toBeNull();
    expect(G.discard).not.toContain("IE-GW-03");

    finishBattle(G, ctx);

    const inFront = gwCombatCardsInFront(G);
    expect(inFront).toHaveLength(1);
    expect(inFront[0]).toMatchObject({holder: "FR", cardId: "IE-GW-03", faceup: false});
    expect(facedownGwCombatCards(G)).toHaveLength(1);
    expect(G.discard).not.toContain("IE-GW-03");

    const flipped = flipFaceDownGwCombatCard(G, "FR", "IE-GW-03");
    expect(flipped.ok).toBe(true);
    expect(facedownGwCombatCards(G)).toHaveLength(0);
    expect(faceupCombatCardIdsInFront(G, "FR")).toContain("IE-GW-03");

    // The card is now offered from the in-front faceup state on a later turn
    // (GW-03 is attacker-only, so only when FR is the attacker).
    const frAttack = {...battle, attacker: "FR" as Power, defender: "GE" as Power};
    expect(availableCombatCards(G, "FR", frAttack)).toContain("IE-GW-03");
  });

  test("planning flips every facedown in-front card faceup", () => {
    const G = fresh();
    G.phase = "gwPlanning";
    G.gw = gwState(2);
    G.gw.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "GE", cardId: "IE-GW-04", faceup: false},
    ];
    // `beginGwTurn` is exercised indirectly: flipping is the same helper the
    // planning step uses, and no card may be used while facedown.
    const {flipFacedownGwCombatCards} = require("./engine/combatCards");
    expect(facedownGwCombatCards(G)).toHaveLength(2);
    flipFacedownGwCombatCards(G);
    expect(facedownGwCombatCards(G)).toHaveLength(0);
    expect(faceupCombatCardIdsInFront(G, "FR")).toEqual(["IE-GW-03"]);
    expect(faceupCombatCardIdsInFront(G, "GE")).toEqual(["IE-GW-04"]);
  });
});

// ---------------------------------------------------------------------------
// Audit corrections
// ---------------------------------------------------------------------------

describe("support halving for a minor-led defense", () => {
  const minorBattle = (): {G: ImperialElegyState; battle: BattleState; ctx: Ctx} => {
    const G = fresh();
    G.phase = "wartime";
    clearHands(G);
    G.spaces.saxony.ally = "FR";
    clearLandUnits(G, "bavaria");
    const ctx = makeCtx([3, 3]);
    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    if (!battle) throw new Error("battle did not start");
    return {G, battle, ctx};
  };

  test("minor units supporting the controlling power are not halved", () => {
    const {G, battle} = minorBattle();
    G.spaces.bavaria.ally = "FR";
    placeUnit(G, "Saxony", "minorArmy", "bavaria", 2);
    const candidate = supportCandidates(G, "FR", battle, "defender").find(
      (entry) => entry.space === "bavaria",
    );
    expect(candidate?.fp).toBe(2);
  });

  test("the controller's own units supporting the minor are halved for different power", () => {
    const {G, battle} = minorBattle();
    placeUnit(G, "FR", "army", "bavaria", 2);
    const candidate = supportCandidates(G, "FR", battle, "defender").find(
      (entry) => entry.space === "bavaria",
    );
    expect(candidate?.fp).toBe(1);
  });
});

describe("GW-03 trench cancellation support recompute", () => {
  test("recomputes committed support FP without the trench halving", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = gwState(3);
    clearHands(G);
    G.powers.GE.gwCard = "IE-GW-03";
    G.powers.FR.hand = ["IE-A060"];
    // 28.1.2: an adjacent attack cannot enter a space with a trench battle
    // *marker*, but the printed trench terrain still makes this a trench battle.
    G.spaces.saxony.trenchLine = true;
    // 28.1.3 halves support from a space that is itself in a trench battle.
    G.spaces.hanover.trench = {status: "defender", turn: 3};
    // One GE army in Hanover, adjacent to both Berlin and Saxony.  Only the
    // trench condition halves its support before GW-03.
    clearLandUnits(G, "hanover");
    placeUnit(G, "GE", "army", "hanover", 2);
    const ctx = makeCtx([3, 3]);
    const {battle} = stageEvenBattle(G, ctx);
    expect(battle.trench).toBe(true);

    chooseSupport(G, ctx, "hanover");
    expect(battle.supportAttack.find((entry) => entry.space === "hanover")?.fp).toBe(1);
    finishSupportWindows(G, ctx);
    expect(cardOptions(G)).toEqual(["card:IE-GW-03"]);

    playCombatCard(G, ctx, "IE-GW-03");
    const after = G.battle!;
    expect(after.notes).toContain("cancelTrenches");
    expect(after.trench).toBe(false);
    expect(after.supportAttack.find((entry) => entry.space === "hanover")?.fp).toBe(2);
  });
});

describe("GW-05 event flip and decline guards", () => {
  test("the event flip helper chooses one facedown card", () => {
    const G = fresh();
    G.gw = gwState(2);
    G.gw.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "GE", cardId: "IE-GW-04", faceup: false},
    ];
    const result = chooseGw05FlipCard(G, "IE-GW-04");
    expect(result.ok).toBe(true);
    expect(facedownGwCombatCards(G).map((entry) => entry.cardId)).toEqual(["IE-GW-03"]);
    expect(faceupCombatCardIdsInFront(G, "GE")).toEqual(["IE-GW-04"]);
  });

  test("planning flips in-front cards, excludes them from the deal and does not mark GW-05 faceup", () => {
    const G = fresh();
    G.phase = "gwPlanning";
    G.gw = gwState(2);
    G.gw.combatCardsInFront = [{holder: "FR", cardId: "IE-GW-03", faceup: false}];
    G.powers.GE.gwCard = "IE-GW-05";
    const result = beginGwTurn(G, makeCtx([2]));
    expect(result.ok).toBe(true);
    expect(facedownGwCombatCards(G)).toHaveLength(0);
    // GW-05 is a normal event/response, never a faceup combat card.
    expect(faceupCombatCards(G).GE).toBeUndefined();
    // The in-front card never re-enters the GW deck.
    for (const power of POWERS) expect(G.powers[power].gwCard).not.toBe("IE-GW-03");
  });

  test("declining A062 or a GW-05 side choice reopens the decision instead of picking option one", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A062"];
    G.powers.FR.hand = ["IE-A060"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    const ctx = makeCtx([3, 3]);

    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    playCombatCard(G, ctx, "IE-A062");
    expect(G.pending?.context?.supportDeny).toBe(true);
    // Moves' decline wrapper clears the pending first and passes "done".
    G.pending = null;
    chooseSupportDeny(G, ctx, "done");
    expect(G.pending?.context?.supportDeny).toBe(true);
    expect(G.battle?.supportDenied ?? []).toHaveLength(0);

    // Same guard for GW-05's forced side choice.
    const H = fresh();
    H.phase = "gwManeuver";
    H.gw = gwState(2);
    clearHands(H);
    H.powers.GE.gwCard = "IE-GW-05";
    const gwCtx = makeCtx([4, 3]);
    stageEvenBattle(H, gwCtx);
    finishSupportWindows(H, gwCtx);
    expect(H.pending?.kind).toBe("combatCard");
    playCombatCard(H, gwCtx, "IE-GW-05");
    expect(H.battle?.rerollPending).toBe(true);
    H.pending = null;
    chooseSupport(H, gwCtx, "done");
    expect(H.pending?.context?.gwReroll).toBe(true);
    expect(H.battle?.rerollUsed).toBeUndefined();
  });
});

describe("GW-05 event effect", () => {
  test("opens a facedown-card choice and flips the selected card", () => {
    const G = fresh();
    G.gw = gwState(2);
    G.gw.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: false},
      {holder: "GE", cardId: "IE-GW-04", faceup: false},
    ];
    const ctx = makeCtx([], "0");
    const done = resolveEffects(
      G,
      ctx,
      "GE",
      [{type: "special", handler: "gwCapableCommander"}],
      {},
    );
    expect(done).toBe(false);
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((entry) => entry.id)).toEqual(["flip0", "flip1"]);

    resolvePending(G, ctx, "flip1");

    expect(faceupCombatCardIdsInFront(G, "GE")).toEqual(["IE-GW-04"]);
    expect(facedownGwCombatCards(G).map((entry) => entry.cardId)).toEqual(["IE-GW-03"]);
  });
});

// ---------------------------------------------------------------------------
// Audit corrections: support caps, A059/A062 availability, GW discard/advance
// ---------------------------------------------------------------------------

describe("support space limits and connection rules", () => {
  test("commits at most two spaces per side and never duplicates a space", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    clearLandUnits(G, "hanover");
    clearLandUnits(G, "pomerania");
    clearLandUnits(G, "prussia");
    placeUnit(G, "GE", "army", "hanover", 2);
    placeUnit(G, "GE", "army", "pomerania", 2);
    placeUnit(G, "GE", "army", "prussia", 2);
    const ctx = makeCtx([3, 3]);
    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    const battle = G.battle!;
    const options = supportCandidates(G, "GE", battle, "attacker").map((entry) => entry.space);
    expect(options.length).toBeGreaterThanOrEqual(3);
    const [first, second, third] = options;

    chooseSupport(G, ctx, first);
    chooseSupport(G, ctx, first); // duplicate: ignored
    chooseSupport(G, ctx, second);
    chooseSupport(G, ctx, third); // third space: no longer legal
    chooseSupport(G, ctx, "done");

    expect(battle.supportAttack.map((entry) => entry.space)).toEqual([first, second]);
    expect(new Set(battle.supportAttack.map((entry) => entry.space)).size).toBe(2);
  });

  test("a severe/red-only adjacency cannot support; clear+difficult is not halved", () => {
    const G = fresh();
    G.phase = "wartime";
    clearLandUnits(G, "sudan");
    placeUnit(G, "GE", "army", "sudan", 2);
    const severeBattle = {
      ...G.battle,
      kind: "land" as const,
      attacker: "GE" as const,
      defender: "FR" as const,
      from: "egypt",
      to: "sinai",
      mainAttack: [],
      mainDefense: [],
      supportAttack: [],
      supportDefense: [],
      stage: "support" as const,
      supportSide: "attacker" as const,
      attackerDrm: 0,
      defenderDrm: 0,
      attackerLosses: 0,
      defenderLosses: 0,
      decisive: false,
      notes: [],
    };
    expect(supportCandidates(G, "GE", severeBattle, "attacker").map((e) => e.space)).not.toContain("sudan");

    // Bavaria is linked to Bohemia via a difficult connection and to Saxony via
    // a clear one: 18.3.2's clarification says that is NOT halved.
    clearLandUnits(G, "bavaria");
    placeUnit(G, "GE", "army", "bavaria", 2);
    const mixedBattle = {...severeBattle, from: "bohemia", to: "saxony", notes: []};
    const candidate = supportCandidates(G, "GE", mixedBattle, "attacker").find(
      (entry) => entry.space === "bavaria",
    );
    expect(candidate?.fp).toBe(2);
  });
});

describe("A059/A062 availability guards", () => {
  test("A059 is not offered when the main defense has no enemy army (EC/EF only)", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A059"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "eliteCorps", "saxony", 1);
    const ctx = makeCtx([3, 3]);
    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    expect(cardOptions(G)).not.toContain("card:IE-A059");
  });

  test("A062 is not offered when no adjacent space holds an army", () => {
    const G = fresh();
    G.phase = "wartime";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A062"];
    clearLandUnits(G, "saxony");
    placeUnit(G, "FR", "army", "saxony", 2);
    for (const space of [
      "hanover",
      "bavaria",
      "bohemia",
      "silesia",
      "pomerania",
      "prussia",
      "schleswig-holstein",
    ]) {
      clearLandUnits(G, space);
    }
    const ctx = makeCtx([3, 3]);
    beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    finishSupportWindows(G, ctx);
    expect(cardOptions(G)).not.toContain("card:IE-A062");
  });
});

describe("GW discard and face-up resync", () => {
  test("GW-05/06 go to the GW discard, never the action discard, and are not redealt", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.gw = gwState(2);
    clearHands(G);
    G.powers.GE.gwCard = "IE-GW-05";
    const ctx = makeCtx([4, 3, 1]);
    stageEvenBattle(G, ctx);
    finishSupportWindows(G, ctx);
    playCombatCard(G, ctx, "IE-GW-05");
    expect(G.discard).not.toContain("IE-GW-05");
    expect(G.gw?.discard).toContain("IE-GW-05");

    // Planning must keep every card still in the GW discard out of the deal.
    for (const power of POWERS) G.powers[power].gwCard = null;
    const before = [...(G.gw?.discard ?? [])];
    beginGwTurn(G, makeCtx([2]));
    for (const power of POWERS) expect(G.powers[power].gwCard).not.toBe("IE-GW-05");
    expect(G.gw?.discard).toEqual(before);
  });

  test("faceupCombatCards reflects both in-front cards held by one power immediately", () => {
    const G = fresh();
    G.gw = gwState(2);
    G.gw.combatCardsInFront = [
      {holder: "FR", cardId: "IE-GW-03", faceup: true},
      {holder: "FR", cardId: "IE-GW-04", faceup: true},
    ];
    expect(faceupCombatCards(G).FR).toEqual(["IE-GW-03", "IE-GW-04"]);
    expect(String(G.flags.gwFaceupCombat)).toContain("FR:IE-GW-03");
  });
});

describe("GW-06 advance and fort", () => {
  test("advances when every defender was eliminated and does not remove the fort", () => {
    const G = fresh();
    G.phase = "wartime";
    clearLandUnits(G, "berlin");
    clearLandUnits(G, "saxony");
    const attacker = placeUnit(G, "GE", "army", "berlin", 2);
    G.spaces.saxony.fort = {power: "FR", level: 2};
    G.battle = {
      kind: "land",
      attacker: "GE",
      defender: "FR",
      from: "berlin",
      to: "saxony",
      mainAttack: [attacker.id],
      mainDefense: [],
      supportAttack: [],
      supportDefense: [],
      stage: "lossesDefense",
      supportSide: "attacker",
      attackerDrm: 0,
      defenderDrm: 0,
      attackerLosses: 1,
      defenderLosses: 2,
      decisive: false,
      winner: "attacker",
      notes: ["noRetreat"],
    };
    const ctx = makeCtx([3, 3]);
    finishBattle(G, ctx);
    expect(G.spaces.saxony.units).toContain(attacker.id);
    // GW-06 prevented a retreat, so the fort is not eliminated.
    expect(G.spaces.saxony.fort).not.toBeNull();
  });
});
