import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleState, CardId, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  COMBAT_CARD_BY_ID,
  availableCombatCardModes,
  combatCardModes,
} from "./engine/combatCards";
import type {CombatCardMode} from "./engine/combatCards";
import {
  beginLandBattle,
  beginNavalBattle,
  chooseSupport,
  playCombatCard,
} from "./engine/combat";
import {placeUnit} from "./engine/effects";
import {resolvePending} from "./moves";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeCtx = (dice: number[] = [6], playerID: string | null = "0"): Ctx => {
  let index = 0;
  return {
    playerID,
    random: {
      Die: (_sides: number) => dice[Math.min(index++, dice.length - 1)] ?? 6,
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

const setHand = (G: ImperialElegyState, power: Power, hand: CardId[]): void => {
  G.powers[power].hand = [...hand];
};

const cardOptionIds = (G: ImperialElegyState): string[] =>
  (G.pending?.options ?? []).map((entry) => String(entry.id)).filter((id) => id.startsWith("card:"));

const optionLabel = (G: ImperialElegyState, id: string): string =>
  String(G.pending?.options.find((entry) => entry.id === id)?.label ?? "");

const expectedLabel = (mode: CombatCardMode): string => `Play ${mode.label}`;

/**
 * A UK attack on the fortified GE port of Gibraltar.  At turn 4 the port's
 * mines are four dice (all 6s with this ctx), but the roll is deferred until
 * after the pre-dice combat-card window.
 *
 * Giving GE `A066` keeps a defender card window open after the UK play, which
 * leaves the applied battle live for DRM assertions instead of resolving
 * straight into the dice and losses.
 */
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
  setHand(G, "UK", hand);
  setHand(G, "GE", defenderHand);
  G.spaces.gibraltar.fort = {power: "GE", level: 1};
  placeUnit(G, "GE", "squadron", "gibraltar", 2);
  // UK is seat 1; `resolvePending` checks the acting decision's seat.
  const ctx = makeCtx([6], "1");
  const battle = beginNavalBattle(G, ctx, "UK", "london", "gibraltar");
  if (!battle) throw new Error("naval battle did not start");
  return {G, ctx, battle};
};

/**
 * A GE attack on a RU-held Saxony.  `defenderHand` keeps the defender's card
 * window open so the attacker's applied battle copy stays live.
 */
const openLandCardWindow = (
  hand: CardId[],
  defenderHand: CardId[] = [],
): {G: ImperialElegyState; ctx: Ctx; battle: BattleState} => {
  const G = fresh();
  G.phase = "wartime";
  G.activePower = "GE";
  G.war = warState("GE", "RU");
  clearHands(G);
  setHand(G, "GE", hand);
  setHand(G, "RU", defenderHand);
  placeUnit(G, "RU", "army", "saxony", 2);
  // Siege Guns is only offered against an enemy fort.
  if (hand.includes("IE-A058")) G.spaces.saxony.fort = {power: "RU", level: 1};
  const ctx = makeCtx([3, 3]);
  const battle = beginLandBattle(G, ctx, "GE", "berlin", "saxony");
  if (!battle) throw new Error("land battle did not start");
  chooseSupport(G, ctx, "done");
  chooseSupport(G, ctx, "done");
  if (G.pending?.kind !== "combatCard") throw new Error("combat-card window did not open");
  return {G, ctx, battle};
};

const modeOf = (cardId: CardId, modeId: string): CombatCardMode => {
  const mode = combatCardModes(COMBAT_CARD_BY_ID[cardId]).find((entry) => entry.id === modeId);
  if (!mode) throw new Error(`${cardId} has no mode ${modeId}`);
  return mode;
};

// ---------------------------------------------------------------------------
// Mode selection in the card window
// ---------------------------------------------------------------------------

describe("combat-card mode options", () => {
  test("A066 offers its no-mines and +1 naval modes", () => {
    const {G, battle} = openMinedPortBattle(["IE-A066"]);

    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("UK");
    // The window is built from availableCombatCardModes, one option per mode.
    expect(cardOptionIds(G)).toEqual([
      "card:IE-A066:noMines",
      "card:IE-A066:navalDrm",
    ]);
    expect(availableCombatCardModes(G, "UK", battle).map((entry) => entry.mode.id)).toEqual([
      "noMines",
      "navalDrm",
    ]);
    // Labels come from the mode definitions, not the raw card id.
    expect(optionLabel(G, "card:IE-A066:noMines")).toBe(
      expectedLabel(modeOf("IE-A066", "noMines")),
    );
    expect(optionLabel(G, "card:IE-A066:navalDrm")).toBe(
      expectedLabel(modeOf("IE-A066", "navalDrm")),
    );
  });

  test("A061 still offers its +2 and no-mines modes", () => {
    const {G} = openMinedPortBattle(["IE-A061"]);

    expect(cardOptionIds(G)).toEqual([
      "card:IE-A061:navalDrm",
      "card:IE-A061:noMines",
    ]);
    expect(optionLabel(G, "card:IE-A061:navalDrm")).toBe(
      expectedLabel(modeOf("IE-A061", "navalDrm")),
    );
    expect(optionLabel(G, "card:IE-A061:noMines")).toBe(
      expectedLabel(modeOf("IE-A061", "noMines")),
    );
  });

  test("single-mode cards keep the plain card option id and title", () => {
    const {G} = openLandCardWindow(["IE-A043"]);

    expect(cardOptionIds(G)).toEqual(["card:IE-A043"]);
    expect(optionLabel(G, "card:IE-A043")).toBe("Play At Any Cost");
  });
});

// ---------------------------------------------------------------------------
// Resolving a chosen mode
// ---------------------------------------------------------------------------

describe("combat-card mode resolution", () => {
  test("A066 no-mines prevents the deferred mine losses", () => {
    const control = openMinedPortBattle([]);
    expect(control.battle.notes).toContain("minefield");
    // With no card, the deferred mines are rolled and cost ships.  The battle
    // finishes here, so read the (still-mutated) battle object rather than G.battle.
    expect(control.battle.mines).toBe(4);

    // Keep a defender card window open so the applied battle stays live (the
    // 19.5 port DRMs and deferred mines would otherwise finish it).
    const {G, ctx, battle} = openMinedPortBattle(["IE-A066"], ["IE-A066"]);
    expect(battle.notes).toContain("minefield");
    expect(battle.mines).toBe(0);

    // moves.ts forwards the `:noMines` suffix after stripping `card:`.
    expect(resolvePending(G, ctx, "card:IE-A066:noMines")).toBeUndefined();
    const applied = G.battle;
    expect(applied).not.toBeNull();
    expect(applied?.notes).toContain("noMines");
    expect(applied?.mines).toBe(0);
    expect(applied?.attackerDrm).toBe(battle.attackerDrm);
    // The noMines mode suppresses the four mine hits entirely.
    expect(applied?.mines).toBe(0);
  });

  test("A066 +1 naval mode adds exactly one attacker DRM", () => {
    const {G, ctx, battle} = openMinedPortBattle(["IE-A066"], ["IE-A066"]);
    const beforeAttacker = battle.attackerDrm;
    const beforeDefender = battle.defenderDrm;

    expect(playCombatCard(G, ctx, "IE-A066:navalDrm")).toBeUndefined();
    const applied = G.battle;
    expect(applied).not.toBeNull();
    expect(applied?.attackerDrm).toBe(beforeAttacker + 1);
    expect(applied?.defenderDrm).toBe(beforeDefender);
    // The DRM mode does not cancel mines; the roll is still deferred.
    expect(applied?.notes).not.toContain("noMines");
    expect(applied?.mines).toBe(0);
    // The defender's window is open, so nothing has been rolled yet.
    expect(G.pending?.kind).toBe("combatCard");
    expect(G.pending?.power).toBe("GE");
  });

  test("A061 +2 mode resolves only its own printed clause", () => {
    const {G, ctx, battle} = openMinedPortBattle(["IE-A061"], ["IE-A066"]);
    const beforeAttacker = battle.attackerDrm;

    expect(playCombatCard(G, ctx, "IE-A061:navalDrm")).toBeUndefined();
    const applied = G.battle;
    expect(applied).not.toBeNull();
    expect(applied?.attackerDrm).toBe(beforeAttacker + 2);
    expect(applied?.notes).not.toContain("noMines");
    expect(applied?.mines).toBe(0);
  });

  test("a bare card id still applies the legacy combined effect", () => {
    const {G, ctx, battle} = openMinedPortBattle(["IE-A061"], ["IE-A066"]);
    const beforeAttacker = battle.attackerDrm;

    // Existing callers and response-window code pass the plain card id.
    expect(playCombatCard(G, ctx, "IE-A061")).toBeUndefined();
    const applied = G.battle;
    expect(applied?.attackerDrm).toBe(beforeAttacker + 2);
    expect(applied?.notes).toContain("noMines");
    expect(applied?.mines).toBe(0);
  });

  test('single-mode cards accept both the plain id and an explicit ":default"', () => {
    const plain = openLandCardWindow(["IE-A043"], ["IE-A060"]);
    const beforePlain = plain.battle.attackerDrm;
    expect(playCombatCard(plain.G, plain.ctx, "IE-A043")).toBeUndefined();
    expect(plain.G.battle?.attackerDrm).toBe(beforePlain + 1);
    expect(plain.G.powers.GE.hand).not.toContain("IE-A043");

    const explicit = openLandCardWindow(["IE-A058"], ["IE-A060"]);
    expect(playCombatCard(explicit.G, explicit.ctx, "IE-A058:default")).toBeUndefined();
    expect(explicit.G.battle?.notes).toContain("siegeGuns");
    expect(explicit.G.powers.GE.hand).not.toContain("IE-A058");
  });
});

// ---------------------------------------------------------------------------
// Invalid choices must not consume the card or touch the battle
// ---------------------------------------------------------------------------

describe("combat-card mode validation", () => {
  test("rejects unknown cards, unoffered modes and malformed selections without mutation", () => {
    const {G, ctx, battle} = openMinedPortBattle(["IE-A066"], ["IE-A066"]);
    const pending = G.pending;
    const snapshot = JSON.stringify({battle: G.battle, pending: G.pending, hand: G.powers.UK.hand, discard: G.discard});

    const invalid = [
      "IE-A066:bogus", // known card, unknown mode
      "IE-A066:default", // A066 has no synthesized default
      "IE-A066:", // empty mode id
      "IE-A061:navalDrm", // known card/mode, but not in this hand
      "IE-A999:noMines", // unknown card
      "IE-A999", // unknown bare card
      "", // empty selection
    ];
    for (const selection of invalid) {
      expect(playCombatCard(G, ctx, selection)).toBeUndefined();
      expect(G.pending).toBe(pending);
      expect(G.battle).toBe(battle);
      expect(G.powers.UK.hand).toEqual(["IE-A066"]);
      expect(JSON.stringify({battle: G.battle, pending: G.pending, hand: G.powers.UK.hand, discard: G.discard})).toBe(snapshot);
    }

    // resolvePending also refuses an id that was never offered.
    expect(resolvePending(G, ctx, "card:IE-A066:bogus")).toBe(INVALID_MOVE);
    expect(G.pending).toBe(pending);
    expect(G.battle).toBe(battle);
    expect(G.powers.UK.hand).toEqual(["IE-A066"]);

    // A valid choice still works after the rejected attempts.
    expect(resolvePending(G, ctx, "card:IE-A066:navalDrm")).toBeUndefined();
    expect(G.powers.UK.hand).not.toContain("IE-A066");
    expect(G.discard).toContain("IE-A066");
  });
});
