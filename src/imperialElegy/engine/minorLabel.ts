/**
 * Display names for a non-player power (a minor) inside engine-built text.
 *
 * A minor is stored by its own name ("Qing China", "Bavaria", …), and several
 * decisions and log lines quote it.  The home space of a minor carries the
 * bilingual name, so the engine can name it in either language without the
 * board's helper module (the engine must not import from `components/`).
 */
import {SPACES, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";

/** A minor's name in one language; an unknown minor prints as it is stored. */
export const minorLabel = (minor: string, locale: "en" | "zh_CN"): string => {
  if (minor === "") return locale === "zh_CN" ? "一个中立方" : "a minor power";
  // The German-unification realignment treats several minors as one group.
  if (minor === "German minors") return locale === "zh_CN" ? "德意志诸小国" : "the German minors";
  const home = MINOR_POWER_HOMES[minor];
  if (home !== undefined && SPACES[home] !== undefined) return spaceLabel(home, locale);
  return minor;
};
