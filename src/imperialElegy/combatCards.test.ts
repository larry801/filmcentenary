import type {Ctx} from "boardgame.io";
import type {BattleState, CardId, GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  COMBAT_CARD_BY_ID,
  COMBAT_CARD_DEFS,
  applyCombatCardToBattle,
  availableCombatCards,
  battleDiceRolled,
  combatCardById,
  combatCardConditionsMet,
  combatCardDrm,
  isCombatCardId,
} from "./engine/combatCards";
import type {CombatCardKind, CombatCardSide} from "./engine/combatCards";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCtx = (): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => {
  const G = setupImperialElegy(makeCtx());
  // A058 needs an enemy fort in the battle space; Saxony's starting garrison
  // is the standard land-battle fixture.  The fixture battle below also names
  // one enemy army so A059's `requiresEnemyArmy` condition sees a real unit.
  G.spaces.saxony.fort = {power: "FR", level: 1};
  G.units["fr-army-1"] = {
    id: "fr-army-1",
    kind: "army",
    owner: "FR",
    steps: 2,
    space: "saxony",
  };
  G.units["ge-army-1"] = {
    id: "ge-army-1",
    kind: "army",
    owner: "GE",
    steps: 2,
    space: "berlin",
  };
  // IE-A043 requires a German elite corps in the main attack force.
  G.units["ge-ec-1"] = {
    id: "ge-ec-1",
    kind: "eliteCorps",
    owner: "GE",
    steps: 1,
    space: "berlin",
  };
  return G;
};

const landBattle = (overrides: Partial<BattleState> = {}): BattleState => ({
  kind: "land",
  attacker: "GE",
  defender: "FR",
  from: "berlin",
  to: "saxony",
  mainAttack: ["ge-army-1", "ge-ec-1"],
  mainDefense: ["fr-army-1"],
  supportAttack: [],
  supportDefense: [],
  stage: "cards",
  supportSide: "attacker",
  cardSide: "attacker",
  attackerDrm: 0,
  defenderDrm: 0,
  attackerLosses: 0,
  defenderLosses: 0,
  decisive: false,
  notes: [],
  ...overrides,
});

const navalBattle = (overrides: Partial<BattleState> = {}): BattleState =>
  landBattle({kind: "naval", from: "northSea", to: "balticSea", ...overrides});

const rolledBattle = (overrides: Partial<BattleState> = {}): BattleState =>
  landBattle({attackerRoll: 5, defenderRoll: 2, stage: "lossesAttack", ...overrides});

const gwState = (turn = 1): GreatWarState => ({
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
});

const activateGw = (G: ImperialElegyState, turn = 1): void => {
  G.gw = gwState(turn);
  G.phase = "gwManeuver";
};

const setHand = (G: ImperialElegyState, power: Power, hand: CardId[]): void => {
  G.powers[power].hand = [...hand];
};

// ---------------------------------------------------------------------------
// Definition table
// ---------------------------------------------------------------------------

interface ExpectedDef {
  title: string;
  source: "action" | "greatWar";
  side: CombatCardSide;
  kind: CombatCardKind;
  drm: number;
}

const EXPECTED: Record<CardId, ExpectedDef> = {
  "IE-A043": {title: "At Any Cost", source: "action", side: "attacker", kind: "drm", drm: 1},
  "IE-A058": {title: "Siege Guns", source: "action", side: "either", kind: "drm", drm: 0},
  "IE-A059": {title: "Flank Attack", source: "action", side: "attacker", kind: "drm", drm: 0},
  "IE-A060": {title: "Charge of the Light Brigade", source: "action", side: "either", kind: "drm", drm: -1},
  "IE-A061": {title: "Ironclads", source: "action", side: "either", kind: "drm", drm: 2},
  "IE-A062": {title: "Miscommunication", source: "action", side: "either", kind: "drm", drm: 0},
  "IE-A066": {title: "Damn the Torpedoes", source: "action", side: "either", kind: "noMines", drm: 0},
  "IE-GW-03": {title: "Technological Terror", source: "greatWar", side: "attacker", kind: "cancelTrenches", drm: 2},
  "IE-GW-04": {title: "Dawn of Modern Warfare", source: "greatWar", side: "attacker", kind: "cancelTrenches", drm: 2},
  "IE-GW-05": {title: "Capable Commander", source: "greatWar", side: "either", kind: "reroll", drm: 0},
  "IE-GW-06": {title: "They Shall Not Pass", source: "greatWar", side: "either", kind: "noRetreat", drm: 0},
};

const ACTION_IDS = [
  "IE-A043",
  "IE-A058",
  "IE-A059",
  "IE-A060",
  "IE-A061",
  "IE-A062",
  "IE-A066",
];
const GW_IDS = ["IE-GW-03", "IE-GW-04", "IE-GW-05", "IE-GW-06"];
const ATTACKER_ONLY = ["IE-A043", "IE-A059", "IE-GW-03", "IE-GW-04"];
const AFTER_DICE = ["IE-GW-05", "IE-GW-06"];

/** The battle kind a card is printed for (land unless it says naval). */
const battleFor = (id: CardId): BattleState =>
  COMBAT_CARD_BY_ID[id].conditions.battleKind === "naval" ? navalBattle() : landBattle();

describe("combat card definitions", () => {
  test("cover every printed action and GW combat card exactly once", () => {
    expect([...COMBAT_CARD_DEFS].map((def) => def.id).sort()).toEqual(
      [...ACTION_IDS, ...GW_IDS].sort(),
    );
    expect(new Set(COMBAT_CARD_DEFS.map((def) => def.id)).size).toBe(COMBAT_CARD_DEFS.length);
    expect(COMBAT_CARD_DEFS).toHaveLength(11);

    for (const def of COMBAT_CARD_DEFS) {
      const expected = EXPECTED[def.id];
      expect(expected).toBeDefined();
      expect(def.title).toBe(expected.title);
      expect(def.source).toBe(expected.source);
      expect(def.side).toBe(expected.side);
      expect(def.kind).toBe(expected.kind);
      expect(def.drm).toBe(expected.drm);
      expect(COMBAT_CARD_BY_ID[def.id]).toBe(def);
      expect(combatCardById(def.id)).toBe(def);
      expect(isCombatCardId(def.id)).toBe(true);
    }
    expect(isCombatCardId("IE-A057")).toBe(false);
    expect(combatCardById("IE-A057")).toBeUndefined();
  });

  test("encode the printed side, era, timing and special restrictions", () => {
    for (const def of COMBAT_CARD_DEFS) {
      expect(Boolean(def.conditions.attackerOnly)).toBe(ATTACKER_ONLY.includes(def.id));
      expect(Boolean(def.conditions.afterDice)).toBe(AFTER_DICE.includes(def.id));
      expect(Boolean(def.conditions.nonGwOnly)).toBe(ACTION_IDS.includes(def.id));
      expect(Boolean(def.conditions.gwOnly)).toBe(GW_IDS.includes(def.id));
      // A card only requires the attacker when its printed side says so.
      if (def.conditions.attackerOnly) expect(def.side).toBe("attacker");
    }

    // IE-A043 is Germany-only (the elite corps is German).
    expect(COMBAT_CARD_BY_ID["IE-A043"].conditions.power).toBe("GE");
    // IE-A060 transfers the penalty to the opponent.
    expect(COMBAT_CARD_BY_ID["IE-A060"].drmTarget).toBe("opponent");
    // IE-A061 is a naval card that stops working after Dreadnoughts.
    expect(COMBAT_CARD_BY_ID["IE-A061"].conditions.battleKind).toBe("naval");
    expect(COMBAT_CARD_BY_ID["IE-A061"].conditions.requiresNoDreadnoughts).toBe(true);
    // IE-A066 is the printed no-mines naval card.
    expect(COMBAT_CARD_BY_ID["IE-A066"].conditions.battleKind).toBe("naval");
    // GW-03/GW-04 cancel trenches only from GW turn 3.
    expect(COMBAT_CARD_BY_ID["IE-GW-03"].conditions.cancelTrenchesFromGwTurn).toBe(3);
    expect(COMBAT_CARD_BY_ID["IE-GW-04"].conditions.cancelTrenchesFromGwTurn).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

describe("availableCombatCards", () => {
  test("offers action combat cards from the hand, filtered by battle kind", () => {
    const G = fresh();
    setHand(G, "GE", [...ACTION_IDS, "IE-A057"]);

    expect(availableCombatCards(G, "GE", landBattle())).toEqual([
      "IE-A043",
      "IE-A058",
      "IE-A059",
      "IE-A060",
      "IE-A062",
    ]);
    expect(availableCombatCards(G, "GE", navalBattle())).toEqual(["IE-A061", "IE-A066"]);
  });

  test("applies attacker-only and power restrictions", () => {
    const G = fresh();
    // FR is the defender and holds every action combat card.  A043 is
    // Germany-only and A059 is attacker-only; the rest are defender-legal.
    setHand(G, "FR", ACTION_IDS);
    // A058 is unavailable to the defender: the fort in the battle space is
    // FR's own, and Siege Guns only targets an enemy fort.
    expect(availableCombatCards(G, "FR", landBattle({cardSide: "defender"}))).toEqual([
      "IE-A060",
      "IE-A062",
    ]);

    // GE as the attacker gets A043 and A059.
    setHand(G, "GE", ACTION_IDS);
    expect(availableCombatCards(G, "GE", landBattle())).toEqual([
      "IE-A043",
      "IE-A058",
      "IE-A059",
      "IE-A060",
      "IE-A062",
    ]);
  });

  test("excludes a power that is not a belligerent in the battle", () => {
    const G = fresh();
    setHand(G, "RU", ACTION_IDS);
    expect(availableCombatCards(G, "RU", landBattle())).toEqual([]);
  });

  test("hides action cards once the Great War is active", () => {
    const G = fresh();
    activateGw(G);
    setHand(G, "GE", ["IE-A058", "IE-A062"]);
    expect(availableCombatCards(G, "GE", landBattle())).toEqual([]);
  });

  test("offers the power's GW card when it is a combat card", () => {
    const G = fresh();
    activateGw(G, 1);
    G.powers.GE.gwCard = "IE-GW-03";
    expect(availableCombatCards(G, "GE", landBattle())).toEqual(["IE-GW-03"]);

    // GW-03 is attacker-only, so the defender gets nothing.
    G.powers.FR.gwCard = "IE-GW-03";
    expect(availableCombatCards(G, "FR", landBattle({cardSide: "defender"}))).toEqual([]);
  });

  test("does not offer a GW card that is not a combat card", () => {
    const G = fresh();
    activateGw(G);
    G.powers.GE.gwCard = "IE-GW-02";
    expect(availableCombatCards(G, "GE", landBattle())).toEqual([]);
  });

  test("offers GW-05/GW-06 only after the dice are rolled", () => {
    const G = fresh();
    activateGw(G, 3);

    G.powers.GE.gwCard = "IE-GW-05";
    expect(availableCombatCards(G, "GE", landBattle())).toEqual([]);
    expect(availableCombatCards(G, "GE", rolledBattle())).toEqual(["IE-GW-05"]);

    G.powers.GE.gwCard = "IE-GW-06";
    expect(availableCombatCards(G, "GE", landBattle())).toEqual([]);
    expect(availableCombatCards(G, "GE", rolledBattle())).toEqual(["IE-GW-06"]);
  });

  test("offers after-dice cards to the defender after the roll", () => {
    const G = fresh();
    activateGw(G, 3);
    G.powers.FR.gwCard = "IE-GW-06";
    expect(
      availableCombatCards(G, "FR", rolledBattle({cardSide: "defender"})),
    ).toEqual(["IE-GW-06"]);
  });

  test("stops offering before-dice cards once the dice are rolled", () => {
    const G = fresh();
    setHand(G, "GE", ["IE-A058", "IE-A059"]);
    expect(availableCombatCards(G, "GE", rolledBattle())).toEqual([]);
  });

  test("Ironclads is unavailable after Dreadnoughts has been played", () => {
    const G = fresh();
    setHand(G, "GE", ["IE-A061", "IE-A066"]);
    G.persistent.dreadnoughts = true;
    expect(availableCombatCards(G, "GE", navalBattle())).toEqual(["IE-A066"]);
  });

  test("GW-03/GW-04 are offered before GW turn 3; only the trench clause waits", () => {
    const G = fresh();
    activateGw(G, 1);
    G.powers.GE.gwCard = "IE-GW-03";
    expect(availableCombatCards(G, "GE", landBattle())).toEqual(["IE-GW-03"]);

    G.gw!.turn = 3;
    expect(availableCombatCards(G, "GE", landBattle())).toEqual(["IE-GW-03"]);
  });

  test("combatCardConditionsMet agrees with the availability list", () => {
    const G = fresh();
    activateGw(G, 1);
    G.powers.GE.gwCard = "IE-GW-03";
    const battle = landBattle();
    expect(combatCardConditionsMet(G, "GE", battle, COMBAT_CARD_BY_ID["IE-GW-03"])).toBe(true);
    expect(combatCardConditionsMet(G, "FR", battle, COMBAT_CARD_BY_ID["IE-GW-03"])).toBe(false);
  });

  test("battleDiceRolled follows the recorded die values", () => {
    expect(battleDiceRolled(landBattle())).toBe(false);
    expect(battleDiceRolled(landBattle({attackerRoll: 1}))).toBe(true);
    expect(battleDiceRolled(rolledBattle())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DRM
// ---------------------------------------------------------------------------

describe("combatCardDrm", () => {
  test.each(
    COMBAT_CARD_DEFS.map((def) => [def.id, def.drm] as [CardId, number]),
  )("%s returns its printed DRM", (id, drm) => {
    expect(combatCardDrm(COMBAT_CARD_BY_ID[id], battleFor(id))).toBe(drm);
  });

  test("battle-kind restrictions zero the DRM", () => {
    expect(combatCardDrm(COMBAT_CARD_BY_ID["IE-A043"], navalBattle())).toBe(0);
    expect(combatCardDrm(COMBAT_CARD_BY_ID["IE-A058"], navalBattle())).toBe(0);
    expect(combatCardDrm(COMBAT_CARD_BY_ID["IE-A061"], landBattle())).toBe(0);
    expect(combatCardDrm(COMBAT_CARD_BY_ID["IE-A061"], navalBattle())).toBe(2);
    expect(combatCardDrm(COMBAT_CARD_BY_ID["IE-A066"], landBattle())).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Applying a card
// ---------------------------------------------------------------------------

interface ExpectedApply {
  attackerDrm: number;
  defenderDrm: number;
  notes: string[];
  mines?: number;
}

const EXPECTED_APPLY: Record<CardId, ExpectedApply> = {
  "IE-A043": {attackerDrm: 1, defenderDrm: 0, notes: []},
  "IE-A058": {attackerDrm: 0, defenderDrm: 0, notes: ["siegeGuns"]},
  "IE-A059": {attackerDrm: 0, defenderDrm: 0, notes: ["flankAttack"]},
  "IE-A060": {attackerDrm: 0, defenderDrm: -1, notes: []},
  "IE-A061": {attackerDrm: 2, defenderDrm: 0, notes: ["noMines"], mines: 0},
  "IE-A062": {attackerDrm: 0, defenderDrm: 0, notes: ["miscommunication"]},
  "IE-A066": {attackerDrm: 0, defenderDrm: 0, notes: ["noMines"], mines: 0},
  "IE-GW-03": {attackerDrm: 2, defenderDrm: 0, notes: []},
  "IE-GW-04": {attackerDrm: 2, defenderDrm: 0, notes: []},
  "IE-GW-05": {attackerDrm: 0, defenderDrm: 0, notes: ["reroll"]},
  "IE-GW-06": {attackerDrm: 0, defenderDrm: 0, notes: ["noRetreat"]},
};

describe("applyCombatCardToBattle", () => {
  test.each(
    COMBAT_CARD_DEFS.map((def) => [def.id] as [CardId]),
  )("%s adds the printed DRM and notes without mutating the input", (id) => {
    const def = COMBAT_CARD_BY_ID[id];
    const battle = def.conditions.battleKind === "naval"
      ? navalBattle({mines: 2, attackerLosses: 2})
      : landBattle();
    const snapshot = JSON.parse(JSON.stringify(battle));
    const expected = EXPECTED_APPLY[id];

    const after = applyCombatCardToBattle(battle, def, 0);

    expect(after.attackerDrm).toBe(expected.attackerDrm);
    expect(after.defenderDrm).toBe(expected.defenderDrm);
    expect(after.notes).toEqual(expected.notes);
    expect(after.mines).toBe(expected.mines);

    // The input is untouched, including nested arrays and notes.
    expect(JSON.parse(JSON.stringify(battle))).toEqual(snapshot);
    expect(after).not.toBe(battle);
    expect(after.notes).not.toBe(battle.notes);
    expect(after.mainAttack).not.toBe(battle.mainAttack);
    expect(after.supportAttack).not.toBe(battle.supportAttack);
  });

  test("IE-A060 penalizes the opponent of the playing side", () => {
    const def = COMBAT_CARD_BY_ID["IE-A060"];

    const asAttacker = applyCombatCardToBattle(landBattle({cardSide: "attacker"}), def);
    expect(asAttacker.attackerDrm).toBe(0);
    expect(asAttacker.defenderDrm).toBe(-1);

    const asDefender = applyCombatCardToBattle(landBattle({cardSide: "defender"}), def);
    expect(asDefender.attackerDrm).toBe(-1);
    expect(asDefender.defenderDrm).toBe(0);
  });

  test("GW-03/GW-04 give +2 immediately but cancel trenches only from GW turn 3", () => {
    for (const id of ["IE-GW-03", "IE-GW-04"] as CardId[]) {
      const def = COMBAT_CARD_BY_ID[id];
      const battle = landBattle({trench: true});

      const early = applyCombatCardToBattle(battle, def, 2);
      expect(early.attackerDrm).toBe(2);
      expect(early.notes).not.toContain("cancelTrenches");
      expect(early.trench).toBe(true);

      const late = applyCombatCardToBattle(battle, def, 3);
      expect(late.attackerDrm).toBe(2);
      expect(late.notes).toContain("cancelTrenches");
      expect(late.trench).toBe(false);

      // No trench, no cancellation note.
      const openGround = applyCombatCardToBattle(landBattle(), def, 5);
      expect(openGround.attackerDrm).toBe(2);
      expect(openGround.notes).not.toContain("cancelTrenches");
    }
  });

  test("GW-06 records noRetreat without changing DRM", () => {
    const after = applyCombatCardToBattle(
      landBattle({cardSide: "defender", stage: "retreat"}),
      COMBAT_CARD_BY_ID["IE-GW-06"],
      4,
    );
    expect(after.notes).toEqual(["noRetreat"]);
    expect(after.attackerDrm).toBe(0);
    expect(after.defenderDrm).toBe(0);
  });

  test("does not duplicate an existing battle note", () => {
    const battle = landBattle({notes: ["siegeGuns"]});
    const after = applyCombatCardToBattle(battle, COMBAT_CARD_BY_ID["IE-A058"]);
    expect(after.notes).toEqual(["siegeGuns"]);
  });

  test("noMines clears the mine marker but preserves the caller's losses", () => {
    const battle = navalBattle({mines: 3, attackerLosses: 3});
    const after = applyCombatCardToBattle(battle, COMBAT_CARD_BY_ID["IE-A061"]);
    expect(after.mines).toBe(0);
    expect(after.attackerLosses).toBe(3);
    expect(battle.mines).toBe(3);
  });
});
