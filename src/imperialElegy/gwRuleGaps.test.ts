/**
 * Regression coverage for the remaining 27.5.2 / 28.2 / 22.1 / 22.3.1 rules.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleState, GreatWarState, ImperialElegyState, Power} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {MINOR_POWER_HOMES} from "./constant/setup";
import {italianUnificationSpaces} from "./engine/rules";
import {placeUnit, removeUnit} from "./engine/effects";
import {finishBattle} from "./engine/combat";
import {gwDraft, placeItalyMpit, resolvePending} from "./moves";
import {
  ITALIAN_INTERNAL_WAR_POWERS,
  ITALY_TABLE_CARD,
  italianPetitionChoices,
  italianUnificationRoll,
  italyTable,
  unifyItaly,
} from "./engine/greatWar";

const makeCtx = (dice: number | number[] = 3, playerID = "0"): Ctx => {
  const values = Array.isArray(dice) ? dice : [dice];
  let index = 0;
  return {
    playerID,
    random: {
      Die: () => values[Math.min(index++, values.length - 1)] ?? 3,
      Number: () => 1,
      Shuffle: (items: unknown[]) => items,
    },
    events: {
      setActivePlayers: () => undefined,
      setPhase: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  } as unknown as Ctx;
};

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const seat = (power: Power): string => String(POWERS.indexOf(power));

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
} as GreatWarState);

const clearSpace = (G: ImperialElegyState, space: string): void => {
  for (const id of [...(G.spaces[space]?.units ?? [])]) removeUnit(G, id);
};

const landBattle = (
  G: ImperialElegyState,
  winner: "attacker" | "defender",
): {battle: BattleState; attackerId: string; defenderId: string} => {
  G.phase = "wartime";
  clearSpace(G, "berlin");
  clearSpace(G, "saxony");
  const attacker = placeUnit(G, "GE", "army", "berlin", 2);
  const defender = placeUnit(G, "FR", "army", "saxony", 2);
  G.battle = {
    kind: "land",
    attacker: "GE",
    defender: "FR",
    from: "berlin",
    to: "saxony",
    mainAttack: [attacker.id],
    mainDefense: [defender.id],
    supportAttack: [],
    supportDefense: [],
    stage: "lossesDefense",
    supportSide: "attacker",
    attackerDrm: 0,
    defenderDrm: 0,
    attackerLosses: 0,
    defenderLosses: 0,
    decisive: false,
    winner,
    notes: [],
  };
  return {battle: G.battle, attackerId: attacker.id, defenderId: defender.id};
};

// ---------------------------------------------------------------------------
// 28.2 forts
// ---------------------------------------------------------------------------

describe("28.2 Great War forts", () => {
  test("a defending fort that survives a battle drops one level", () => {
    const G = fresh();
    G.gw = gwState(1);
    const {battle} = landBattle(G, "defender");
    G.spaces.saxony.fort = {power: "FR", level: 3};
    finishBattle(G, makeCtx(3));
    expect(G.battle).toBeNull();
    expect(G.spaces.saxony.fort?.level).toBe(2);
    expect(G.log.some((entry) => entry.key === "gwFortDegraded" && entry.args?.space === "saxony")).toBe(true);
  });

  test("a level-one fort is removed when it degrades", () => {
    const G = fresh();
    G.gw = gwState(1);
    landBattle(G, "defender");
    G.spaces.saxony.fort = {power: "FR", level: 1};
    finishBattle(G, makeCtx(3));
    expect(G.spaces.saxony.fort).toBeNull();
  });

  test("prior to GW turn 1 a friendly fort cancels a forced retreat", () => {
    const G = fresh();
    G.gw = gwState(0);
    const {defenderId} = landBattle(G, "attacker");
    G.spaces.saxony.fort = {power: "FR", level: 2};
    finishBattle(G, makeCtx(3));
    expect(G.pending?.kind).toBe("combatRetreat");
    expect(G.pending?.options.map((entry) => entry.id)).toContain("cancelRetreatFort");

    const ctx = makeCtx(3, seat("FR"));
    expect(resolvePending(G, ctx, "cancelRetreatFort")).toBeUndefined();
    expect(G.battle).toBeNull();
    expect(G.spaces.saxony.fort).toBeNull();
    expect(G.spaces.saxony.units).toContain(defenderId);
    expect(G.spaces.saxony.units.some((id) => G.units[id]?.owner === "GE")).toBe(false);
  });

  test("the fort option is not offered after GW turn 1", () => {
    const G = fresh();
    G.gw = gwState(1);
    landBattle(G, "attacker");
    G.spaces.saxony.fort = {power: "FR", level: 2};
    finishBattle(G, makeCtx(3));
    expect(G.pending?.options.map((entry) => entry.id) ?? []).not.toContain("cancelRetreatFort");
    // The garrison was eliminated, so 18.7 leaves the fort; 28.2 then degrades it.
    expect(G.spaces.saxony.fort?.level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 27.5.2 allied minor draft
// ---------------------------------------------------------------------------

const draftResolverCtx = (): Ctx => makeCtx([3], "0");

const baseGwDraft = (): ImperialElegyState => {
  const G = fresh();
  G.gw = gwState(1);
  G.phase = "gwManeuver";
  G.activePower = "GE";
  G.turnIndex = 0;
  G.pending = null;
  G.battle = null;
  G.war = null;
  G.powers.GE.gwBudget = 3;
  G.powers.GE.manpower = 3;
  G.spaces.berlin.control = "GE";
  return G;
};

describe("27.5.2 allied minor power draft substitution", () => {
  test("an allied minor army can replace the second drafted army in its home space", () => {
    const G = baseGwDraft();
    const minor = ITALIAN_INTERNAL_WAR_POWERS[0];
    const home = MINOR_POWER_HOMES[minor];
    G.spaces[home].ally = "GE";
    const before = Object.values(G.units).filter((unit) => unit.owner === minor && unit.kind === "minorArmy").length;

    expect(gwDraft(G, draftResolverCtx(), "berlin")).toBeUndefined();
    const option = G.pending?.options.find((entry) => entry.id.startsWith(`minor:${minor}:`));
    expect(option).toBeTruthy();

    expect(resolvePending(G, draftResolverCtx(), option!.id)).toBeUndefined();
    expect(G.pending).toBeNull();
    const after = Object.values(G.units).filter(
      (unit) => unit.owner === minor && unit.kind === "minorArmy" && unit.space === home && unit.steps === 1,
    );
    expect(after.length).toBeGreaterThan(0);
    expect(Object.values(G.units).filter((unit) => unit.owner === minor && unit.kind === "minorArmy")).toHaveLength(before + 1);
    // The first army is still GE's own drafted reduced army.
    expect(Object.values(G.units).filter(
      (unit) => unit.owner === "GE" && unit.kind === "army" && unit.space === "berlin" && unit.steps === 1,
    )).toHaveLength(1);
  });

  test("a minor army cannot be placed when the minor is not allied to the drafting player", () => {
    const G = baseGwDraft();
    const minor = ITALIAN_INTERNAL_WAR_POWERS[0];
    G.spaces[MINOR_POWER_HOMES[minor]].ally = null;
    expect(gwDraft(G, draftResolverCtx(), "berlin")).toBeUndefined();
    expect(G.pending?.options.some((entry) => entry.id.startsWith(`minor:${minor}:`))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 22.1 Italian table
// ---------------------------------------------------------------------------

describe("22.1 Italian Minor Power Table", () => {
  test("Petition for Aid only removes an allied minor whose player controls an Italian space", () => {
    const G = fresh();
    const minor = ITALIAN_INTERNAL_WAR_POWERS[0];
    G.spaces[MINOR_POWER_HOMES[minor]].ally = "GE";
    expect(italianPetitionChoices(G)).toHaveLength(0);

    G.spaces.rome.control = "GE";
    expect(italianPetitionChoices(G)).toMatchObject([{minor, player: "GE"}]);
    expect(italyTable(G, makeCtx(3), "GE")).toBe(true);
    expect(G.spaces[MINOR_POWER_HOMES[minor]].ally).toBeNull();
    expect(G.flags.italyPetition).toBe(true);
  });

  test("both eligible allied minors open a live Petition choice", () => {
    const G = fresh();
    const [first, second] = ITALIAN_INTERNAL_WAR_POWERS;
    G.spaces[MINOR_POWER_HOMES[first]].ally = "GE";
    G.spaces[MINOR_POWER_HOMES[second]].ally = "FR";
    G.spaces.rome.control = "GE";
    G.spaces.tuscany.control = "FR";

    expect(italyTable(G, makeCtx(3), "GE", {interactive: true})).toBe(false);
    expect(G.pending?.kind).toBe("italianPetition");
    expect(G.pending?.options.map((entry) => entry.id).sort()).toEqual([first, second].sort());
    expect(resolvePending(G, makeCtx(3, seat("GE")), second)).toBeUndefined();
    expect(G.spaces[MINOR_POWER_HOMES[second]].ally).toBeNull();
    expect(G.spaces[MINOR_POWER_HOMES[first]].ally).toBe("GE");
    expect(G.flags.italyPetition).toBe(true);
  });

  test("the +1 unification-box marker is read by the unification roll", () => {
    const G = fresh();
    for (const space of italianUnificationSpaces()) G.spaces[space].control = "GE";
    const ctx = makeCtx(6);
    expect(italianUnificationRoll(G, ctx, "GE")).toBe(false);
    G.flags.italyPetition = true;
    expect(italianUnificationRoll(G, makeCtx(6), "GE")).toBe(true);
  });

  test("A Lost Dream removes the Italy card from the game", () => {
    const G = fresh();
    G.deck.push(ITALY_TABLE_CARD);
    G.flags.italyFlashpointDominator = "GE";
    expect(italyTable(G, makeCtx(1), "GE")).toBe(true);
    expect(G.removed).toContain(ITALY_TABLE_CARD);
    expect(G.deck).not.toContain(ITALY_TABLE_CARD);
  });

  test("Uprising unifies immediately when no Italian space is player-controlled", () => {
    const G = fresh();
    for (const space of italianUnificationSpaces()) G.spaces[space].control = null;
    expect(italyTable(G, makeCtx(1), "GE")).toBe(true);
    expect(G.persistent.italyUnified).toBe(true);
  });

  test("Nationalist Wave lets the active player choose the minor and both keys", () => {
    const G = fresh();
    for (const space of italianUnificationSpaces()) G.spaces[space].control = null;
    expect(italyTable(G, makeCtx(6), "GE", {interactive: true})).toBe(false);
    expect(G.pending?.kind).toBe("italianNationalistWave");
    expect(G.pending?.context?.stage).toBe("minor");

    expect(resolvePending(G, makeCtx(1, seat("GE")), ITALIAN_INTERNAL_WAR_POWERS[1])).toBeUndefined();
    expect(G.pending?.kind).toBe("italianNationalistWave");
    expect(G.pending?.context?.stage).toBe("keys");
    const pair = G.pending?.options.find((entry) => entry.id === "rome|naples");
    expect(pair).toBeTruthy();
    expect(resolvePending(G, makeCtx(1, seat("GE")), pair!.id)).toBeUndefined();
    expect(G.spaces.rome.control).toBe(ITALIAN_INTERNAL_WAR_POWERS[1]);
    expect(G.spaces.naples.control).toBe(ITALIAN_INTERNAL_WAR_POWERS[1]);
    expect(G.persistent.italyUnified).not.toBe(true);
  });

  test("an illegal Nationalist key pair is rejected and the decision stays open", () => {
    const G = fresh();
    for (const space of italianUnificationSpaces()) G.spaces[space].control = null;
    italyTable(G, makeCtx(1), "GE", {interactive: true});
    resolvePending(G, makeCtx(1, seat("GE")), ITALIAN_INTERNAL_WAR_POWERS[0]);
    const pending = G.pending;
    expect(resolvePending(G, makeCtx(1, seat("GE")), "rome|rome")).toBe(INVALID_MOVE);
    expect(G.pending).toBe(pending);
  });
});

// ---------------------------------------------------------------------------
// 22.3.1 Kingdom of Italy table
// ---------------------------------------------------------------------------

describe("22.3.1 Kingdom of Italy table", () => {
  test("3–4 lets the active player choose an uncontrolled naval base", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(3), "GE");
    G.turn = 1;
    G.spaces.malta.control = null;
    expect(italyTable(G, makeCtx(3), "GE", {interactive: true})).toBe(false);
    expect(G.pending?.kind).toBe("italyNavalBase");
    const base = G.pending!.options[0].id;
    expect(resolvePending(G, makeCtx(3, seat("GE")), base)).toBeUndefined();
    expect(G.spaces[base].control).toBe("IT");
  });

  test("7+ resolves the Ottoman war and takes the base plus the chosen territory", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(3), "GE");
    G.turn = 5; // unified table roll 6 + 1 = 7
    expect(italyTable(G, makeCtx(6), "GE", {interactive: true})).toBe(false);
    expect(G.pending?.kind).toBe("italyOttomanWar");
    expect(G.pending?.context?.stage).toBe("territory");
    const base = G.pending?.context?.base as string;
    expect(base).toBe("rhodes");

    expect(resolvePending(G, makeCtx(6, seat("GE")), "libya")).toBeUndefined();
    expect(G.spaces.rhodes.control).toBe("IT");
    expect(G.spaces.tripoli.control).toBe("IT");
    expect(G.spaces.benghazi.control).toBe("IT");
    expect(G.spaces.tunisia.control).toBe("OT");
    expect(G.log.some((entry) => entry.key === "italyOttomanWar" && entry.args?.result === "won")).toBe(true);
  });

  test("7+ with no Ottoman Eastern Mediterranean base is treated as a 5", () => {
    const G = fresh();
    unifyItaly(G, makeCtx(3), "GE");
    G.turn = 5;
    G.spaces.rhodes.control = "UK";
    expect(italyTable(G, makeCtx(6), "GE")).toBe(true);
    expect(G.italyReinforcements?.armies).toBe(1);
    expect(G.log.some((entry) => entry.key === "italyOttomanWar" && entry.args?.result === "treatedAs5")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 22.2 Italian unification war winner's free MPIT CP
// ---------------------------------------------------------------------------

describe("22.2 free CP for Italy's MPIT", () => {
  test("spends the same-turn grant without touching the ordinary CP budget", () => {
    const G = fresh();
    G.turn = 4;
    G.activePower = "GE";
    G.cpRemaining = 3;
    G.italyMpit = {te: 0, ta: 0, neutral: 0};
    G.flags.italyUnificationMpitCp = 2;
    G.flags.italyUnificationMpitCpTurn = 4;
    G.flags.italyUnificationMpitCpPower = "GE";
    const ctx = makeCtx(3, seat("GE"));

    expect(placeItalyMpit(G, ctx, "neutral")).toBeUndefined();
    expect(placeItalyMpit(G, ctx, "te")).toBeUndefined();
    expect(placeItalyMpit(G, ctx, "ta")).toBe(INVALID_MOVE);
    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 1});
    expect(G.cpRemaining).toBe(3);
  });
});
