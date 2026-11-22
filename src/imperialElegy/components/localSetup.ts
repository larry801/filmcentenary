/**
 * The local (hotseat / solo) entrance's saved setup.
 *
 * The boardgame.io `Local()` master deals the match on demand with
 * `setupData: undefined`, so neither the scenario nor the bot seats can travel
 * through the normal online setup bag.  They live in `localStorage` instead,
 * written by the setup screens (`local.tsx`, `solo.tsx`) and read once when the
 * shell mounts.  Keeping the keys and the parsing in one module means the seat
 * setup screen and the solo page cannot disagree about where a choice is kept.
 */
import {POWERS, Power} from "../types";
import {ScenarioId, scenarioFromSetupData, SCENARIOS} from "../constant/scenarios";
import {BotDifficulty, DEFAULT_BOT_DIFFICULTY, IE_NO_GW_LABEL} from "../configuration";
import type {IELocale, IEStrings} from "./i18n";

/** Storage key for the bot-seat configuration. */
export const BOT_SEATS_KEY = "ie_local_bot_seats";

/** Storage key for the hotseat scenario choice (`IE_playbook.pdf` pp. 3-10). */
export const SCENARIO_KEY = "ie_local_scenario";

/** Storage key for Scenario 4's "No GW" modifier. */
export const NO_GW_KEY = "ie_local_no_gw";

/** Storage key for the single power a solo match hands to the player. */
export const SOLO_POWER_KEY = "ie_local_solo_power";

/** Storage key for Rule 34.1's single difficulty level for this match's bots. */
export const BOT_DIFFICULTY_KEY = "ie_local_bot_difficulty";

export const loadScenario = (): ScenarioId => {
  try {
    return scenarioFromSetupData(localStorage.getItem(SCENARIO_KEY));
  } catch {/* ignore */}
  return "campaign";
};

/** 34.1: the saved bot difficulty, or the rulebook default. */
export const loadBotDifficulty = (): BotDifficulty => {
  try {
    const raw = localStorage.getItem(BOT_DIFFICULTY_KEY);
    return raw === "easy" || raw === "normal" || raw === "hard" ? raw : DEFAULT_BOT_DIFFICULTY;
  } catch {/* ignore */}
  return DEFAULT_BOT_DIFFICULTY;
};

export const loadNoGw = (): boolean => {
  try {
    return localStorage.getItem(NO_GW_KEY) === "1";
  } catch {/* ignore */}
  return false;
};

export const loadBotSeats = (): Set<Power> => {
  try {
    const raw = localStorage.getItem(BOT_SEATS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      return new Set(arr.filter((p): p is Power => (POWERS as readonly string[]).includes(p)));
    }
  } catch {/* ignore */}
  return new Set();
};

export const saveBotSeats = (seats: ReadonlySet<Power>): void => {
  try {
    localStorage.setItem(BOT_SEATS_KEY, JSON.stringify([...seats]));
  } catch {/* ignore */}
};

/**
 * The power the player took for a solo match, if a solo match was started.
 *
 * The dedicated match page uses it to build the one visible board and to name
 * the five headless bot seats.  A hotseat match ignores it.
 */
export const loadSoloPower = (): Power | null => {
  try {
    const raw = localStorage.getItem(SOLO_POWER_KEY);
    return (POWERS as readonly string[]).includes(raw ?? "") ? raw as Power : null;
  } catch {/* ignore */}
  return null;
};

/** The five bot seats of a solo match: every power but the one the player took. */
export const soloBotSeats = (power: Power): Set<Power> =>
  new Set<Power>(POWERS.filter((candidate) => candidate !== power));


/**
 * The setup bag a solo match hands the engine.
 *
 * Rule 34: the five seats the player does not take are bots, and the engine has
 * to be told so (`G.bots`) or 34.1's bot NG counts and 34.4.5's free bot
 * redeployment never apply.  34.1: one difficulty covers every bot seat.
 */
export const soloSetupData = (
  power: Power,
  scenario: ScenarioId,
  noGw: boolean,
  botDifficulty: BotDifficulty,
): {scenario: ScenarioId; noGw?: true; botDifficulty: BotDifficulty; bots: Power[]} => ({
  scenario,
  ...(noGw ? {noGw: true as const} : {}),
  botDifficulty,
  bots: [...soloBotSeats(power)],
});

/**
 * Record everything the local shell needs to deal the chosen solo match.
 *
 * The other five seats are bots, and the chosen power becomes the first seat
 * shown.  Called by the solo page immediately before it navigates to the shell.
 */
export const saveSoloSetup = (
  power: Power,
  scenario: ScenarioId,
  noGw: boolean,
  difficulty: BotDifficulty = DEFAULT_BOT_DIFFICULTY,
): void => {
  saveBotSeats(soloBotSeats(power));
  try {
    localStorage.setItem(SOLO_POWER_KEY, power);
    localStorage.setItem(SCENARIO_KEY, scenario);
    localStorage.setItem(NO_GW_KEY, noGw ? "1" : "0");
    localStorage.setItem(BOT_DIFFICULTY_KEY, difficulty);
  } catch {/* ignore */}
};

/** Persist a seat-setup screen's choices (the multi-seat hotseat path). */
export const saveMatchSetup = (scenario: ScenarioId, noGw: boolean): void => {
  try {
    localStorage.setItem(SCENARIO_KEY, scenario);
    localStorage.setItem(NO_GW_KEY, noGw ? "1" : "0");
  } catch {/* ignore */}
};

/**
 * `?solo=1` opens the seat-setup screen first; plain `/localIE` starts at once.
 * The dedicated solo page (`/localIE/solo`) does not use this flag.
 */
export const wantsSeatSetup = (search: string): boolean =>
  new URLSearchParams(search).get("solo") === "1";

/**
 * The fresh-match nonce a hotseat entrance may pass to the shell.
 *
 * The dedicated solo page no longer uses this: it owns its own match id.  The
 * hotseat shell still folds a supplied stamp into its `matchID` so an older
 * `?fresh=<stamp>` link cannot resume the previous match.
 */
export const loadFreshNonce = (search: string): number => {
  const raw = Number(new URLSearchParams(search).get("fresh"));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
};

/** The dedicated solo match page that deals the setup just saved. */
export const SOLO_MATCH_PATH = "/localIE/solo/play";
export const soloMatchPath = (): string => SOLO_MATCH_PATH;

/**
 * The display name of a Rule 34.1 difficulty level.
 *
 * Kept next to the saved setup so the solo page, the local shell and the bot
 * badge all print the same three words.
 */
export const botDifficultyLabel = (
  difficulty: BotDifficulty,
  locale: IELocale,
): string => {
  const labels: Record<BotDifficulty, {en: string; zh_CN: string}> = {
    easy: {en: "Easy", zh_CN: "简单"},
    normal: {en: "Normal", zh_CN: "普通"},
    hard: {en: "Hard", zh_CN: "困难"},
  };
  return labels[difficulty][locale];
};

/**
 * The scenario line, Scenario-4 availability, the seat setup and the hand-over
 * stamp are all read from `localStorage` and the URL.  They are gathered in one
 * read so the shell's initial state describes one coherent setup instead of
 * three independent lookups that could disagree.
 */
export interface ILocalSetup {
  botSeats: Set<Power>;
  /** The seat the shell opens on. */
  tabIndex: number;
  /** The optional fresh-match stamp of a hotseat visit. */
  fresh: number;
  scenario: ScenarioId;
  noGw: boolean;
  /** 34.1: the match's one bot difficulty level. */
  botDifficulty: BotDifficulty;
  /** True when `?solo=1` asks for the multi-seat setup screen first. */
  showSetup: boolean;
}

/**
 * Read the whole local setup for one shell mount.
 *
 * `?solo=1` is the old seat-setup entrance: with nothing saved it pre-selects
 * P2–P6 as bots and leaves P1 for the person at the keyboard.  The dedicated
 * solo pages (`/localIE/solo` and `/localIE/solo/play`) do not use this read:
 * they derive every seat from the saved solo power.
 */
export const readLocalSetup = (search: string): ILocalSetup => {
  const fresh = loadFreshNonce(search);
  const showSetup = wantsSeatSetup(search);
  const saved = loadBotSeats();
  const botSeats = saved.size > 0
    ? saved
    : showSetup ? new Set<Power>(POWERS.slice(1)) : new Set<Power>();
  // A saved setup can make P1 a bot; opening a read-only bot board would look
  // like a broken match, so fall back to the first seat a person owns.
  const firstHuman = POWERS.findIndex((power) => !botSeats.has(power));
  const tabIndex = firstHuman < 0 ? 0 : firstHuman;
  return {
    botSeats,
    tabIndex,
    fresh,
    scenario: loadScenario(),
    noGw: loadNoGw(),
    botDifficulty: loadBotDifficulty(),
    showSetup,
  };
};

/**
 * A one-line summary of a chosen scenario, shared by the hotseat seat-setup
 * screen and the solo page so both describe the same printed setup.
 */
export const scenarioSummary = (
  scenario: ScenarioId,
  noGw: boolean,
  locale: IELocale,
  t: IEStrings,
): string => {
  const def = SCENARIOS[scenario];
  const turns = def.firstTurn === def.lastTurn ? `${def.firstTurn}` : `${def.firstTurn}-${def.lastTurn}`;
  const vp = def.special.countVp ? t.scenarioCountsVp : t.scenarioNoVp;
  const gw = def.special.gwTutorial || def.special.altGw ? ` · ${t.scenarioStartsInGw}` : "";
  const noGwLabel = noGw ? ` · ${locale === "en" ? IE_NO_GW_LABEL.en : IE_NO_GW_LABEL.zh_CN}` : "";
  return `${t.scenarioTurns} ${turns} · ${vp}${gw}${noGwLabel}`;
};

/**
 * Whether a printed scenario offers Scenario 4's "No GW" modifier.
 *
 * The playbook applies the modifier to "whichever scenario you wish to play",
 * but the two tutorials print their own victory checks (`allowsNoGw: false`),
 * so the toggle is hidden rather than silently ignored.
 */
export const scenarioAllowsNoGw = (scenario: ScenarioId): boolean =>
  SCENARIOS[scenario].special.allowsNoGw !== false;
