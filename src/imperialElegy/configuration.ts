import {Power, POWERS} from "./types";
import {NO_GW_SETUP_KEY, SCENARIO_IDS, SCENARIO_OPTIONS, ScenarioId, isScenarioId, scenarioFromSetupData} from "./constant/scenarios";

/** The rulebook fixes seating and turn order as GE, UK, FR, AU, RU, OT. */
export const IE_SEATS: readonly Power[] = POWERS;

export const IE_SEAT_LABELS: Record<Power, {en: string; zh_CN: string}> = {
  GE: {en: "Germany", zh_CN: "德国"},
  UK: {en: "United Kingdom", zh_CN: "英国"},
  FR: {en: "France", zh_CN: "法国"},
  AU: {en: "Austria-Hungary", zh_CN: "奥匈帝国"},
  RU: {en: "Russia", zh_CN: "俄国"},
  OT: {en: "Ottoman Empire", zh_CN: "奥斯曼帝国"},
};

export const seatPower = (seat: string | number | null | undefined): Power | undefined => {
  const index = Number(seat);
  return Number.isInteger(index) && index >= 0 && index < IE_SEATS.length ? IE_SEATS[index] : undefined;
};

export const powerSeat = (power: Power): string => String(IE_SEATS.indexOf(power));

/**
 * The printed scenarios the lobby may start (`IE_playbook.pdf` pp. 3-10).
 *
 * Scenario 4 "No GW" is a victory-condition modifier rather than a setup of its
 * own ("Set up whichever scenario you wish to play and modify the victory
 * conditions as follows"), so it is offered as a toggle next to the picker
 * (`IE_NO_GW_LABEL`) and travels in `setupData.noGw`.
 */
export const IE_SCENARIOS = SCENARIO_OPTIONS;

/** Scenario 4's lobby label. */
export const IE_NO_GW_LABEL = {en: "No GW (Scenario 4)", zh_CN: "无大战（剧本 4）"} as const;

/** `setupData` key carrying the scenario id of an online match. */
export const IE_SCENARIO_SETUP_KEY = "scenario" as const;

/** `setupData` key carrying Scenario 4's "No GW" modifier. */
export const IE_NO_GW_SETUP_KEY = NO_GW_SETUP_KEY;

// ---------------------------------------------------------------------------
// Online multi-human / bot seats
// ---------------------------------------------------------------------------

/**
 * The engine always runs all six printed seats: every power owns a hand, a
 * deck and a national characteristic, and the phase flow walks `POWERS` by
 * name.  A human-vs-human match is therefore "six seats, some of them played
 * by the Rule 34 bot": the match is still created with six boardgame.io
 * players, and `setupData.bots` names the powers the server drives.
 *
 * The lobby offers 2–6 human seats; the remaining seats are bots.
 */
export const IE_MIN_HUMANS = 2;
export const IE_MAX_HUMANS = IE_SEATS.length;

/** `setupData` key carrying the bot-controlled powers of an online match. */
export const IE_BOTS_SETUP_KEY = "bots" as const;

/** Rule 34.1's three printed bot difficulty levels. */
export type BotDifficulty = "easy" | "normal" | "hard";

/** `setupData` key carrying the difficulty of this match's bot seats. */
export const IE_BOT_DIFFICULTY_SETUP_KEY = "botDifficulty" as const;

/** 34.1's default when the table does not choose one. */
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = "normal";

const isBotDifficulty = (value: unknown): value is BotDifficulty =>
  value === "easy" || value === "normal" || value === "hard";

/** A `setupData` bag with an optional scenario, bot list and difficulty. */
export interface IESetupData {
  /** The printed scenario to set up; absent reads as the campaign. */
  scenario?: ScenarioId;
  /** Scenario 4 "No GW": decide a Great War by alliance VP totals. */
  noGw?: boolean;
  bots?: Power[];
  botDifficulty?: BotDifficulty;
}

/**
 * Read and validate the scenario of a `setupData` bag.
 *
 * An absent or unknown id reads as the campaign instead of refusing the match:
 * the scenario only changes the opening position and a few printed rules, and a
 * bad token (an old client, a hand-written fixture) should not block a table.
 */
export const parseScenarioId = (setupData: unknown): ScenarioId => {
  if (setupData === null || typeof setupData !== "object" || Array.isArray(setupData)) return "campaign";
  return scenarioFromSetupData((setupData as Record<string, unknown>)[IE_SCENARIO_SETUP_KEY]);
};

/**
 * Read Scenario 4's "No GW" modifier.
 *
 * Only a real `true` turns it on; every other value reads as a normal scenario,
 * so a stale save or a typo cannot silently change how a Great War is scored.
 */
export const parseNoGw = (setupData: unknown): boolean => {
  if (setupData === null || typeof setupData !== "object" || Array.isArray(setupData)) return false;
  return (setupData as Record<string, unknown>)[NO_GW_SETUP_KEY] === true;
};

/** The scenario a live state plays (older saves have no field => campaign). */
export const scenarioOfState = (G: {scenario?: unknown} | null | undefined): ScenarioId =>
  scenarioFromSetupData(G?.scenario);

const isPower = (value: unknown): value is Power =>
  typeof value === "string" && (POWERS as readonly string[]).includes(value);

/**
 * Read and validate the bot list of a `setupData` bag.
 *
 * Returns `undefined` when the bag names something that is not a subset of the
 * six printed powers.  An absent list is an empty list: a six-human match and a
 * six-bot match are the two ends of the same scale.
 */
export const parseBotPowers = (setupData: unknown): Power[] | undefined => {
  if (setupData === undefined || setupData === null) return [];
  if (typeof setupData !== "object" || Array.isArray(setupData)) return undefined;
  const raw = (setupData as Record<string, unknown>)[IE_BOTS_SETUP_KEY];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return undefined;
  const bots: Power[] = [];
  for (const entry of raw) {
    if (!isPower(entry)) return undefined;
    if (bots.includes(entry)) return undefined;
    bots.push(entry);
  }
  return bots;
};

/**
 * Read and validate the bot difficulty of a `setupData` bag.
 *
 * Rule 34.1 sets the level once per match ("in theory, players can set
 * difficulty level for each bot, but this may be hard to keep track of"), so a
 * single value covers every bot seat.  An absent or unknown value reads as the
 * default instead of refusing the match: difficulty only changes bot play, and
 * a bad token should not be able to block a table.
 */
export const parseBotDifficulty = (setupData: unknown): BotDifficulty => {
  if (setupData === null || typeof setupData !== "object" || Array.isArray(setupData)) {
    return DEFAULT_BOT_DIFFICULTY;
  }
  const raw = (setupData as Record<string, unknown>)[IE_BOT_DIFFICULTY_SETUP_KEY];
  return isBotDifficulty(raw) ? raw : DEFAULT_BOT_DIFFICULTY;
};

/** True when a `setupData` bag explicitly names a difficulty. */
export const declaresBotDifficulty = (setupData: unknown): boolean =>
  setupData !== null
  && typeof setupData === "object"
  && !Array.isArray(setupData)
  && IE_BOT_DIFFICULTY_SETUP_KEY in (setupData as Record<string, unknown>);

/** Read the difficulty of a live game state (legacy saves read as the default). */
export const botDifficultyOf = (G: {botDifficulty?: unknown} | null | undefined): BotDifficulty => {
  const raw = G?.botDifficulty;
  return isBotDifficulty(raw) ? raw : DEFAULT_BOT_DIFFICULTY;
};

/** Powers that keep a human seat in a match with this bot list. */
export const humanPowers = (bots: readonly Power[]): Power[] =>
  IE_SEATS.filter((power) => !bots.includes(power));

/**
 * Flip one seat between human and bot for the lobby's seat picker, keeping the
 * six-seat roster and returning it in printed order.
 *
 * The lobby's human minimum (`IE_MIN_HUMANS`) is enforced here because it is a
 * rule for *creating* a match: a bot list that would leave fewer humans is not
 * offered.  A live handover is not bound by it — the seat keeps playing either
 * way — so the in-match move does not use this helper.
 */
export const toggleBotSeat = (bots: readonly Power[], power: Power): Power[] => {
  const next = new Set(bots);
  if (next.has(power)) next.delete(power); else next.add(power);
  if (IE_SEATS.length - next.size < IE_MIN_HUMANS) return IE_SEATS.filter((seat) => bots.includes(seat));
  return IE_SEATS.filter((seat) => next.has(seat));
};

/** True when the lobby picker may flip `power` without breaking the human minimum. */
export const canToggleBotSeat = (bots: readonly Power[], power: Power): boolean =>
  bots.includes(power) || IE_SEATS.length - botPowersOf({bots: [...bots, power]}).length >= IE_MIN_HUMANS;

/**
 * Read the bot seats of a live game state.
 *
 * `G.bots` is the public list `engine/setup.ts` copies from `setupData`; a
 * hotseat match has no list at all.  Unknown or duplicate entries are dropped
 * instead of trusted, because the field travels over the wire.
 */
export const botPowersOf = (G: {bots?: unknown} | null | undefined): Power[] => {
  const bots = G?.bots;
  if (!Array.isArray(bots)) return [];
  const seen = new Set<Power>();
  for (const entry of bots) {
    if (isPower(entry)) seen.add(entry);
  }
  return IE_SEATS.filter((power) => seen.has(power));
};

/** True when `power` is one of the state's bot seats. */
export const isBotPower = (G: {bots?: unknown} | null | undefined, power: Power): boolean =>
  botPowersOf(G).includes(power);

/**
 * Rule 34 — hand a seat over to the bot, or take it back, during a match.
 *
 * Any seat can do this, not just the tail seats a lobby filled in: a player may
 * step out at any phase (misclick, lost connection, "play it out"), and a bot
 * seat can be reclaimed by a returning player.  The seat's own controllers learn
 * the new answer from `G.bots`, and the server driver reads the same list on its
 * next tick, so a handover is immediate and needs no restart.
 *
 * Only the seat's own client may call it: `playerID` must name the seat, which
 * is how a local hotseat board (one client per seat) and an online seat pass
 * their own id.  Nobody can force a bot onto an opponent.
 */
export const handOverSeat = (
  G: {bots?: unknown},
  playerID: string | null | undefined,
  power: Power,
  bot: boolean,
): Power[] | null => {
  if (typeof playerID !== "string" || powerSeat(power) !== playerID) return null;
  const current = botPowersOf(G);
  if (current.includes(power) === bot) return current;
  const next = bot ? botPowersOf({bots: [...current, power]}) : current.filter((seat) => seat !== power);
  G.bots = next;
  return next;
};

/**
 * The lobby's "humans + bots" split: the last `6 - humanCount` seats are bots.
 *
 * A count outside 0–6 is clamped to that range, but the *minimum* of two humans
 * is not enforced here — that is `validateIESetupData`'s job, so a table the
 * lobby must not create is refused instead of silently becoming a legal one.
 */
export const botsForHumanCount = (humanCount: number): Power[] => {
  const humans = Number.isFinite(humanCount) ? Math.trunc(humanCount) : 0;
  const clamped = Math.min(IE_SEATS.length, Math.max(0, humans));
  return IE_SEATS.slice(clamped);
};

/** Lowest seat index that is not a bot, i.e. the first joinable link. */
export const firstHumanSeat = (bots: readonly Power[]): number =>
  Math.max(0, IE_SEATS.findIndex((power) => !bots.includes(power)));

/**
 * The lobby's `validateSetupData` for Imperial Elegy.
 *
 * boardgame.io calls this before creating the match.  The engine needs all six
 * seats, so `numPlayers` must be six even when fewer humans play; the human
 * count is `6 - bots.length` and must leave room for at least two humans (a
 * table of one human and five bots is the hotseat solo entrance, not an online
 * match).
 */
export const validateIESetupData = (setupData: unknown, numPlayers: number): string | undefined => {
  if (numPlayers !== IE_SEATS.length) {
    return `Imperial Elegy always seats ${IE_SEATS.length} powers; choose 2–6 humans and let bots fill the rest.`;
  }
  const bots = parseBotPowers(setupData);
  if (bots === undefined) {
    return "Invalid bot seats: expected a list of distinct powers (GE, UK, FR, AU, RU, OT).";
  }
  if (bots.length > IE_SEATS.length - IE_MIN_HUMANS) {
    return `At most ${IE_SEATS.length - IE_MIN_HUMANS} bot seats: an online match needs at least ${IE_MIN_HUMANS} human players.`;
  }
  // A named scenario must be one of the printed ones.  An absent id reads as the
  // campaign (an older client), but a *wrong* id is a caller bug worth refusing.
  if (typeof setupData === "object" && setupData !== null) {
    const raw = (setupData as Record<string, unknown>)[IE_SCENARIO_SETUP_KEY];
    if (raw !== undefined && !isScenarioId(raw)) {
      return `Unknown scenario: expected one of ${SCENARIO_IDS.join(", ")}.`;
    }
  }
  return undefined;
};
