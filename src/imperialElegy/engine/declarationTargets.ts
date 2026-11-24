/**
 * The legal targets of a war declaration.
 *
 * The four "declare war using this card's CP value" home cards (Bismarck, Aux
 * Armes, Russo-Turkish Wars, Jihad) leave a declaration entitlement when their
 * event resolves.  An ordinary declaration (no home card) has the same shape:
 * a defending power, an aim and one or two objective spaces.
 *
 * Rule 14.1 adds a second dimension: the GE and FR home cards may attack **two
 * different powers** with one declaration.  That second target may be a player
 * power or, as the reporter of the panel bug asked, a non-player power, so a
 * declaration is described by a *pair* of targets here (`second` is null for
 * the ordinary single-target case).
 *
 * This module is the single list the War panel reads, so it can never offer a
 * target the engine's `declareWar` would refuse.  It is split into small
 * enumerations — defenders, second targets, aims and objective spaces —
 * because the panel asks one question at a time; the complete list is assembled
 * from them:
 *
 *  - the same `warDeclarationTargetLegal` gate (Russo-Turkish Wars: OT only;
 *    Jihad: RU or an Ottoman-home controller);
 *  - 13.4 resolution of a non-player target, so a minor's player ally is the
 *    defender its objectives must belong to (an allied minor is therefore
 *    listed through that player, never as its own target);
 *  - the same `validateWarAim` call, with the card's policy rules (RU-9's
 *    Balkan liberation, Aux Armes' two-key limit) and every named defender;
 *  - 13.5 truces, eliminated seats and the 13.0 World Tension gate.
 *
 * Rule 13.0 lets an ordinary declaration name up to two spaces (13.1/13.2) and
 * 13.3 allows two for a conquest as long as only one is a key, so the panel
 * offers every legal pair of spaces, not one per target.
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
  BISMARCK_HOME_CARD,
  WarDeclarationAim,
  WarDeclarationEntitlement,
  allied,
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
  isWarImmuneNonPlayer,
  minorWarDefender,
  minorWarInfo,
  nonPlayerControlId,
  validateWarAim,
  warTargetKey,
} from "./limitedWar";

/** One legal declaration the entitlement (or the ordinary action) can make. */
export interface WarTargetCandidate {
  /** The argument `declareWar` takes: a player power or `{minor}`. */
  target: WarTarget;
  /** The resolved defending primary (13.4: a minor's player ally). */
  defender: PowerOrMinor;
  /** The printed aim this declaration uses. */
  aim: WarDeclarationAim;
  /** The objective space the declaration names (13.0's first space). */
  objective: SpaceId;
}

/** A defending power the seat may declare war on, before an aim/objective. */
export interface WarDeclarationDefender {
  target: WarTarget;
  defender: PowerOrMinor;
}

/** Every aim an ordinary declaration may use, in the player aid's order. */
export const ALL_WAR_AIMS: readonly WarDeclarationAim[] = ["conquest", "liberation", "unification"];

/** A stable identity for a candidate, used as a React key and for de-duplication. */
export const warTargetCandidateKey = (candidate: WarTargetCandidate): string =>
  `${warTargetKey(candidate.target)}:${candidate.aim}:${candidate.objective}`;

/** A target's identity is shared with the engine (`WarTarget` lives there). */
export {warTargetKey};

/** The aims a declaration may use: the card's printed list, or every aim. */
export const declarationAimsFor = (
  entitlement: WarDeclarationEntitlement | null,
): readonly WarDeclarationAim[] => {
  if (entitlement === null) return ALL_WAR_AIMS;
  return entitlement.aim !== null ? [entitlement.aim] : [...warDeclarationAims(entitlement.card)];
};

/**
 * The spaces one named target's objectives may come from, in printed order.
 *
 * A player power's list is the spaces it controls; a non-player power's list is
 * the spaces its own control marker sits on.  An allied minor is resolved to
 * its player ally first (13.4), because a declaration on it *is* a declaration
 * on that player.
 */
const spacesOf = (G: ImperialElegyState, target: WarTarget): SpaceId[] => {
  if (typeof target === "string") return Object.keys(SPACES).filter((id) => controlledBy(G, id, target));
  const controlId = nonPlayerControlId(target.minor);
  return Object.keys(SPACES).filter((id) => G.spaces[id]?.control === controlId);
};

/** The objective spaces a declaration on `targets` may name, before the aim. */
const objectiveSpaces = (G: ImperialElegyState, targets: readonly WarTarget[]): SpaceId[] => {
  const out: SpaceId[] = [];
  for (const target of targets) {
    for (const space of spacesOf(G, target)) if (!out.includes(space)) out.push(space);
  }
  return out;
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
    // Rule 8.1.2: "Players in an alliance box: cannot declare war on members
    // of their alliance."  The same gate is enforced by `declareWar`, so the
    // panel can never offer a target the engine would refuse.
    if (allied(G, power, defender)) continue;
    if (hasTruce(G, power, defender)) continue;
    if (!warDeclarationTargetLegal(G, entitlement, defender)) continue;
    out.push({target: defender, defender});
  }

  // Independent non-player powers (13.4).  A minor allied to a player is
  // defended by that player, so it is reached through the player row above.
  const minors = Object.keys(MINOR_POWER_HOMES).sort();
  for (const minor of minors) {
    // 12.17.1: the US and the CSA can never be a war target.
    if (isWarImmuneNonPlayer(minor)) continue;
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
 * Errata 13.4.5: the allied non-player powers offered beside an unaligned one.
 *
 * The ordinary defender list reaches a minor with a player ally through that
 * player's row (13.4 makes the declaration a war on the player).  Bismarck's
 * two-minor errata keys on the *minor* being named, though: "if Germany attacks
 * a minor power with a player ally and a minor power without a player ally,
 * the player allied … immediately allies with the unaligned minor power."  So
 * when the first target is an unaligned minor, a Bismarck declaration also
 * offers the allied minors as second targets, labelled with the ally they
 * resolve to.
 */
const alliedMinorTargets = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement,
): WarDeclarationDefender[] => {
  const out: WarDeclarationDefender[] = [];
  for (const minor of Object.keys(MINOR_POWER_HOMES).sort()) {
    if (isWarImmuneNonPlayer(minor)) continue;
    const info: MinorWarInfo = minorWarInfo(G, power, minor);
    if (!info.ok || info.ally === null || info.ally === power) continue;
    if (!warDeclarationTargetLegal(G, entitlement, info.ally)) continue;
    out.push({target: {minor}, defender: info.ally});
  }
  return out;
};

/**
 * Every second target a two-target declaration may name beside `entry`.
 *
 * Rule 14.1: "through the play of one of their home cards … GE or FR [may]
 * attack two different powers".  The printed wording is about *powers*, not
 * about spaces, so a player power, a non-player power or a pair of two
 * non-player powers are all offered.  The gates are the same ones `declareWar`
 * runs for a second target — no truce (13.5), not eliminated, not the attacker,
 * allowed by the card's printed target list — plus the pair rule: a second
 * target whose only spaces the shared aim refuses would be a dead row, because
 * 13.0 requires at least one objective.
 *
 * Bismarck's errata 13.4.5 adds one row the ordinary list cannot express: an
 * allied minor beside an unaligned minor.  Without it the panel can only name
 * the ally as a player, which loses the minor the printed rule keys on.
 */
export const declarationSecondTargets = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
  entry: WarDeclarationDefender,
  aim: WarDeclarationAim,
): WarDeclarationDefender[] => {
  if (entitlement === null) return [];
  const policy = warDeclarationPolicy(entitlement.card);
  if (policy === null || policy.maxPowers < 2 || !policy.twoPowerAims.includes(aim)) return [];

  const firstInfo = typeof entry.target === "string"
    ? null
    : minorWarInfo(G, power, entry.target.minor);
  const firstIsUnalignedMinor = firstInfo !== null && firstInfo.ok && firstInfo.ally === null;
  const extras = entitlement.card === BISMARCK_HOME_CARD && firstIsUnalignedMinor
    ? alliedMinorTargets(G, power, entitlement)
    : [];
  const seen = new Set<string>();
  return [...declarationDefenders(G, power, entitlement), ...extras]
    .filter((candidate) => warTargetKey(candidate.target) !== warTargetKey(entry.target))
    // A pair with no space in common is a dead row: the panel would show no
    // objective, and `declareWar` needs at least one.
    .filter((candidate) =>
      declarationObjectives(G, power, entitlement, entry, aim, candidate).length > 0)
    .filter((candidate) => {
      const key = warTargetKey(candidate.target);
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
 *
 * When `second` is given, the row must also be part of a legal *pair* with the
 * chosen second target, so a space only the pair refuses never appears.
 */
export const declarationObjectives = (
  G: ImperialElegyState,
  power: Power,
  entitlement: WarDeclarationEntitlement | null,
  entry: WarDeclarationDefender,
  aim: WarDeclarationAim,
  second: WarDeclarationDefender | null = null,
  italianBeneficiary?: string,
): SpaceId[] => {
  if (G.war !== null) return [];
  if (G.wtt >= 3) return [];
  if (G.powers[power]?.eliminated === true) return [];
  const targets: WarTarget[] = second === null ? [entry.target] : [entry.target, second.target];
  const defenders: PowerOrMinor[] = second === null ? [entry.defender] : [entry.defender, second.defender];
  const rules = aimRulesFor(entitlement);
  return objectiveSpaces(G, targets).filter((objective) =>
    validateWarAim(G, power, entry.defender, aim, [objective], {
      ...rules,
      ...(second === null ? {} : {defenders}),
      ...(italianBeneficiary !== undefined ? {italianBeneficiary} : {}),
    }).ok);
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
  second: WarDeclarationDefender | null = null,
  italianBeneficiary?: string,
): SpaceId[] => {
  const rules = aimRulesFor(entitlement);
  const defenders: PowerOrMinor[] | undefined =
    second !== null ? [entry.defender, second.defender] : undefined;
  return declarationObjectives(G, power, entitlement, entry, aim, second, italianBeneficiary)
    .filter((objective) => objective !== selected)
    .filter((objective) => validateWarAim(G, power, entry.defender, aim, [selected, objective], {
      ...rules,
      ...(defenders !== undefined ? {defenders} : {}),
      ...(italianBeneficiary !== undefined ? {italianBeneficiary} : {}),
    }).ok);
};

/**
 * Every declaration a live home-card entitlement can make, as complete
 * candidates.  Empty without an entitlement: the ordinary declaration form
 * asks its questions one at a time, so it reads `declarationDefenders` and
 * `declarationObjectives` instead of this flat list.
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
    const key = warTargetCandidateKey(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
