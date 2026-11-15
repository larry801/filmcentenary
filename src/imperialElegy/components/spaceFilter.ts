import {Region, SpaceId} from "../types";
import {SPACES, SPACE_IDS, spaceLabel} from "../constant/spaces";

/** How the space chooser narrows its 145 entries. */
export interface SpaceFilter {
  search: string;
  region: Region | "all";
  onlyTargets: boolean;
  targets: readonly SpaceId[];
}

/**
 * Filter the space catalogue for the chooser.
 *
 * Search matches both printed names — so a Chinese-UI player can type either
 * "柏林" or "berlin" — and the stable id, which makes partial words and the
 * printed English names usable even when the UI is in Chinese.  Legal targets
 * are always moved to the top by `orderSpaces`, because a pending decision is
 * the one case where the player must pick from a known set.
 */
export const filterSpaces = (filter: SpaceFilter, locale: "en" | "zh_CN"): SpaceId[] => {
  const needle = filter.search.trim().toLowerCase();
  const targetSet = new Set(filter.targets);
  const matches = SPACE_IDS.filter((id) => {
    const space = SPACES[id];
    if (!space) return false;
    if (filter.region !== "all" && space.region !== filter.region) return false;
    if (filter.onlyTargets && !targetSet.has(id)) return false;
    if (needle === "") return true;
    return (
      space.name.toLowerCase().includes(needle) ||
      space.nameZh.includes(filter.search.trim()) ||
      id.includes(needle)
    );
  }).sort((a, b) =>
    spaceLabel(a, locale).localeCompare(spaceLabel(b, locale), locale === "zh_CN" ? "zh-CN" : "en"));
  return orderSpaces(matches, targetSet);
};

/** Legal targets first, then alphabetical order (which `matches` already has). */
export const orderSpaces = (ids: readonly SpaceId[], targets: ReadonlySet<SpaceId>): SpaceId[] => {
  const pinned: SpaceId[] = [];
  const rest: SpaceId[] = [];
  for (const id of ids) (targets.has(id) ? pinned : rest).push(id);
  return [...pinned, ...rest];
};

/** Regions offered as filter chips, in board order. */
export const PICKER_REGIONS: readonly (Region | "all")[] = [
  "all", "europe", "africa", "asia", "northAmerica", "pacific", "naval",
];
