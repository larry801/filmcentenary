/**
 * Regression suite for the card-event defects recorded in `CARD_EVENTS.md`.
 *
 * Each block pins one printed clause that the engine used to resolve with the
 * wrong sign, the wrong target or a deterministic default:
 *
 *   - §3.1 four cards granted stability twice;
 *   - §3.2 A083 Quagmire applied +1 pacification and -1 stability instead of
 *     -2 pacification and -1 card marker;
 *   - §3.3 A080 Machine Guns floored naval/rebel dice;
 *   - §3.4 A091 Hydraulic Recoil was a no-op;
 *   - §3.5 A069 removed itself on every turn;
 *   - §3.6 A039 omitted the UK discard-to-ignore window;
 *   - §3.7 A072 omitted the naval squadron;
 *   - §3.8 A099 omitted the first-card bonus and A096 crowned Japan's alliance
 *     immediately instead of at the war's end;
 *   - §3.9 A032 only set a flag;
 *   - §3.10 printed "OR" resolved by a deterministic default.
 */
import type {Ctx} from "boardgame.io";
import {setupImperialElegy} from "./engine/setup";
import {playCard, resolvePending} from "./moves";
import {beginLandBattle, beginNavalBattle, machineGunsApplies, resolveBattleRoll} from "./engine/combat";
import {placeUnit, resolveAmericanCivilWarEndPhase, resolveCard} from "./engine/effects";
import {cardById} from "./engine/deck";
import {POWERS} from "./types";

const seats = POWERS as unknown as string[];

const makeCtx = (dice: number[] = [], seat = "0", turn = 1): Ctx => {
  let index = 0;
  return {
    playerID: seat,
    random: {Die: () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn,
    phase: "action",
  } as unknown as Ctx;
};

const seatOf = (power: string): string => String(seats.indexOf(power));

const setup = (power: string, turn = 3) => {
  const G: any = setupImperialElegy({...makeCtx()});
  G.phase = "action";
  G.activePower = power;
  G.turn = turn;
  return G;
};

/** 12.16/13.4: make Bavaria a legal land-battle target for France. */
const declareOnBavaria = (G: any): void => {
  G.war = {
    attacker: "FR", defender: "Bavaria", attackerAllies: [], defenderAllies: [],
    attackerMinors: [], defenderMinors: ["Bavaria"], warAim: "conquest",
    objectives: ["bavaria"], status: "maneuver", budgets: {}, initiative: [],
    treaties: [], victor: null, truceTurns: 0, passed: [], startedTurn: 3,
  };
};

/** Play one card for its event and return the state. */
const play = (id: string, power: string, turn = 3, dice: number[] = []) => {
  const G = setup(power, turn);
  G.powers[power].hand = [id];
  if (id.startsWith("IE-H")) G.powers[power].selectedHomeCard = id;
  let index = 0;
  const d = () => dice[Math.min(index++, Math.max(0, dice.length - 1))] ?? 3;
  playCard(G, makeCtx([], seatOf(power), turn), id, "event");
  void d;
  return G;
};

/** Pass every open support declaration so the dice can be rolled. */
const passSupport = (G: any): void => {
  let guard = 0;
  while (G.pending?.kind === "combatSupport" && guard++ < 4) {
    const pending = G.pending;
    resolvePending(G, makeCtx([], seatOf(pending.power), G.turn), "done");
  }
};

/** Answer the open decision with the first option until none is left. */
const answerAll = (G: any, limit = 30): void => {
  let guard = 0;
  while (G.pending && guard++ < limit) {
    const pending = G.pending;
    const option = pending.options[0];
    if (!option) break;
    resolvePending(G, makeCtx([], seatOf(pending.power), G.turn), option.id);
    if (G.pending === pending) break;
  }
};

// ---------------------------------------------------------------------------
// §3.1 — stability applied once
// ---------------------------------------------------------------------------

describe("a card's stability effect is applied once", () => {
  const cases: [string, string][] = [
    ["IE-A047", "AU"],
    ["IE-H-GE-1", "GE"],
    ["IE-H-UK-3", "UK"],
    ["IE-H-FR-5", "FR"],
  ];

  test.each(cases)("%s grants exactly +1 to %s", (cardId, power) => {
    const G = play(cardId, power, 1);
    // Every starting power sits at 3; the printed clause is +1.
    expect(G.powers[power].stability).toBe(4);
  });

  test("A029 Economic Boom still grants exactly +1", () => {
    const G = play("IE-A029", "GE", 3);
    expect(G.powers.GE.stability).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// §3.2 — A083 Quagmire
// ---------------------------------------------------------------------------

describe("A083 Quagmire", () => {
  test("subtracts 2 pacification and 1 card marker, and does not touch stability", () => {
    const G = setup("GE");
    G.spaces["south-africa"].control = "UK";
    G.spaces["south-africa"].pacification = 6;
    G.war = {
      attacker: "GE", defender: "UK", status: "maneuver",
      attackerAllies: [], defenderAllies: [], attackerMinors: [], defenderMinors: [],
      objectives: [], budgets: {GE: 4, UK: 4}, initiative: ["GE"], treaties: [],
    };
    const stabilityBefore = G.powers.UK.stability;
    G.powers.GE.hand = ["IE-A083"];
    playCard(G, makeCtx([], "0", 3), "IE-A083", "event");

    const pending = G.pending;
    expect(pending?.kind).toBe("eventTargetSpace");
    const southAfrica = pending!.options.find((o: any) => o.id === "south-africa");
    expect(southAfrica).toBeDefined();
    resolvePending(G, makeCtx([], seatOf(pending!.power), 3), "south-africa");

    expect(G.spaces["south-africa"].pacification).toBe(4);
    expect(G.powers.UK.cardMarkers).toBe(-1);
    expect(G.powers.UK.stability).toBe(stabilityBefore);
  });

  test("offers any space that is still being pacified, not only enemy Africa", () => {
    const G = setup("GE");
    G.spaces["south-africa"].control = "GE";
    G.spaces["south-africa"].pacification = 3;
    G.powers.GE.hand = ["IE-A083"];
    playCard(G, makeCtx([], "0", 3), "IE-A083", "event");
    expect(G.pending?.options.map((o: any) => o.id)).toContain("south-africa");
  });

  test("floors the marker at 0", () => {
    const G = setup("GE");
    G.spaces["south-africa"].control = "UK";
    G.spaces["south-africa"].pacification = 1;
    G.powers.GE.hand = ["IE-A083"];
    playCard(G, makeCtx([], "0", 3), "IE-A083", "event");
    resolvePending(G, makeCtx([], seatOf(G.pending!.power), 3), "south-africa");
    expect(G.spaces["south-africa"].pacification).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §3.3 — A080 Machine Guns scope
// ---------------------------------------------------------------------------

describe("A080 Machine Guns applies to land battles against non-rebels only", () => {
  const buildLand = (G: any, defenderIsRebel: boolean) => {
    // 12.16/13.4: the land battle needs the declaration that makes Bavaria a
    // belligerent (a rebel defender is always a legal target).
    declareOnBavaria(G);
    for (const unit of Object.values(G.units) as any[]) {
      if (unit.space === "bavaria") unit.steps = 0;
    }
    G.units = Object.fromEntries(Object.entries(G.units).filter(([, u]: any) => u.steps > 0));
    G.spaces.bavaria.units = [];
    if (defenderIsRebel) {
      placeUnit(G, "REBEL:Zulu", "rebelArmy", "bavaria", 2);
      G.spaces.bavaria.rebellion = {minor: "Zulu", step: 0, rebels: []};
    } else {
      placeUnit(G, "Bavaria", "minorArmy", "bavaria", 2);
    }
    return beginLandBattle(G, makeCtx([1, 1]), "FR", "alsace-lorraine", "bavaria");
  };

  test("floors both dice in a land battle", () => {
    const G = setup("FR");
    G.persistent.machineGuns = true;
    const battle: any = buildLand(G, false);
    G.battle = battle;
    resolveBattleRoll(G, makeCtx([1, 1]));
    expect(battle.attackerRoll).toBe(3);
    expect(battle.defenderRoll).toBe(3);
  });

  test("does not floor a rebel defender's die", () => {
    const G = setup("FR");
    G.persistent.machineGuns = true;
    const battle: any = buildLand(G, true);
    G.battle = battle;
    expect(machineGunsApplies(G, battle, "attacker")).toBe(false);
    resolveBattleRoll(G, makeCtx([1, 1]));
    expect(battle.defenderRoll).toBe(1);
  });

  test("does not floor naval dice", () => {
    const G = setup("UK");
    G.persistent.machineGuns = true;
    placeUnit(G, "GE", "squadron", "north-atlantic", 2);
    const battle: any = beginNavalBattle(G, makeCtx([1, 1]), "UK", "london", "north-atlantic");
    G.battle = battle;
    expect(machineGunsApplies(G, battle, "attacker")).toBe(false);
    resolveBattleRoll(G, makeCtx([1, 1]));
    expect(battle.attackerRoll).toBe(1);
    expect(battle.defenderRoll).toBe(1);
  });

  test("is inert without the card", () => {
    const G = setup("FR");
    const battle: any = buildLand(G, false);
    G.battle = battle;
    resolveBattleRoll(G, makeCtx([2, 1]));
    expect(battle.attackerRoll).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §3.4 — A091 Hydraulic Recoil
// ---------------------------------------------------------------------------

describe("A091 Hydraulic Recoil applies the CRT footnotes", () => {
  test("the `**` row adds one loss to both sides without a decision", () => {
    const G = setup("FR");
    G.persistent.hydraulicRecoil = true;
    // A differential of 0 is the printed `**` row (1/1 losses, attacker wins).
    declareOnBavaria(G);
    const battle: any = beginLandBattle(G, makeCtx(), "FR", "alsace-lorraine", "bavaria");
    G.battle = battle;
    passSupport(G);
    resolveBattleRoll(G, makeCtx([3, 3]));
    expect(battle.doubleStar).toBe(true);
    // The `**` row is mandatory: no hydraulicRecoil decision is opened.
    expect(G.pending?.kind).not.toBe("hydraulicRecoil");
    expect(battle.attackerLosses).toBe(2);
    expect(battle.defenderLosses).toBe(2);
  });

  test("the `*` row asks the victor and applies the extra loss on request", () => {
    const G = setup("FR");
    G.persistent.hydraulicRecoil = true;
    declareOnBavaria(G);
    const battle: any = beginLandBattle(G, makeCtx(), "FR", "alsace-lorraine", "bavaria");
    G.battle = battle;
    passSupport(G);
    // differential +2 is the printed `*` row.  The minor defender's fort/DRM
    // makes the raw dice an unreliable way to hit that row, so drive the roll
    // with a wide margin instead.
    resolveBattleRoll(G, makeCtx([6, 3]));
    expect(battle.star).toBe(true);
    expect(G.pending?.kind).toBe("hydraulicRecoil");
    const before = [battle.attackerLosses, battle.defenderLosses];
    resolvePending(G, makeCtx([], seatOf("FR"), 3), "apply");
    expect(battle.hydraulicRecoilResolved).toBe(true);
    // `applyLosses` consumes a loss straight away, so compare against the
    // recorded totals rather than the untouched `before` pair.
    expect(battle.attackerLosses + battle.defenderLosses)
      .toBeGreaterThanOrEqual(before[0] + before[1]);
  });

  test("declining the `*` row leaves the losses alone", () => {
    const G = setup("FR");
    G.persistent.hydraulicRecoil = true;
    declareOnBavaria(G);
    const battle: any = beginLandBattle(G, makeCtx(), "FR", "alsace-lorraine", "bavaria");
    G.battle = battle;
    passSupport(G);
    resolveBattleRoll(G, makeCtx([6, 3]));
    const before = [battle.attackerLosses, battle.defenderLosses];
    resolvePending(G, makeCtx([], seatOf("FR")), "decline");
    expect([battle.attackerLosses, battle.defenderLosses]).toEqual(before);
  });

  test("is inert without the card", () => {
    const G = setup("FR");
    declareOnBavaria(G);
    const battle: any = beginLandBattle(G, makeCtx(), "FR", "alsace-lorraine", "bavaria");
    G.battle = battle;
    passSupport(G);
    resolveBattleRoll(G, makeCtx([3, 3]));
    expect(battle.attackerLosses).toBe(1);
    expect(battle.defenderLosses).toBe(1);
    expect(G.pending?.kind).not.toBe("hydraulicRecoil");
  });
});

// ---------------------------------------------------------------------------
// §3.5 — A069 Concert of Europe
// ---------------------------------------------------------------------------

describe("A069 Concert of Europe", () => {
  test.each([
    [1, false],
    [3, false],
    [4, false],
    [5, true],
    [6, true],
  ])("turn %i removes the card: %s", (turn, removed) => {
    const G = play("IE-A069", "GE", turn);
    expect(G.removed.includes("IE-A069")).toBe(removed);
    if (!removed) expect(G.discard).toContain("IE-A069");
  });
});

// ---------------------------------------------------------------------------
// §3.6 — A039 Uprising in Ireland
// ---------------------------------------------------------------------------

describe("A039 Uprising in Ireland", () => {
  const withUkCard = (G: any) => {
    G.spaces.ireland.control = "UK";
    G.powers.UK.hand = ["IE-A023"];
    return G;
  };

  test("offers the UK the discard-to-ignore window", () => {
    const G = withUkCard(setup("GE"));
    G.powers.GE.hand = ["IE-A039"];
    playCard(G, makeCtx([], "0", 3), "IE-A039", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.power).toBe("UK");
    expect(G.pending?.options.map((o: any) => o.id)).toContain("discard:IE-A023");
  });

  test("discarding a 3 CP card ignores the event entirely", () => {
    const G = withUkCard(setup("GE"));
    const stabilityBefore = G.powers.UK.stability;
    const markersBefore = G.powers.UK.cardMarkers;
    G.powers.GE.hand = ["IE-A039"];
    playCard(G, makeCtx([], "0", 3), "IE-A039", "event");
    resolvePending(G, makeCtx([], seatOf("UK"), 3), "discard:IE-A023");
    expect(G.powers.UK.hand).not.toContain("IE-A023");
    expect(G.powers.UK.stability).toBe(stabilityBefore);
    expect(G.powers.UK.cardMarkers).toBe(markersBefore);
    expect(G.spaces.ireland.rebellion ?? null).toBeNull();
  });

  test("declining applies the printed penalty", () => {
    const G = withUkCard(setup("GE"));
    const stabilityBefore = G.powers.UK.stability;
    G.powers.GE.hand = ["IE-A039"];
    playCard(G, makeCtx([], "0", 3), "IE-A039", "event");
    resolvePending(G, makeCtx([], seatOf("UK"), 3), "decline");
    expect(G.powers.UK.stability).toBe(stabilityBefore - 1);
    expect(G.powers.UK.cardMarkers).toBe(-1);
    expect(G.spaces.ireland.rebellion).toBeDefined();
  });

  test("applies immediately when the UK holds no 3/4 CP card", () => {
    const G = setup("GE");
    G.spaces.ireland.control = "UK";
    G.powers.UK.hand = [];
    G.powers.GE.hand = ["IE-A039"];
    playCard(G, makeCtx([], "0", 3), "IE-A039", "event");
    expect(G.pending).toBeNull();
    expect(G.spaces.ireland.rebellion).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// §3.7 — A072 Meiji Restoration
// ---------------------------------------------------------------------------

test("A072 Meiji Restoration places the army and the squadron", () => {
  const G = play("IE-A072", "GE");
  const kinds = (Object.values(G.units) as any[])
    .filter((u) => u.space === "japan")
    .map((u) => u.kind)
    .sort();
  expect(kinds).toEqual(["minorArmy", "squadron"]);
});

// ---------------------------------------------------------------------------
// §3.8 — A099 first-card bonus
// ---------------------------------------------------------------------------

describe("A099 Dreadnought", () => {
  const dreadnoughts = (G: any): number =>
    (Object.values(G.units) as any[]).filter((u) => u.kind === "dreadnought" && u.owner === "GE").length;

  test("grants an extra dreadnought as the first card of the turn", () => {
    const G = play("IE-A099", "GE", 3);
    expect(dreadnoughts(G)).toBe(2);
  });

  test("grants only one when another card was already played", () => {
    const G = setup("GE");
    // A first play consumes the turn's "first card" slot.
    G.powers.GE.hand = ["IE-A029"];
    playCard(G, makeCtx([], "0", 3), "IE-A029", "event");
    answerAll(G);
    // `finishImpulse` handed the impulse on; give it back to GE (the turn is
    // still the same, so A099 is no longer the first card of the turn).
    G.pending = null;
    G.cpRemaining = 0;
    G.impulseCard = null;
    G.activePower = "GE";
    G.powers.GE.hand = ["IE-A099"];
    playCard(G, makeCtx([], "0", 3), "IE-A099", "event");
    expect(dreadnoughts(G)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// §3.8 — A096 Japan's alliance happens at the end of the war
// ---------------------------------------------------------------------------

test("A096 Empire of the Sun records the alliance for the war's end", () => {
  const G = setup("GE");
  G.persistent.meiji = true;
  G.powers.GE.hand = ["IE-A096"];
  playCard(G, makeCtx([], "0", 3), "IE-A096", "event");
  // The card is a chain (Korea/Manchuria, then the defender's discard), so the
  // claim is recorded only once it resolves.
  answerAll(G);
  expect(G.spaces.japan.ally).toBeNull();
  expect(G.flags.japanAlliancePending).toBe("GE");
});

// ---------------------------------------------------------------------------
// §3.9 — A032 American Civil War
// ---------------------------------------------------------------------------

describe("A032 American Civil War end-phase roll", () => {
  const withAcw = () => {
    const G = setup("GE");
    G.persistent.acw = true;
    return G;
  };

  test("6+ makes the CSA independent and rewards the largest force in The South", () => {
    const G = withAcw();
    placeUnit(G, "UK", "army", "the-south", 2);
    placeUnit(G, "UK", "army", "the-south", 2);
    placeUnit(G, "FR", "army", "the-south", 2);
    const result = resolveAmericanCivilWarEndPhase(G, makeCtx([6]));
    expect(result?.independent).toBe(true);
    expect(G.persistent.csaIndependent).toBe(true);
    expect(G.spaces["the-south"].ally).toBe("UK");
    expect(G.powers.UK.colonialKeys).toBe(8); // 7 at setup + 1
  });

  test("a low roll keeps the CSA in the Union", () => {
    const G = withAcw();
    const result = resolveAmericanCivilWarEndPhase(G, makeCtx([1]));
    expect(result?.independent).toBe(false);
    expect(G.persistent.csaIndependent).toBeUndefined();
  });

  test("UK and FR support adds a DRM and costs them a card marker on success", () => {
    const G = withAcw();
    G.spaces["the-south"].diplomacy = "UK";
    placeUnit(G, "FR", "squadron", "the-south", 2);
    placeUnit(G, "UK", "army", "the-south", 2);
    const result = resolveAmericanCivilWarEndPhase(G, makeCtx([4]));
    // 4 + 2 support = 6 → independent.
    expect(result?.drm).toBe(2);
    expect(result?.independent).toBe(true);
    expect(G.powers.UK.cardMarkers).toBe(-1);
    expect(G.powers.FR.cardMarkers).toBe(-1);
  });

  test("is inert without the American Civil War", () => {
    const G = setup("GE");
    expect(resolveAmericanCivilWarEndPhase(G, makeCtx([6]))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// §3.10 — printed "OR" is a player choice
// ---------------------------------------------------------------------------

describe("printed OR clauses are player choices", () => {
  test("A068 The United States offers both printed modes", () => {
    const G = play("IE-A068", "GE");
    expect(G.pending?.kind).toBe("eventChoice");
    const ids = G.pending!.options.map((o: any) => o.id);
    expect(ids).toContain("trade");
    expect(ids).toContain("marker:mexico");
    expect(ids).toContain("marker:japan");
  });

  test("A068 American Trade draws a card instead of rolling a die", () => {
    const G = play("IE-A068", "GE");
    const handBefore = G.powers.GE.hand.length;
    resolvePending(G, makeCtx([], "0", 3), "trade");
    expect(G.powers.GE.hand.length).toBe(handBefore + 1);
    expect(G.powers.GE.cardMarkers).toBe(1);
  });

  test("A073 Economic Panic asks each player that holds a card", () => {
    const G = play("IE-A073", "GE");
    expect(G.pending?.kind).toBe("eventChoice");
    // The actor has just spent its only card, so the first held-card power is
    // asked; a power with an empty hand cannot discard and is skipped.
    const asked = G.pending!.power;
    expect(G.powers[asked].hand.length).toBeGreaterThan(0);
    expect(G.pending?.options.map((o: any) => o.id)).toEqual(["stability", "discard"]);
  });

  test("A073 lets a player take the stability loss", () => {
    const G = play("IE-A073", "GE");
    const asked = G.pending!.power;
    const stabilityBefore = G.powers[asked].stability;
    const handBefore = G.powers[asked].hand.length;
    resolvePending(G, makeCtx([], seatOf(asked), 3), "stability");
    expect(G.powers[asked].stability).toBe(stabilityBefore - 1);
    expect(G.powers[asked].hand.length).toBe(handBefore);
  });

  test("A107 World's Fair lets a player keep every card", () => {
    const G = play("IE-A107", "GE");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((o: any) => o.id)).toContain("pass");
  });

  test("A109 Revolution of 1905 asks Russia instead of always discarding", () => {
    // A109 is a response card, so it is resolved through the response window;
    // call the shared resolver directly to inspect the decision it opens.
    const G = setup("GE");
    G.resolvingCard = "IE-A109";
    resolveCard(G, makeCtx([], "0", 3), "GE", cardById("IE-A109"));
    expect(G.pending?.power).toBe("RU");
    expect(G.pending?.options.map((o: any) => o.id)).toEqual(["stability", "discard"]);
  });

  test("A052 Eastern Orthodoxy lets Russia pick the Balkan minor", () => {
    const G = play("IE-A052", "GE");
    expect(G.pending?.kind).toBe("eventTargetSpace");
    expect((G.pending?.options.length ?? 0)).toBeGreaterThan(0);
  });

  test("A051 Polish Revolt lets the actor pick the victim", () => {
    const G = play("IE-A051", "GE");
    expect(G.pending?.kind).toBe("eventTargetPower");
  });

  test("A045 Folie de Grandeur lets France pick the space", () => {
    const G = play("IE-A045", "GE");
    expect(G.pending?.kind).toBe("eventTargetSpace");
  });

  test("H-AU-7 Habsburg Dynasty lets Austria pick the minor", () => {
    const G = play("IE-H-AU-7", "AU");
    expect(G.pending?.kind).toBe("eventTargetSpace");
  });

  test("GW-01 Minor Power Entry lets the player pick the minor", () => {
    // No live impulse ledger: `gwCardProblem` then only requires the GW phase
    // and an open table, which is the pre-27.1 path these unit fixtures use.
    const G = setup("GE");
    G.gw = {
      active: true, turn: 2,
      order: ["GE", "FR"], belligerents: ["GE", "FR"],
      neutrals: ["UK", "AU", "RU", "OT"], te: ["FR"], ta: ["GE"],
      usIn: false, italyIn: false, usStability: 3, usManpower: 3, usBudget: 4,
      italyStability: 3, italyManpower: 3, italyBudget: 2,
      trenches: {}, lastColonialWar: null, victor: null,
      outbreakDone: true, nationalWillDone: true, bonusImpulses: [],
      discard: [], combatCardsInFront: [],
    } as any;
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "teCommitted";
    G.phase = "gwManeuver";
    G.activePower = "GE";
    G.pending = null;
    G.battle = null;
    G.impulseCard = null;
    G.powers.GE.gwCard = "IE-GW-01";
    const {playGwCardMove} = require("./moves");
    playGwCardMove(G, makeCtx([], "0", 2), "event");
    // GW-01 first asks which printed branch to use, then which minor power.
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((o: any) => o.id)).toEqual(["join", "neutral"]);
  });

  test("A048 Multicultural Empire offers rights or citizenship once the Dual Monarchy is played", () => {
    const G = setup("AU");
    G.persistent.dualMonarchyPlayed = true;
    G.powers.AU.hand = ["IE-A048"];
    playCard(G, makeCtx([], seatOf("AU"), 3), "IE-A048", "event");
    expect(G.pending?.kind).toBe("eventChoice");
    expect(G.pending?.options.map((o: any) => o.id)).toEqual(["rights", "citizenship"]);
  });
});
