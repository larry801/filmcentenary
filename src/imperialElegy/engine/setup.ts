import {Ctx} from "boardgame.io";
import {
  ImperialElegyState,
  LogEntry,
  Power,
  POWERS,
  SpaceState,
  Unit,
} from "../types";
import {SPACES, createSpaceStates} from "../constant/spaces";
import {CAMPAIGN_SETUP, createEmptyPowerState, MINOR_POWER_HOMES} from "../constant/setup";
import {goalsForPower} from "../constant/goals";
import {CARDS} from "../constant/cards.data";
import {prepareDeck, shuffle, drawCards, cardsForDecade} from "./deck";
import {log, cardsToDraw, recomputeTracks} from "./rules";
import {ensureStateDefaults} from "./migrations";

const newUnit = (
  G: ImperialElegyState,
  owner: string,
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
  if (space !== null) G.spaces[space].units.push(id);
  return unit;
};

export const setupImperialElegy = (ctx: Ctx, _setupData?: unknown): ImperialElegyState => {
  const G: ImperialElegyState = {
    scenario: "campaign",
    turn: 1,
    decade: "1850s",
    phase: "prep",
    activePower: "GE",
    turnIndex: 0,
    powers: {
      GE: createEmptyPowerState("GE"),
      UK: createEmptyPowerState("UK"),
      FR: createEmptyPowerState("FR"),
      AU: createEmptyPowerState("AU"),
      RU: createEmptyPowerState("RU"),
      OT: createEmptyPowerState("OT"),
    },
    spaces: createSpaceStates(),
    units: {},
    nextUnitId: 1,
    deck: [],
    discard: [],
    removed: [],
    delayedCards: {},
    wtt: CAMPAIGN_SETUP.wtt,
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
  for (const override of CAMPAIGN_SETUP.controlOverrides) {
    if (G.spaces[override.space]) G.spaces[override.space].control = override.control;
  }

  // ---------------------------------------------------------------- markers
  for (const entry of CAMPAIGN_SETUP.diplomacy) G.spaces[entry.space].diplomacy = entry.power;
  for (const entry of CAMPAIGN_SETUP.influence) G.spaces[entry.space].influence = entry.power;
  for (const entry of CAMPAIGN_SETUP.pacification) {
    G.spaces[entry.space].pacification = entry.value;
  }

  // ---------------------------------------------------------------- forts
  for (const fort of CAMPAIGN_SETUP.forts) {
    G.spaces[fort.space].fort = {power: fort.power, level: fort.level};
  }

  // ---------------------------------------------------------------- units
  for (const setup of CAMPAIGN_SETUP.units) {
    const extra: Partial<Unit> = {};
    if (setup.special === "indian") extra.elite = false;
    const unit = newUnit(G, setup.owner, setup.kind, setup.steps, setup.space, extra);
    if (setup.special === "indian") unit.flags = {...(unit.flags ?? {}), indian: true};
    if (setup.owner === "UK" && setup.kind === "army" && setup.space === "london") unit.flags = {...(unit.flags ?? {}), firstArmy: true};
    if (setup.special === "arab") unit.flags = {...(unit.flags ?? {}), arab: true};
    if (setup.space === null) {
      const power = setup.owner as Power;
      if (G.powers[power]) G.powers[power].reserves.push(unit.id);
    }
  }

  // ---------------------------------------------------------------- decks
  for (const card of CARDS.home) {
    if (card.power) G.powers[card.power].homeCards.push(card.id);
  }
  for (const power of POWERS) {
    G.powers[power].goalDeck = shuffle(ctx, goalsForPower(power).map((g) => g.id));
  }
  G.deck = shuffle(ctx, [...cardsForDecade("1850s")]);
  // The 1850s cards are all in the initial deck; remove the duplicates that
  // the data may carry for scenario variants.
  G.deck = [...new Set(G.deck)];

  // ---------------------------------------------------------------- first deal
  // Turn 1 prep: no new deck cards, deal to every power by the printed 10.2
  // formula (industry, flashpoint domination, card markers, stability and
  // conditions such as India being stable), minimum 3.
  for (const power of POWERS) {
    drawCards(G, ctx, power, cardsToDraw(G, power));
  }

  G.log.push({id: G.nextLogId++, turn: 1, phase: "prep", key: "campaignStarted", args: {}});
  log(G, undefined, "seatOrder", {order: POWERS.join(", ")});
  G.phase = "prep";
  // Rounds 1–6 added typed records that this function does not have to spell
  // out one by one: the migration is the single list of documented defaults
  // (build box, Italy MPIT, revealed goals, GW lifecycle, …), so a fresh game
  // and a migrated old save have exactly the same shape.
  return ensureStateDefaults(G);
};

export const initialSpaceState = (id: string): SpaceState => G_SPACE_FACTORY[id];

const G_SPACE_FACTORY: Record<string, SpaceState> = createSpaceStates();

/** A deterministic summary used by tests and the setup validation screen. */
export const setupSummary = (): {
  spaces: number;
  units: number;
  forts: number;
  diplomacy: number;
  influence: number;
  actionCards: number;
  homeCards: number;
  goals: number;
} => ({
  spaces: Object.keys(SPACES).length,
  units: CAMPAIGN_SETUP.units.length,
  forts: CAMPAIGN_SETUP.forts.length,
  diplomacy: CAMPAIGN_SETUP.diplomacy.length,
  influence: CAMPAIGN_SETUP.influence.length,
  actionCards: CARDS.actions.length,
  homeCards: CARDS.home.length,
  goals: Object.values(SPACES).length,
});

export const minorHome = (minor: string): string | undefined => MINOR_POWER_HOMES[minor];
