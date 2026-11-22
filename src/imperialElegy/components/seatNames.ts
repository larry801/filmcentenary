/**
 * The printed name of a great power, for the panels that print one.
 *
 * A047 The Dual Monarchy turns "The Austrian Empire" into "The
 * Austro-Hungarian Empire" (`cards.data.ts`), and the rulebook abbreviation
 * reads "AU - Austria/Austria-Hungary".  The 1850 opening is therefore the
 * Austrian Empire, not Austria-Hungary: the seat name printed on the strip, the
 * player mat and the solo page has to follow the state (or, before a match
 * exists, the scenario's opening decade).
 */
import type {ImperialElegyState, Power} from "../types";
import type {ScenarioId} from "../constant/scenarios";
import type {IELocale, IEStrings} from "./i18n";

export interface AuNames {
  formed: {en: string; zh_CN: string};
  empire: {en: string; zh_CN: string};
}

/** The two AU names; kept beside the helper so every caller prints the same pair. */
export const AU_NAMES: AuNames = {
  formed: {en: "Austria-Hungary", zh_CN: "奥匈帝国"},
  empire: {en: "Austrian Empire", zh_CN: "奥地利帝国"},
};

/** True once A047 (or a later decade) has made the Dual Monarchy historical fact. */
export const auFormedForState = (G: ImperialElegyState): boolean => {
  const p = G.persistent as Record<string, unknown> | undefined;
  if (p?.dualMonarchyPlayed === true || p?.dualMonarchy === true) return true;
  if (G.powers?.AU?.citizenship?.includes("Hungarians") === true) return true;
  if (G.gw) return true;
  // 1850s/1860s are before the 1867 Compromise; every later printed decade is
  // after it, so a campaign that has advanced has formed the Dual Monarchy.
  return typeof G.decade === "string" && G.decade >= "1870s";
};

/**
 * The scenario a setup screen is about to deal, for the same question.
 *
 * The two 1850 openings (the campaign's first turn and the 1850 tutorial) are
 * the Austrian Empire; every scenario printed from 1870 onward is
 * Austria-Hungary.  A live match uses `auFormedForState` instead.
 */
export const auFormedForScenario = (scenario: ScenarioId): boolean =>
  scenario !== "campaign" && scenario !== "tutorial1850";

/** A seat's printed name in the UI language. */
export const seatPowerName = (
  t: IEStrings,
  power: Power,
  locale: IELocale,
  auFormed: boolean,
): string => {
  if (power !== "AU") return t.seats[power];
  const names = auFormed ? AU_NAMES.formed : AU_NAMES.empire;
  return locale === "en" ? names.en : names.zh_CN;
};
