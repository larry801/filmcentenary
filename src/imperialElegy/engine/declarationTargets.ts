/**
 * The legal targets of the war a home card entitles the seat to declare.
 *
 * The four "declare war using this card's CP value" home cards (Bismarck, Aux
 * Armes, Russo-Turkish Wars, Jihad) leave a declaration entitlement when their
 * event resolves; the Orders panel could only offer the declaration after the
 * player had found a target space on the map.  That left the card looking like
 * it did nothing ("事件俾斯麦之后不能统一战争"), so the board now opens a
 * target chooser as soon as the entitlement is live.  This module is the single
 * list both the chooser and its prompt read, so it can never offer a target the
 * engine's `declareWar` would refuse.
 *
 * A candidate is one *complete* declaration: the defender, the printed aim and
 * the single objective key/space.  Enumeration mirrors `moves.declareWar`:
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
 * keys) and a second power (14.1) are optional clauses the existing declaration
 * form adds after the chooser has fixed the primary target, so the chooser
 * stays a target list rather than a second copy of that form.
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

/** One legal declaration the entitlement can make. */
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

/** A stable identity for a candidate, used as a React key and for de-duplication. */
export const warTargetCandidateKey = (candidate: WarTargetCandidate): string => {
  const target = typeof candidate.target === "string"
    ? candidate.target
    : `minor:${candidate.target.minor}`;
  return `${target}:${candidate.aim}:${candidate.objective}`;
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

/**
 * Every declaration this seat's live home-card entitlement can make right now.
 *
 * Empty when the seat has no entitlement, when a war already runs, when World
 * Tension is 3+ (13.0) or when the card's printed target/aim list leaves no
 * legal defender.  The list is deterministic and grouped by aim/target order so
 * the chooser reads the same way every time.
 */
export const declarationTargetCandidates = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
): WarTargetCandidate[] => {
  if (entitlement === null) return [];
  if (G.war !== null) return [];
  if (G.wtt >= 3) return [];
  if (G.powers[power]?.eliminated === true) return [];

  const policy = warDeclarationPolicy(entitlement.card);
  const aims: WarDeclarationAim[] = entitlement.aim !== null
    ? [entitlement.aim]
    : [...warDeclarationAims(entitlement.card)];
  const aimRules = {
    ruRussoTurkishWars: policy?.russianBalkanLiberation === true,
    conquestKeyLimit: policy?.conquestKeyLimit,
  };
  const candidates: WarTargetCandidate[] = [];
  const add = (target: WarTarget, defender: PowerOrMinor, aim: WarDeclarationAim, spaces: readonly SpaceId[]): void => {
    for (const objective of spaces) {
      if (validateWarAim(G, power, defender, aim, [objective], aimRules).ok) {
        candidates.push({target, defender, aim, objective});
      }
    }
  };

  // Player powers, in seat order.  A non-player power defended by one of them
  // is not enumerated separately: 13.4 makes the declaration a war on the
  // player, and that player's own row already covers the objectives.
  for (const defender of POWERS) {
    if (defender === power) continue;
    if (G.powers[defender].eliminated) continue;
    if (hasTruce(G, power, defender)) continue;
    if (!warDeclarationTargetLegal(G, entitlement, defender)) continue;
    const spaces = objectiveSpaces(G, defender, null);
    for (const aim of aims) add(defender, defender, aim, spaces);
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
    const spaces = objectiveSpaces(G, defender, minor);
    for (const aim of aims) add({minor}, defender, aim, spaces);
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = warTargetCandidateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
