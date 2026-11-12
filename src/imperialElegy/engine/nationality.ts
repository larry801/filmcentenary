/**
 * Imperial Elegy — core and minority nationalities.
 *
 * The map prints a flag for every space that contains a distinct nationality
 * (rule 3.2.6).  A nationality is *minority* only in relation to the power
 * that controls the space: "Germans" in Berlin are the German core, while
 * "Poles" in Russian Poland are a minority.  This module centralises that
 * comparison so card handlers can ask a single question instead of treating
 * any printed flag as a minority.
 *
 * Everything here is pure: the helpers read `SPACES` / `G.spaces` and return
 * values without touching game state.  The caller remains responsible for
 * applying the effects (rebellions, stability loss, card discards, ...).
 */

import {ImperialElegyState, Power, PowerOrMinor, POWERS, SpaceId} from "../types";
import {SPACES, isNavalBox} from "../constant/spaces";
import {AU_NATIONALITIES} from "./characteristics";

/**
 * The nationalities each player power treats as its own people.
 *
 * These are the flags that do *not* make a space a minority-nationality
 * target for that power.  The UK is deliberately limited to the British /
 * English / Scots core of Great Britain: the Irish and Welsh flags are
 * minority nationalities for Nationalist Uprising purposes.  Austria-Hungary
 * counts both Austrians and Hungarians as core (the Dual Monarchy); the other
 * rule-33.4.1 nationalities remain minorities.
 */
export const CORE_NATIONALITIES: Record<Power, string[]> = {
  GE: ["Germans"],
  UK: ["British", "English", "Scots"],
  FR: ["French"],
  AU: ["Austrians", "Hungarians"],
  RU: ["Russians"],
  OT: ["Turks", "Arabs"],
};

const isPlayerPower = (value: unknown): value is Power =>
  typeof value === "string" && (POWERS as readonly string[]).includes(value);

const printedNationalities = (spaceId: SpaceId): readonly string[] =>
  SPACES[spaceId]?.nationalities ?? [];

const AU_CITIZENSHIP_NATIONALITIES = AU_NATIONALITIES as readonly string[];

/** Core nationalities of a player power (a copy, so callers cannot mutate the table). */
export const coreNationalitiesOf = (power: Power): string[] => [
  ...(CORE_NATIONALITIES[power] ?? []),
];

/** True when `nationality` is one of `power`'s core nationalities. */
export const isCoreNationality = (power: Power, nationality: string): boolean =>
  CORE_NATIONALITIES[power]?.includes(nationality) ?? false;

/**
 * Nationalities printed in `spaceId` that are not core to `controller`.
 *
 * A minor power, an independent space (`null`) or an unknown controller owns
 * no core nationalities in this model, so every printed nationality is
 * returned for them.  Spaces without a printed flag return an empty array.
 */
export const minorityNationalities = (
  spaceId: SpaceId,
  controller: PowerOrMinor | null | undefined,
): string[] => {
  const printed = printedNationalities(spaceId);
  if (!isPlayerPower(controller)) return [...printed];
  const core = CORE_NATIONALITIES[controller];
  return printed.filter((nationality) => !core.includes(nationality));
};

/** True when the space contains at least one minority nationality for the controller. */
export const isMinorityNationalitySpace = (
  spaceId: SpaceId,
  controller: PowerOrMinor | null | undefined,
): boolean => minorityNationalities(spaceId, controller).length > 0;

/**
 * Spaces that Nationalist Uprising may target: land spaces directly controlled
 * by a player power and containing a minority nationality of that controller.
 * Naval boxes are never eligible, even if a nationality were printed on one.
 *
 * Minor-power allies are excluded on purpose: the card requires a space
 * "controlled by a player", and a minor ally's home is not player control.
 */
export const eligibleNationalistUprisingSpaces = (G: ImperialElegyState): SpaceId[] =>
  Object.values(SPACES)
    .filter((space) => {
      if (isNavalBox(space.id)) return false;
      const state = G.spaces[space.id];
      if (!state || !isPlayerPower(state.control)) return false;
      return isMinorityNationalitySpace(space.id, state.control);
    })
    .map((space) => space.id);

/**
 * Whether `spaceId` can support `nationality` for a power's citizenship
 * achievements (AU "Bind Them Together" and "A New Way Forward").
 *
 * The space must print the nationality, and the nationality must be one the
 * power can naturalise: a core nationality, or — for Austria-Hungary — one of
 * the eight nationalities of rule 33.4.1.  Hungarians therefore match through
 * the core list; Czechs, Poles, Croats, etc. match through the AU list; and
 * Germans match neither, so a German space cannot count for an Austrian
 * citizenship goal.  Control of the space is checked by the caller.
 */
export const citizenshipMatchesSpace = (
  power: Power,
  nationality: string,
  spaceId: SpaceId,
): boolean => {
  if (!printedNationalities(spaceId).includes(nationality)) return false;
  if (isCoreNationality(power, nationality)) return true;
  return power === "AU" && AU_CITIZENSHIP_NATIONALITIES.includes(nationality);
};

/**
 * Unique AU citizenships backed by at least one AU-controlled space.
 *
 * A citizenship entry alone is not enough: the nationality must also have a
 * matching AU-controlled space (rule 33.4.1 / Bind Them Together and "A New
 * Way Forward").  Duplicate entries in `G.powers.AU.citizenship` count once.
 */
export const matchedAuCitizenshipCount = (G: ImperialElegyState): number =>
  new Set(
    G.powers.AU.citizenship.filter((nationality) =>
      Object.values(SPACES).some(
        (space) =>
          G.spaces[space.id]?.control === "AU" &&
          citizenshipMatchesSpace("AU", nationality, space.id),
      ),
    ),
  ).size;

/** 33.4.1 — the AU persistent marker that latches "A New Way Forward" once. */
export const AU_NEW_WAY_FORWARD = "auNewWayForward";

/**
 * 33.4 "A New Way Forward": "+1 manpower when 4 nationalities have citizenship
 * ... AU gains this manpower during the end phase, this is a one time bonus."
 * The grant is latched the first time the end phase sees four matched
 * citizenships; later recomputations keep the +1 even if AU later loses a
 * nationality or its matching space.
 */
export const grantAuNewWayForward = (G: ImperialElegyState): boolean => {
  if (G.persistent[AU_NEW_WAY_FORWARD] === "granted") return false;
  if (matchedAuCitizenshipCount(G) < 4) return false;
  G.persistent[AU_NEW_WAY_FORWARD] = "granted";
  return true;
};

/** True when the latched A New Way Forward bonus applies. */
export const auNewWayForwardGranted = (G: ImperialElegyState): boolean =>
  G.persistent[AU_NEW_WAY_FORWARD] === "granted";
