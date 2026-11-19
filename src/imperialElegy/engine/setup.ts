import {Ctx} from "boardgame.io";
import {
  ImperialElegyState,
  LogEntry,
  Power,
  POWERS,
  PowerOrMinor,
  SpaceState,
  Unit,
} from "../types";
import {SPACES, createSpaceStates} from "../constant/spaces";
import {CAMPAIGN_SETUP, createEmptyPowerState, MINOR_POWER_HOMES} from "../constant/setup";
import {scenarioById} from "../constant/scenarios";
import type {ScenarioDef} from "../constant/scenarios/types";
import type {Decade} from "../constant/cards";
import {goalsForPower} from "../constant/goals";
import {CARDS} from "../constant/cards.data";
import {CARD_BY_ID} from "./deck";
import {prepareDeck, shuffle, drawCards, cardsForDecade} from "./deck";
import {log, cardsToDraw} from "./rules";
import {ensureStateDefaults} from "./migrations";
import {botPowersOf, parseBotDifficulty, parseBotPowers, parseNoGw, parseScenarioId} from "../configuration";
import {initialNonPlayerBuildBox} from "./endPhase";
import {
  buildPointsFor,
  initialBuildPoints,
  placeAltGwInventory,
} from "./scenario";
import {applyGoalDeckEdits, applyIndependentMinorMarkers} from "./scenarioSetup";

const newUnit = (
  G: ImperialElegyState,
  owner: PowerOrMinor,
  kind: Unit["kind"],
  steps: 1 | 2,
  space: string | null,
  extra: Partial<Unit> = {},
): Unit => {
  const id = `u${G.nextUnitId++}`;
  const unit: Unit = {
    id,
    kind,
    owner,
    steps,
    space,
    naval: ["squadron", "dreadnought"].includes(kind),
    ...extra,
  };
  G.units[id] = unit;
  if (space !== null && G.spaces[space]) G.spaces[space].units.push(id);
  return unit;
};

/**
 * Build the initial state for one printed scenario.
 *
 * `setupData` carries the match configuration (`configuration.ts#IESetupData`):
 *
 *  - `scenario` — the printed scenario id (absent => campaign);
 *  - `noGw` — Scenario 4's victory-condition modifier;
 *  - `bots` / `botDifficulty` — Rule 34 seats of an online match.
 */
export const setupImperialElegy = (ctx: Ctx, setupData?: unknown): ImperialElegyState => {
  // Rule 34 seats of an online match: the lobby names the bot powers in
  // `setupData.bots` (see configuration.ts#parseBotPowers).  A hotseat match
  // passes no setupData at all and keeps its per-seat toggles on the client.
  // Stored in rulebook seat order, so every reader sees the same list.
  const bots = botPowersOf({bots: parseBotPowers(setupData) ?? []});
  // 34.1: one difficulty for the whole table.  Only written for a match that
  // actually has bot seats, so a hotseat state keeps the field absent.
  const botDifficulty = bots.length > 0 ? parseBotDifficulty(setupData) : undefined;
  const scenarioId = parseScenarioId(setupData);
  const def: ScenarioDef = scenarioById(scenarioId);
  const noGw = parseNoGw(setupData);
  const buildPoints = initialBuildPoints(def);
  const G: ImperialElegyState = {
    scenario: scenarioId,
    ...(noGw ? {noGw: true} : {}),
    ...(buildPoints === undefined ? {} : {buildPoints}),
    turn: def.firstTurn,
    decade: decadeForScenarioTurn(def.firstTurn),
    phase: "prep",
    activePower: "GE",
    turnIndex: 0,
    powers: {
      GE: createEmptyPowerState("GE", def),
      UK: createEmptyPowerState("UK", def),
      FR: createEmptyPowerState("FR", def),
      AU: createEmptyPowerState("AU", def),
      RU: createEmptyPowerState("RU", def),
      OT: createEmptyPowerState("OT", def),
    },
    bots,
    ...(botDifficulty === undefined ? {} : {botDifficulty}),
    spaces: createSpaceStates(),
    units: {},
    nextUnitId: 1,
    deck: [],
    discard: [],
    removed: [],
    delayedCards: {},
    wtt: def.wtt,
    worldTensionMax: 5,
    passed: [],
    cpRemaining: 0,
    impulseCard: null,
    resolvingCard: null,
    war: null,
    wars: [],
    battle: null,
    gw: null,
    pending: null,
    pendingStack: [],
    seed: 0,
    log: [],
    nextLogId: 1,
    flags: {},
    result: null,
    persistent: {},
    decisionSeq: 1,
    version: 1,
  };

  // ---------------------------------------------------------------- control
  // The printed "control markers".  Scenario data lists only the overrides
  // (the map's own `control` field carries the campaign defaults), so applying
  // the list is enough for every scenario.
  for (const override of def.controlOverrides) {
    if (G.spaces[override.space]) G.spaces[override.space].control = override.control;
  }

  // ---------------------------------------------------------------- markers
  for (const entry of def.diplomacy) G.spaces[entry.space].diplomacy = entry.power;
  for (const entry of def.influence) G.spaces[entry.space].influence = entry.power;
  for (const entry of def.pacification) {
    G.spaces[entry.space].pacification = entry.value;
  }

  // Printed "Ally marker" entries: a minor power already allied to a player at
  // the scenario's start (4.8 / 12.5.3).  An ally marker is the allied side of
  // the diplomacy marker, so it clears any diplomacy marker in the space.
  for (const entry of def.allyMarkers ?? []) {
    const state = G.spaces[entry.space];
    if (!state) continue;
    state.control = entry.minor;
    state.diplomacy = null;
    state.influence = null;
    state.ally = entry.power;
  }

  // ---------------------------------------------------------------- forts
  for (const fort of def.forts) {
    G.spaces[fort.space].fort = {
      power: fort.power as Power,
      level: fort.level,
      ...(fort.indian === true ? {indian: true} : {}),
    };
  }

  // ---------------------------------------------------------------- units
  for (const setup of def.units) {
    const extra: Partial<Unit> = {};
    if (setup.special === "indian") extra.elite = false;
    const unit = newUnit(G, setup.owner, setup.kind, setup.steps, setup.space, extra);
    if (setup.special === "indian") unit.flags = {...(unit.flags ?? {}), indian: true};
    if (setup.special === "arab") unit.flags = {...(unit.flags ?? {}), arab: true};
    if (setup.special === "eliteColonialEf") unit.elite = true;
    if (setup.owner === "UK" && setup.kind === "army" && setup.space === "london") {
      unit.flags = {...(unit.flags ?? {}), firstArmy: true};
    }
    if (setup.space === null) {
      const power = setup.owner as Power;
      if (G.powers[power]) G.powers[power].reserves.push(unit.id);
    }
  }

  // ---------------------------------------------- scenario markers / states
  // The Suez Canal is printed "complete" by the 1870/1880/GW scenarios and only
  // built by A055 in the campaign.
  if (def.suezComplete === true) G.persistent.suezCanal = true;
  if (def.kielComplete === true) G.persistent.kielCanal = true;
  // Independently printing minor powers ("IMP marker"): they are independent
  // from the start.  `applyIndependentMinorMarkers` records the marker on the
  // spaces that print it as well as the minor itself.
  for (const minor of def.independentMinors ?? []) {
    G.persistent[`independentMinor:${minor}`] = true;
  }
  applyIndependentMinorMarkers(G, def);
  // Printed truces between two powers ("1 turn FR Truce").
  // A scenario prints truces as a flat list; each one is recorded with its
  // remaining turn count under a stable key and counted down by 20.7.
  for (const truce of def.truces ?? []) {
    G.persistent[`scenarioTruce:${truce.a}:${truce.b}`] = truce.turns;
  }
  // A completed Trans-Siberian RR is printed by the GW setups.
  if (def.powers.RU.tsrr === true) G.powers.RU.tsrr = true;

  // ---------------------------------------------------------------- GW scenarios
  if (def.special.gwTutorial || def.special.altGw) {
    // Great-War scenarios open with the war already in progress: `beginScenarioGw`
    // builds the GW state (alliances, order, canals, permanent events) from the
    // scenario data.  Imported lazily to keep the module graph acyclic.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {beginScenarioGw} = require("./greatWar") as typeof import("./greatWar");
    beginScenarioGw(G, def);
  }

  // ---------------------------------------------------------------- build box
  G.nonPlayerBuildBox = initialNonPlayerBuildBox();
  G.nonPlayerBuildBox.minors = [...def.buildBox];

  // ---------------------------------------------------------------- decks
  for (const card of CARDS.home) {
    if (card.power) G.powers[card.power].homeCards.push(card.id);
  }
  for (const power of POWERS) {
    G.powers[power].goalDeck = shuffle(ctx, goalsForPower(power, scenarioId).map((g) => g.id));
  }
  // The four-turn scenarios print National Goal deck edits for AU: "adds the
  // 'Precarious Position' NG … and they may remove either 'Contain Italy' or
  // 'Contain Prussia'".  The add happens here; the removal is the power's
  // choice and is offered as a setup decision.
  applyGoalDeckEdits(G, def, ctx);
  // 10.1: the deck starts with the scenario's opening decade band.  The
  // campaign starts at the 1850s (58 cards); the 1870 and 1880 scenarios start
  // at their own decade, and the printed "Removed Cards" never enter it.
  G.deck = shuffle(ctx, [...cardsForDecade(decadeForScenarioTurn(def.firstTurn))]);
  // The 1850s cards are all in the initial deck; remove the duplicates that
  // the data may carry for scenario variants.
  G.deck = [...new Set(G.deck)];
  // Printed removals: the scenario's "Removed Cards" list names cards that are
  // out of the game entirely, so they are moved to `removed` (not left in the
  // deck or the discard pile).
  for (const title of def.removedCards) {
    const card = CARDS.actions.find((entry) => entry.title === title);
    if (!card) {
      log(G, undefined, "scenarioCardMissing", {card: title});
      continue;
    }
    G.deck = G.deck.filter((id) => id !== card.id);
    if (!G.removed.includes(card.id)) G.removed.push(card.id);
  }
  // 1880 Berlin Conference: "set aside five random action cards and the Berlin
  // Conference mandatory event.  Shuffle the six cards and place them on the top
  // of the deck."
  if (def.special.berlinConference === true) {
    const berlin = CARDS.actions.find((card) => card.title === "Berlin Conference");
    if (berlin) {
      const extras: string[] = [];
      const pool = G.deck.filter((id) => id !== berlin.id);
      for (let i = 0; i < 5 && pool.length > 0; i += 1) {
        const pick = pool.splice(dieIndex(ctx, pool.length), 1)[0];
        extras.push(pick);
      }
      G.deck = G.deck.filter((id) => !extras.includes(id) && id !== berlin.id);
      const top = shuffle(ctx, [berlin.id, ...extras]);
      G.deck.push(...top);
    }
  }

  // ---------------------------------------------------------------- opening deal
  // Turn 1 prep: no new deck cards, deal to every power by the printed 10.2
  // formula (industry, flashpoint domination, card markers, stability and
  // conditions such as India being stable), minimum 3.  A scenario that opens
  // mid-campaign (1870/1880) uses the same formula plus its printed extras, and
  // one that opens at the Great War deals no action cards at all.
  if (!def.special.gwTutorial && !def.special.altGw) {
    for (const power of POWERS) {
      drawCards(G, ctx, power, cardsToDraw(G, power));
    }
  }

  // ---------------------------------------------------------------- national goals
  // 20.11 Play Note: "Players do not start the campaign game with any NGs
  // (players start with 1 NG in the 1870 and 1880 scenarios)."  A scenario
  // prints that as the opening "draw 3 NGs and pick one" (GE draws 2), so the
  // drawn cards are recorded as the pending choice and one is kept.
  for (const power of POWERS) {
    const draw = def.special.startingGoalDraw?.[power] ?? 0;
    if (draw <= 0) continue;
    const p = G.powers[power];
    const drawn = p.goalDeck.splice(0, draw);
    if (drawn.length === 0) continue;
    p.goals.push(drawn[0]);
    p.flags.startingGoal = drawn[0];
    log(G, power, "goalDrawn", {count: drawn.length, kept: drawn[0]});
  }

  // ---------------------------------------------------------------- alt-GW setup
  // Playbook p. 8: the alternate setups give each power a printed unit
  // inventory plus build points; their positions are a secret player choice,
  // so `placeAltGwInventory` applies the deterministic legal default.
  if (def.special.altGw) {
    for (const power of POWERS) {
      const inventory = def.special.altGw.units?.[power];
      if (inventory === undefined) continue;
      const placed = placeAltGwInventory(G, power, inventory);
      log(G, power, "altGwUnitsPlaced", {count: placed.length});
    }
    for (const power of POWERS) {
      const points = buildPointsFor(def, power);
      if (points > 0) log(G, power, "buildPointsGranted", {points});
    }
  }

  G.log.push({id: G.nextLogId++, turn: G.turn, phase: "prep", key: "campaignStarted", args: {}});
  if (def.id !== "campaign") {
    // A separate line names the scenario, so the campaign's original log entry
    // (and every test that reads its empty `args`) stays exactly as it was.
    log(G, undefined, "scenarioStarted", {
      scenario: def.id,
      name: def.name,
      firstTurn: def.firstTurn,
      lastTurn: def.lastTurn,
    });
  }
  log(G, undefined, "seatOrder", {order: POWERS.join(", ")});
  G.phase = "prep";
  // The printed display markers are authoritative at setup: the campaign
  // prints Power Projection UK 8 / FR 3 / RU 3, and the derived port formula
  // disagrees by one for FR and RU (a known modelling gap).  Recomputing here
  // would silently replace the printed markers, so the tracks stay as printed
  // and are derived from the board by the first end phase (20.6).
  // Rounds 1–6 added typed records that this function does not have to spell
  // out one by one: the migration is the single list of documented defaults
  // (build box, Italy MPIT, revealed goals, GW lifecycle, …), so a fresh game
  // and a migrated old save have exactly the same shape.
  return ensureStateDefaults(G);
};

/** Deterministic index for a deck pick (keeps `shuffle`'s single dice source). */
const dieIndex = (ctx: Ctx, length: number): number =>
  length <= 0 ? 0 : Math.min(length - 1, Math.max(0, (ctx.random?.Die(length) ?? 1) - 1));

/**
 * The decade a scenario turn belongs to, without importing `economy` (which
 * imports this module's siblings).  The mapping is the campaign's, so a
 * scenario that starts at turn 3 begins in the 1870s and one at turn 4 in the
 * 1880s, exactly as the printed headers say.
 */
const SCENARIO_TURN_DECADES = ["1850s", "1860s", "1870s", "1880s", "1890s", "1900s", "1910s"] as const;
const decadeForScenarioTurn = (turn: number): Decade => {
  const index = Math.min(Math.max(Math.floor(Number.isFinite(turn) ? turn : 1), 1), SCENARIO_TURN_DECADES.length) - 1;
  return SCENARIO_TURN_DECADES[index];
};

export const initialSpaceState = (id: string): SpaceState => G_SPACE_FACTORY[id];

const G_SPACE_FACTORY: Record<string, SpaceState> = createSpaceStates();

/** A deterministic summary used by tests and the setup validation screen. */
export const setupSummary = (scenarioId: unknown = "campaign"): {
  scenario: string;
  spaces: number;
  units: number;
  forts: number;
  diplomacy: number;
  influence: number;
  actionCards: number;
  homeCards: number;
  goals: number;
} => {
  const def = scenarioById(scenarioId);
  return {
    scenario: def.id,
    spaces: Object.keys(SPACES).length,
    units: def.units.length,
    forts: def.forts.length,
    diplomacy: def.diplomacy.length,
    influence: def.influence.length,
    actionCards: CARDS.actions.length,
    homeCards: CARDS.home.length,
    goals: Object.values(SPACES).length,
  };
};

export const minorHome = (minor: string): string | undefined => MINOR_POWER_HOMES[minor];

/** The campaign setup, re-exported so older imports keep working. */
export {CAMPAIGN_SETUP};
