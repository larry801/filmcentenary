/**
 * Printed "Playable if / after / by" gates for action and home events.
 *
 * The card faces carry hard prerequisites that the engine must enforce before
 * an event can be started: A31 needs a player marker in Afghanistan, A71 needs
 * a minor-controlled Egypt, A108 needs Dreadnought to have been played, and so
 * on.  This module is the single pure predicate for those conditions; it does
 * not replace the response/combat windows, which keep their own gates in
 * `moves.ts#responseCardEligibility` and the combat-card helper.
 *
 * The "Playable by …" power lists and the "Playable after …" turn gates live
 * here too, so a board button and the move layer always agree.  `A54` is a
 * response card, so its printed turn gate is exported as
 * {@link youngTurksBlocksFailedReforms} and called from the response window.
 */
import {CardId, ImperialElegyState, Power} from "../types";
import {CARD_BY_ID} from "./deck";
import {SPACES} from "../constant/spaces";
import {flashpointController, isPower} from "./rules";

export type PlayBlockReason =
  | "unknown-card"
  | "battle-window"
  /** A printed "Playable by …" power list excludes the acting power. */
  | "power-list"
  /** A printed "(Germany only after unification)" clause. */
  | "germany-unified"
  /** A54 Failed Reforms: The Young Turks has already been played. */
  | "young-turks"
  /** A71 Urabi Revolt: Egypt must be controlled by a minor power. */
  | "egypt-minor"
  /** A108 High Seas Fleet: Dreadnought must have been played. */
  | "dreadnought"
  /** A96 Empire of the Sun: Meiji Restoration must have been played. */
  | "meiji"
  /** A103 Bosnian Crisis: the Ottomans must not control the Balkans flashpoint. */
  | "balkans-ottoman"
  /** A102 Moroccan Crisis: another player must control Morocco. */
  | "morocco-other"
  /** A70 Papal Influence: the event cannot be played after Italy unifies. */
  | "italy-unified"
  /** A31 Graveyard of Empires: a player needs a marker in Afghanistan. */
  | "afghanistan-marker"
  /** A49 South German Confederation: Bavaria must be independent and an AU ally. */
  | "bavaria-austrian"
  /** A68 The United States: blocked while the ACW is in effect. */
  | "acw"
  /** A81 Conquest of Central Asia: Russia must control Central Asia. */
  | "central-asia"
  /** A87 Mahdist War: needs an African space with a player marker. */
  | "mahdist-target"
  /** AU-8 Kaiserreich: The Dual Monarchy must have been played. */
  | "dual-monarchy"
  /** A112 Franz Ferdinand: Death of Franz Joseph must have been played. */
  | "franz-joseph";

export interface EventPlayability {
  ok: boolean;
  reason?: PlayBlockReason;
}

const OK: EventPlayability = {ok: true};
const deny = (reason: PlayBlockReason): EventPlayability => ({ok: false, reason});

/** True when a player power owns an influence or control marker in the space. */
const hasPlayerMarker = (G: ImperialElegyState, space: string): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  return isPower(state.control) || isPower(state.influence);
};

const africanPlayerMarkerSpaces = (G: ImperialElegyState): string[] =>
  Object.values(SPACES)
    .filter((def) => def.region === "africa" && hasPlayerMarker(G, def.id))
    .map((def) => def.id);

interface PowerListGate {
  /** Printed "Playable by" list (omitted = no list printed). */
  allowed?: readonly Power[];
  /** Printed exclusions ("Cannot be played by the Ottomans"). */
  denied?: readonly Power[];
  /** Printed "(Germany only after unification)" qualifier. */
  germanyAfterUnification?: boolean;
}

/**
 * Printed power restrictions, transcribed from `constant/cards.data.ts`.
 * A card absent from the table has no "Playable by / Cannot be played by"
 * clause and stays open to every power.
 */
const POWER_LIST_GATES: Partial<Record<CardId, PowerListGate>> = {
  // A34 Decline of the Qing — UK, France, Russia or Germany (after unification).
  "IE-A034": {allowed: ["UK", "FR", "RU", "GE"], germanyAfterUnification: true},
  // A36 Rebellions in China — UK, France, Russia or Germany (after unification).
  "IE-A036": {allowed: ["UK", "FR", "RU", "GE"], germanyAfterUnification: true},
  // A37 The Great Game — UK, Ottomans, France or Russia.
  "IE-A037": {allowed: ["UK", "OT", "FR", "RU"]},
  // A75 Second Industrial Revolution — cannot be played by the Ottomans.
  "IE-A075": {denied: ["OT"]},
  // A78 Crack Colonial Troops — UK, France, Russia or Germany.
  "IE-A078": {allowed: ["UK", "FR", "RU", "GE"]},
  // A41 Prussian Military Tradition — "Playable at the start of the German
  // player's impulse"; the card's other mode is a standard event during that
  // same impulse.
  "IE-A041": {allowed: ["GE"]},
  // A79 Loose Grip — UK, France or Germany (after unification).
  "IE-A079": {allowed: ["UK", "FR", "GE"], germanyAfterUnification: true},
  // A88 Our Place in the Sun — UK, France, Russia or Germany (after unification).
  "IE-A088": {allowed: ["UK", "FR", "RU", "GE"], germanyAfterUnification: true},
  // A110 Extreme Militarism — cannot be played by the UK.
  "IE-A110": {denied: ["UK"]},
};

/** Apply the printed power list; `null` means the power may play the event. */
const powerListBlock = (G: ImperialElegyState, power: Power, cardId: CardId): PlayBlockReason | null => {
  const gate = POWER_LIST_GATES[cardId];
  if (gate === undefined) return null;
  if (gate.allowed !== undefined && !gate.allowed.includes(power)) return "power-list";
  if (gate.denied !== undefined && gate.denied.includes(power)) return "power-list";
  if (gate.germanyAfterUnification && power === "GE" && G.powers.GE.unified !== true) {
    return "germany-unified";
  }
  return null;
};

/**
 * A70 Papal Influence is printed "Playable by France and Austria; event cannot
 * be played after Italy unifies."  The unification check comes first so the
 * more specific printed reason wins.
 */
const papalInfluenceBlock = (G: ImperialElegyState, power: Power): PlayBlockReason | null => {
  if (G.persistent.italyUnified === true) return "italy-unified";
  if (power !== "FR" && power !== "AU") return "power-list";
  return null;
};

/**
 * GW-10 Exhaustion is printed "Neither event triggers on GW turn 0."  The card
 * is a mandatory GW event, so it stays playable (27.3 requires it to be played
 * at some point in the turn and grants its bonus CP); only the trigger is
 * gated.  The live effect consults this predicate and the board shows the
 * printed reason on the card.
 */
export const gwExhaustionTurnZero = (G: ImperialElegyState): boolean => (G.gw?.turn ?? 0) === 0;

/** The one printed "no effect" hint a Great War card face can show today. */
export type GwEventHint = "gw-turn-0";

export const gwEventHint = (G: ImperialElegyState, cardId: CardId): GwEventHint | null =>
  cardId === "IE-GW-10" && gwExhaustionTurnZero(G) ? "gw-turn-0" : null;

/**
 * A54 Failed Reforms is printed "Cannot be played after The Young Turks".
 * A106 is a mandatory card, so once it resolves there is no way back into the
 * earlier window.
 */
export const youngTurksBlocksFailedReforms = (G: ImperialElegyState, cardId: CardId): boolean =>
  cardId === "IE-A054" && G.persistent.youngTurks === true;

/**
 * A70 Papal Influence is also printed "Remove from the game if played for CP
 * and Italy is unified."  The CP path is not an event, so the removal is a
 * separate predicate from {@link eventPlayability}.
 */
export const removeAfterCpPlay = (G: ImperialElegyState, cardId: CardId): boolean =>
  cardId === "IE-A070" && G.persistent.italyUnified === true;

/**
 * The printed event prerequisites, keyed by card id.  Every card that can be
 * started through `playCard(..., "event")` is covered; cards without a hard
 * condition (only a "Playable by" power list) are checked through
 * {@link POWER_LIST_GATES} and always pass when their list includes the power.
 */
export const eventPlayability = (
  G: ImperialElegyState,
  power: Power,
  cardId: CardId,
): EventPlayability => {
  const card = CARD_BY_ID[cardId];
  if (card === undefined) return deny("unknown-card");
  // A41 is the one printed response that also allows a normal-event play
  // ("This can also be played as a standard event during your impulse"), so it
  // keeps its event mode; every other response/combat card is battle-window
  // only.
  if ((card.type === "response" || card.type === "combat") && cardId !== "IE-A041") {
    return deny("battle-window");
  }

  // Specific printed conditions (and their more precise reason codes) come
  // before the power lists: a GE player attempting A70 after unification sees
  // "Italy is already unified", not the generic power-list reason.
  if (cardId === "IE-A070") {
    const reason = papalInfluenceBlock(G, power);
    return reason === null ? OK : deny(reason);
  }
  const listReason = powerListBlock(G, power, cardId);
  if (listReason !== null) return deny(listReason);

  switch (cardId) {
    case "IE-A031":
      return hasPlayerMarker(G, "afghanistan") ? OK : deny("afghanistan-marker");
    case "IE-A049": {
      const bavaria = G.spaces.bavaria;
      const independent = bavaria?.control === "Bavaria";
      return independent && bavaria?.ally === "AU" ? OK : deny("bavaria-austrian");
    }
    case "IE-A068":
      return G.persistent.acw === true || G.persistent.csaIndependent === true
        ? deny("acw")
        : OK;
    case "IE-A071": {
      const control = G.spaces.egypt?.control ?? null;
      return control !== null && !isPower(control) ? OK : deny("egypt-minor");
    }
    case "IE-A081":
      return G.spaces["central-asia"]?.control === "RU" ? OK : deny("central-asia");
    case "IE-A087":
      return africanPlayerMarkerSpaces(G).length > 0 ? OK : deny("mahdist-target");
    case "IE-A096":
      return G.persistent.meiji === true || G.flags.meiji === true ? OK : deny("meiji");
    case "IE-A102": {
      const control = G.spaces.morocco?.control ?? null;
      return isPower(control) && control !== power ? OK : deny("morocco-other");
    }
    case "IE-A103":
      return flashpointController(G, "balkans").includes("OT") ? deny("balkans-ottoman") : OK;
    case "IE-A108":
      return G.persistent.dreadnoughts === true ? OK : deny("dreadnought");
    case "IE-A112":
      return G.persistent.franzJosephDead === true ? OK : deny("franz-joseph");
    case "IE-H-AU-8":
      return G.persistent.dualMonarchyPlayed === true || G.persistent.dualMonarchy === true
        ? OK
        : deny("dual-monarchy");
    default:
      return OK;
  }
};

/** Convenience boolean form for board controls and quick checks. */
export const canPlayEvent = (G: ImperialElegyState, power: Power, cardId: CardId): boolean =>
  eventPlayability(G, power, cardId).ok;
