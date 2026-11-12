import type {Ctx} from "boardgame.io";
import type {BattleState, CardId, GreatWarState, ImperialElegyState, Power, Unit, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  COMBAT_CARD_BY_ID,
  applyCombatCardToBattle,
  availableCombatCards,
} from "./engine/combatCards";
import {
  beginLandBattle,
  beginNavalBattle,
  chooseLoss,
  chooseSupport,
  playCombatCard,
  resolveMineRetreat,
} from "./engine/combat";
import {placeUnit, removeUnit} from "./engine/effects";
import {landUnitsIn, navalUnitsIn} from "./engine/rules";

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
});

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
});

const ACTION_IDS: CardId[] = [
  "IE-A043",
  "IE-A058",
  "IE-A059",
  "IE-A060",
  "IE-A061",
  "IE-A062",
  "IE-A066",
];

const landBattle = (overrides: Partial<BattleState> = {}): BattleState => ({
  kind: "land",
  attacker: "GE",
  defender: "FR",
  from: "berlin",
  to: "saxony",
  mainAttack: [],
  mainDefense: [],
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

/**
 * Replace the Berlin/Saxony stacks with equal, known armies so the CRT result
 * is deterministic, then open the land battle and neutralize the printed DRMs.
 */
const stageLandBattle = (
  G: ImperialElegyState,
  ctx: Ctx,
  armyCount: number,
  withElite = false,
  sameSpace = false,
): {battle: BattleState; attackUnits: Unit[]; defenceUnits: Unit[]} => {
  for (const unit of [...landUnitsIn(G, "berlin"), ...landUnitsIn(G, "saxony")]) {
    removeUnit(G, unit.id);
  }
  const attackUnits: Unit[] = [];
  const defenceUnits: Unit[] = [];
  const from = sameSpace ? "saxony" : "berlin";
  for (let i = 0; i < armyCount; i += 1) attackUnits.push(placeUnit(G, "GE", "army", from, 2));
  // IE-A043 requires a German elite corps in the main attack force.
  if (withElite) attackUnits.push(placeUnit(G, "GE", "eliteCorps", from, 1));
  for (let i = 0; i < armyCount; i += 1) defenceUnits.push(placeUnit(G, "FR", "army", "saxony", 2));
  const battle = beginLandBattle(G, ctx, "GE", from, "saxony");
  if (!battle) throw new Error("battle did not start");
  battle.attackerDrm = 0;
  battle.defenderDrm = 0;
  return {battle, attackUnits, defenceUnits};
};

const finishSupport = (G: ImperialElegyState, ctx: Ctx): void => {
  chooseSupport(G, ctx, "done");
  chooseSupport(G, ctx, "done");
};

const cardOptionIds = (G: ImperialElegyState): string[] =>
  (G.pending?.options ?? []).map((entry) => entry.id).filter((id) => id.startsWith("card:"));

const playedCards = (G: ImperialElegyState): string[] =>
  G.log.filter((entry) => entry.key === "combatCardPlayed").map((entry) => String(entry.args?.card));

// ---------------------------------------------------------------------------
// Action cards
// ---------------------------------------------------------------------------

describe("action combat cards", () => {
  test("offers an action card by title and applies its printed DRM once", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A043"];
    const ctx = makeCtx([3, 3]);

    const {battle} = stageLandBattle(G, ctx, 3, true);
    finishSupport(G, ctx);

    expect(G.pending?.kind).toBe("combatCard");
    expect(cardOptionIds(G)).toEqual(["card:IE-A043"]);
    const option = G.pending?.options.find((entry) => entry.id === "card:IE-A043");
    // Labels use the printed title, never the raw card id.
    expect(option?.label).toBe("Play At Any Cost");
    expect(G.pending?.options.some((entry) => String(entry.label).includes("IE-A043"))).toBe(false);

    const beforeDrm = battle.attackerDrm;
    playCombatCard(G, ctx, "IE-A043");

    expect(G.powers.GE.hand).not.toContain("IE-A043");
    expect(G.discard).toContain("IE-A043");
    expect(G.battle).not.toBeNull();
    expect(G.battle?.attackerDrm).toBe(beforeDrm + 1);
    expect(playedCards(G)).toEqual(["IE-A043"]);
  });

  test("offers land cards only on land and naval cards only at sea", () => {
    const land = fresh();
    land.phase = "wartime";
    land.activePower = "GE";
    land.war = warState("GE", "FR");
    clearHands(land);
    land.powers.GE.hand = [...ACTION_IDS];
    const landCtx = makeCtx([3, 3]);
    stageLandBattle(land, landCtx, 1, true);
    finishSupport(land, landCtx);

    expect(cardOptionIds(land)).toEqual([
      "card:IE-A043",
      // A058 needs an enemy fort in the battle space.
      "card:IE-A059",
      "card:IE-A060",
      "card:IE-A062",
    ]);

    const naval = fresh();
    naval.phase = "action";
    naval.activePower = "UK";
    naval.war = warState("UK", "GE");
    clearHands(naval);
    naval.powers.UK.hand = [...ACTION_IDS];
    placeUnit(naval, "GE", "squadron", "north-atlantic", 2);
    const navalBattle = beginNavalBattle(naval, makeCtx(), "UK", "london", "north-atlantic");
    expect(navalBattle).not.toBeNull();

    // Multi-mode cards offer one mode-qualified option per printed alternative.
    expect(cardOptionIds(naval)).toEqual([
      "card:IE-A061:navalDrm",
      "card:IE-A061:noMines",
      "card:IE-A066:noMines",
      "card:IE-A066:navalDrm",
    ]);
    expect(cardOptionIds(naval).filter((id) => id.startsWith("card:IE-A066:"))).toEqual([
      "card:IE-A066:noMines",
      "card:IE-A066:navalDrm",
    ]);
  });

  test("does not offer a card to a bystander power or to the wrong side", () => {
    const G = fresh();
    clearHands(G);
    const battle = landBattle();

    // RU is neither the attacker nor the defender.
    G.powers.RU.hand = [...ACTION_IDS];
    expect(availableCombatCards(G, "RU", battle)).toEqual([]);

    // IE-A043/IE-A059 are attacker-only; the defender gets no options.
    G.powers.FR.hand = ["IE-A043", "IE-A059"];
    expect(availableCombatCards(G, "FR", {...battle, cardSide: "defender"})).toEqual([]);

    // GW-03 is attacker-only as well.
    G.gw = gwState(3);
    G.powers.FR.gwCard = "IE-GW-03";
    expect(availableCombatCards(G, "FR", {...battle, cardSide: "defender"})).toEqual([]);
  });

  test("applyCombatCardToBattle returns a copy and leaves the input battle untouched", () => {
    const battle = landBattle({
      trench: true,
      notes: ["machineGuns"],
      mainAttack: ["ge-army-1", "ge-army-2"],
      mainDefense: ["fr-army-1"],
      supportAttack: [{space: "hanover", units: ["h-1"], fp: 2}],
      supportDefense: [{space: "bavaria", units: ["b-1"], fp: 1}],
    });
    const snapshot = JSON.parse(JSON.stringify(battle));

    const after = applyCombatCardToBattle(battle, COMBAT_CARD_BY_ID["IE-GW-06"], 4);

    expect(after).not.toBe(battle);
    expect(after.notes).toEqual(["machineGuns", "noRetreat"]);
    expect(after.notes).not.toBe(battle.notes);
    expect(after.mainAttack).not.toBe(battle.mainAttack);
    expect(after.supportAttack).not.toBe(battle.supportAttack);
    expect(JSON.parse(JSON.stringify(battle))).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// Great War cards
// ---------------------------------------------------------------------------

describe("Great War combat cards", () => {
  test("offers GW-03 from the GW card slot and applies its +2 and trench cancel", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.gw = gwState(3);
    G.spaces.saxony.trench = {status: "defender", turn: 3};
    clearHands(G);
    G.powers.GE.gwCard = "IE-GW-03";
    G.flags.gwFaceupCombat = "FR:IE-GW-04,GE:IE-GW-03";
    const ctx = makeCtx([3, 3]);

    // 28.1.2: only units already in a trench-battle space may fight there.
    const {battle} = stageLandBattle(G, ctx, 3, false, true);
    finishSupport(G, ctx);

    expect(battle.trench).toBe(true);
    expect(G.pending?.kind).toBe("combatCard");
    expect(cardOptionIds(G)).toEqual(["card:IE-GW-03"]);
    expect(G.pending?.options.find((entry) => entry.id === "card:IE-GW-03")?.label).toBe(
      "Play Technological Terror",
    );

    playCombatCard(G, ctx, "IE-GW-03");

    // GW cards leave the GW slot (not the hand) and stop being faceup.
    expect(G.powers.GE.gwCard).toBeNull();
    expect(G.powers.GE.hand).not.toContain("IE-GW-03");
    expect(String(G.flags.gwFaceupCombat)).not.toContain("GE:");
    expect(String(G.flags.gwFaceupCombat)).toContain("FR:IE-GW-04");
    // 26.1: the card is not discarded; it waits to be placed facedown in front
    // of the opponent at the end of the battle.
    expect(G.discard).not.toContain("IE-GW-03");
    expect(G.battle?.faceDownCards).toEqual([{cardId: "IE-GW-03", holder: "FR"}]);
    expect(playedCards(G)).toEqual(["IE-GW-03"]);

    const applied = G.battle;
    expect(applied).not.toBeNull();
    expect(applied?.attackerDrm).toBe(2);
    // From GW turn 3 the card also cancels the trench.
    expect(applied?.trench).toBe(false);
    expect(applied?.notes).toContain("cancelTrenches");
  });

  test("offers GW-06 after the dice and its noRetreat keeps the loser in place", () => {
    const G = fresh();
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.gw = gwState(3);
    clearHands(G);
    G.powers.FR.gwCard = "IE-GW-06";
    const ctx = makeCtx([4, 3]);

    const {battle, attackUnits, defenceUnits} = stageLandBattle(G, ctx, 3);
    finishSupport(G, ctx);

    // GW-06 is printed "after dice", so the pre-dice window skips it and the
    // roll opens the response window instead.
    expect(battle.winner).toBe("attacker");
    expect(battle.attackerRoll).toBe(4);
    expect(battle.defenderRoll).toBe(3);
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("FR");
    expect(cardOptionIds(G)).toEqual(["card:IE-GW-06"]);

    playCombatCard(G, ctx, "IE-GW-06");
    const applied = G.battle;
    expect(applied?.notes).toContain("noRetreat");
    expect(G.powers.FR.gwCard).toBeNull();

    // Apply the two 1-step losses, then finish the battle.
    expect(G.pending?.kind).toBe("combatLosses");
    chooseLoss(G, ctx, attackUnits[0].id);
    expect(G.pending?.kind).toBe("combatLosses");
    expect(G.pending?.power).toBe("FR");
    chooseLoss(G, ctx, defenceUnits[0].id);

    expect(G.battle).toBeNull();
    // The defeated defender stays in the space and the attacker does not advance.
    expect(G.units[defenceUnits[0].id]).toBeDefined();
    expect(G.spaces.saxony.units).toContain(defenceUnits[0].id);
    expect(G.spaces.berlin.units).toContain(attackUnits[0].id);
  });
});

// ---------------------------------------------------------------------------
// Naval mines
// ---------------------------------------------------------------------------

describe("naval mine deferral", () => {
  const openMinedPortBattle = (
    hand: CardId[],
    defenderHand: CardId[] = [],
  ): {G: ImperialElegyState; ctx: Ctx; battle: BattleState} => {
    const G = fresh();
    G.phase = "action";
    G.activePower = "UK";
    G.war = warState("UK", "GE");
    G.turn = 4;
    clearHands(G);
    G.powers.UK.hand = [...hand];
    G.powers.GE.hand = [...defenderHand];
    G.spaces.gibraltar.fort = {power: "GE", level: 1};
    placeUnit(G, "GE", "squadron", "gibraltar", 2);
    const ctx = makeCtx([6]);
    const battle = beginNavalBattle(G, ctx, "UK", "london", "gibraltar");
    if (!battle) throw new Error("naval battle did not start");
    return {G, ctx, battle};
  };

  test("A061 noMines cancels the deferred mine roll before ships are lost", () => {
    // Keep the defender's card window open so the applied battle stays live
    // for the DRM/mine assertions; the 19.5 port DRMs and the deferred mine
    // resolution would otherwise finish the battle immediately.
    const {G, ctx, battle} = openMinedPortBattle(["IE-A061"], ["IE-A061"]);

    expect(battle.notes).toContain("minefield");
    // The roll is deferred until after the card window.
    expect(battle.mines).toBe(0);
    expect(G.pending?.kind).toBe("combatCard");
    expect(cardOptionIds(G)).toEqual(["card:IE-A061:navalDrm", "card:IE-A061:noMines"]);

    playCombatCard(G, ctx, "IE-A061");
    const applied = G.battle;
    expect(applied).not.toBeNull();
    expect(applied?.notes).toContain("noMines");
    expect(applied?.mines).toBe(0);
    // A061's +2 plus 19.5's +1 port-count DRM (UK has two more adjacent ports).
    expect(applied?.attackerDrm).toBe(3);
    // With the 19.5 port DRM the CRT gives no attacker losses; no mine hits
    // (4 dice, all 6s) are added on top.
    expect(applied?.attackerLosses).toBe(0);
    expect(navalUnitsIn(G, "london")).toHaveLength(2);
  });

  test("without the card the deferred mines are rolled and cost ships", () => {
    const {G, battle} = openMinedPortBattle([]);

    expect(battle.notes).toContain("minefield");
    expect(battle.mines).toBe(4);
    // 19.4: four mine hits trigger the attacker's two-hit retreat option before
    // any loss is applied.  Continuing keeps the printed full-loss resolution.
    expect(G.pending?.kind).toBe("mineRetreat");
    expect(navalUnitsIn(G, "london")).toHaveLength(2);
    expect(resolveMineRetreat(G, makeCtx([], "1"), "continue")).toBe(true);
    // The mine hits are added to the CRT losses and destroy the squadron stack.
    expect(navalUnitsIn(G, "london")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Minor defenders
// ---------------------------------------------------------------------------

describe("minor defenders", () => {
  test("does not open the defender support/card window for the attacker", () => {
    const G = fresh();
    G.phase = "wartime";
    G.activePower = "GE";
    clearHands(G);
    G.powers.GE.hand = ["IE-A058", "IE-A062"];
    // A058 is only offered against an enemy fort.
    G.spaces.saxony.fort = {power: "Saxony", level: 2};
    const ctx = makeCtx([3, 3]);

    const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
    expect(battle).not.toBeNull();
    // Saxony is a minor, so `defender` falls back to the attacker; the marker
    // keeps the defender-side windows closed.
    expect(battle?.defender).toBe("GE");
    expect(battle?.notes).toContain("minorDefender");

    chooseSupport(G, ctx, "done");
    // Straight to the attacker's card window, not a defender support window.
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("GE");
    expect(cardOptionIds(G)).toEqual(["card:IE-A058", "card:IE-A062"]);

    playCombatCard(G, ctx, "IE-A058");
    // The leftover IE-A062 must not be offered again as the "defender".
    expect(G.pending?.kind).not.toBe("combatCard");
    expect(G.powers.GE.hand).toContain("IE-A062");
  });
});
