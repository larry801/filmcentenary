import type {Ctx} from "boardgame.io";
import type {BattleState, GreatWarState, ImperialElegyState, Power, Unit, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {beginLandBattle, beginNavalBattle, finishBattle, resolveBattleRoll} from "./engine/combat";
import {chooseSupport, playCombatCard} from "./engine/combat";
import {availableCombatCards} from "./engine/combatCards";
import {drawCards} from "./engine/deck";
import {placeUnit, removeUnit} from "./engine/effects";
import {deployReserveLimit, rapidMobilizationFreeDeploy} from "./engine/limitedWar";
import {faceupCombatCards, revealGwCombatCard} from "./engine/greatWarFlow";
import {landUnitsIn, navalUnitsIn} from "./engine/rules";
import {deployReserves, redeploy, resolvePending} from "./moves";

const makeCtx = (dice: number[] = [], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 3},
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

const gwState = (): GreatWarState => ({
  active: true,
  turn: 1,
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

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const unit of [...landUnitsIn(G, space), ...navalUnitsIn(G, space)]) removeUnit(G, unit.id);
};

const finishSupport = (G: ImperialElegyState, ctx: Ctx): void => {
  let guard = 0;
  while (G.pending?.kind === "combatSupport" && guard++ < 6) chooseSupport(G, ctx, "done");
};

/** A deterministic land battle with an optional German EC in the main force. */
const stageLand = (
  G: ImperialElegyState,
  ctx: Ctx,
  attackArmies: number,
  defenceArmies: number,
  withElite = false,
): BattleState => {
  clearSpace(G, "berlin");
  clearSpace(G, "saxony");
  for (let i = 0; i < attackArmies; i += 1) placeUnit(G, "GE", "army", "berlin", 2);
  if (withElite) placeUnit(G, "GE", "eliteCorps", "berlin", 1);
  for (let i = 0; i < defenceArmies; i += 1) placeUnit(G, "FR", "army", "saxony", 2);
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  if (!battle) throw new Error("land battle did not start");
  battle.attackerDrm = 0;
  battle.defenderDrm = 0;
  return battle;
};

// ---------------------------------------------------------------------------
// A061 Ironclads: remove and draw another after Dreadnoughts
// ---------------------------------------------------------------------------

describe("A061 post-Dreadnoughts draw special", () => {
  test("is removed from the game and replaced when drawn after Dreadnoughts", () => {
    const G = fresh();
    const ctx = makeCtx([3]);
    G.persistent.dreadnoughts = true;
    G.deck = ["IE-A060", "IE-A061"];
    G.discard = [];
    G.powers.GE.hand = [];

    const drawn = drawCards(G, ctx, "GE", 1);

    expect(drawn).toEqual(["IE-A060"]);
    expect(G.removed).toContain("IE-A061");
    expect(G.powers.GE.hand).toEqual(["IE-A060"]);
  });

  test("is drawn normally before Dreadnoughts has been played", () => {
    const G = fresh();
    const ctx = makeCtx([3]);
    G.deck = ["IE-A060", "IE-A061"];
    G.powers.GE.hand = [];

    expect(drawCards(G, ctx, "GE", 1)).toEqual(["IE-A061"]);
    expect(G.removed).not.toContain("IE-A061");
  });
});

// ---------------------------------------------------------------------------
// A043 At Any Cost: elite corps + discard-pile play
// ---------------------------------------------------------------------------

describe("A043 At Any Cost", () => {
  test("requires a German elite corps in the main attack force", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A043"];

    const withoutElite = stageLand(G, ctx, 3, 1);
    finishSupport(G, ctx);
    expect(availableCombatCards(G, "GE", withoutElite)).not.toContain("IE-A043");

    // Reset for the elite case.
    G.battle = null;
    G.pending = null;
    const withElite = stageLand(G, ctx, 3, 1, true);
    finishSupport(G, ctx);
    expect(availableCombatCards(G, "GE", withElite)).toContain("IE-A043");
  });

  test("queues the end-of-battle draw when played from hand", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A043"];
    G.powers.FR.hand = ["IE-A060"];
    stageLand(G, ctx, 3, 1, true);
    finishSupport(G, ctx);

    expect(playCombatCard(G, ctx, "IE-A043")).toBeUndefined();
    expect(G.battle?.extraDraws).toEqual(["GE"]);
    expect(G.powers.GE.hand).not.toContain("IE-A043");
  });

  test("can be played from the discard pile by discarding a hand card, without the draw", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A060"];
    G.powers.FR.hand = ["IE-A060"];
    G.discard = ["IE-A043"];
    const battle = stageLand(G, ctx, 3, 1, true);
    finishSupport(G, ctx);

    const options = (G.pending?.options ?? []).map((entry) => entry.id);
    expect(options).toContain("card:IE-A043:discard");

    expect(playCombatCard(G, ctx, "IE-A043:discard")).toBeUndefined();
    expect(G.pending?.kind).toBe("combatDiscard");
    expect((G.pending?.options ?? []).map((entry) => entry.id)).toEqual(["IE-A060"]);

    expect(resolvePending(G, ctx, "IE-A060")).toBeUndefined();
    expect(G.powers.GE.hand).not.toContain("IE-A060");
    expect(G.discard).toContain("IE-A060");
    expect(G.discard).toContain("IE-A043");
    expect(G.battle?.attackerDrm).toBe(battle.attackerDrm + 1);
    expect(G.battle?.extraDraws ?? []).not.toContain("GE");
  });
});

// ---------------------------------------------------------------------------
// 18.6 losses on supporting armies
// ---------------------------------------------------------------------------

describe("18.6 support-army losses", () => {
  test("the first loss is main-force only and later losses may hit a supporting army", () => {
    const G = fresh();
    const ctx = makeCtx([1, 6]); // attacker 1 vs defender 6: 2 attacker losses, 0 defender losses
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A060"];
    const battle = stageLand(G, ctx, 3, 1);
    clearSpace(G, "hanover");
    const support = placeUnit(G, "GE", "army", "hanover", 2);
    battle.supportAttack.push({space: "hanover", units: [support.id], fp: 2});
    // Cancel the FP edge from the added support so the dice produce two
    // attacker losses and no defender losses.
    battle.attackerDrm = -10;
    finishSupport(G, ctx);
    G.pending = null;

    resolveBattleRoll(G, ctx);

    // First loss: main force only, no support option.
    expect(G.pending?.kind).toBe("combatLosses");
    const firstOptions = (G.pending?.options ?? []).map((entry) => entry.id);
    expect(firstOptions).toContain(battle.mainAttack[0]);
    expect(firstOptions).not.toContain(support.id);
    const firstMain = battle.mainAttack.find((id) => firstOptions.includes(id));
    expect(firstMain).toBeDefined();
    resolvePending(G, ctx, firstMain!);

    // Second loss: the supporting army is now a legal target.
    expect(G.pending?.kind).toBe("combatLosses");
    const secondOptions = (G.pending?.options ?? []).map((entry) => entry.id);
    expect(secondOptions).toContain(support.id);
    resolvePending(G, ctx, support.id);

    expect(G.units[support.id]?.steps ?? 0).toBeLessThan(2);
  });
});

// ---------------------------------------------------------------------------
// GW-06 They Shall Not Pass: face-up reveal and naval no-retreat
// ---------------------------------------------------------------------------

describe("GW-06 They Shall Not Pass", () => {
  test("can be marked face up as a Great War combat card", () => {
    const G = fresh();
    G.gw = gwState();
    G.powers.GE.gwCard = "IE-GW-06";

    const result = revealGwCombatCard(G, "GE");

    expect(result.ok).toBe(true);
    expect(faceupCombatCards(G).GE).toBe("IE-GW-06");
  });

  test("keeps a defeated naval defender in place when noRetreat is in effect", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "UK";
    G.war = warState("UK", "GE");
    clearHands(G);
    clearSpace(G, "london");
    clearSpace(G, "north-atlantic");
    clearSpace(G, "baltic-sea");
    placeUnit(G, "UK", "squadron", "london", 2);
    const defender = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    G.powers.UK.hand = ["IE-A061"];

    const battle = beginNavalBattle(G, ctx, "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    battle.notes.push("noRetreat");
    battle.winner = "attacker";
    battle.attackerLosses = 0;
    battle.defenderLosses = 0;
    finishBattle(G, ctx);

    expect(G.units[defender.id]?.space).toBe("north-atlantic");
    expect(navalUnitsIn(G, "north-atlantic").some((unit) => unit.owner === "UK")).toBe(false);
  });

  test("a normal naval victory retreats the loser and lets the attacker occupy the box", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "UK";
    G.war = warState("UK", "GE");
    clearHands(G);
    clearSpace(G, "london");
    clearSpace(G, "north-atlantic");
    clearSpace(G, "baltic-sea");
    const attacker = placeUnit(G, "UK", "squadron", "london", 2);
    const defender = placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    G.powers.UK.hand = ["IE-A061"];

    const battle = beginNavalBattle(G, ctx, "UK", "london", "north-atlantic");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    battle.winner = "attacker";
    battle.attackerLosses = 0;
    battle.defenderLosses = 0;
    finishBattle(G, ctx);

    expect(G.units[attacker.id]?.space).toBe("north-atlantic");
    expect(G.units[defender.id]?.space).not.toBe("north-atlantic");
  });

  test("uses the defending port fort's FP and no adjacent support (19.5)", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "UK";
    G.war = warState("UK", "GE");
    clearHands(G);
    clearSpace(G, "north-atlantic");
    clearSpace(G, "denmark");
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    placeUnit(G, "GE", "squadron", "denmark", 2);
    G.spaces.denmark.fort = {power: "GE", level: 2};
    G.powers.UK.hand = ["IE-A061"];

    const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "denmark");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    resolveBattleRoll(G, ctx);

    // 2 defender FP + a level-2 fort = 4; only the 2 attacker FP oppose it.
    expect(battle.defenceDrmTotal).toBe(2);
    expect(battle.supportAttack).toHaveLength(0);
    expect(battle.supportDefense).toHaveLength(0);
  });

  test("eliminates a port fort when its defender loses the naval battle", () => {
    const G = fresh();
    const ctx = makeCtx([3, 3]);
    G.phase = "wartime";
    G.activePower = "UK";
    G.war = warState("UK", "GE");
    clearHands(G);
    clearSpace(G, "north-atlantic");
    clearSpace(G, "denmark");
    placeUnit(G, "UK", "squadron", "north-atlantic", 2);
    placeUnit(G, "GE", "squadron", "denmark", 2);
    G.spaces.denmark.fort = {power: "GE", level: 2};
    G.powers.UK.hand = ["IE-A061"];

    const battle = beginNavalBattle(G, ctx, "UK", "north-atlantic", "denmark");
    if (!battle) throw new Error("naval battle did not start");
    G.pending = null;
    battle.winner = "attacker";
    battle.attackerLosses = 0;
    battle.defenderLosses = 0;
    finishBattle(G, ctx);

    expect(G.spaces.denmark.fort).toBeNull();
    // A victorious attacker in a port displaces back to its naval box.
    expect(navalUnitsIn(G, "denmark").some((unit) => unit.owner === "UK")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 18.8 decisive-battle follow-up
// ---------------------------------------------------------------------------

describe("18.8 decisive-battle follow-up", () => {
  test("offers a free move and moves the advanced unit one more space", () => {
    const G = fresh();
    const ctx = makeCtx([6, 1]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A060"];
    const battle = stageLand(G, ctx, 3, 1);
    finishSupport(G, ctx);
    G.pending = null;
    resolveBattleRoll(G, ctx);

    expect(battle.decisive).toBe(true);
    expect(G.pending?.kind).toBe("decisiveBattle");
    const advanced = (G.pending?.context?.unitIds as string[]) ?? [];
    expect(advanced).toHaveLength(1);
    const moveOption = (G.pending?.options ?? []).find((entry) => entry.id.startsWith("move:"));
    expect(moveOption).toBeDefined();
    const target = moveOption!.id.slice("move:".length);

    expect(resolvePending(G, ctx, moveOption!.id)).toBeUndefined();
    expect(G.units[advanced[0]]?.space).toBe(target);
    expect(G.flags.decisiveBonusUsed).toBe(true);
  });

  test("can spend the bonus on another land battle instead", () => {
    const G = fresh();
    const ctx = makeCtx([6, 1]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    clearHands(G);
    G.powers.GE.hand = ["IE-A060"];
    placeUnit(G, "FR", "army", "bavaria", 2);
    stageLand(G, ctx, 3, 1);
    finishSupport(G, ctx);
    G.pending = null;
    resolveBattleRoll(G, ctx);

    expect(G.pending?.kind).toBe("decisiveBattle");
    const battleOption = (G.pending?.options ?? []).find((entry) => entry.id === "battle:bavaria");
    expect(battleOption).toBeDefined();

    expect(resolvePending(G, ctx, "battle:bavaria")).toBeUndefined();
    expect(G.battle).not.toBeNull();
    expect(G.battle?.from).toBe("saxony");
    expect(G.battle?.to).toBe("bavaria");
    expect(G.battle?.notes).toContain("decisiveFollowUpBattle");
  });
});

// ---------------------------------------------------------------------------
// A063 Rapid Mobilization: free deploy + extra reserve army
// ---------------------------------------------------------------------------

describe("A063 Rapid Mobilization deploy clauses", () => {
  const addReserve = (G: ImperialElegyState): Unit => {
    const unit = placeUnit(G, "GE", "reserveArmy", null, 2);
    G.powers.GE.reserves.push(unit.id);
    return unit;
  };

  test("the first deploy is free and deploys one extra army, capped at three", () => {
    const G = fresh();
    const ctx = makeCtx([3]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    G.war.budgets.GE = 5;
    G.powers.GE.industry = 4;
    G.powers.GE.flags.rapidMobilization = true;
    G.powers.GE.reserves = [];
    addReserve(G);
    addReserve(G);

    expect(deployReserveLimit(G, "GE")).toBe(3);
    expect(rapidMobilizationFreeDeploy(G, "GE")).toBe(true);
    expect(deployReserves(G, ctx, "berlin")).toBeUndefined();

    const deployed = landUnitsIn(G, "berlin").filter((unit) => unit.kind === "reserveArmy");
    expect(deployed).toHaveLength(2);
    expect(deployed.every((unit) => unit.flags?.deployedThisImpulse === true)).toBe(true);
    expect(G.war.budgets.GE).toBe(5);
    expect(G.powers.GE.flags.rapidFreeDeployUsed).toBe(true);
  });

  test("a later deploy costs one CP and still uses the A063 limit", () => {
    const G = fresh();
    const ctx = makeCtx([3]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    G.war.budgets.GE = 5;
    G.powers.GE.industry = 4;
    G.powers.GE.flags.rapidMobilization = true;
    G.powers.GE.flags.rapidFreeDeployUsed = true;
    // 33.1 Superior Staff Work would also make GE's first deploy free; this
    // fixture is specifically about a *paid* later deploy.
    G.powers.GE.flags.superiorStaffWorkUsed = true;
    G.powers.GE.reserves = [];
    clearSpace(G, "berlin");
    for (let i = 0; i < 4; i += 1) addReserve(G);

    expect(deployReserves(G, ctx, "berlin", 3)).toBeUndefined();
    expect(G.war.budgets.GE).toBe(4);
    expect(landUnitsIn(G, "berlin").filter((unit) => unit.kind === "reserveArmy")).toHaveLength(3);
  });

  test("the printed half-industry limit applies without A063", () => {
    const G = fresh();
    G.war = warState("GE", "FR");
    G.powers.GE.flags.rapidMobilization = false;
    G.powers.GE.industry = 3;
    expect(deployReserveLimit(G, "GE")).toBe(2);
    G.powers.GE.industry = 1;
    expect(deployReserveLimit(G, "GE")).toBe(1);
    G.powers.GE.industry = 8;
    expect(deployReserveLimit(G, "GE")).toBe(3);
  });

  test("freshly deployed armies cannot attack or move in the same impulse", () => {
    const G = fresh();
    const ctx = makeCtx([3]);
    G.phase = "wartime";
    G.activePower = "GE";
    G.war = warState("GE", "FR");
    G.war.budgets.GE = 5;
    G.powers.GE.industry = 2;
    G.powers.GE.flags.rapidMobilization = true;
    G.powers.GE.reserves = [];
    clearSpace(G, "berlin");
    clearSpace(G, "saxony");
    addReserve(G);
    placeUnit(G, "FR", "army", "saxony", 2);
    expect(deployReserves(G, ctx, "berlin")).toBeUndefined();
    const deployed = landUnitsIn(G, "berlin").find((unit) => unit.kind === "reserveArmy")!;

    expect(typeof redeploy(G, ctx, deployed.id, "hanover")).toBe("string");
    expect(beginLandBattle(G, ctx, "GE", "berlin", "saxony")).toBeNull();
  });
});
