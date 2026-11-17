/**
 * 4.8 / 12.5.3 / 12.8 / 12.9 foreign-affairs markers.
 *
 * The board used to decide "can a diplomacy marker go here?" on its own while
 * `placeDiplomacy` decided again, and the two disagreed: the panel only tested
 * `control === null`, so every player power's own home space (Berlin, London,
 * Paris …) offered a legal row that the engine then refused — 392 such rows at
 * campaign start.  The fix is structural rather than a patched condition: the
 * printed legality lives in this module once, as a reason code, and both the
 * move and the Orders panel read it.  A code the panel does not translate is a
 * compile error, so the two cannot drift apart again.
 *
 *  12.5.3 "Diplomacy markers can only be placed in minor power spaces. Only one
 *          player can have a diplomacy marker in a given space. If a minor
 *          power controls multiple spaces, place the marker in the space that
 *          shares the name of the minor power … if the minor power controls
 *          that space. Otherwise the player decides."
 *    • Italy   — normal before unification; no marker once unified.
 *    • Qing    — "Players cannot place diplomacy markers in Qing spaces."
 *    • The South — only while the American Civil War is in effect.
 *  5.6 lists LoCs only for "placing influence markers"; 12.5.3 prints no LoC
 *  requirement for diplomacy, so this path does not trace one.
 *  12.8 "A player may place an ally marker with a minor power provided they
 *          already have a diplomacy marker on that minor power. Each minor
 *          power can only be allied with one player."
 *  12.9 "Flip any one ally marker on a minor power to its diplomacy side."
 *          Any player may do it, and it flips to its diplomacy *side* — the
 *          older marker therefore keeps the player it belonged to.
 *
 * 4.6.2 is why the US and a unified Italy are not minor powers, and 3.4.6 is
 * why Japan takes no marker before Meiji Restoration.
 */
import type {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, isNavalBox} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {isIndependentIndia} from "./characteristics";
import {hasLoc, isMinorPowerOwner, isPower, minorAlliesOf, minorController} from "./rules";

/** Why a diplomacy marker cannot be placed in a space, or null when it can. */
export type DiplomacyProblem =
  | "unknown-space"
  /** 33.2.2: India cannot be controlled or marked by anyone once independent. */
  | "independent-india"
  /** 12.5.3: "Only one player can have a diplomacy marker in a given space." */
  | "already-marked"
  /** 12.5.3 + 4.6.2: players, the US and a unified Italy are not minor powers. */
  | "not-minor-power"
  /** 12.5.3: "Players cannot place diplomacy markers in Qing spaces." */
  | "qing-china"
  /** 12.5.3: the South is only in play during the American Civil War. */
  | "the-south"
  /** 3.4.6: Japan enters play through Meiji Restoration. */
  | "japan-not-in-play"
  /** 12.5.3: when the minor holds its namesake space, the marker goes there. */
  | "minor-home-space";

/** True once Meiji Restoration has been played (3.4.6). */
export const japanInPlay = (G: ImperialElegyState): boolean =>
  G.persistent.meiji === true || G.flags.meiji === true;

/**
 * Why an influence marker cannot be placed, or null when it can.  12.5.1:
 * "Influence markers can only be placed in uncontrolled spaces. A LoC is
 * required … Only one player can have an influence marker in a given space."
 * 12.5.2 caps each player at one African marker until the Berlin Conference.
 */
export type InfluenceProblem =
  | "unknown-space"
  | "independent-india"
  /** 12.5.1 / 4.7.2: influence lives in an uncontrolled *space*, not a sea box. */
  | "naval-box"
  | "already-controlled"
  | "already-influenced"
  | "africa-limit"
  | "no-loc";

export const influencePlacementProblem = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): InfluenceProblem | null => {
  if (SPACES[space] === undefined || G.spaces[space] === undefined) return "unknown-space";
  if (isIndependentIndia(G, space)) return "independent-india";
  // 4.7.2 defines "uncontrolled spaces" as the purple flagless *land* spaces;
  // a naval box is never controlled and never takes a control marker, so it is
  // not somewhere influence can be placed.
  if (isNavalBox(space)) return "naval-box";
  const state = G.spaces[space];
  if (state.control !== null) return "already-controlled";
  if ((state.influence ?? null) !== null) return "already-influenced";
  // 12.5.2: "each player can only have 1 influence marker on the Africa submap"
  // until Berlin.  The note about North Africa means the main-map Egyptian and
  // Tripolitanian spaces are exempt; `submap === "africa"` is exactly the
  // submap those spaces are not on.
  if (G.persistent.berlinConference !== true && SPACES[space].submap === "africa") {
    const african = Object.values(SPACES).filter(
      (def) => def.submap === "africa" && G.spaces[def.id]?.influence === power,
    ).length;
    if (african >= 1) return "africa-limit";
  }
  // 5.6: a LoC is required for influence (and for nothing else in this file).
  if (!hasLoc(G, power, space)) return "no-loc";
  return null;
};

/** True while the American Civil War event is in effect (#32 / 12.5.3). */
export const americanCivilWarInEffect = (G: ImperialElegyState): boolean =>
  G.persistent.acw === true;

/**
 * 12.5.3: the space a minor's marker must sit on when that minor still controls
 * the space sharing its name.  Egypt's namesake is `egypt`, so its marker may
 * not be dropped on Sinai or the Great Sand Sea while Egypt holds Egypt.
 */
export const minorNamesakeSpace = (G: ImperialElegyState, minor: string): SpaceId | null => {
  const mapped = MINOR_POWER_HOMES[minor];
  if (mapped !== undefined && G.spaces[mapped]?.control === minor) return mapped;
  // A minor that gained independence during play (Poland, Ireland) carries an
  // `independentHome` stamp instead of a `MINOR_POWER_HOMES` row, so its
  // namesake is the space that was liberated.
  for (const [id, state] of Object.entries(G.spaces)) {
    if (state.control === minor && state.independentHome?.power === minor) return id;
  }
  // Otherwise fall back to the space that prints the minority's own flag.
  for (const [id, def] of Object.entries(SPACES)) {
    if (def.minorHome === minor && G.spaces[id]?.control === minor) return id;
  }
  return null;
};

/** 4.6.2 + 12.5.3: does a *minor* power control this space right now? */
export const isMinorPowerSpace = (G: ImperialElegyState, space: SpaceId): boolean => {
  const control = G.spaces[space]?.control;
  return control !== null && control !== undefined && isMinorPowerOwner(control);
};

export const diplomacyPlacementProblem = (
  G: ImperialElegyState,
  space: SpaceId,
): DiplomacyProblem | null => {
  if (SPACES[space] === undefined || G.spaces[space] === undefined) return "unknown-space";
  if (isIndependentIndia(G, space)) return "independent-india";
  const state = G.spaces[space];
  // 12.5.3: one marker per space, whoever it belongs to.
  if ((state.diplomacy ?? null) !== null) return "already-marked";
  // 12.5.3's special cases come before the general minor-power test: the South
  // is a US space, and Japan is a minor power that is simply not in play yet.
  if (space === "the-south") return americanCivilWarInEffect(G) ? null : "the-south";
  if (space === "japan" && !japanInPlay(G)) return "japan-not-in-play";
  // Qing China is "all spaces containing the Qing flag".
  if (SPACES[space].minorHome === "Qing China") return "qing-china";
  if (!isMinorPowerSpace(G, space)) return "not-minor-power";
  const minor = state.control as string;
  const namesake = minorNamesakeSpace(G, minor);
  if (namesake !== null && namesake !== space) return "minor-home-space";
  return null;
};

/** Why a minor alliance cannot be placed, or null when it can. */
export type MinorAllianceProblem =
  | "unknown-space"
  | "independent-india"
  | "not-minor-power"
  | "needs-diplomacy"
  | "allied-elsewhere"
  | "already-allied"
  | "ally-limit";

export const minorAllianceProblem = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): MinorAllianceProblem | null => {
  if (SPACES[space] === undefined || G.spaces[space] === undefined) return "unknown-space";
  if (isIndependentIndia(G, space)) return "independent-india";
  const state = G.spaces[space];
  // 12.8: the alliance grows out of this player's own diplomacy marker.
  if ((state.diplomacy ?? null) !== power) return "needs-diplomacy";
  if (!isMinorPowerSpace(G, space)) return "not-minor-power";
  const minor = state.control as string;
  // 12.8: "Each minor power can only be allied with one player."  A marker in
  // another space of the same minor is the same alliance.
  const controller = minorController(G, minor);
  if (controller !== null && controller !== power) return "allied-elsewhere";
  if ((state.ally ?? null) !== null) return "already-allied";
  if (minorAlliesOf(G, power).length >= 5) return "ally-limit";
  return null;
};

/** Why an ally marker cannot be flipped back, or null when it can. */
export type RemoveAllianceProblem = "unknown-space" | "no-ally";

export const removeMinorAllianceProblem = (
  G: ImperialElegyState,
  space: SpaceId,
): RemoveAllianceProblem | null => {
  if (SPACES[space] === undefined || G.spaces[space] === undefined) return "unknown-space";
  return (G.spaces[space].ally ?? null) === null ? "no-ally" : null;
};

/**
 * 12.9.1 Naval Supremacy: "Players may conduct the remove alliance action for
 * 3 CP in port spaces adjacent to a naval box where they have more naval units
 * than the player allied to the minor power."
 *
 * So the marker's own space must be a port space, and at least one of the
 * naval boxes that port touches must hold strictly more of `power`'s naval
 * units than the allied player's.  A landlocked minor (Bavaria, Saxony) never
 * qualifies and always pays the printed 4 CP.
 */
export const navalSupremacyPort = (G: ImperialElegyState, power: Power, space: SpaceId): SpaceId | null => {
  const state = G.spaces[space];
  if (state === undefined) return null;
  const boxes = SPACES[space]?.ports ?? [];
  if (boxes.length === 0) return null;
  const ally = state.ally;
  if (!isPower(ally)) return null;
  for (const box of boxes) {
    const naval = G.spaces[box]?.units ?? [];
    let mine = 0;
    let theirs = 0;
    for (const id of naval) {
      const owner = G.units[id]?.owner;
      if (owner === power) mine += 1;
      else if (owner === ally) theirs += 1;
    }
    if (mine > theirs) return box;
  }
  return null;
};

/**
 * The CP a remove-alliance action costs here: 3 CP under 12.9.1's naval
 * supremacy, otherwise 12.9's printed 4 CP.
 */
export const removeAllianceCost = (G: ImperialElegyState, power: Power, space: SpaceId): number =>
  navalSupremacyPort(G, power, space) === null ? 4 : 3;

/** Why an influence/diplomacy marker cannot be removed, or null. */
export type RemoveMarkerProblem =
  | "unknown-space"
  | "no-own-marker"
  | "africa-after-berlin"
  | "foreign-unit-present";

/**
 * 12.6: "Players are allowed to remove their own markers using this action.
 * Players cannot remove influence in a space that contains a unit belonging to
 * another player. Exception: After the Berlin Conference event is played,
 * players cannot remove influence in Africa."  Both restrictions are printed
 * against influence, so removing a diplomacy marker has neither.
 */
export const removeMarkerProblem = (
  G: ImperialElegyState,
  power: Power,
  space: SpaceId,
): RemoveMarkerProblem | null => {
  if (SPACES[space] === undefined || G.spaces[space] === undefined) return "unknown-space";
  const state = G.spaces[space];
  const removingInfluence = state.influence === power;
  const removingDiplomacy = state.diplomacy === power;
  if (!removingInfluence && !removingDiplomacy) return "no-own-marker";
  if (!removingInfluence) return null;
  if (G.persistent.berlinConference === true && SPACES[space].submap === "africa") {
    return "africa-after-berlin";
  }
  // "a unit belonging to another player": the acting power's own units are fine.
  const foreignUnit = state.units.some((id) => {
    const owner = G.units[id]?.owner;
    return owner !== undefined && isPower(owner) && owner !== power;
  });
  return foreignUnit ? "foreign-unit-present" : null;
};
