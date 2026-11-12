/**
 * Legacy-save live flows (round 7 migration).
 *
 * `legacySaveDefaults.test.ts` pins the pure `ensureStateDefaults` behaviour.
 * This file exercises the three live paths an old save (or a partial fixture)
 * actually goes through:
 *
 *  - `playerView` (`redactForView`) — must never throw and must never mutate,
 *    even *before* the migration ran (a resumed boardgame.io match renders the
 *    view before any phase `onBegin` or move);
 *  - `resolveEnd` — the defensive migration call, then the twelve 20.x steps;
 *  - the Great War and limited-war flows (`beginGwTurn`, `startGwManeuver`,
 *    `resolveGwWinter`, `startWarManeuver`) on a migrated old state.
 */

import type {Ctx} from "boardgame.io";
import {Ctx as BoardCtx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, POWERS, Power, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {ensureStateDefaults} from "./engine/migrations";
import {redactForView} from "./engine/privacy";
import {
  beginGwTurn,
  resolveGwWinter,
  startGwManeuver as startGwManeuverStep,
} from "./engine/greatWarFlow";
import {ImperialElegyGameDef} from "./game";
import {declareWar, resolveEnd, startWarManeuver} from "./moves";

const makeCtx = (playerID: string | null = "0", phase = "action"): Ctx =>
  ({
    playerID,
    random: {Die: (_sides: number) => 3},
    events: {
      setPhase: () => undefined,
      setActivePlayers: () => undefined,
      endGame: () => undefined,
      endTurn: () => undefined,
    },
    turn: 1,
    phase,
  }) as unknown as Ctx;

const fresh = (): ImperialElegyState => setupImperialElegy(makeCtx());
const seat = (power: Power): string => String(POWERS.indexOf(power));
const bag = (target: unknown): Record<string, unknown> => target as Record<string, unknown>;
const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** A pre-migration save: the round 1–6 top-level records were never written. */
const legacySave = (): ImperialElegyState => {
  const G = fresh();
  for (const key of [
    "minorDeclarations",
    "italyMpit",
    "minorCardMarkers",
    "navalContinuation",
    "navalTransit",
    "italyReinforcements",
    "revealedGoals",
    "eliminatedMinors",
    "nonPlayerBuildBox",
    "dardanellesPassage",
    "dardanellesPassages",
  ]) {
    delete bag(G)[key];
  }
  for (const power of POWERS) {
    delete bag(G.powers[power]).maxIndustry;
    delete bag(G.powers[power]).rapidDeployment;
  }
  return G;
};

/** An old-style Great War block: only the round-1 fields. */
const legacyGreatWar = (): GreatWarState => ({
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
});

/** A great war in progress with the round 4–6 records already migrated. */
const migratedGreatWar = (): ImperialElegyState => {
  const G = fresh();
  G.gw = legacyGreatWar();
  G.phase = "gwPlanning";
  G.powers.GE.alliance = "taCommitted";
  G.powers.FR.alliance = "teCommitted";
  G.powers.GE.industry = 5;
  ensureStateDefaults(G);
  return G;
};

/** Fresh state with a live limited war declared through the real move. */
const declaredWarState = (): ImperialElegyState => {
  const G = fresh();
  G.phase = "action";
  G.activePower = "GE";
  G.cpRemaining = 4;
  G.pending = null;
  G.war = null;
  expect(declareWar(G, makeCtx("0"), "FR", "conquest", ["alsace-lorraine", "algeria"], 2)).toBeUndefined();
  expect(G.war).not.toBeNull();
  return G;
};

const stripWarFields = (war: WarState): void => {
  for (const key of [
    "refusedAllies",
    "freeActionEntitlements",
    "freeActions",
    "defenderShift",
    "declarationCard",
    "postWarDraws",
    "knockedOut",
  ]) {
    delete bag(war)[key];
  }
};

// ---------------------------------------------------------------------------
// playerView tolerance
// ---------------------------------------------------------------------------

describe("playerView on a legacy save", () => {
  test("redacts a pre-migration save without throwing and without mutating it", () => {
    const G = legacySave();
    const before = json(G);

    const spectator = redactForView(G, null);
    expect(spectator.handCounts.GE).toBe(G.powers.GE.hand.length);
    expect(spectator.powers.GE.hand).toEqual([]);
    expect(spectator.deckCount).toBe(G.deck.length);
    expect(spectator.gwDiscardCount).toBe(0);
    expect(spectator.faceupCombat).toEqual({});

    // Building a view never writes to the authoritative state.
    expect(json(G)).toEqual(before);
  });

  test("survives a seat, a container and the flag bag being missing", () => {
    const G = legacySave();
    delete (G.powers as Record<string, unknown>).OT;
    delete bag(G).flags;
    delete bag(G).pendingStack;
    delete bag(G).log;
    delete bag(G).deck;

    const view = redactForView(G, "1");

    expect(view.handCounts.OT).toBe(0);
    expect(view.goalCounts.OT).toBe(0);
    expect(view.pendingStack).toEqual([]);
    expect(view.log).toEqual([]);
    expect(view.deckCount).toBe(0);
    // The viewers still see their own and the others' cards correctly.
    expect(view.powers.GE.hand).toEqual([]);
    expect(view.handCounts.GE).toBe(G.powers.GE.hand.length);
  });

  test("the playerView game hook works before the migration ran", () => {
    const G = legacySave();
    const view = ImperialElegyGameDef.playerView!(G, makeCtx("0") as BoardCtx, "0");
    expect(view.powers.GE.hand).toEqual(G.powers.GE.hand);
    expect(view.powers.UK.hand).toEqual([]);
    // The view keeps a migrated shape once the state is migrated.
    ensureStateDefaults(G);
    expect(redactForView(G, "0").revealedGoals).toEqual([]);
  });

  test("tolerates an old Great War block (no in-front cards, no flag bag)", () => {
    const G = fresh();
    G.gw = legacyGreatWar();
    delete bag(G).flags;

    const view = redactForView(G, null);

    expect(view.faceupCombat).toEqual({});
    expect(view.gwDiscardCount).toBe(0);
    expect(view.gw!.discard).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Game start (prep phase onBegin)
// ---------------------------------------------------------------------------

describe("game start on a legacy save", () => {
  test("the prep phase onBegin migrates the loaded state", () => {
    const G = legacySave();
    const phases = ImperialElegyGameDef.phases as unknown as Record<
      string,
      {onBegin?: (G: ImperialElegyState, ctx: Ctx) => void}
    >;
    const prep = phases.prep.onBegin;
    expect(prep).toBeDefined();

    expect(() => prep!(G, makeCtx("0", "prep"))).not.toThrow();

    expect(G.phase).toBe("prep");
    expect(G.revealedGoals).toEqual([]);
    expect(G.eliminatedMinors).toEqual([]);
    expect(G.nonPlayerBuildBox).toBeDefined();
    expect(G.powers.GE.maxIndustry).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// End phase
// ---------------------------------------------------------------------------

describe("resolveEnd on a legacy save", () => {
  test("migrates defensively and still walks the printed end phase", () => {
    const G = legacySave();
    G.phase = "end";
    const trace: string[] = [];

    expect(() => resolveEnd(G, makeCtx("0", "end"), trace)).not.toThrow();

    expect(trace).toHaveLength(12);
    expect(G.phase).toBe("end");
    expect(G.turn).toBe(2);
    // The defensive migration filled the records the 20.x steps read.
    expect(G.nonPlayerBuildBox).toBeDefined();
    expect(G.revealedGoals).toEqual([]);
    expect(G.eliminatedMinors).toEqual([]);
    expect(G.powers.GE.maxIndustry).toBe(7);
  });

  test("runs a second end phase on the same (migrated) state", () => {
    const G = legacySave();
    G.phase = "end";
    resolveEnd(G, makeCtx("0", "end"));
    const migrated = json(G);
    G.phase = "end";
    expect(() => resolveEnd(G, makeCtx("0", "end"))).not.toThrow();
    expect(G.turn).toBe(3);
    // The migration is additive: it does not disturb the first end phase.
    expect(G.revealedGoals).toEqual((migrated as ImperialElegyState).revealedGoals ?? []);
  });
});

// ---------------------------------------------------------------------------
// Great War
// ---------------------------------------------------------------------------

describe("Great War flows on a migrated old state", () => {
  test("beginGwTurn plans turn 1 on a migrated save", () => {
    const G = migratedGreatWar();

    const res = beginGwTurn(G, makeCtx("0", "gwPlanning"));

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error(res.message);
    expect(G.phase).toBe("gwPlanning");
    expect(G.gw!.budgetTurn).toBe(1);
    expect(G.gw!.blockaded).toEqual([]);
    expect(G.gw!.combatCardsInFront).toEqual([]);
    expect(G.gw!.discard).toEqual([]);
    expect(G.gw!.exhaustionPending).toBeNull();
    expect(G.gw!.trenches.berlin).toBe("deadlock");
  });

  test("startGwManeuver then resolveGwWinter on a migrated save", () => {
    const G = migratedGreatWar();
    beginGwTurn(G, makeCtx("0", "gwPlanning"));

    const maneuver = startGwManeuverStep(G, makeCtx("0", "gwPlanning"));
    expect(maneuver.ok).toBe(true);
    expect(G.phase).toBe("gwManeuver");

    G.phase = "gwWinter";
    G.pending = null;
    const winter = resolveGwWinter(G, makeCtx("0", "gwWinter"));
    expect(winter.ok).toBe(true);
    expect(G.gw!.winter).not.toBeNull();
    expect(G.gw!.blockadedLastTurn).toEqual([]);
    expect(Array.isArray(G.gw!.blockaded)).toBe(true);
    expect(G.gw!.italyAlliance).toBe("neutral");
  });

  test("a winter already in progress keeps its migrated choice lists", () => {
    const G = migratedGreatWar();
    G.phase = "gwWinter";
    G.gw!.winter = {
      turn: 1,
      blockaded: [],
      industryLost: [],
      colonialWar: {
        africa: {
          region: "africa",
          te: 1,
          ta: 2,
          winner: "ta",
          teRoll: 1,
          taRoll: 2,
          teMod: 0,
          taMod: 0,
          teModifiers: [],
          taModifiers: [],
          controllingSide: null,
          losses: [],
          transfers: [],
        },
        asia: {
          region: "asia",
          te: 1,
          ta: 2,
          winner: "ta",
          teRoll: 1,
          taRoll: 2,
          teMod: 0,
          taMod: 0,
          teModifiers: [],
          taModifiers: [],
          controllingSide: null,
          losses: [],
          transfers: [],
        },
      },
      colonialStability: [],
      joinedNeutrals: [],
      bonusCp: {},
      usStabilityLoss: 0,
      politicalPressureLosses: [],
    };

    const winter = resolveGwWinter(G, makeCtx("0", "gwWinter"));
    expect(winter.ok).toBe(true);
    // The non-interactive path never reads the missing choice lists, so the
    // old winter keeps running; migrating afterwards materialises them.
    ensureStateDefaults(G);
    expect(G.gw!.winter!.colonialTransfers).toEqual([]);
    expect(G.gw!.winter!.colonialBonus).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Limited war
// ---------------------------------------------------------------------------

describe("startWarManeuver on a migrated old war", () => {
  test("applies the declaration shift fallback without the round 4–6 records", () => {
    const G = declaredWarState();
    expect(G.war!.defenderShift).toBeDefined();
    stripWarFields(G.war!);

    ensureStateDefaults(G);

    expect(G.war!.refusedAllies).toEqual([]);
    expect(G.war!.knockedOut).toEqual([]);
    expect(G.war!.defenderShift).toBeNull();

    expect(startWarManeuver(G, makeCtx("0", "wartime"))).toBeUndefined();
    expect(G.war!.status).toBe("maneuver");
    expect(G.war!.initiative.length).toBeGreaterThan(0);
  });

  test("an old archived war keeps its optional lists migrated", () => {
    const G = declaredWarState();
    const archived = JSON.parse(JSON.stringify(G.war)) as WarState;
    stripWarFields(archived);
    G.wars = [archived];

    ensureStateDefaults(G);

    expect(G.wars[0].refusedAllies).toEqual([]);
    expect(G.wars[0].freeActions).toEqual([]);
    expect(G.wars[0].postWarDraws).toEqual([]);
  });
});
