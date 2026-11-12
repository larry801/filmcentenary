/**
 * Rules 15.4.2 / 13.4.2 / 16.1.1 — a non-player power defending alone (lone
 * non-player wars).
 *
 * "Minor powers defending alone without the aid of a player will remain in
 * their space and defend themselves, however they will never move or attack.
 * They may retreat following the normal retreat rules."  The attacked
 * non-player that finds no player ally during 13.4.2 Seeking Aid now gets a
 * real `WarState` (`minorTarget.ally === null`): the attacker manoeuvres with
 * its war budget against the minor's defending units, and the war settles
 * through the normal 16.0/16.1 classification, except that 16.1.1 "Major
 * victories cannot be achieved against non-player powers" and a non-player
 * never imposes a treaty option.
 */
import type {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import type {BattleState, ImperialElegyState, Power, WarState} from "./types";
import {POWERS} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {placeUnit} from "./engine/effects";
import {unitsIn} from "./engine/rules";
import {
  belligerentsOf,
  canApplyTreaty,
  classifyVictory,
  createWarState,
  isLoneMinorWar,
  loneMinorDefender,
  sidePowers,
  truceRivals,
  validateWarAim,
} from "./engine/limitedWar";
import {
  callWarAlly,
  chooseWarAim,
  declareWar,
  landBattle,
  passWar,
  resolvePending,
  startWarManeuver,
  surrender,
} from "./moves";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const seat = (power: Power): string => String(POWERS.indexOf(power));

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

const lastLog = (G: ImperialElegyState, key: string) =>
  [...G.log].reverse().find((entry) => entry.key === key);

/**
 * No player can aid Denmark: every other power shares the attacker's alliance
 * (13.4.2 filters them out), so the declaration becomes a lone war straight
 * away.  Denmark controls denmark (squadron) and schleswig-holstein (army).
 */
const declareLoneWarOnDenmark = (G: ImperialElegyState, cp = 3): string | void => {
  // 8.1.2: a player inside the attacker's alliance cannot answer 13.4.2's aid
  // search, so every table candidate is filtered out of the printed order.
  for (const power of POWERS) G.powers[power].alliance = "taAligned";
  beginAction(G, "GE", cp);
  return declareWar(G, makeCtx([], seat("GE")), {minor: "Denmark"}, "conquest", ["schleswig-holstein"], cp);
};

const clearHands = (G: ImperialElegyState): void => {
  for (const power of POWERS) G.powers[power].hand = [];
};

/** A live war object with a non-player lone defender. */
const loneWar = (attacker: Power, minor: string, objectives: string[]): WarState =>
  createWarState(fresh(), attacker, minor, "conquest", objectives, 2, {minor: {minor, ally: null}});

// ---------------------------------------------------------------------------
// Typed state
// ---------------------------------------------------------------------------

describe("15.4.2 lone-defender WarState", () => {
  test("createWarState records the non-player defender and gives it no budget", () => {
    const G = fresh();
    const war = createWarState(G, "GE", "Denmark", "conquest", ["schleswig-holstein"], 2, {
      minor: {minor: "Denmark", ally: null},
    });
    expect(isLoneMinorWar(war)).toBe(true);
    expect(loneMinorDefender(war)).toBe("Denmark");
    expect(war.defender).toBe("Denmark");
    expect(war.minorTarget).toEqual({minor: "Denmark", ally: null});
    expect(war.defenderMinors).toEqual(["Denmark"]);
    // Rule 13.7: "Minor powers defending alone ... receive no war budget."
    expect(war.budgets.GE).toBe(2 + G.powers.GE.industry);
    expect(war.budgets.Denmark).toBeUndefined();
    // 15.4.2: only the player is a belligerent / takes impulses.
    expect(belligerentsOf(war)).toEqual(["GE"]);
    expect(sidePowers(war, "defender")).toEqual([]);
  });

  test("a player-defended war and an aided minor war are not lone wars", () => {
    const G = fresh();
    expect(isLoneMinorWar(null)).toBe(false);
    expect(isLoneMinorWar(createWarState(G, "GE", "FR", "conquest", ["picardy"], 2))).toBe(false);
    const aided = createWarState(G, "GE", "FR", "conquest", ["belgium"], 2, {
      minor: {minor: "Belgium", ally: "FR"},
    });
    expect(isLoneMinorWar(aided)).toBe(false);
    expect(loneMinorDefender(aided)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Live declaration: 13.4.2 unaided → lone war
// ---------------------------------------------------------------------------

describe("13.4.2 unaided declaration opens a lone war", () => {
  test("the war is live with the non-player as defender, no defender budget and a CP budget for the attacker", () => {
    const G = fresh();
    const cp = 3;
    expect(declareLoneWarOnDenmark(G, cp)).toBeUndefined();

    const war = G.war;
    expect(war).not.toBeNull();
    expect(war!.attacker).toBe("GE");
    expect(war!.defender).toBe("Denmark");
    expect(war!.minorTarget).toEqual({minor: "Denmark", ally: null});
    expect(war!.defenderMinors).toEqual(["Denmark"]);
    expect(war!.warAim).toBe("conquest");
    expect(war!.objectives).toEqual(["schleswig-holstein"]);
    expect(war!.status).toBe("warAim");
    // 14.3: the attacker's wartime budget is the declaration card + industry.
    expect(war!.budgets.GE).toBe(cp + G.powers.GE.industry);
    expect(war!.budgets.Denmark).toBeUndefined();
    // The live wartime phase opened for the attacker.
    expect(G.phase).toBe("wartime");
    expect(G.activePower).toBe("GE");
    expect(G.pending).toBeNull();
    // 13.4.2's declaration ledger still records the printed 8.2 data.
    expect(G.minorDeclarations).toHaveLength(1);
    expect(G.minorDeclarations?.[0]).toMatchObject({attacker: "GE", minor: "Denmark", aim: "conquest"});
    expect(lastLog(G, "warDeclared")?.args).toMatchObject({target: "Denmark", aim: "conquest"});
    expect(lastLog(G, "minorUnopposed")?.args).toMatchObject({target: "Denmark", war: true});
  });

  test("war aims validate against the non-player's spaces", () => {
    const G = fresh();
    declareLoneWarOnDenmark(G);
    expect(G.war!.objectives).toEqual(["schleswig-holstein"]);
    // A space the minor does not control is rejected before the CP is spent.
    const other = fresh();
    for (const power of POWERS) other.powers[power].alliance = "taAligned";
    beginAction(other, "GE", 4);
    expect(
      declareWar(other, makeCtx([], seat("GE")), {minor: "Denmark"}, "conquest", ["berlin"], 2),
    ).toBe(INVALID_MOVE);
    expect(other.war).toBeNull();
    expect(other.cpRemaining).toBe(4);
  });

  test("the live war aim is re-validated against the non-player's spaces", () => {
    const G = fresh();
    declareLoneWarOnDenmark(G);
    // Schleswig-Holstein is not a GE home space and is not in rebellion, so a
    // 13.1 liberation aim cannot target it.
    expect(chooseWarAim(G, makeCtx([], seat("GE")), "liberation")).toBe(INVALID_MOVE);
    expect(G.war!.warAim).toBe("conquest");
    expect(G.war!.status).toBe("warAim");
    // The declared conquest aim is legal and advances the war.
    expect(chooseWarAim(G, makeCtx([], seat("GE")), "conquest")).toBeUndefined();
    expect(G.war!.status).toBe("alliance");
  });

  test("unification objectives validate against the non-player's nationality spaces", () => {
    const G = fresh();
    // Bavaria is a German-nationality key controlled by the Bavarian minor.
    expect(validateWarAim(G, "GE", "Bavaria", "unification", ["bavaria"]).ok).toBe(true);
    // Denmark's key has no German nationality, so the aim is rejected even
    // though the minor controls it.
    const wrong = validateWarAim(G, "GE", "Bavaria", "unification", ["denmark"]);
    expect(wrong.ok).toBe(false);
    expect(wrong.issues.map((issue) => issue.code)).toContain("unification-not-german");
  });

  test("the live 13.4 prohibitions still reject the declaration", () => {
    const G = fresh();
    // Denmark allied to the attacker (13.4 prohibition 1).
    G.spaces.denmark.ally = "GE";
    beginAction(G);
    expect(declareWar(G, makeCtx([], seat("GE")), {minor: "Denmark"}, "conquest", ["schleswig-holstein"], 2)).toBe(
      INVALID_MOVE,
    );
    expect(G.war).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Maneuver and battle against the lone minor
// ---------------------------------------------------------------------------

describe("15.4.2 maneuver and combat", () => {
  test("only the attacker takes impulses; the minor never moves or attacks", () => {
    const G = fresh();
    declareLoneWarOnDenmark(G);
    expect(startWarManeuver(G, makeCtx([], seat("GE")))).toBeUndefined();

    const war = G.war!;
    expect(war.status).toBe("maneuver");
    // 15.4.2: the minor is not a belligerent, so it never holds an impulse.
    expect(war.initiative).toEqual(["GE"]);
    expect(belligerentsOf(war)).toEqual(["GE"]);
    expect(war.initiative).not.toContain("Denmark");
    expect(G.activePower).toBe("GE");

    // A non-belligerent pass is rejected; the attacker's pass settles the war.
    expect(passWar(G, makeCtx([], seat("FR")))).toBe(INVALID_MOVE);
    expect(passWar(G, makeCtx([], seat("GE")))).toBeUndefined();
    // No objectives are held, so the war settles as a white peace.
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0].victor).toBeNull();
    // 17.0: the attacker's free demobilization actions follow the settlement;
    // the non-player has no free actions (it is not a player).
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    let guard = 0;
    while (G.pending !== null && guard++ < 6) {
      expect(G.pending.power).toBe("GE");
      expect(resolvePending(G, makeCtx([], seat("GE")), "done")).toBeUndefined();
    }
    expect(G.phase).toBe("action");
  });

  test("a player ally may join the attacker's side; the lone defender still never acts", () => {
    const G = fresh();
    declareLoneWarOnDenmark(G);
    // 14.0: the attacker may call a player ally; the non-player has no seat to
    // call anyone (13.4.2's aid search is the only way onto its side).
    expect(callWarAlly(G, makeCtx([], seat("GE")), "UK")).toBeUndefined();
    expect(G.pending?.kind).toBe("warAllyConsent");
    expect(G.pending?.power).toBe("UK");
    expect(resolvePending(G, makeCtx([], seat("UK")), "accept")).toBeUndefined();

    expect(G.war!.attackerAllies).toEqual(["UK"]);
    expect(G.war!.defenderAllies).toEqual([]);
    expect(G.war!.budgets.UK).toBeGreaterThan(0);
    expect(G.war!.budgets.Denmark).toBeUndefined();
    expect(belligerentsOf(G.war!)).toEqual(["GE", "UK"]);

    expect(startWarManeuver(G, makeCtx([], seat("GE")))).toBeUndefined();
    expect(G.war!.initiative).not.toContain("Denmark");
    expect([...G.war!.initiative].sort()).toEqual(["GE", "UK"]);
  });

  test("the attacker's land battle against the minor's units is a normal defensive battle", () => {
    const G = fresh();
    clearHands(G);
    declareLoneWarOnDenmark(G);
    expect(startWarManeuver(G, makeCtx([], seat("GE")))).toBeUndefined();

    // A German army in Hanover attacks Denmark's army in Schleswig-Holstein.
    placeUnit(G, "GE", "army", "hanover", 2);
    const ctx = makeCtx([6, 1]);
    expect(landBattle(G, ctx, "hanover", "schleswig-holstein")).toBeUndefined();

    const battle = G.battle as BattleState | null;
    expect(battle).not.toBeNull();
    expect(battle!.attacker).toBe("GE");
    // No player owns the defence: the engine's lone-minor fallback is used and
    // the defender support window is never opened to the attacker.
    expect(battle!.notes).toContain("minorDefender");
    expect(battle!.defender).toBe("GE");
    // Every window the battle opens belongs to the attacker: a lone non-player
    // defender has no seat to answer a support/card/retreat decision.
    expect(G.pending?.kind).toBe("combatSupport");
    expect(G.pending?.power).toBe("GE");
    let guard = 0;
    while (G.pending !== null && guard++ < 8) {
      expect(G.pending.power).toBe("GE");
      const ids = G.pending.options.map((entry) => entry.id);
      const choice = ids.includes("done") ? "done" : ids[0];
      expect(resolvePending(G, ctx, choice)).toBeUndefined();
    }
    expect(guard).toBeLessThan(8);
    // The victorious attacker advances into the space; the minor's unit either
    // retreated (15.4.2 allows the normal retreat) or was eliminated.
    expect(G.spaces["schleswig-holstein"].occupiedBy).toBe("GE");
    expect(unitsIn(G, "schleswig-holstein").every((unit) => unit.owner === "GE")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Victory and settlement
// ---------------------------------------------------------------------------

describe("15.4.2 / 16.0 victory and settlement", () => {
  test("classifyVictory: normal victory when the attacker holds every objective", () => {
    const G = fresh();
    const war = loneWar("GE", "Denmark", ["schleswig-holstein"]);
    G.spaces["schleswig-holstein"].occupiedBy = "GE";

    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("normal");
    expect(victory.victor).toBe("attacker");
    expect(victory.winner).toBe("GE");
    expect(victory.treatyOptions).toBe(1);
  });

  test("classifyVictory never awards a major victory against a non-player power (16.1.1)", () => {
    const G = fresh();
    // Unified Italy: Rome is a capital, so the ordinary capital check would
    // fire; 16.1.1 forbids it against a non-player power.
    G.persistent.italyUnified = true;
    G.flags.italyUnified = true;
    G.spaces.rome.control = "IT";
    G.spaces.naples.control = "IT";
    const war = createWarState(G, "GE", "IT", "conquest", ["naples"], 2, {minor: {minor: "Italy", ally: null}});
    G.spaces.rome.occupiedBy = "GE";
    G.spaces.naples.occupiedBy = "GE";

    const victory = classifyVictory(G, war);
    expect(victory.kind).toBe("normal");
    expect(victory.primary).not.toBe("major");
    expect(victory.treatyOptions).toBe(1);
  });

  test("an attacker's surrender is a defensive result with no treaty for the non-player", () => {
    const G = fresh();
    declareLoneWarOnDenmark(G);
    const stability = G.powers.GE.stability;
    expect(surrender(G, makeCtx([], seat("GE")))).toBeUndefined();
    expect(G.war!.victor).toBe("defender");
    expect(passWar(G, makeCtx([], seat("GE")))).toBeUndefined();

    const archived = G.wars[0];
    expect(archived.victor).toBe("defender");
    // 16.1.1 / 16.1: a non-player cannot collect a major victory or a treaty.
    expect(archived.treaties).toEqual([]);
    expect(G.powers.GE.stability).toBe(stability);
    expect(G.war).toBeNull();
  });

  test("territorial cession is the only legal treaty against a lone non-player", () => {
    const G = fresh();
    const war = loneWar("GE", "Denmark", ["schleswig-holstein"]);
    G.spaces["schleswig-holstein"].occupiedBy = "GE";
    const victory = classifyVictory(G, war);

    expect(canApplyTreaty(G, war, victory, {option: "territorialCession"}).ok).toBe(true);
    const reparations = canApplyTreaty(G, war, victory, {option: "warReparations"});
    expect(reparations.ok).toBe(false);
    expect(reparations.issues.map((issue) => issue.code)).toContain("not-a-player");
    expect(canApplyTreaty(G, war, victory, {option: "realignment"}).ok).toBe(false);
    const righteous = canApplyTreaty(G, war, victory, {option: "righteousDefense", space: "schleswig-holstein"});
    expect(righteous.ok).toBe(false);
    expect(canApplyTreaty(G, war, victory, {option: "colonialCession", space: "schleswig-holstein"}).ok).toBe(
      false,
    );
  });

  test("the live settlement cedes the objective, archives the war and leaves no player truce", () => {
    const G = fresh();
    clearHands(G);
    declareLoneWarOnDenmark(G);
    expect(startWarManeuver(G, makeCtx([], seat("GE")))).toBeUndefined();
    // The attacker occupies the objective (as a won battle would leave it).
    G.spaces["schleswig-holstein"].occupiedBy = "GE";

    expect(passWar(G, makeCtx([], seat("GE")))).toBeUndefined();
    // 16.2: the winner chooses the treaty option.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((entry) => entry.id)).toContain("territorialCession");

    expect(resolvePending(G, makeCtx([], seat("GE")), "territorialCession")).toBeUndefined();
    // The 17.0 free-action chooser follows the treaty.
    let guard = 0;
    while (G.pending !== null && guard++ < 6) {
      expect(G.pending.power).toBe("GE");
      expect(resolvePending(G, makeCtx([], seat("GE")), "done")).toBeUndefined();
    }

    expect(G.war).toBeNull();
    expect(G.phase).toBe("action");
    expect(G.wars).toHaveLength(1);
    expect(G.spaces["schleswig-holstein"].control).toBe("GE");
    // 13.5: truces are exchanged between players; a lone non-player is not one.
    expect(truceRivals(G, "GE")).toEqual([]);
  });
});
