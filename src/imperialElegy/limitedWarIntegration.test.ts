/**
 * Limited-war integration tests.
 *
 * These exercise the live `moves.ts` war entry points and the `game.ts` phase
 * hooks.  The pure rules helpers are covered by `limitedWar.test.ts` and
 * `treatyChoice.test.ts`; this file checks that production moves actually use
 * them (declaration validation, initiative, alliance calls, victory
 * classification, treaty decisions, demobilisation and truce bookkeeping).
 */

import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {ImperialElegyState, Power} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {cardById} from "./engine/deck";
import {createWarState, classifyVictory, warBudgetCardId} from "./engine/limitedWar";
import {
  callWarAlly,
  callWarMinor,
  chooseWarAim,
  declareWar,
  declinePending,
  passWarMove,
  resolveEnd,
  resolvePending,
  resolveWar,
  startWarManeuver,
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

const beginAction = (G: ImperialElegyState, active: Power = "GE", cp = 4): void => {
  G.phase = "action";
  G.activePower = active;
  G.cpRemaining = cp;
};

type PhaseOnBegin = (G: ImperialElegyState, ctx: Ctx) => void;
const onBegin = (phase: "action" | "wartime"): PhaseOnBegin =>
  (ImperialElegyGameDef.phases as unknown as Record<string, {onBegin: PhaseOnBegin}>)[phase].onBegin;

const declare = (G: ImperialElegyState, ctx: Ctx, aim: "conquest" | "liberation" | "unification" = "conquest"): void => {
  expect(declareWar(G, ctx, "AU", aim, ["bohemia"], 2)).toBeUndefined();
};

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

describe("declareWar uses the limited-war validation and state builders", () => {
  test("an illegal aim is rejected before CP is spent", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");

    // Vienna is a capital and Bohemia has no German nationality: both are
    // invalid under rule 13.0 and must not spend the 2 CP.
    expect(declareWar(G, ctx, "AU", "conquest", ["vienna"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.war).toBeNull();
    expect(G.wtt).toBe(0);

    expect(declareWar(G, ctx, "AU", "unification", ["bohemia"], 2)).toBe(INVALID_MOVE);
    expect(G.cpRemaining).toBe(4);
    expect(G.war).toBeNull();
  });

  test("a legal declaration creates the war state and snapshots attacker control", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    expect(declareWar(G, ctx, "AU", "conquest", ["bohemia"], 2)).toBeUndefined();

    expect(G.cpRemaining).toBe(2);
    expect(G.phase).toBe("wartime");
    expect(G.war).not.toBeNull();
    expect(G.war!).toMatchObject({
      attacker: "GE",
      defender: "AU",
      warAim: "conquest",
      objectives: ["bohemia"],
      status: "warAim",
      truceTurns: 2,
      victor: null,
      startedTurn: G.turn,
    });
    expect(G.war!.budgets.GE).toBe(2 + G.powers.GE.industry);
    expect(G.war!.budgets.AU).toBe(0);
    expect(G.wtt).toBe(1);

    const snapshot = String(G.flags.limitedWarAttackerStart).split(",").filter(Boolean);
    expect(snapshot).toEqual(expect.arrayContaining(["silesia", "berlin"]));
    expect(snapshot).not.toContain("bohemia");
  });

  test("chooseWarAim revalidates against the live board", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);

    // GE cannot run a war of unification over Czech Bohemia.
    expect(chooseWarAim(G, ctx, "unification")).toBe(INVALID_MOVE);
    expect(G.war!.warAim).toBe("conquest");
    expect(G.war!.status).toBe("warAim");

    expect(chooseWarAim(G, ctx, "conquest")).toBeUndefined();
    expect(G.war!.warAim).toBe("conquest");
    expect(G.war!.status).toBe("alliance");
  });
});

// ---------------------------------------------------------------------------
// Initiative
// ---------------------------------------------------------------------------

describe("startWarManeuver uses initiativeOrder", () => {
  test("GE only breaks a card-CP tie; higher card CP goes first", () => {
    const G = fresh();
    G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    G.phase = "wartime";
    G.activePower = "GE";
    G.powers.GE.industry = 1;
    G.powers.AU.industry = 1;
    const ctx = makeCtx("0");

    G.war.budgets = {GE: 5, AU: 5};
    expect(startWarManeuver(G, ctx)).toBeUndefined();
    expect(G.war.initiative).toEqual(["GE", "AU"]);
    expect(G.activePower).toBe("GE");

    G.war.status = "alliance";
    G.war.initiative = [];
    G.war.passed = [];
    G.war.budgets = {GE: 4, AU: 6};
    expect(startWarManeuver(G, ctx)).toBeUndefined();
    expect(G.war.initiative).toEqual(["AU", "GE"]);
    expect(G.activePower).toBe("AU");
  });
});

// ---------------------------------------------------------------------------
// Alliance calls
// ---------------------------------------------------------------------------

describe("callWarAlly opens the rule 14.0 consent decision", () => {
  test("a same-alliance event card joins after the ally accepts and funds them", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.powers.GE.alliance = "taCommitted";
    G.powers.RU.alliance = "taCommitted";

    const cardId = warBudgetCardId(G, "RU");
    expect(cardId).not.toBeNull();
    const cp = cardById(cardId!).cp;

    expect(callWarAlly(G, ctx, "RU")).toBeUndefined();
    // Rule 14.0: the ally decides; it has not joined yet.
    expect(G.war!.attackerAllies).toEqual([]);
    expect(G.pending?.kind).toBe("warAllyConsent");
    expect(G.pending?.power).toBe("RU");

    expect(resolvePending(G, makeCtx("4"), "accept")).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war!.attackerAllies).toContain("RU");
    expect(G.war!.budgets.RU).toBe(cp + G.powers.RU.industry);
    expect(G.powers.RU.hand).not.toContain(cardId);
    expect(G.discard).toContain(cardId);
  });

  test("mandatory, response and combat cards never fund an ally", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.powers.GE.alliance = "taCommitted";
    G.powers.FR.alliance = "taCommitted";
    // Response, combat and mandatory cards respectively.
    G.powers.FR.hand = ["IE-A023", "IE-A043", "IE-A017"];

    expect(callWarAlly(G, ctx, "FR")).toBe(INVALID_MOVE);
    expect(G.war!.attackerAllies).not.toContain("FR");
    expect(G.powers.FR.hand).toEqual(["IE-A023", "IE-A043", "IE-A017"]);
  });

  test("a minor ally joins for free when the move is used", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.spaces.bavaria.ally = "GE";

    expect(callWarMinor(G, ctx, "Bavaria")).toBeUndefined();
    expect(G.war!.attackerMinors).toContain("Bavaria");
    expect(G.war!.budgets.Bavaria).toBeUndefined();
    expect(callWarMinor(G, ctx, "Bavaria")).toBe(INVALID_MOVE);
  });
});

// ---------------------------------------------------------------------------
// Victory paths
// ---------------------------------------------------------------------------

describe("resolveWar classifies victory and demobilizes", () => {
  test("major victory applies capital fall, stability and a two-turn truce", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.spaces.vienna.occupiedBy = "GE";

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.wars[0]).toMatchObject({victor: "attacker", truceTurns: 2, status: "done"});
    // The conquest declaration cost GE 1 stability; the major victory restores
    // it, while AU still loses the major-victory point.
    expect(G.powers.GE.stability).toBe(3);
    expect(G.powers.AU.stability).toBe(2);
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("GE");
    expect(G.wars[0].treaties).toEqual([]);
  });

  test("normal victory needs every objective but gives no major stability", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.spaces.bohemia.control = "GE";

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.wars[0]).toMatchObject({victor: "attacker", truceTurns: 2});
    // Only the conquest declaration penalty applies; a normal victory has no
    // major-victory stability swing.
    expect(G.powers.GE.stability).toBe(2);
    expect(G.powers.AU.stability).toBe(3);
    expect(G.phase).toBe("action");
  });

  test("defensive victory uses the declaration snapshot and preserves the winner", () => {
    const G = fresh();
    beginAction(G);
    const phaseCalls: string[] = [];
    const ctx = makeCtx("0", phaseCalls);
    declare(G, ctx);
    // Silesia was in the attacker-controlled snapshot; the defender now holds
    // it while the objectives remain in AU hands.
    G.spaces.silesia.occupiedBy = "AU";

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.wars[0]).toMatchObject({victor: "defender", truceTurns: 2});
    expect(G.phase).toBe("action");
    expect(G.activePower).toBe("AU");
    expect(phaseCalls).toContain("action");
    expect(G.flags.postWarWinner).toBe("AU");

    // boardgame.io runs actionBegin after the move; it must not reset to GE.
    onBegin("action")(G, ctx);
    expect(G.activePower).toBe("AU");
    expect(G.flags.postWarWinner).toBeUndefined();
  });

  test("white peace (and the explicit whitePeace flag) uses a one-turn truce", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.wars[0]).toMatchObject({victor: null, truceTurns: 1});

    const G2 = fresh();
    beginAction(G2);
    const ctx2 = makeCtx("0");
    declare(G2, ctx2);
    G2.flags.whitePeace = true;
    expect(resolveWar(G2, ctx2, [])).toBeUndefined();
    expect(G2.wars[0]).toMatchObject({victor: null, truceTurns: 1});
    expect(G2.flags.whitePeace).toBeUndefined();
  });

  test("negotiated peace is read from flags and makes the other side the victor", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.flags.negotiatedPeace = "attacker";

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.wars[0]).toMatchObject({victor: "defender", truceTurns: 2});
    expect(G.wars[0].treaties).toEqual([]);
    expect(G.flags.negotiatedPeace).toBeUndefined();
  });

  test("the defenderBlockading flag produces a defensive victory", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.flags.defenderBlockading = true;

    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.wars[0]).toMatchObject({victor: "defender", truceTurns: 2});
    expect(G.activePower).toBe("AU");
    expect(G.flags.defenderBlockading).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Interactive treaty chooser
// ---------------------------------------------------------------------------

describe("treaty decisions", () => {
  test("resolveWar opens a treatyOption pending and demobilizes after the choice", () => {
    const G = fresh();
    beginAction(G);
    const phaseCalls: string[] = [];
    const ctx = makeCtx("0", phaseCalls);
    declare(G, ctx);
    // A normal victory with Bohemia occupied but still AU-controlled, plus an
    // occupied AU home, leaves cession and reparations legal.
    G.spaces.bohemia.occupiedBy = "GE";
    G.spaces.vienna.occupiedBy = "GE";

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.war).not.toBeNull();
    expect(G.war!.status).toBe("victory");
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.power).toBe("GE");
    expect(G.pending?.options.map((option) => option.id)).toEqual(
      expect.arrayContaining(["territorialCession", "warReparations", "done"]),
    );

    expect(resolvePending(G, ctx, "territorialCession")).toBeUndefined();
    // A major victory has two treaty options, so the chooser offers the second.
    expect(G.pending?.kind).toBe("treatyOption");
    expect(resolvePending(G, ctx, "done")).toBeUndefined();
    // Rule 17.0 free actions are offered after the settlement; declining
    // skips the remaining entitled powers and hands back the action phase.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war).toBeNull();
    expect(G.spaces.bohemia.control).toBe("GE");
    expect(G.spaces.bohemia.occupiedBy).toBeNull();
    expect(G.wars[0].treaties).toContain("territorialCession");
    expect(G.phase).toBe("action");
    expect(phaseCalls).toContain("action");
  });

  test("a space option opens treatySpace and applies the selected space", () => {
    const G = fresh();
    G.war = createWarState(G, "GE", "UK", "conquest", ["malta"], 2);
    G.phase = "wartime";
    G.activePower = "GE";
    G.spaces.malta.occupiedBy = "GE";
    G.spaces.canada.control = "UK";
    G.spaces.canada.occupiedBy = "GE";
    const ctx = makeCtx("0");

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(G.pending?.options.map((option) => option.id)).toContain("colonialCession");

    expect(resolvePending(G, ctx, "colonialCession")).toBeUndefined();
    expect(G.pending?.kind).toBe("treatySpace");
    const spaces = G.pending!.options.map((option) => option.id);
    expect(spaces).toContain("canada");

    expect(resolvePending(G, ctx, "canada")).toBeUndefined();
    // The 17.0 free-action prompt must not block the end of the settlement.
    expect(G.pending?.kind).toBe("demobilizationFreeAction");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.pending).toBeNull();
    expect(G.war).toBeNull();
    expect(G.spaces.canada.control).toBe("GE");
    expect(G.wars[0].treaties).toContain("colonialCession");
  });

  test("declining the treaty decision settles without a treaty", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.spaces.bohemia.occupiedBy = "GE";
    G.spaces.vienna.occupiedBy = "GE";

    expect(resolveWar(G, ctx)).toBeUndefined();
    expect(G.pending?.kind).toBe("treatyOption");
    expect(declinePending(G, ctx)).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars[0].treaties).toEqual([]);
    expect(G.phase).toBe("action");
  });
});

// ---------------------------------------------------------------------------
// Truces and phase hooks
// ---------------------------------------------------------------------------

describe("end phase and wartime/action hooks", () => {
  test("G.wars[].truceTurns counts down and expires at zero", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.spaces.vienna.occupiedBy = "GE";
    expect(resolveWar(G, ctx, [])).toBeUndefined();
    expect(G.wars[0].truceTurns).toBe(2);

    resolveEnd(G, ctx);
    expect(G.wars[0].truceTurns).toBe(1);
    resolveEnd(G, ctx);
    expect(G.wars[0].truceTurns).toBe(0);
    resolveEnd(G, ctx);
    expect(G.wars[0].truceTurns).toBe(0);
  });

  test("wartimeBegin does not roll a later war status back to warAim", () => {
    const G = fresh();
    G.war = createWarState(G, "GE", "AU", "conquest", ["bohemia"], 2);
    G.war.status = "maneuver";
    G.activePower = "AU";
    const ctx = makeCtx("0");

    onBegin("wartime")(G, ctx);
    expect(G.war.status).toBe("maneuver");
    expect(G.activePower).toBe("AU");
    expect(G.phase).toBe("wartime");

    // A genuinely new war still receives its attacker's initiative.
    G.war.status = "warAim";
    G.activePower = "AU";
    onBegin("wartime")(G, ctx);
    expect(G.war.status).toBe("warAim");
    expect(G.activePower).toBe("GE");
  });

  test("passing every belligerent resolves through the shared victory path", () => {
    const G = fresh();
    beginAction(G);
    const ctx = makeCtx("0");
    declare(G, ctx);
    G.war!.status = "maneuver";
    G.war!.initiative = ["GE", "AU"];

    expect(passWarMove(G, ctx)).toBeUndefined();
    expect(G.war!.passed).toEqual(["GE"]);
    expect(G.activePower).toBe("AU");

    const au = makeCtx("3");
    expect(passWarMove(G, au)).toBeUndefined();
    expect(G.war).toBeNull();
    expect(G.wars).toHaveLength(1);
    expect(G.phase).toBe("action");
  });
});
