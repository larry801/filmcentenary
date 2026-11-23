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
import {shuffle, drawCards, cardsThroughDecade} from "./deck";
import {
  log,
  cardsToDraw,
  isAloneSensitiveKind,
  recomputeTracks,
  SETUP_PLACEMENT_FLAG,
} from "./rules";
import {ensureStateDefaults} from "./migrations";
import {
  botPowersOf,
  declaresBotDifficulty,
  parseBotDifficulty,
  parseBotPowers,
  parseNoGw,
  parseScenarioId,
} from "../configuration";
import {initialNonPlayerBuildBox} from "./endPhase";
import {
  applyAltGwUncontrolledSpaces,
  buildPointsFor,
  initialBuildPoints,
  placeAltGwInventory,
} from "./scenario";
import {applyGoalDeckEdits, applyIndependentMinorMarkers, openGwBuildPointDecision} from "./scenarioSetup";

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
  // 34.1: one difficulty for the whole table.  Written for a match that names
  // bot seats *or* explicitly names a level (the local/solo shell keeps its bot
  // seats on the client, so `bots` is empty there).  An ordinary hotseat visit
  // names neither and keeps the field absent.
  const botDifficulty = bots.length > 0 || declaresBotDifficulty(setupData)
    ? parseBotDifficulty(setupData)
    : undefined;
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
    // Scenarios print "Pac 0" as a real marker, not as an unset value.
    G.spaces[entry.space].pacificationMarker = true;
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
    // 5.1.3 / 5.1.5 / 5.1.6: a counter the printed setup places on its own (the
    // FR Zouave in Algeria, the UK elite colonial EF at Suez) is exempt from the
    // end-of-movement alone clause until the game has actually moved on.
    if (isAloneSensitiveKind(setup.kind as Unit["kind"])) {
      unit.flags = {...(unit.flags ?? {}), [SETUP_PLACEMENT_FLAG]: G.turn};
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
  // 22.5(1): an independent Poland's 4th/5th armies are *reserve* army counters
  // and belong in the Polish reserve armies holding box (3.8).  A scenario that
  // prints one (Independent Poland, playbook p. 9: "1 reserve army") registers
  // it here; a space-less reserve counter owned by a non-player power has no
  // player reserve box to go to.
  for (const unit of Object.values(G.units)) {
    if (unit.space !== null && unit.space !== undefined) continue;
    if (unit.owner !== "Poland" || unit.kind !== "reserveArmy") continue;
    const polish = (G.nonPlayerBuildBox.poland ??= {reserveArmies: []});
    if (!polish.reserveArmies.includes(unit.id)) polish.reserveArmies.push(unit.id);
  }

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
  // 10.1: the deck starts with every card band up to and including the
  // scenario's opening decade.  The campaign starts at the 1850s (58 cards);
  // the 1870 and 1880 scenarios also include the earlier bands, and the printed
  // "Removed Cards" never enter it.
  G.deck = shuffle(ctx, [...cardsThroughDecade(decadeForScenarioTurn(def.firstTurn))]);
  // A mid-campaign scenario opens with every card band already in play, plus
  // its own band; the 1850s campaign starts with only the 1850s cards.  Remove
  // the duplicates that the data may carry for scenario variants.
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
  // prints that as the opening "draw 3 NGs and pick one" (GE draws 2).  2.4 /
  // 20.11 require the deck to be shuffled, one card kept and the other two
  // *returned to the NG deck*, so the drawn cards are held in
  // `startingGoalChoices` until the seat answers the setup decision; nothing is
  // discarded here.
  // 34.1: a bot does not draw NGs with the players — its NGs are drawn at the
  // end of the game (or the start of the GW), so bot seats skip this draw.
  for (const power of POWERS) {
    const draw = def.special.startingGoalDraw?.[power] ?? 0;
    if (draw <= 0) continue;
    if (bots.includes(power)) continue;
    const p = G.powers[power];
    p.goalDeck = shuffle(ctx, p.goalDeck);
    const drawn = p.goalDeck.splice(0, draw);
    if (drawn.length === 0) continue;
    p.flags.startingGoalChoices = drawn.join(",");
    log(G, power, "goalDrawn", {count: drawn.length});
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
    // A unified Italy is a non-player major, not a `Power`, so its printed
    // inventory is placed through the same helper with the "IT" owner.
    const italianInventory = def.special.altGw.units?.Italy;
    if (italianInventory !== undefined && def.italy?.unified === true) {
      const placed = placeAltGwInventory(G, "IT", italianInventory);
      log(G, undefined, "altGwUnitsPlaced", {count: placed.length, power: "IT"});
    }
    // Step 3 of the printed procedure: "Taking Control of Uncontrolled
    // Spaces" (in turn order, UK 2 per placement, LoC required).  The printed
    // spaces are a player choice, so the deterministic legal default is
    // applied here before step 4 sets manpower.
    const claimed = applyAltGwUncontrolledSpaces(G, def);
    if (claimed > 0) log(G, undefined, "altGwUncontrolledKeys", {count: claimed});
    // Step 4: "Set manpower for each player based on how many keys they
    // control."  The track recomputation is the single board-reading step, so
    // the printed setup's control markers decide the starting manpower.
    recomputeTracks(G);
    // "Poland begins the scenario at war and allied with AU."  The alliance is
    // the printed ally marker in the scenario data; during the Great War being
    // on AU's side against RU already makes Poland a belligerent, so the
    // printed war is recorded on the ledger rather than as a separate limited
    // war (the GW supersedes limited wars for alliance purposes).
    for (const war of def.special.altGw.startingWars ?? []) {
      G.persistent[`startingWar:${war.attacker}:${war.defender}`] = true;
      log(G, undefined, "scenarioStartingWar", {
        attacker: war.attacker,
        defender: war.defender,
        minor: war.minorTarget?.minor ?? "",
        ally: war.minorTarget?.ally ?? "",
      });
    }
    for (const power of POWERS) {
      const points = buildPointsFor(def, power);
      if (points > 0) log(G, power, "buildPointsGranted", {points});
    }
    // Step 2's spend choice: a Great-War scenario has no prep phase, so the
    // first decision is opened here (the deciding seat answers it from the
    // opening planning step) and each answer opens the next one.
    if (openGwBuildPointDecision(G)) G.flags.gwSetupPending = true;
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
  // Power Projection is derived from the board (3.3.1), never a printed
  // marker: the campaign setup prints UK 8 / FR 3 / RU 3, and the corrected
  // map data (Algeria's South Atlantic anchor) makes the derived formula agree.
  // Keeping the scenario value equal to the formula means the track the player
  // sees at setup and the one 20.6 derives at the first end phase are the same.
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
