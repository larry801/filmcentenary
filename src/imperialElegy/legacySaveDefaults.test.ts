/**
 * Legacy-save defaults (round 7 migration).
 *
 * Rounds 1–6 added typed state records that the engine and the board read
 * directly.  These tests pin `ensureStateDefaults`:
 *
 *  - an old-style save (a real setup with the newer fields removed) is filled
 *    with every documented default;
 *  - existing values are never overwritten, and the migration is idempotent
 *    and JSON-round-trip safe;
 *  - the legacy `persistent` markers (`italy_mpit_*`, `italyAlliance`) are
 *    folded into their typed homes without losing data;
 *  - a fresh `setupImperialElegy` already has the migrated shape;
 *  - partial fixtures (missing seat / space / bags) are rebuilt.
 *
 * `legacySaveFlows.test.ts` covers the live hooks (playerView, end phase, GW).
 */

import type {Ctx} from "boardgame.io";
import {GreatWarState, ImperialElegyState, POWERS, PowerState, WarState} from "./types";
import {setupImperialElegy} from "./engine/setup";
import {CURRENT_STATE_VERSION, ensureStateDefaults} from "./engine/migrations";
import {printedMaxIndustry} from "./engine/greatWarFlow";
import {START_BUILD_BOX} from "./constant/setup";

const makeCtx = (dieValue = 3): Ctx =>
  ({
    playerID: "0",
    random: {Die: (_sides: number) => dieValue},
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

/** The round 1–6 top-level records a pre-migration save can be missing. */
const NEW_TOP_LEVEL = [
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
] as const;

/** Round 1–6 per-power fields. */
const NEW_POWER_FIELDS = ["maxIndustry", "rapidDeployment", "secondaryManpower", "arabKeys"] as const;

const bag = (target: unknown): Record<string, unknown> => target as Record<string, unknown>;

/**
 * A realistic old-style save: a real campaign setup with the newer fields
 * removed (as if it had been written by an earlier build).
 */
const legacySave = (): ImperialElegyState => {
  const G = fresh();
  const raw = bag(G);
  for (const key of NEW_TOP_LEVEL) delete raw[key];
  for (const power of POWERS) {
    for (const field of NEW_POWER_FIELDS) delete bag(G.powers[power])[field];
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

/** An old-style limited war (missing every round 4–6 optional record). */
const legacyWar = (): WarState => ({
  attacker: "GE",
  defender: "FR",
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: [],
  warAim: "conquest",
  objectives: ["alsace-lorraine"],
  status: "warAim",
  budgets: {GE: 2, FR: 0},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: 1,
});

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

// ---------------------------------------------------------------------------
// Top-level defaults
// ---------------------------------------------------------------------------

describe("ensureStateDefaults — top-level records", () => {
  test("fills every round 1–6 top-level field on an old-style save", () => {
    const G = legacySave();
    // Precondition: the save really is missing them.
    expect(G.revealedGoals).toBeUndefined();
    expect(G.nonPlayerBuildBox).toBeUndefined();

    expect(ensureStateDefaults(G)).toBe(G);

    expect(G.minorDeclarations).toEqual([]);
    expect(G.minorCardMarkers).toEqual({});
    expect(G.revealedGoals).toEqual([]);
    expect(G.eliminatedMinors).toEqual([]);
    expect(G.italyReinforcements).toEqual({armies: 0, squadrons: 0});
    expect(G.navalContinuation).toBeNull();
    expect(G.navalTransit).toBeNull();
    expect(G.dardanellesPassage).toBeNull();
    expect(G.dardanellesPassages).toBeNull();
    // 20.3: the printed campaign build box, with the 22.5 Polish box empty.
    expect(G.nonPlayerBuildBox).toEqual({
      minors: [...START_BUILD_BOX],
      italy: {italianArmy: 0, squadron: 0, dreadnought: 0},
      poland: {reserveArmies: []},
    });
    // 8.5: a column that never existed stays lazy (unifyItaly seeds the
    // printed 1 neutral influence); only legacy markers materialise it.
    expect(G.italyMpit).toBeUndefined();
    // Live cursors and score boards keep their "absent" meaning.
    expect(G.endPhase).toBeUndefined();
    expect(G.scores).toBeUndefined();
    expect(G.version).toBe(CURRENT_STATE_VERSION);
  });

  test("fills the per-power defaults (29.1 max industry, 33.2 rapid deployment)", () => {
    const G = legacySave();
    ensureStateDefaults(G);
    for (const power of POWERS) {
      expect(G.powers[power].maxIndustry).toBe(printedMaxIndustry(power));
      expect(G.powers[power].rapidDeployment).toBeNull();
      expect(G.powers[power].secondaryManpower).toBe(0);
      expect(G.powers[power].arabKeys).toBe(0);
      expect(G.powers[power].flags).toEqual(expect.any(Object));
      expect(G.powers[power].mpit).toEqual(expect.any(Object));
    }
    // The printed display maximum: Germany has industry box 7, the rest 6.
    expect(G.powers.GE.maxIndustry).toBe(7);
    expect(G.powers.UK.maxIndustry).toBe(6);
  });

  test("restores the canonical fresh-space shape", () => {
    const G = fresh();
    delete bag(G.spaces.berlin).units;
    delete bag(G.spaces.paris).influence;
    delete bag(G.spaces.london).diplomacy;
    delete bag(G.spaces.rome).ally;
    delete bag(G.spaces.vienna).fort;
    delete bag(G.spaces.piedmont).pacification;
    delete bag(G.spaces.naples).rebellion;
    delete bag(G.spaces.silesia).trench;

    ensureStateDefaults(G);

    expect(G.spaces.berlin.units).toEqual([]);
    expect(G.spaces.paris.influence).toBeNull();
    expect(G.spaces.london.diplomacy).toBeNull();
    expect(G.spaces.rome.ally).toBeNull();
    expect(G.spaces.vienna.fort).toBeNull();
    expect(G.spaces.piedmont.pacification).toBe(0);
    expect(G.spaces.naples.rebellion).toBeNull();
    expect(G.spaces.silesia.trench).toBeNull();
    // The genuinely dynamic encodings stay absent.
    expect(G.spaces.berlin.occupiedBy).toBeUndefined();
    expect(G.spaces.berlin.trenchLine).toBeUndefined();
    expect(G.spaces.berlin.keyTypeOverride).toBeUndefined();
  });

  test("fills the Great War lifecycle records (26.1, 28.1, 29.1–29.3, 30.1–30.2)", () => {
    const G = fresh();
    G.gw = legacyGreatWar();
    G.phase = "gwPlanning";

    ensureStateDefaults(G);

    const gw = G.gw!;
    expect(gw.bonusImpulseSide).toBeNull();
    expect(gw.blockaded).toEqual([]);
    expect(gw.blockadedLastTurn).toEqual([]);
    expect(gw.usSurrendered).toBe(false);
    expect(gw.italySurrendered).toBe(false);
    expect(gw.italyLostKeys).toEqual([]);
    expect(gw.italyAlliance).toBe("neutral");
    expect(gw.neutralEntry).toBeNull();
    expect(gw.winter).toBeNull();
    expect(gw.exhaustionPending).toBeNull();
    expect(gw.bonusCp).toEqual({});
    expect(gw.budgetTurn).toBe(-1);
    expect(gw.combatCardsInFront).toEqual([]);
    expect(gw.discard).toEqual([]);
  });

  test("fills a started winter's optional choice lists (29.2)", () => {
    const G = fresh();
    G.gw = legacyGreatWar();
    G.gw.winter = {
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

    ensureStateDefaults(G);

    expect(G.gw!.winter!.colonialTransfers).toEqual([]);
    expect(G.gw!.winter!.colonialBonus).toEqual([]);
    expect(G.gw!.winter!.colonialBonusPlanned).toBe(false);
  });

  test("fills the optional war bookkeeping on live and archived wars", () => {
    const G = fresh();
    G.war = legacyWar();
    G.wars = [legacyWar()];

    ensureStateDefaults(G);

    for (const war of [G.war, G.wars[0]]) {
      expect(war!.refusedAllies).toEqual([]);
      expect(war!.freeActionEntitlements).toEqual([]);
      expect(war!.freeActions).toEqual([]);
      expect(war!.defenderShift).toBeNull();
      expect(war!.declarationCard).toBeNull();
      expect(war!.postWarDraws).toEqual([]);
      expect(war!.knockedOut).toEqual([]);
      // The typed non-player marker stays absent: it is not a default.
      expect(war!.minorTarget).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Legacy persistent markers
// ---------------------------------------------------------------------------

describe("ensureStateDefaults — legacy persistent markers", () => {
  test("folds persistent.italy_mpit_* into the typed Italy column", () => {
    const G = legacySave();
    G.persistent.italy_mpit_neutral = 2;
    G.persistent.italy_mpit_te = 1;

    ensureStateDefaults(G);

    expect(G.italyMpit).toEqual({te: 1, ta: 0, neutral: 2});
    // The legacy bag itself is preserved verbatim (no destructive migration).
    expect(G.persistent.italy_mpit_neutral).toBe(2);
  });

  test("an existing typed Italy column wins over legacy markers", () => {
    const G = legacySave();
    G.persistent.italy_mpit_neutral = 2;
    G.italyMpit = {te: 5, ta: 0, neutral: 0};

    ensureStateDefaults(G);

    expect(G.italyMpit).toEqual({te: 5, ta: 0, neutral: 0});
  });

  test("folds persistent.italyAlliance into gw.italyAlliance (25.3)", () => {
    const G = fresh();
    G.gw = legacyGreatWar();
    G.persistent.italyAlliance = "taAligned";

    ensureStateDefaults(G);

    expect(G.gw.italyAlliance).toBe("taAligned");
  });

  test("an invalid legacy alliance box falls back to the neutral box", () => {
    const G = fresh();
    G.gw = legacyGreatWar();
    G.persistent.italyAlliance = "not-a-box";

    ensureStateDefaults(G);

    expect(G.gw.italyAlliance).toBe("neutral");
  });

  test("does not seed persistent one-off markers", () => {
    const G = legacySave();
    ensureStateDefaults(G);
    expect(G.persistent).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// No overwrite / idempotence / round trip
// ---------------------------------------------------------------------------

describe("ensureStateDefaults — additive and idempotent", () => {
  test("never overwrites an existing value", () => {
    const G = fresh();
    G.gw = legacyGreatWar();
    G.war = legacyWar();
    // Start from the canonical (already migrated) shape, then overwrite every
    // kind of migrated field with a distinct value.
    ensureStateDefaults(G);
    G.revealedGoals = ["IE-NG-01"];
    G.eliminatedMinors = ["Serbia"];
    G.minorCardMarkers = {Serbia: 1};
    G.italyReinforcements = {armies: 2, squadrons: 1};
    G.italyMpit = {te: 0, ta: 0, neutral: 3};
    G.nonPlayerBuildBox = {
      minors: ["Serbia"],
      italy: {italianArmy: 1, squadron: 0, dreadnought: 0},
      poland: {reserveArmies: ["u999"]},
    };
    G.powers.GE.maxIndustry = 4;
    G.powers.UK.rapidDeployment = {scope: "limited", turn: 3, spent: true};
    G.spaces.berlin.influence = "FR";
    G.gw.blockaded = ["GE"];
    G.gw.exhaustionPending = {mode: "vp", power: "GE", turn: 2};
    G.gw.combatCardsInFront = [{holder: "GE", cardId: "IE-GW-03", faceup: true}];
    G.war.refusedAllies = ["UK"];
    G.war.freeActionEntitlements = [{power: "GE", side: "attacker", order: 1}];
    G.war.freeActions = [
      {power: "GE", side: "attacker", action: "redeploy", unitIds: [], from: "berlin", to: "silesia"},
    ];
    G.war.declarationCard = "IE-H-GE-1";
    G.war.postWarDraws = ["UK"];
    G.war.knockedOut = [{power: "FR", by: "attacker", occupier: "GE", capital: "paris", turn: 1}];
    G.war.defenderShift = {from: "neutral", to: "teAligned", steps: 1, forced: false, choice: false};
    G.gw.bonusImpulseSide = "te";
    G.gw.blockadedLastTurn = ["FR"];
    G.gw.usSurrendered = false;
    G.gw.italySurrendered = false;
    G.gw.italyLostKeys = ["rome"];
    G.gw.italyAlliance = "teCommitted";
    G.gw.neutralEntry = {
      queue: [],
      current: null,
      rolls: [],
      choice: null,
      usedRedeploy: false,
      usedDeploy: false,
      unitId: null,
    };
    G.gw.winter = null;
    G.gw.bonusCp = {GE: 2};
    G.gw.budgetTurn = 1;
    G.gw.discard = ["IE-GW-06"];

    const before = json(G);
    ensureStateDefaults(G);

    expect(json(G)).toEqual(before);
  });

  test("is idempotent and JSON-round-trip safe", () => {
    const G = legacySave();
    G.gw = legacyGreatWar();
    G.war = legacyWar();
    G.wars = [legacyWar()];
    ensureStateDefaults(G);
    const once = json(G);

    // Simulate save/load and run it again: nothing may change.
    const loaded = JSON.parse(JSON.stringify(G)) as ImperialElegyState;
    ensureStateDefaults(loaded);
    ensureStateDefaults(loaded);

    expect(json(loaded)).toEqual(once);
  });

  test("a fresh setup already has the migrated shape", () => {
    const G = fresh();
    expect(G.revealedGoals).toEqual([]);
    expect(G.eliminatedMinors).toEqual([]);
    expect(G.minorDeclarations).toEqual([]);
    expect(G.minorCardMarkers).toEqual({});
    expect(G.italyReinforcements).toEqual({armies: 0, squadrons: 0});
    expect(G.nonPlayerBuildBox).toEqual({
      minors: [...START_BUILD_BOX],
      italy: {italianArmy: 0, squadron: 0, dreadnought: 0},
      poland: {reserveArmies: []},
    });
    expect(G.version).toBe(CURRENT_STATE_VERSION);
  });

  test("rebuilds a partial fixture's missing seat, space and bags", () => {
    const G = fresh();
    delete (G.powers as Record<string, PowerState | undefined>).RU;
    delete (G.spaces as Record<string, unknown>).berlin;
    delete bag(G)["flags"];
    delete bag(G)["pendingStack"];
    delete bag(G)["log"];
    delete bag(G)["persistent"];

    ensureStateDefaults(G);

    expect(G.powers.RU).toBeDefined();
    // The printed RU starting display.
    expect(G.powers.RU.stability).toBe(3);
    expect(G.powers.RU.industry).toBe(0);
    expect(G.spaces.berlin).toBeDefined();
    expect(G.spaces.berlin.control).toBe("GE");
    expect(G.flags).toEqual({});
    expect(G.pendingStack).toEqual([]);
    expect(G.log).toEqual([]);
    expect(G.persistent).toEqual({});
  });
});
