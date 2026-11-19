/**
 * The legal targets of a war declaration.
 *
 * The four "declare war using this card's CP value" home cards (Bismarck, Aux
 * Armes, Russo-Turkish Wars, Jihad) leave a declaration entitlement when their
 * event resolves.  An ordinary declaration (no home card) has the same shape:
 * a defending power, an aim and one objective space.
 *
 * This module is the single list the War panel reads, so it can never offer a
 * target the engine's `declareWar` would refuse.  It is split into three small
 * enumerations — defenders, aims and objective spaces — because the panel asks
 * one question at a time; the complete list is assembled from the three:
 *
 *  - the same `warDeclarationTargetLegal` gate (Russo-Turkish Wars: OT only;
 *    Jihad: RU or an Ottoman-home controller);
 *  - 13.4 resolution of a non-player target, so a minor's player ally is the
 *    defender its objectives must belong to (an allied minor is therefore
 *    listed through that player, never as its own target);
 *  - the same `validateWarAim` call, with the card's policy rules (RU-9's
 *    Balkan liberation, Aux Armes' two-key limit);
 *  - 13.5 truces, eliminated seats and the 13.0 World Tension gate.
 *
 * Only a single objective is enumerated.  A second objective (Aux Armes' two
 * keys) and a second power (14.1) are optional clauses the declaration panel
 * adds after the primary target is fixed.
 */
import {
  ImperialElegyState,
  Power,
  PowerOrMinor,
  POWERS,
  SpaceId,
} from "../types";
import {SPACES} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {
  WarDeclarationAim,
  WarDeclarationEntitlement,
  controlledBy,
  isPower,
  warDeclarationAims,
  warDeclarationPolicy,
  warDeclarationTargetLegal,
} from "./rules";
import {
  MinorWarInfo,
  WarTarget,
  hasTruce,
  minorWarDefender,
  minorWarInfo,
  nonPlayerControlId,
  validateWarAim,
} from "./limitedWar";

/** One legal declaration the entitlement (or the ordinary action) can make. */
export interface WarTargetCandidate {
  /** The argument `declareWar` takes: a player power or `{minor}`. */
  target: WarTarget;
  /** The resolved defending primary (13.4: a minor's player ally). */
  defender: PowerOrMinor;
  /** The printed aim this declaration uses. */
  aim: WarDeclarationAim;
  /** The objective space the declaration names. */
  objective: SpaceId;
}

/** A defending power the seat may declare war on, before an aim/objective. */
export interface WarDeclarationDefender {
  target: WarTarget;
  defender: PowerOrMinor;
}

/** Every aim an ordinary declaration may use, in the player aid's order. */
export const ALL_WAR_AIMS: readonly WarDeclarationAim[] = ["conquest", "liberation", "unification"];

/** A stable identity for a target, used as a React key and for de-duplication. */
export const warTargetKey = (target: WarTarget): string =>
  typeof target === "string" ? target : `minor:${target.minor}`;

/** A stable identity for a candidate, used as a React key and for de-duplication. */
export const warTargetCandidateKey = (candidate: WarTargetCandidate): string =>
  `${warTargetKey(candidate.target)}:${candidate.aim}:${candidate.objective}`;

const candidateKey = warTargetCandidateKey;

/** The aims a declaration may use: the card's printed list, or every aim. */
export const declarationAimsFor = (
  entitlement: WarDeclarationEntitlement | null,
): readonly WarDeclarationAim[] => {
  if (entitlement === null) return ALL_WAR_AIMS;
  return entitlement.aim !== null ? [entitlement.aim] : [...warDeclarationAims(entitlement.card)];
};

/** The spaces a defender's objectives may name, in printed order. */
const objectiveSpaces = (G: ImperialElegyState, defender: PowerOrMinor, minor: string | null): SpaceId[] => {
  if (minor !== null) {
    const controlId = nonPlayerControlId(minor);
    return Object.keys(SPACES).filter((id) => G.spaces[id]?.control === controlId);
  }
  if (!isPower(defender)) return [];
  return Object.keys(SPACES).filter((id) => controlledBy(G, id, defender));
};

/** The engine's printed aim policy, or no restrictions for an ordinary declaration. */
const aimRulesFor = (entitlement: WarDeclarationEntitlement | null) => {
  const policy = entitlement === null ? null : warDeclarationPolicy(entitlement.card);
  return {
    ruRussoTurkishWars: policy?.russianBalkanLiberation === true,
    conquestKeyLimit: policy?.conquestKeyLimit,
  };
};

/**
 * Every defender this seat may declare war on right now.
 *
 * Empty when a war already runs, when World Tension is 3+ (13.0), when the seat
 * is eliminated, or when a card's printed target list leaves no legal defender.
 * Player powers come first in seat order, then independent non-player powers.
 */
export const declarationDefenders = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
): WarDeclarationDefender[] => {
  if (G.war !== null) return [];
  if (G.wtt >= 3) return [];
  if (G.powers[power]?.eliminated === true) return [];

  const out: WarDeclarationDefender[] = [];
  // Player powers, in seat order.  A non-player power defended by one of them
  // is not enumerated separately: 13.4 makes the declaration a war on the
  // player, and that player's own row already covers the objectives.
  for (const defender of POWERS) {
    if (defender === power) continue;
    if (G.powers[defender].eliminated) continue;
    if (hasTruce(G, power, defender)) continue;
    if (!warDeclarationTargetLegal(G, entitlement, defender)) continue;
    out.push({target: defender, defender});
  }

  // Independent non-player powers (13.4).  A minor allied to a player is
  // defended by that player, so it is reached through the player row above.
  const minors = Object.keys(MINOR_POWER_HOMES).sort();
  for (const minor of minors) {
    const info: MinorWarInfo = minorWarInfo(G, power, minor);
    if (!info.ok) continue;
    if (info.ally !== null) continue;
    const defender = minorWarDefender(info);
    if (!warDeclarationTargetLegal(G, entitlement, defender)) continue;
    out.push({target: {minor}, defender});
  }

  const seen = new Set<string>();
  return out.filter((entry) => {
    const key = warTargetKey(entry.target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * The objective spaces a declaration against `entry` may name for `aim`.
 *
 * Every row is one the engine's `declareWar` accepts; the panel may therefore
 * render the list directly.  The aim decides the gates (13.3's key limit,
 * RU-9's Balkan list), which is why this is per-aim rather than all at once.
 */
export const declarationObjectives = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
  entry: WarDeclarationDefender,
  aim: WarDeclarationAim,
): SpaceId[] => {
  if (G.war !== null) return [];
  if (G.wtt >= 3) return [];
  if (G.powers[power]?.eliminated === true) return [];
  const minor = typeof entry.target === "string" ? null : entry.target.minor;
  const rules = aimRulesFor(entitlement);
  return objectiveSpaces(G, entry.defender, minor).filter((objective) =>
    validateWarAim(G, power, entry.defender, aim, [objective], rules).ok);
};

/**
 * The optional second objective of the same declaration, for `aim`.
 *
 * `selected` is the first objective, already fixed by the panel; the engine
 * validates the pair (and the two declared defenders when 14.1 names a second
 * power), so this list never offers a second key the declaration would refuse.
 */
export const declarationSecondObjectives = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
  entry: WarDeclarationDefender,
  aim: WarDeclarationAim,
  selected: SpaceId,
  secondTarget: Power | null,
): SpaceId[] => {
  const rules = aimRulesFor(entitlement);
  const defenders: PowerOrMinor[] | undefined =
    secondTarget !== null ? [entry.defender, secondTarget] : undefined;
  return declarationObjectives(G, power, entitlement, entry, aim)
    .filter((objective) => objective !== selected)
    .filter((objective) => validateWarAim(G, power, entry.defender, aim, [selected, objective], {
      ...rules,
      ...(defenders !== undefined ? {defenders} : {}),
    }).ok);
};

/**
 * Every declaration a live home-card entitlement can make, as complete
 * candidates.  Empty without an entitlement: the ordinary declaration form
 * asks its three questions one at a time, so it reads `declarationDefenders`
 * and `declarationObjectives` instead of this flat list.
 */
export const declarationTargetCandidates = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
): WarTargetCandidate[] => {
  if (entitlement === null) return [];
  const aims = declarationAimsFor(entitlement);
  const candidates: WarTargetCandidate[] = [];
  for (const entry of declarationDefenders(G, power, entitlement)) {
    for (const aim of aims) {
      for (const objective of declarationObjectives(G, power, entitlement, entry, aim)) {
        candidates.push({target: entry.target, defender: entry.defender, aim, objective});
      }
    }
  }
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = candidateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
