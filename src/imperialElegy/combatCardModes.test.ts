import type {Ctx} from "boardgame.io";
import type {BattleState, CardId, GreatWarState, ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  COMBAT_CARD_BY_ID,
  applyCombatCardModeToBattle,
  applyCombatCardToBattle,
  availableCombatCardModes,
  availableCombatCards,
  combatCardDrm,
  combatCardModes,
} from "./engine/combatCards";
import type {CombatCardMode} from "./engine/combatCards";

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

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const landBattle = (overrides: Partial<BattleState> = {}): BattleState => ({
  kind: "land",
  attacker: "GE",
  defender: "FR",
  from: "berlin",
  to: "saxony",
  mainAttack: ["ge-army-1"],
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

const modeById = (defId: CardId, modeId: string): CombatCardMode => {
  const mode = combatCardModes(COMBAT_CARD_BY_ID[defId]).find((entry) => entry.id === modeId);
  if (!mode) throw new Error(`${defId} has no mode ${modeId}`);
  return mode;
};

// ---------------------------------------------------------------------------
// Mode tables
// ---------------------------------------------------------------------------

describe("combatCardModes", () => {
  test("IE-A066 prints a no-mines mode and a +1 naval DRM mode", () => {
    const def = COMBAT_CARD_BY_ID["IE-A066"];
    const modes = combatCardModes(def);

    expect(modes).toHaveLength(2);
    expect(modes.map((mode) => mode.id)).toEqual(["noMines", "navalDrm"]);
    expect(modes[0]).toMatchObject({kind: "noMines", drm: 0, target: "self"});
    expect(modes[0].notes).toContain("noMines");
    expect(modes[1]).toMatchObject({kind: "drm", drm: 1, target: "self"});
    expect(modes[1].notes).toEqual([]);
    // Both printed options carry labels in both languages.
    for (const mode of modes) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.labelZh.length).toBeGreaterThan(0);
    }
  });

  test("IE-A061 exposes its two printed clauses as modes", () => {
    const def = COMBAT_CARD_BY_ID["IE-A061"];
    const modes = combatCardModes(def);

    expect(modes).toHaveLength(2);
    expect(modes.map((mode) => mode.id)).toEqual(["navalDrm", "noMines"]);
    expect(modes[0]).toMatchObject({kind: "drm", drm: 2, target: "self"});
    expect(modes[1]).toMatchObject({kind: "noMines", drm: 0, target: "self"});
    expect(modes[1].notes).toContain("noMines");
  });

  test("single-mode cards synthesize a default mode from the legacy fields", () => {
    const def = COMBAT_CARD_BY_ID["IE-A058"];
    const modes = combatCardModes(def);

    expect(modes).toHaveLength(1);
    expect(modes[0]).toMatchObject({
      id: "default",
      label: "Siege Guns",
      labelZh: "攻城炮",
      kind: "drm",
      drm: 0,
      target: "self",
    });
    expect(modes[0].notes).toEqual(["siegeGuns"]);
  });
});

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

describe("availableCombatCardModes", () => {
  test("offers both Damn the Torpedoes modes in a naval battle", () => {
    const G = fresh();
    setHand(G, "GE", ["IE-A066"]);

    const entries = availableCombatCardModes(G, "GE", navalBattle());
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.cardId)).toEqual(["IE-A066", "IE-A066"]);
    expect(entries.map((entry) => entry.mode.id)).toEqual(["noMines", "navalDrm"]);
    expect(entries.map((entry) => entry.mode.kind)).toEqual(["noMines", "drm"]);
  });

  test("offers neither Damn the Torpedoes mode in a land battle", () => {
    const G = fresh();
    setHand(G, "GE", ["IE-A066"]);

    expect(availableCombatCardModes(G, "GE", landBattle())).toEqual([]);
  });

  test("offers both modes to the defending player at sea", () => {
    const G = fresh();
    setHand(G, "FR", ["IE-A066"]);

    const entries = availableCombatCardModes(
      G,
      "FR",
      navalBattle({cardSide: "defender"}),
    );
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => entry.cardId === "IE-A066")).toBe(true);
  });

  test("offers both Ironclads modes at sea and none on land", () => {
    const G = fresh();
    setHand(G, "GE", ["IE-A061"]);

    expect(
      availableCombatCardModes(G, "GE", navalBattle()).map((entry) => entry.mode.id),
    ).toEqual(["navalDrm", "noMines"]);
    expect(availableCombatCardModes(G, "GE", landBattle())).toEqual([]);
  });

  test("offers the synthesized default mode of a GW combat card", () => {
    const G = fresh();
    activateGw(G, 3);
    G.powers.GE.gwCard = "IE-GW-05";

    const entries = availableCombatCardModes(G, "GE", rolledBattle());
    expect(entries).toHaveLength(1);
    expect(entries[0].cardId).toBe("IE-GW-05");
    expect(entries[0].mode.id).toBe("default");
    expect(entries[0].mode.kind).toBe("reroll");
  });
});

// ---------------------------------------------------------------------------
// Applying a mode
// ---------------------------------------------------------------------------

describe("applyCombatCardModeToBattle", () => {
  test("the no-mines mode clears mines without adding DRM", () => {
    const def = COMBAT_CARD_BY_ID["IE-A066"];
    const mode = modeById("IE-A066", "noMines");
    const battle = navalBattle({mines: 3, attackerLosses: 3});

    const after = applyCombatCardModeToBattle(battle, def, mode);

    expect(after.mines).toBe(0);
    expect(after.notes).toContain("noMines");
    expect(after.attackerDrm).toBe(0);
    expect(after.defenderDrm).toBe(0);
    // The caller's loss bookkeeping is untouched, and so is the input battle.
    expect(after.attackerLosses).toBe(3);
    expect(battle.mines).toBe(3);
    expect(after).not.toBe(battle);
    expect(after.notes).not.toBe(battle.notes);
    expect(after.mainAttack).not.toBe(battle.mainAttack);
  });

  test("the +1 naval mode gives the playing side the DRM, not the mines", () => {
    const def = COMBAT_CARD_BY_ID["IE-A066"];
    const mode = modeById("IE-A066", "navalDrm");

    const asAttacker = applyCombatCardModeToBattle(
      navalBattle({cardSide: "attacker", mines: 2}),
      def,
      mode,
    );
    expect(asAttacker.attackerDrm).toBe(1);
    expect(asAttacker.defenderDrm).toBe(0);
    // Only the no-mines mode cancels mines.
    expect(asAttacker.mines).toBe(2);
    expect(asAttacker.notes).toEqual([]);

    const asDefender = applyCombatCardModeToBattle(
      navalBattle({cardSide: "defender"}),
      def,
      mode,
    );
    expect(asDefender.attackerDrm).toBe(0);
    expect(asDefender.defenderDrm).toBe(1);
  });

  test("the +1 mode is ignored outside a naval battle", () => {
    const def = COMBAT_CARD_BY_ID["IE-A066"];
    const mode = modeById("IE-A066", "navalDrm");

    const after = applyCombatCardModeToBattle(landBattle(), def, mode);
    expect(after.attackerDrm).toBe(0);
    expect(after.defenderDrm).toBe(0);
  });

  test("Ironclads modes resolve the +2 and the no-mines clause separately", () => {
    const def = COMBAT_CARD_BY_ID["IE-A061"];
    const battle = navalBattle({cardSide: "attacker", mines: 2});

    const drmOnly = applyCombatCardModeToBattle(battle, def, modeById("IE-A061", "navalDrm"));
    expect(drmOnly.attackerDrm).toBe(2);
    expect(drmOnly.mines).toBe(2);
    expect(drmOnly.notes).toEqual([]);

    const minesOnly = applyCombatCardModeToBattle(battle, def, modeById("IE-A061", "noMines"));
    expect(minesOnly.attackerDrm).toBe(0);
    expect(minesOnly.mines).toBe(0);
    expect(minesOnly.notes).toContain("noMines");

    // Applying both clauses reproduces the printed combined effect.
    const both = applyCombatCardModeToBattle(
      drmOnly,
      def,
      modeById("IE-A061", "noMines"),
    );
    expect(both.attackerDrm).toBe(2);
    expect(both.mines).toBe(0);
    expect(both.notes).toEqual(["noMines"]);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility
// ---------------------------------------------------------------------------

describe("legacy single-mode API", () => {
  test("availableCombatCards still returns plain card ids", () => {
    const G = fresh();
    setHand(G, "GE", ["IE-A061", "IE-A066"]);

    expect(availableCombatCards(G, "GE", navalBattle())).toEqual(["IE-A061", "IE-A066"]);
    expect(availableCombatCards(G, "GE", landBattle())).toEqual([]);
  });

  test("applyCombatCardToBattle keeps the old combined card effects", () => {
    // Ironclads still grants +2 and cancels mines in one call.
    const ironclads = applyCombatCardToBattle(
      navalBattle({mines: 3}),
      COMBAT_CARD_BY_ID["IE-A061"],
    );
    expect(ironclads.attackerDrm).toBe(2);
    expect(ironclads.mines).toBe(0);
    expect(ironclads.notes).toContain("noMines");

    // Damn the Torpedoes still defaults to its no-mines mode.
    const torpedoes = applyCombatCardToBattle(
      navalBattle({mines: 2}),
      COMBAT_CARD_BY_ID["IE-A066"],
    );
    expect(torpedoes.attackerDrm).toBe(0);
    expect(torpedoes.mines).toBe(0);
    expect(torpedoes.notes).toContain("noMines");

    // A single-mode land card is unchanged too.
    const siege = applyCombatCardToBattle(landBattle(), COMBAT_CARD_BY_ID["IE-A058"]);
    expect(siege.notes).toEqual(["siegeGuns"]);
    expect(siege.attackerDrm).toBe(0);
  });

  test("combatCardDrm keeps its old whole-card behaviour", () => {
    const def = COMBAT_CARD_BY_ID["IE-A061"];
    expect(combatCardDrm(def, navalBattle())).toBe(2);
    expect(combatCardDrm(def, landBattle())).toBe(0);
    expect(combatCardDrm(COMBAT_CARD_BY_ID["IE-A060"], landBattle())).toBe(-1);
  });
});
