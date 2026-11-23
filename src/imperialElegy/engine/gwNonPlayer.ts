/**
 * Rule 32.4 — typed access to the non-player belligerents a player brought into
 * the Great War.
 *
 * Kept in its own module with no engine imports so `rules.ts` can read the
 * ledger from `hostileOwner`/`legalLandBattleTarget` without an import cycle.
 * The declaration and 30.2 elimination logic lives in `gwNonPlayerWar.ts`.
 */
import type {GwNonPlayerBelligerent, GwSide, ImperialElegyState, Power} from "../types";
import {POWERS} from "../types";

/** Every 32.4 declaration, including ones 30.2 has since eliminated. */
export const gwNonPlayerBelligerents = (G: ImperialElegyState): GwNonPlayerBelligerent[] =>
  Array.isArray(G.gw?.nonPlayerBelligerents) ? G.gw!.nonPlayerBelligerents : [];

/** The live 32.4 entry for `power`, or null when it is not a declared belligerent. */
export const gwNonPlayerBelligerent = (
  G: ImperialElegyState,
  power: string,
): GwNonPlayerBelligerent | null =>
  gwNonPlayerBelligerents(G).find((entry) => entry.power === power && entry.eliminated !== true) ?? null;

/** The alliance a declared non-player fights for (null when not declared/eliminated). */
export const gwNonPlayerSide = (G: ImperialElegyState, power: string): GwSide | null =>
  gwNonPlayerBelligerent(G, power)?.side ?? null;

/** True for a minor power or unified Italy that a 32.4 declaration brought in. */
export const isGwNonPlayerBelligerent = (G: ImperialElegyState, power: string): boolean =>
  gwNonPlayerBelligerent(G, power) !== null;

/**
 * 30.1/30.2: after a player is eliminated, keep the 32.4 ledger's `ally`
 * pointing at whoever now holds the marker.  `rules.ts#reassignMinorAllyMarkers`
 * has already moved the markers; this only refreshes the typed row.
 */
export const reconcileGwNonPlayerControllers = (
  G: ImperialElegyState,
  leaving: Power | "IT" | "US",
): void => {
  for (const entry of gwNonPlayerBelligerents(G)) {
    if (entry.ally !== leaving) continue;
    const holder = entry.spaces
      .map((space) => G.spaces[space]?.ally)
      .find((ally): ally is Power => typeof ally === "string" && (POWERS as readonly string[]).includes(ally));
    entry.ally = holder ?? null;
  }
};
