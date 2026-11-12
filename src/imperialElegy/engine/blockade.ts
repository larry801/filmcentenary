/**
 * Rules 17.1 / 29.1 — the shared blockade trace.
 *
 * "A player is blockaded if they cannot trace a LoC from their capital to any
 * naval box except the Baltic Sea or Black Sea. ... Players can trace through
 * the Baltic Sea and Black Sea, but ending their trace in either box counts as
 * being blockaded."  Rule 17.1 applies this to the end of a limited war and
 * 29.1 to the GW winter step, so the trace lives here rather than in either
 * caller.
 */
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES, connectionBetween, neighboursOf} from "../constant/spaces";
import {
  allied,
  atWar,
  capitalOf,
  friendlySpace,
  hostileOwner,
  isPower,
  navalHopPassable,
} from "./rules";

/** 17.1 / 29.1: a trace may pass through these boxes, but ending there is blockaded. */
export const BLOCKADE_EXEMPT_BOXES: readonly SpaceId[] = ["baltic-sea", "black-sea"];

/** 29.1: the RU Pacific gate applies to both Pacific boxes on the map. */
export const PACIFIC_BOXES: readonly SpaceId[] = ["pacific-ocean", "south-central-pacific"];

/** 17.1 / 29.1: every naval box that counts as "a naval box" for the blockade check. */
export const BLOCKADE_ALLOWED_BOXES: readonly SpaceId[] = Object.values(SPACES)
  .filter((def) => def.type === "navalBox" && !BLOCKADE_EXEMPT_BOXES.includes(def.id))
  .map((def) => def.id);

/** A naval box whose enemy ships cut the LoC (5.6: boxes with enemy units). */
const boxHasEnemyNaval = (G: ImperialElegyState, power: Power, box: SpaceId): boolean =>
  (G.spaces[box]?.units ?? []).some((id) => {
    const unit = G.units[id];
    return Boolean(unit) && unit!.naval === true && hostileOwner(G, power, unit!.owner);
  });

/**
 * 15.2.5 + 27.5 + 29.1: a GW Rail Move follows the wartime rail rule, whose
 * TSRR exception lets "the RU player, and players allied to RU" move along the
 * railroad once it is complete.  The same eligibility gates the 17.1/29.1
 * Pacific LoC: RU and its allies can only reach the Pacific boxes through the
 * completed railroad.  A rail action already moves one army for one CP, so the
 * printed "1 army via the TSRR per impulse" is the action's own limit.
 */
export const tsrrConnectionUsable = (G: ImperialElegyState, power: Power): boolean =>
  G.powers.RU?.tsrr === true && (power === "RU" || allied(G, power, "RU"));

/**
 * 17.1 / 29.1: the naval boxes a power can reach from its capital with an
 * uninterrupted LoC.
 *
 * - land connections may only pass through friendly spaces (5.6: "through
 *   friendly spaces during wartime"; neutral spaces never);
 * - naval boxes may be traced through, provided they hold no enemy naval
 *   units (5.6);
 * - the Baltic and Black Seas may be *passed through* but are returned in the
 *   trace so the caller can treat "ending there" as blockaded;
 * - RU and its allies may only use the Pacific boxes / TSRR land connections
 *   when the TSRR is complete (15.2.5 + 17.1/29.1), so those routes are
 *   excluded from their trace otherwise.  A power not allied to RU keeps the
 *   ordinary sea route to the Pacific.
 */
export const blockadeTrace = (G: ImperialElegyState, power: Power): SpaceId[] => {
  // 33.5: the OT capital may have moved to Ankara; 30.0 also means an
  // enemy-held capital cannot be traced from at all.
  const capital = capitalOf(G, power);
  const capitalState = G.spaces[capital];
  if (!capitalState) return [];
  if (!friendlySpace(G, capital, power)) return [];
  const occupier = capitalState.occupiedBy;
  if (occupier !== null && occupier !== undefined && occupier !== power) {
    if (!isPower(occupier) || atWar(G, power, occupier)) return [];
  }
  const reached: SpaceId[] = [];
  const visited = new Set<SpaceId>([capital]);
  const queue: SpaceId[] = [capital];
  const usesRuPacific = power === "RU" || allied(G, power, "RU");
  const tsrrComplete = tsrrConnectionUsable(G, power);
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current !== capital && SPACES[current]?.type === "navalBox") reached.push(current);
    for (const next of neighboursOf(current)) {
      if (visited.has(next)) continue;
      const def = SPACES[next];
      if (!def) continue;
      const connection = connectionBetween(current, next);
      if (connection?.type === "tsrr" && !tsrrComplete) continue;
      // 17.1/29.1 traces a real sea route: a closed/blocked Suez or a refused
      // Dardanelles crossing cannot connect the capital to a naval box.
      if (connection?.type === "sea" && !navalHopPassable(G, power, current, next)) continue;
      if (def.type === "navalBox") {
        if (boxHasEnemyNaval(G, power, next)) continue;
        // 17.1/29.1: an RU ally's Pacific route is the completed TSRR, not the
        // ordinary sea route; a non-RU-allied power keeps its sea access.
        if (usesRuPacific && !tsrrComplete && PACIFIC_BOXES.includes(next)) continue;
        visited.add(next);
        queue.push(next);
        continue;
      }
      if (!friendlySpace(G, next, power)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  return reached;
};

/** 17.1/29.1: true when the only boxes reached are Baltic/Black Sea (or none). */
export const blockadedAt = (G: ImperialElegyState, power: Power): boolean => {
  const reached = blockadeTrace(G, power);
  return !reached.some((box) => BLOCKADE_ALLOWED_BOXES.includes(box));
};
