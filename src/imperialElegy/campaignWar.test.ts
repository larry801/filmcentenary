/**
 * Campaign-level limited-war integration test.
 *
 * `limitedWarIntegration.test.ts` exercises individual move entry points;
 * `game.test.ts` only settles a war with an explicit treaty list.  This file
 * plays a whole campaign sequence through the real moves: declare, manoeuvre,
 * pass through every belligerent, resolve the interactive `treatyOption` /
 * `treatySpace` chooser, choose `done`, and verify the demobilisation handed
 * the action phase back to the winner.  White peace and surrender are covered
 * on the same pipeline, plus the rule that an illegal declaration never spends
 * CP.
 *
 * Only production moves are called below; the test never invokes the pure
 * settlement helpers directly, so a regression in `moves.ts` or `game.ts`
 * breaks it.
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, POWERS, Power, SpaceId} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {
  declareWar,
  declinePending,
  passWarMove,
  resolvePending,
  startWarManeuver,
  surrender,
} from "./moves";
import {ImperialElegyGameDef} from "./game";

const makeCtx = (playerID: string | null = "0", phaseCalls?: string[]): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: (phase: string) => {
        phaseCalls?.push(phase);
      },
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase: "action",
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());

/** Put a power into a clean action impulse with the given CP. */
const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
  G.pending = null;
  G.war = null;
};

type PhaseOnBegin = (G: ImperialElegyState, ctx: Ctx) => void;
const actionBegin = (): PhaseOnBegin =>
  (ImperialElegyGameDef.phases as unknown as Record<string, {onBegin: PhaseOnBegin}>).action.onBegin;

const seat = (power: Power): string => String(POWERS.indexOf(power));

/**
 * Two legal conquest objectives for GE vs FR: Alsace-Lorraine is the single
 * allowed key, Algeria is a plain territory.  Both are French-controlled at
 * setup and neither is a capital/subcapital.
 */
const OBJECTIVES: SpaceId[] = ["alsace-lorraine", "algeria"];

/**
 * Move the power's off-map reserve army onto a friendly space so that the
 * demobilisation step has something real to send back to the reserve box.
 */
const putReserveOnMap = (G: ImperialElegyState, power: Power, space: SpaceId): string => {
  const reserveId = G.powers[power].reserves[0];
  expect(reserveId).toBeDefined();
  G.powers[power].reserves = G.powers[power].reserves.filter((id) => id !== reserveId);
  G.units[reserveId].space = space;
  G.spaces[space].units.push(reserveId);
  return reserveId;
};

const declareCampaignWar = (G: ImperialElegyState, ctx: Ctx): void => {
  expect(declareWar(G, ctx, "FR", "conquest", OBJECTIVES, 2)).toBeUndefined();
};

/** Pass through every belligerent in initiative order. */
const passAllBelligerents = (G: ImperialElegyState): void => {
  const war = G.war;
  expect(war).not.toBeNull();
  const belligerents = [
    ...new Set([war!.attacker, war!.defender, ...war!.attackerAllies, ...war!.defenderAllies]),
  ];
  for (const power of belligerents) {
    expect(passWarMove(G, makeCtx(seat(power)))).toBeUndefined();
  }
};

const optionIds = (G: ImperialElegyState): string[] =>
  (G.pending?.options ?? []).map((option) => option.id);

// ---------------------------------------------------------------------------
// Attacker victory with an interactive cession
// ---------------------------------------------------------------------------

describe("campaign limited war", () => {
  test("declaration spends CP once, manoeuvre uses initiative, and a two-objective victory settles interactively", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    const reserveId = putReserveOnMap(G, "GE", "berlin");

    declareCampaignWar(G, ctx);

    // The 2 CP are charged exactly once and fund the attacker's war budget
    // (card CP + industry); the defender starts with no war budget.
    expect(G.cpRemaining).toBe(2);
    expect(G.phase).toBe("wartime");
    expect(G.war).toMatchObject({
      attacker: "GE",
      defender: "FR",
      warAim: "conquest",
      objectives: OBJECTIVES,
      status: "warAim",
      truceTurns: 2,
      victor: null,
      startedTurn: G.turn,
    });
    expect(G.war!.budgets.GE).toBe(2 + G.powers.GE.industry);
    expect(G.war!.budgets.FR).toBe(0);
    expect(G.war!.initiative).toEqual([]);

    // Rule 16.1.2 snapshot: spaces GE controlled before the war, not the
    // French objectives it is about to attack.
    const snapshot = String(G.flags.limitedWarAttackerStart).split(",").filter(Boolean);
    expect(snapshot).toEqual(expect.arrayContaining(["berlin", "silesia"]));
    expect(snapshot).not.toContain("alsace-lorraine");
    expect(snapshot).not.toContain("algeria");

    // Rule 14.3: the card CP decides initiative (GE 2 vs FR 0).  Starting the
    // maneuver must not charge the declaration CP a second time.
    expect(startWarManeuver(G, ctx)).toBeUndefined();
    expect(G.war!.status).toBe("maneuver");
    expect(G.war!.initiative).toEqual(["GE", "FR"]);
    expect(G.activePower).toBe("GE");
    expect(G.cpRemaining).toBe(2);

    // Both objectives are held by occupation (control stays French so the
    // cession treaty remains legal), and Paris has fallen: a major victory
    // with two treaty picks.
    G.spaces["alsace-lorraine"].occupiedBy = "GE";
    G.spaces.algeria.occupiedBy = "GE";
    G.spaces.paris.occupiedBy = "GE";

    // GE passes, then FR passes; the all-passed check settles the war.
    expect(passWarMove(G, makeCtx(seat("GE")))).toBeUndefined();
    expect(G.war!.passed).toEqual(["GE"]);
    expect(G.activePower).toBe("FR");
    expect(passWarMove(G, makeCtx(seat("FR")))).toBeUndefined();

    // Interactive settlement: the winner is prompted instead of the war
    // disappearing immediately.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.context?.winner).toBe("GE");
    expect(optionIds(G)).toEqual(
      expect.arrayContaining(["territorialCession", "done"]),
    );
    expect(G.war).not.toBeNull();
    expect(G.war!.status).toBe("victory");
    expect(G.war!.victor).toBe("attacker");
    expect(G.war!.truceTurns).toBe(2);

    // Territorial cession with two objectives is ambiguous, so it opens a
    // follow-up `treatySpace` decision.
    expect(resolvePending(G, ctx, "territorialCession")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatySpace");
    expect(optionIds(G)).toEqual(
      expect.arrayContaining(["alsace-lorraine", "algeria"]),
    );

    expect(resolvePending(G, ctx, "alsace-lorraine")).toBeUndefined();
    expect(G.spaces["alsace-lorraine"].control).toBe("GE");
    expect(G.spaces["alsace-lorraine"].occupiedBy).toBeNull();
    expect(G.war!.treaties).toContain("territorialCession");

    // A major victory grants a second treaty pick; this one is declined.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(optionIds(G)).toContain("done");
    expect(G.pendingStack).toEqual([]);
    expect(resolvePending(G, ctx, "done")).toBeUndefined();

    // Demobilisation: the active war is archived, the rule 17.0 free-action
    // prompt is offered, and declining it hands the action phase back.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.pendingStack).toEqual([]);
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0]).toMatchObject({
      attacker: "GE",
      defender: "FR",
      victor: "attacker",
      status: "done",
      truceTurns: 2,
    });
    expect(G.wars[0].treaties).toContain("territorialCession");
    expect(G.wars[0].objectives).toEqual(OBJECTIVES);
    expect(G.phase).toBe("action");
    expect(G.cpRemaining).toBe(0);
    expect(G.activePower).toBe("GE");
    expect(G.flags.postWarWinner).toBe("GE");
    expect(G.flags.limitedWarAttackerStart).toBeUndefined();

    // The reserve army is back in its box and off the map.
    expect(G.units[reserveId].space).toBeNull();
    expect(G.powers.GE.reserves).toContain(reserveId);
    expect(G.spaces.berlin.units).not.toContain(reserveId);

    // boardgame.io runs actionBegin after the move; the winner must survive.
    actionBegin()(G, ctx);
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
    expect(G.flags.postWarWinner).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Normal victory: objectives only
  // -------------------------------------------------------------------------

  test("objectives alone win a normal war, and its single cession pick settles after the space", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");

    declareCampaignWar(G, ctx);
    expect(startWarManeuver(G, ctx)).toBeUndefined();

    // Every objective is held, but the French capital is untouched: rule
    // 16.1.2 gives the attacker a normal victory with one treaty pick.
    G.spaces["alsace-lorraine"].occupiedBy = "GE";
    G.spaces.algeria.occupiedBy = "GE";
    passAllBelligerents(G);

    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.war!.status).toBe("victory");
    expect(G.war!.victor).toBe("attacker");
    expect(G.war!.truceTurns).toBe(2);

    expect(resolvePending(G, ctx, "territorialCession")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatySpace");
    expect(resolvePending(G, ctx, "algeria")).toBeUndefined();

    // With only one pick there is no follow-up chooser; the space decision
    // finishes the settlement directly and the free-action prompt follows.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.pendingStack).toEqual([]);
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0]).toMatchObject({victor: "attacker", status: "done", truceTurns: 2});
    expect(G.wars[0].treaties).toEqual(["territorialCession"]);
    expect(G.spaces.algeria.control).toBe("GE");
    expect(G.spaces.algeria.occupiedBy).toBeNull();
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
    expect(G.flags.postWarWinner).toBe("GE");
  });

  // -------------------------------------------------------------------------
  // White peace
  // -------------------------------------------------------------------------

  test("a white peace settles immediately with no phantom treaty pending and a one-turn truce", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");

    declareCampaignWar(G, ctx);
    expect(startWarManeuver(G, ctx)).toBeUndefined();

    // No objective held, no capital taken and no defender counter-attack on
    // the pre-war snapshot: this is a white peace.
    expect(G.spaces["alsace-lorraine"].occupiedBy ?? null).toBeNull();
    expect(G.spaces.algeria.occupiedBy ?? null).toBeNull();
    passAllBelligerents(G);

    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.pendingStack).toEqual([]);
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0]).toMatchObject({
      attacker: "GE",
      defender: "FR",
      victor: null,
      status: "done",
      truceTurns: 1,
    });
    expect(G.wars[0].treaties).toEqual([]);
    expect(G.phase).toBe("action");
    expect(G.cpRemaining).toBe(0);
    expect(G.activePower).toBe("GE");
    expect(G.flags.postWarWinner).toBe("GE");
    expect(G.flags.limitedWarAttackerStart).toBeUndefined();

    actionBegin()(G, ctx);
    expect(G.activePower).toBe("GE");
    expect(G.flags.postWarWinner).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Surrender
  // -------------------------------------------------------------------------

  test("an attacker surrender gives the defender the war, a two-turn truce and no phantom treaty", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");

    declareCampaignWar(G, ctx);
    expect(startWarManeuver(G, ctx)).toBeUndefined();

    // Rule 16.1.1: the attacker concedes; the defender is the victor.
    expect(surrender(G, ctx)).toBeUndefined();
    expect(G.war!.status).toBe("victory");
    expect(G.war!.victor).toBe("defender");

    // Passing through the belligerents routes the recorded surrender through
    // the shared classification/settlement path.
    passAllBelligerents(G);

    // A defensive major victory has no legal treaty option against GE here,
    // so no chooser is opened; the winner's free-action prompt still runs.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(declinePending(G, makeCtx(seat("FR")))).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.pendingStack).toEqual([]);
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0]).toMatchObject({
      attacker: "GE",
      defender: "FR",
      victor: "defender",
      status: "done",
      truceTurns: 2,
    });
    expect(G.wars[0].treaties).toEqual([]);
    expect(G.phase).toBe("action");
    expect(G.cpRemaining).toBe(0);
    expect(G.activePower).toBe("FR");
    expect(G.flags.postWarWinner).toBe("FR");
    expect(G.flags.limitedWarAttackerStart).toBeUndefined();

    // The defender's action starts immediately: actionBegin must not reset it
    // to the default GE seat.
    actionBegin()(G, ctx);
    expect(G.activePower).toBe("FR");
    expect(G.flags.postWarWinner).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Illegal declarations
  // -------------------------------------------------------------------------

  test("an illegal declaration never spends CP or creates a war", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    const stabilityBefore = G.powers.GE.stability;

    // A capital cannot be a conquest objective.
    expect(declareWar(G, ctx, "FR", "conquest", ["paris"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.war).toBeNull();
    expect(G.phase).toBe("action");
    expect(G.wtt).toBe(0);
    expect(G.flags.limitedWarAttackerStart).toBeUndefined();

    // A conquest may target at most one key; both of these are keys.
    expect(
      declareWar(G, ctx, "FR", "conquest", ["alsace-lorraine", "brittany"], 2),
    ).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.war).toBeNull();
    expect(G.flags.limitedWarAttackerStart).toBeUndefined();
    expect(G.powers.GE.stability).toBe(stabilityBefore);

    // A declaration from a power that is not the active one is also rejected.
    expect(declareWar(G, makeCtx(seat("AU")), "FR", "conquest", OBJECTIVES, 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.war).toBeNull();
  });
});
