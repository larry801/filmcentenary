/**
 * Limited-war rules helpers (Imperial Elegy rules 13.0–17.0).
 *
 * This module is deliberately free of boardgame.io move plumbing: every
 * helper reads and/or mutates the existing `ImperialElegyState` / `WarState`
 * shapes from `types.ts` and leaves card spending, phase events and pending
 * decisions to the caller (`moves.ts` / `game.ts`).
 *
 * The `validate*` / `classify*` helpers are pure; `apply*`, `join*` and
 * `demobilize*` mutate the state they are given and are safe to unit-test
 * without a boardgame.io client.
 */

import {Ctx} from "boardgame.io";
import {
  AllianceBox,
  CardId,
  GamePhase,
  ImperialElegyState,
  Power,
  PowerOrMinor,
  POWERS,
  SpaceId,
  Unit,
  WarKnockoutRecord,
  WarState,
} from "../types";
import {SPACES, isNavalBox} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {cardById, isCardId} from "./deck";
import {
  POWER_ORDER,
  allianceOf,
  capitalOf,
  changeStability,
  controlledBy,
  die,
  effectiveKeyType,
  displaceAlliedUnitsInTerritory,
  hasLoc,
  isPower,
  log,
  minorAlliesOf,
  minorController,
  setSpaceControl,
} from "./rules";
import {AU_NATIONALITIES, governmentBenefits} from "./characteristics";
import {blockadedAt} from "./blockade";
import {displaceUnitToFriendlyLoc} from "./effects";
import {initialNonPlayerBuildBox} from "./endPhase";
import {POLAND, isPolandIndependent} from "./poland";
import {
  allyAidShift,
  canJoinAlliance,
  declarationShiftDirection,
  italyDeclarationShift,
  shiftAlliance,
  type AllianceSide,
} from "./alliance";
import {italyAllianceBox, shiftItalyToward} from "./italyEntry";

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

export type WarAim = NonNullable<WarState["warAim"]>;
export type WarSideName = "attacker" | "defender";
export type WarPhaseStatus = WarState["status"];

export interface WarAimIssue {
  code: WarAimIssueCode;
  message: string;
  space?: SpaceId;
}

export type WarAimIssueCode =
  | "invalid-attacker"
  | "invalid-defender"
  | "same-power"
  | "unknown-aim"
  | "no-objectives"
  | "too-many-objectives"
  | "duplicate-objective"
  | "unknown-space"
  | "objective-not-controlled"
  | "liberation-home-and-rebellion"
  | "liberation-not-home-or-rebellion"
  | "liberation-dual-home"
  | "unification-wrong-power"
  | "unification-not-german"
  | "unification-not-citizenship"
  | "conquest-capital"
  | "conquest-subcapital"
  | "conquest-too-many-keys";

export interface WarAimValidation {
  ok: boolean;
  aim: WarAim;
  attacker: Power;
  /** The defending player, or the non-player power for a 13.4 minor war. */
  defender: PowerOrMinor;
  objectives: SpaceId[];
  issues: WarAimIssue[];
}

export interface WarAimRules {
  /**
   * Rule 13.1.2: RU may only liberate non-rebellious Balkan spaces after
   * playing the Russo-Turkish Wars home card.  Defaults to false.
   */
  ruRussoTurkishWars?: boolean;
  /**
   * Nationality lookup for unification.  Defaults to the printed
   * `SpaceDef.nationalities` when present, then to the fallback map below.
   */
  nationalitiesOf?: (space: SpaceId) => readonly string[];
  /** Rule 13.1 dual-home exception.  Defaults to `homeOverride` differing. */
  isDualHome?: (G: ImperialElegyState, space: SpaceId) => boolean;
}

/**
 * Printed nationalities used by wars of unification.  `SpaceDef.nationalities`
 * is optional and the current campaign data leaves it empty, so this map is
 * the fallback used by `validateWarAim`.  Callers may override it through
 * `WarAimRules.nationalitiesOf`.
 */
export const DEFAULT_SPACE_NATIONALITIES: Readonly<Record<SpaceId, readonly string[]>> = {
  // German unification spaces (printed Germany flashpoint / Prussian homes).
  berlin: ["Germans"],
  westphalia: ["Germans"],
  pomerania: ["Germans"],
  prussia: ["Germans"],
  silesia: ["Germans"],
  hanover: ["Germans"],
  saxony: ["Germans"],
  bavaria: ["Germans"],
  // Italian nationalities.
  piedmont: ["Italians"],
  lombardy: ["Italians"],
  tyrol: ["Italians"],
  tuscany: ["Italians"],
  naples: ["Italians"],
  // The eight AU nationalities from rule 33.4.1.
  bohemia: ["Czechs"],
  hungary: ["Hungarians"],
  transylvania: ["Hungarians", "Romanians"],
  banat: ["Hungarians", "Serbians", "Romanians"],
  croatia: ["Croats"],
  "bosnia-herzegovina": ["Serbians", "Croats"],
  serbia: ["Serbians"],
  galicia: ["Poles"],
  poland: ["Poles"],
  romania: ["Romanians"],
};

const nationalityOf = (G: ImperialElegyState, space: SpaceId, rules: WarAimRules): readonly string[] => {
  if (rules.nationalitiesOf) return rules.nationalitiesOf(space);
  const printed = SPACES[space]?.nationalities;
  if (printed && printed.length > 0) return printed;
  return DEFAULT_SPACE_NATIONALITIES[space] ?? [];
};

const isRebellious = (G: ImperialElegyState, space: SpaceId): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  if ((state.rebellion?.rebels.length ?? 0) > 0) return true;
  // A rebel counter is enough even if the Rebellion marker bookkeeping is
  // incomplete (e.g. a scenario that only placed counters).
  return Object.values(G.units).some(
    (unit) => unit.space === space && typeof unit.owner === "string" && unit.owner.startsWith("REBEL:"),
  );
};

const defaultDualHome = (G: ImperialElegyState, space: SpaceId): boolean => {
  const printedHome = SPACES[space]?.home ?? null;
  const override = G.spaces[space]?.homeOverride ?? null;
  return printedHome !== null && override !== null && printedHome !== override;
};

const isWarAim = (value: unknown): value is WarAim =>
  value === "liberation" || value === "unification" || value === "conquest";

// ---------------------------------------------------------------------------
// War aim validation (rule 13.0)
// ---------------------------------------------------------------------------

/**
 * Validate a war aim and its objectives without touching the game state.
 *
 * All aims use one or two objectives controlled by the defender.  Liberation
 * additionally requires an original attacker home space or a rebellion (with
 * the AU/RU special cases), unification requires the relevant nationality,
 * and conquest allows at most one key and forbids capitals/subcapitals.
 *
 * `defender` may also be a non-player power (rule 13.4): its objectives are
 * the spaces that non-player controls, and the aim clauses otherwise work the
 * same way.
 */
export const validateWarAim = (
  G: ImperialElegyState,
  attacker: Power,
  defender: PowerOrMinor,
  aim: WarAim,
  objectives: readonly SpaceId[],
  rules: WarAimRules = {},
): WarAimValidation => {
  const issues: WarAimIssue[] = [];
  const add = (code: WarAimIssueCode, message: string, space?: SpaceId) =>
    issues.push(space === undefined ? {code, message} : {code, message, space});
  const defenderIsPower = isPower(defender);

  if (!POWERS.includes(attacker)) add("invalid-attacker", `${String(attacker)} is not a player power`);
  if (defenderIsPower ? !POWERS.includes(defender) : String(defender).length === 0) {
    add("invalid-defender", `${String(defender)} is not a player power or non-player power`);
  }
  if (attacker === defender) add("same-power", "a power cannot declare war on itself");
  if (!isWarAim(aim)) add("unknown-aim", `unknown war aim ${String(aim)}`);

  if (objectives.length === 0) add("no-objectives", "a war must target at least one objective");
  if (objectives.length > 2) add("too-many-objectives", "a war may target at most two objectives");

  const holdsObjective = (space: SpaceId): boolean =>
    defenderIsPower ? controlledBy(G, space, defender) : G.spaces[space]?.control === defender;

  const seen = new Set<SpaceId>();
  for (const space of objectives) {
    if (seen.has(space)) {
      add("duplicate-objective", `objective ${space} is listed more than once`, space);
      continue;
    }
    seen.add(space);
    if (!SPACES[space]) {
      add("unknown-space", `unknown space ${space}`, space);
      continue;
    }
    if (!holdsObjective(space)) {
      add("objective-not-controlled", `${space} is not controlled by ${String(defender)}`, space);
    }
  }

  if (aim === "liberation") {
    for (const space of objectives) {
      const def = SPACES[space];
      if (!def) continue;
      const home = def.home === attacker;
      const rebel = isRebellious(G, space);
      // 33.4 Arbiter of Italy: "Until Italy unifies, when AU declares a war of
      // liberation they can target spaces with Italian nationalities that are
      // not currently in rebellion."  Keyed on the printed nationality, not the
      // Italy flashpoint, so it does not widen the aim for any other power.
      const italianSpecial =
        attacker === "AU" &&
        nationalityOf(G, space, rules).includes("Italians") &&
        G.persistent.italyUnified !== true &&
        G.flags.italyUnified !== true;
      const balkanSpecial =
        attacker === "RU" &&
        def.flashpoints?.includes("balkans") === true &&
        rules.ruRussoTurkishWars === true;
      const special = italianSpecial || balkanSpecial;
      const dual = (rules.isDualHome ?? defaultDualHome)(G, space);

      if (home && dual) {
        add("liberation-dual-home", `${space} is a dual home space and cannot be liberated`, space);
      } else if (home && rebel) {
        add("liberation-home-and-rebellion", `${space} is both a home space and in rebellion`, space);
      } else if (!home && !rebel && !special) {
        add(
          "liberation-not-home-or-rebellion",
          `${space} is neither an original ${attacker} home space nor in rebellion`,
          space,
        );
      }
    }
  } else if (aim === "unification") {
    if (attacker !== "GE" && attacker !== "AU") {
      add("unification-wrong-power", "only GE or AU may declare a war of unification");
    } else {
      for (const space of objectives) {
        const def = SPACES[space];
        if (!def) continue;
        const nationalities = nationalityOf(G, space, rules);
        if (attacker === "GE") {
          if (!nationalities.includes("Germans")) {
            add("unification-not-german", `${space} does not contain German nationality`, space);
          }
        } else {
          // 33.4 Incorporate: "AU can launch wars of unification targeting
          // spaces that contain nationalities with full citizenship."  Only
          // the eight printed nationalities (33.4.1) can hold AU citizenship,
          // so a stray non-grantable entry in state cannot open a target.
          const citizenship = G.powers.AU.citizenship;
          const eligible = nationalities.some(
            (nationality) =>
              (AU_NATIONALITIES as readonly string[]).includes(nationality) &&
              citizenship.includes(nationality),
          );
          if (!eligible) {
            add(
              "unification-not-citizenship",
              `${space} does not contain a nationality with AU citizenship`,
              space,
            );
          }
        }
      }
    }
  } else if (aim === "conquest") {
    let keys = 0;
    for (const space of objectives) {
      const def = SPACES[space];
      if (!def) continue;
      if (def.type === "capital") {
        add("conquest-capital", `${space} is a capital and cannot be a conquest objective`, space);
      } else if (def.type === "subcapital") {
        add("conquest-subcapital", `${space} is a subcapital and cannot be a conquest objective`, space);
      }
      if (effectiveKeyType(G, space) !== undefined) keys += 1;
    }
    if (keys > 1) add("conquest-too-many-keys", "a war of conquest may target only one key");
  }

  return {
    ok: issues.length === 0,
    aim,
    attacker,
    defender,
    objectives: [...objectives],
    issues,
  };
};

// ---------------------------------------------------------------------------
// War declaration support (rules 12.17 / 13.3)
// ---------------------------------------------------------------------------

/**
 * Build the `WarState` for a fresh limited war.  The caller is responsible for
 * validation, spending CP and setting the wartime phase.
 */
export const createWarState = (
  G: ImperialElegyState,
  attacker: Power,
  defender: PowerOrMinor,
  aim: WarAim,
  objectives: readonly SpaceId[],
  cp: number,
  options: {minor?: {minor: string; ally: Power | null}} = {},
): WarState => ({
  attacker,
  // Rule 15.4.2: an unaided non-player defender has no seat.  Its control id
  // is stored here so `war.defender` stays a single key, but only `minorTarget`
  // is the typed record; player-only paths test `isPower(war.defender)`.
  defender: defender as Power,
  attackerAllies: [],
  defenderAllies: [],
  attackerMinors: [],
  defenderMinors: options.minor ? [options.minor.minor] : [],
  warAim: aim,
  objectives: [...objectives],
  status: "warAim",
  // Rule 14.3: a lone non-player defender has no player budget at all ("Minor
  // powers defending alone ... receive no war budget", 13.7).
  budgets: isPower(defender)
    ? {[attacker]: warBudgetFor(G, attacker, cp), [defender]: 0}
    : {[attacker]: warBudgetFor(G, attacker, cp)},
  initiative: [],
  treaties: [],
  victor: null,
  truceTurns: 2,
  passed: [],
  startedTurn: G.turn,
  ...(options.minor
    ? {minorTarget: {minor: options.minor.minor, ally: options.minor.ally}}
    : {}),
});

// ---------------------------------------------------------------------------
// War on a non-player power (rules 13.4 / 13.5 / 14.2 / 8.2)
// ---------------------------------------------------------------------------

/**
 * Rule 15.4.2: true when the war's defending side has no player belligerent.
 * The non-player is the sole defender; player-only helpers must not treat
 * `war.defender` as a seat for such a war.
 */
export const isLoneMinorWar = (war: WarState | null | undefined): boolean =>
  war?.minorTarget !== undefined && war.minorTarget.ally === null;

/** Rule 15.4.2: the non-player power defending alone, or null. */
export const loneMinorDefender = (war: WarState | null | undefined): string | null =>
  war?.minorTarget !== undefined && war.minorTarget.ally === null ? war.minorTarget.minor : null;

/** The `declareWar` target shape for a non-player power. */
export interface MinorWarTargetArg {
  minor: string;
}

/** A limited-war declaration target: a player power or a non-player power. */
export type WarTarget = Power | MinorWarTargetArg;

/** True when `target` is the typed non-player declaration target. */
export const isMinorWarTargetArg = (target: unknown): target is MinorWarTargetArg =>
  typeof target === "object" &&
  target !== null &&
  typeof (target as {minor?: unknown}).minor === "string" &&
  (target as {minor: string}).minor.length > 0;

/**
 * Rule 13.4: the home/key space that identifies a non-player power.  Unified
 * Italy's capital is Rome (15.6 / 30.2), and it is not in
 * `MINOR_POWER_HOMES` because Italy is a non-player major, not a minor.
 * Poland and Ireland are listed by the 13.4.3 Non-Player Alliance Table as
 * powers that do not start independent but can become independent (22.5);
 * their rows only become live once they control their homeland, which
 * `minorWarInfo` enforces through the `minor-not-present` check.
 */
export const NON_PLAYER_HOMES: Readonly<Record<string, SpaceId>> = {
  Italy: "rome",
  Poland: "poland",
  Ireland: "ireland",
};

/** The space that identifies `minor` (a minor power name or "Italy"). */
export const nonPlayerHome = (minor: string): SpaceId | null =>
  MINOR_POWER_HOMES[minor] ?? NON_PLAYER_HOMES[minor] ?? null;

/** The control-marker value a non-player power writes into `SpaceState.control`. */
export const nonPlayerControlId = (minor: string): string => (minor === "Italy" ? "IT" : minor);

export type MinorWarBlockReason =
  | "unknown-minor"
  | "minor-not-present"
  | "allied-to-attacker"
  | "diplomacy-with-attacker"
  | "attacker-alliance"
  | "truce"
  | "eliminated-ally";

export interface MinorWarInfo {
  ok: boolean;
  minor: string;
  /** The space that identifies the non-player power, when known. */
  home: SpaceId | null;
  /**
   * Rule 13.4: the player ally that becomes the defending primary, or null
   * when the non-player has no player ally (it would defend alone, 15.4.2).
   */
  ally: Power | null;
  reason?: MinorWarBlockReason;
}

/**
 * Rule 13.4 — resolve the player side of a declaration on a non-player power.
 *
 * "Declaring war against a non-player power that has a player ally is treated
 * as declaring war against that player.  Meaning, all normal alliance rules
 * apply, and the defending player will shift away from the attacker on the
 * alliance track [8.2]."  The printed prohibitions are enforced: a player
 * cannot attack a non-player it is allied with or has a diplomacy marker with
 * (13.4.1), nor one allied to a member of its own alliance (8.1.2 / 13.4),
 * and a truce with the defending player blocks the declaration (13.5).
 */
export const minorWarInfo = (
  G: ImperialElegyState,
  attacker: Power,
  minor: string,
): MinorWarInfo => {
  const home = nonPlayerHome(minor);
  if (home === null) return {ok: false, minor, home, ally: null, reason: "unknown-minor"};
  const controlId = nonPlayerControlId(minor);
  const homeState = G.spaces[home];
  if (!homeState) return {ok: false, minor, home, ally: null, reason: "unknown-minor"};
  const holds = (space: SpaceId): boolean => G.spaces[space]?.control === controlId;
  // "Minor present" means the non-player still controls at least its home.
  // Rule 22.5: Poland is independent once it controls any Polish space, and it
  // has no `MINOR_POWER_HOMES` entry, so presence is the independence test.
  const present = minor === POLAND ? isPolandIndependent(G) : holds(home);
  if (!present) return {ok: false, minor, home, ally: null, reason: "minor-not-present"};
  const ally = minorWarAlly(G, minor, controlId);
  const attackerAlliance = allianceOf(G.powers[attacker].alliance);
  const inAttackerAlliance = (power: Power): boolean =>
    power === attacker || (attackerAlliance !== null && attackerAlliance === allianceOf(G.powers[power].alliance));
  if (homeState.ally === attacker || homeState.diplomacy === attacker) {
    return {
      ok: false,
      minor,
      home,
      ally,
      reason: homeState.ally === attacker ? "allied-to-attacker" : "diplomacy-with-attacker",
    };
  }
  // 13.4/8.1.2: a marker belonging to a member of the attacker's alliance also
  // protects the non-player power.
  if (homeState.ally !== null && homeState.ally !== undefined && isPower(homeState.ally) && inAttackerAlliance(homeState.ally)) {
    return {ok: false, minor, home, ally, reason: "attacker-alliance"};
  }
  if (homeState.diplomacy !== null && homeState.diplomacy !== undefined && isPower(homeState.diplomacy) && inAttackerAlliance(homeState.diplomacy)) {
    return {ok: false, minor, home, ally, reason: "attacker-alliance"};
  }
  if (ally === null) return {ok: true, minor, home, ally: null};
  if (ally === attacker) return {ok: false, minor, home, ally, reason: "allied-to-attacker"};
  if (G.powers[ally].eliminated) return {ok: false, minor, home, ally, reason: "eliminated-ally"};
  if (attackerAlliance !== null && attackerAlliance === allianceOf(G.powers[ally].alliance)) {
    return {ok: false, minor, home, ally, reason: "attacker-alliance"};
  }
  if (hasTruce(G, attacker, ally)) return {ok: false, minor, home, ally, reason: "truce"};
  return {ok: true, minor, home, ally};
};

/** The player the non-player power is allied to, from its control markers. */
export const minorWarAlly = (G: ImperialElegyState, minor: string, controlId = nonPlayerControlId(minor)): Power | null => {
  const home = nonPlayerHome(minor);
  if (home !== null) {
    const direct = G.spaces[home]?.ally;
    if (isPower(direct)) return direct;
  }
  for (const state of Object.values(G.spaces)) {
    if (state.control === controlId && isPower(state.ally)) return state.ally;
  }
  return null;
};

/**
 * Rule 4.7.1 / 16.2: a minor power is "independent" while it controls its own
 * homeland with its own marker (Rome's `IT` for Italy, but Italy is a
 * non-player major and not a minor-power beneficiary).  Eliminated minors are
 * never beneficiaries.
 */
export const isIndependentMinor = (G: ImperialElegyState, minor: string): boolean => {
  if (minor === "Italy" || minor === "United States" || minor === "US" || minor === "IT") return false;
  if (G.eliminatedMinors?.includes(minor) === true) return false;
  const home = MINOR_POWER_HOMES[minor] ?? NON_PLAYER_HOMES[minor] ?? null;
  if (home === null) return false;
  return G.spaces[home]?.control === nonPlayerControlId(minor);
};

/**
 * Rule 16.2: "Spaces and war reparations may be awarded to any of the
 * victorious player's allies, including independent minor powers."  Returns
 * the independent minors allied to any player on `side`, in stable name order.
 */
export const independentMinorBeneficiaries = (
  G: ImperialElegyState,
  war: WarState,
  side: WarSideName,
): string[] => {
  const out = new Set<string>();
  for (const power of sidePowers(war, side)) {
    for (const minor of minorAlliesOf(G, power)) {
      if (isIndependentMinor(G, minor)) out.add(minor);
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
};

/**
 * The defender war aims are validated against (13.4): the player ally when
 * one defends, otherwise the non-player's own control-marker id ("IT" for a
 * unified Italy).
 */
export const minorWarDefender = (info: MinorWarInfo): PowerOrMinor =>
  info.ally ?? nonPlayerControlId(info.minor);

export interface MinorDeclarationShiftResult {
  /** The player ally that shifted, when one defended (14.2). */
  ally: Power | null;
  allyShift: ReturnType<typeof allyAidShift> | null;
  /** The printed 8.2 random Italy shift, when it applied. */
  italyShift: ReturnType<typeof italyDeclarationShift> | null;
  /**
   * Rule 14.2 special: when a player aids a neutral unified Italy, Italy's own
   * chit shifts away from the attacker as well.
   */
  italyAidShift: ItalyAidShiftResult | null;
}

/** The result of rule 14.2's special "both Italy and the aiding player shift". */
export interface ItalyAidShiftResult {
  applied: boolean;
  from: AllianceBox;
  to: AllianceBox;
  side: AllianceSide | null;
  steps: number;
}

/**
 * Rule 14.2 special: "After unification, if a neutral Italy is attacked and a
 * player chooses to aid Italy [13.4.2], both Italy and the aiding player will
 * shift away from the attacker on the alliance track."  Italy's chit moves
 * through `shiftItalyToward` (it is not a player power, so the 8.4 cap does
 * not apply).  The direction is the aiding player's printed direction, which
 * is "away from the attacker" whenever the attacker's chit determines one and
 * the deterministic Triple-Entente-first fallback otherwise.
 */
export const applyItalyAidShift = (
  G: ImperialElegyState,
  side: AllianceSide,
): ItalyAidShiftResult => {
  const from = italyAllianceBox(G);
  const unified = G.persistent.italyUnified === true || G.flags.italyUnified === true;
  if (!unified || from !== "neutral") {
    return {applied: false, from, to: from, side: null, steps: 0};
  }
  const to = shiftItalyToward(G, side);
  log(G, undefined, "allianceShifted", {
    from,
    to,
    steps: to === from ? 0 : 1,
    italy: true,
    aidMinor: "Italy",
    aidingPlayer: true,
    side,
  });
  return {applied: true, from, to, side, steps: to === from ? 0 : 1};
};

/**
 * Rule 14.2 / 8.2 — apply the declaration-driven shift for a war on a
 * non-player power.  An aided non-player's defending player shifts away from
 * the attacker (14.2); an unaided unified Italy attacked by a neutral player
 * shifts in the randomly determined direction (8.2).  The 14.2 special also
 * shifts a neutral unified Italy's own chit away from the attacker.
 */
export const applyMinorDeclarationShift = (
  G: ImperialElegyState,
  ctx: Ctx,
  attacker: Power,
  info: MinorWarInfo,
): MinorDeclarationShiftResult => {
  if (info.ally !== null) {
    // 8.1.2 / 8.4: the ally-aiding shift respects the three-player cap.
    const shift = allyAidShift(G, attacker, info.ally);
    log(G, info.ally, "allianceShifted", {
      from: shift.from,
      to: shift.to,
      steps: shift.steps,
      attacker,
      aidMinor: info.minor,
      blocked: shift.blocked,
      fallback: shift.defaultDirection,
    });
    // 14.2 special: a neutral unified Italy shifts with its new player ally.
    const italyAidShift = info.minor === "Italy" ? applyItalyAidShift(G, shift.direction) : null;
    return {ally: info.ally, allyShift: shift, italyShift: null, italyAidShift};
  }
  // Rule 8.2's random clause is Italy's alone; a minor power has no chit.
  if (info.minor !== "Italy") {
    return {ally: null, allyShift: null, italyShift: null, italyAidShift: null};
  }
  const italy = italyDeclarationShift(G, attacker, die(ctx, 6), false);
  if (!italy.applied) return {ally: null, allyShift: null, italyShift: italy, italyAidShift: null};
  log(G, undefined, "allianceShifted", {
    from: italy.from,
    to: italy.to,
    steps: italy.steps,
    attacker,
    italy: true,
    roll: italy.roll,
    random: italy.random,
  });
  return {ally: null, allyShift: null, italyShift: italy, italyAidShift: null};
};

// ---------------------------------------------------------------------------
// Rule 13.4.2 Seeking Aid / 13.4.3 Non-Player Alliance Table
// ---------------------------------------------------------------------------

/**
 * One printed choice column of the 13.4.3 Non-Player Alliance Table.  Two
 * players in one cell roll off (re-rolling ties) for the first chance to ally;
 * `null` is the printed "-" (no player for that choice).
 */
export interface NonPlayerAllianceChoice {
  candidates: readonly Power[];
  /** Printed `*`: the two players roll off for the first chance to aid. */
  rollOff: boolean;
}

export interface NonPlayerAllianceRow {
  /** Printed Nation column. */
  nation: string;
  /** The non-player powers this row covers. */
  nations: readonly string[];
  /** The 1st / 2nd / 3rd Choice columns in order. */
  choices: readonly (NonPlayerAllianceChoice | null)[];
}

/**
 * Rule 13.4.3 — the printed Non-Player Alliance Table, transcribed in column
 * order.  "German State" covers the German minor powers and "Balkan State" the
 * Balkan minor powers; "Italy/IT Minor" covers unified Italy and the Italian
 * minor powers.  Poland and Ireland only become independent nations later
 * (22.5), and the rows still apply once they do.
 */
export const NON_PLAYER_ALLIANCE_TABLE: readonly NonPlayerAllianceRow[] = [
  {
    nation: "Netherlands/Bel.",
    nations: ["Belgium", "Netherlands"],
    choices: [
      {candidates: ["UK", "GE"], rollOff: true},
      {candidates: ["FR"], rollOff: false},
      null,
    ],
  },
  {
    nation: "Denmark",
    nations: ["Denmark"],
    choices: [
      {candidates: ["UK", "FR"], rollOff: true},
      {candidates: ["GE", "RU"], rollOff: true},
      null,
    ],
  },
  {
    nation: "German State",
    nations: ["Hanover", "Saxony", "Bavaria"],
    choices: [
      {candidates: ["AU", "GE"], rollOff: true},
      {candidates: ["RU"], rollOff: false},
      {candidates: ["FR"], rollOff: false},
    ],
  },
  {
    nation: "Balkan State",
    nations: ["Romania", "Serbia", "Bosnia", "Bulgaria"],
    choices: [
      {candidates: ["RU", "AU"], rollOff: true},
      {candidates: ["FR"], rollOff: false},
      {candidates: ["UK"], rollOff: false},
    ],
  },
  {
    nation: "Greece",
    nations: ["Greece"],
    choices: [
      {candidates: ["UK", "RU"], rollOff: true},
      {candidates: ["FR", "AU"], rollOff: true},
      null,
    ],
  },
  {
    nation: "Italy/IT Minor",
    nations: ["Italy", "Sardinia-Piedmont", "Two Sicilies", "Tuscany", "Papal States"],
    choices: [
      {candidates: ["FR", "AU"], rollOff: true},
      {candidates: ["GE"], rollOff: false},
      {candidates: ["UK"], rollOff: false},
    ],
  },
  {
    nation: "Egypt",
    nations: ["Egypt"],
    choices: [
      {candidates: ["UK", "FR"], rollOff: true},
      {candidates: ["OT"], rollOff: false},
      null,
    ],
  },
  {
    nation: "Persia",
    nations: ["Persia"],
    choices: [
      {candidates: ["UK", "RU"], rollOff: true},
      {candidates: ["FR"], rollOff: false},
      {candidates: ["OT"], rollOff: false},
    ],
  },
  {
    nation: "Japan",
    nations: ["Japan"],
    choices: [
      {candidates: ["UK", "FR"], rollOff: true},
      {candidates: ["RU"], rollOff: false},
      null,
    ],
  },
  {
    nation: "Qing China",
    nations: ["Qing China"],
    choices: [
      {candidates: ["UK", "FR"], rollOff: true},
      {candidates: ["RU"], rollOff: false},
      null,
    ],
  },
  {
    nation: "Poland",
    nations: ["Poland"],
    choices: [
      {candidates: ["FR"], rollOff: false},
      {candidates: ["AU", "GE"], rollOff: true},
      null,
    ],
  },
  {
    nation: "Ireland",
    nations: ["Ireland"],
    choices: [
      {candidates: ["FR"], rollOff: false},
      {candidates: ["GE"], rollOff: false},
      null,
    ],
  },
];

/** The 13.4.3 table row for a non-player power, or null when it has none. */
export const nonPlayerAllianceRow = (minor: string): NonPlayerAllianceRow | null =>
  NON_PLAYER_ALLIANCE_TABLE.find((row) => row.nations.includes(minor)) ?? null;

/**
 * Rule 13.4.2: who may be asked to aid the attacked non-player power.  The
 * attacker cannot ally with it, a player allied to the attacker cannot choose
 * it, an eliminated power cannot act, and a player holding a truce with the
 * attacker cannot join a war against them (13.5).  A player already at war
 * with the power on the other side is not possible here: the declaration is
 * only legal while no limited war is running.
 */
export const canAidMinor = (
  G: ImperialElegyState,
  attacker: Power,
  _minor: string,
  power: Power,
): boolean => {
  if (!isPower(power) || power === attacker) return false;
  if (G.powers[power]?.eliminated) return false;
  if (hasTruce(G, attacker, power)) return false;
  const attackerAlliance = allianceOf(G.powers[attacker].alliance);
  if (attackerAlliance !== null && attackerAlliance === allianceOf(G.powers[power].alliance)) return false;
  return true;
};

export interface SeekingAidSlot {
  /** 1 is the diplomacy-marker step, 2-4 are the table's choice columns. */
  step: number;
  /** True for the printed "player who has a diplomacy marker with it" step. */
  diplomacy: boolean;
  /** Eligible candidates, in printed order (roll-off cells keep printed order). */
  candidates: Power[];
  /** True when this cell's two players must roll off for the first chance. */
  rollOff: boolean;
}

/**
 * Rule 13.4.2 — the printed order in which the attacked non-player power
 * seeks aid: first the player holding a diplomacy marker with it, then the
 * Non-Player Alliance Table's 1st, 2nd and 3rd Choices.  Ineligible players
 * (the attacker, its allies, truce partners, eliminated powers) are filtered
 * out, and a printed "-" cell contributes nothing.
 */
export const seekingAidSlots = (
  G: ImperialElegyState,
  attacker: Power,
  minor: string,
): SeekingAidSlot[] => {
  const slots: SeekingAidSlot[] = [];
  const home = nonPlayerHome(minor);
  // A player "has a diplomacy marker with it" when the marker sits on the
  // power's home or on any other space the power controls.  The printed rule
  // assumes one such player; when more than one exists they are asked in seat
  // order before the table is consulted.
  const controlId = nonPlayerControlId(minor);
  const holders = new Set<Power>();
  for (const [space, state] of Object.entries(G.spaces)) {
    if (space !== home && state.control !== controlId) continue;
    if (isPower(state.diplomacy)) holders.add(state.diplomacy);
  }
  for (const holder of [...holders].sort((a, b) => POWER_ORDER[a] - POWER_ORDER[b])) {
    if (!canAidMinor(G, attacker, minor, holder)) continue;
    slots.push({step: 1, diplomacy: true, candidates: [holder], rollOff: false});
  }
  const row = nonPlayerAllianceRow(minor);
  if (row === null) return slots;
  row.choices.forEach((choice, index) => {
    if (choice === null) return;
    const candidates = choice.candidates.filter((power) => canAidMinor(G, attacker, minor, power));
    if (candidates.length === 0) return;
    slots.push({step: index + 2, diplomacy: false, candidates, rollOff: choice.rollOff && candidates.length > 1});
  });
  return slots;
};

export interface AidRollOff {
  /** Candidates in first-chance order (highest roll first). */
  order: Power[];
  /** Every die rolled, in the order rolled (public, like 14.3's roll-off). */
  rolls: {power: Power; roll: number}[];
}

/**
 * Rule 13.4.3's `*`: "Both players roll a d6 to see who the minor power turns
 * to first for aid, the higher roll wins, reroll ties."  The die source is
 * injected (`ctx.random.Die(6)` live), so the helper is deterministic and
 * replay-safe.
 */
export const rollOffAidOrder = (
  candidates: readonly Power[],
  rollDie: () => number,
): AidRollOff => {
  const rolls: {power: Power; roll: number}[] = [];
  let contenders = [...candidates];
  for (let attempt = 0; attempt < 20 && contenders.length > 1; attempt++) {
    const values = new Map<Power, number>();
    for (const power of contenders) values.set(power, rollDie());
    for (const power of contenders) rolls.push({power, roll: values.get(power) ?? 0});
    const sorted = [...contenders].sort(
      (a, b) => (values.get(b) ?? 0) - (values.get(a) ?? 0) || POWER_ORDER[a] - POWER_ORDER[b],
    );
    const best = values.get(sorted[0]) ?? 0;
    const tied = sorted.filter((power) => values.get(power) === best);
    if (tied.length === 1) {
      return {order: [...tied, ...sorted.filter((power) => !tied.includes(power))], rolls};
    }
    contenders = tied;
  }
  return {order: [...contenders].sort((a, b) => POWER_ORDER[a] - POWER_ORDER[b]), rolls};
};

/**
 * Rule 13.4.2: "If a player chooses to aid the attacked non-player power that
 * player immediately gains an alliance with it."  Writes the alliance marker
 * on the power's home space (clearing the diplomacy marker it replaces).
 */
export const applyMinorAidAlliance = (
  G: ImperialElegyState,
  minor: string,
  ally: Power,
): SpaceId | null => {
  const home = nonPlayerHome(minor);
  if (home === null || !G.spaces[home]) return null;
  // The alliance belongs to the power, so every space it controls carries the
  // new ally marker (a multi-space non-player such as unified Italy).  The
  // diplomacy marker the aid replaces is cleared.
  const controlId = nonPlayerControlId(minor);
  for (const [space, state] of Object.entries(G.spaces)) {
    if (space !== home && state.control !== controlId) continue;
    state.ally = ally;
    state.diplomacy = null;
  }
  return home;
};

/**
 * Rule 14.3: a player's CP war budget is the card's CP plus industry.
 *
 * 33.3 Second French Empire: "After FR calculates their CP war budget
 * (including during the GW) they automatically increase it by 1."  The GW half
 * is added in `greatWarFlow.ts#beginGwTurn`; the limited-war half is here, so
 * every war budget calculated through this helper (attacker and called ally)
 * includes it.
 */
export const warBudgetFor = (G: ImperialElegyState, power: Power, cardCp: number): number =>
  Math.max(0, cardCp) +
  (G.powers[power]?.industry ?? 0) +
  governmentBenefits(G, power).warBudgetBonus;

/** Rule 13.3: conquest raises the WTT by one, then costs that WTT in stability. */
export const conquestDeclarationPenalty = (
  G: ImperialElegyState,
  stabilityDiscount = 0,
): {wttDelta: number; stabilityDelta: number} => {
  const nextWtt = Math.min(5, G.wtt + 1);
  return {
    wttDelta: nextWtt - G.wtt,
    stabilityDelta: -Math.max(0, nextWtt - Math.max(0, stabilityDiscount)),
  };
};

// ---------------------------------------------------------------------------
// Alliance calls (rules 14.0 / 14.1)
// ---------------------------------------------------------------------------

export type AllyBlockReason =
  | "no-war"
  | "not-primary"
  | "not-allied"
  | "already-belligerent"
  | "no-valid-card"
  | "eliminated"
  | "truce"
  /** 8.4: the alliance the joining neutral would enter already has three players. */
  | "alliance-full";

export interface AllyRefusalPenalty {
  stability: number;
  neutralInfluence: number;
  exemptForTruce: boolean;
}

/** Options for {@link applyAllyRefusal}. */
export interface AllyRefusalOptions {
  /** Rule 14.0 exception: a truce-forced refusal carries no penalty. */
  exemptForTruce?: boolean;
  /**
   * Legacy escape hatch for callers that have already applied a stability loss
   * for the same refusal.  The live 13.4.1 abandonment path no longer uses it:
   * its printed -1 and the 14.0 committed-box -1 are separate penalties.
   */
  skipStability?: boolean;
}

export interface AllyCallOptions {
  /** Explicit card to play for the ally's war budget. */
  cardId?: CardId;
  /** Powers the would-be ally currently holds a truce with. */
  truceWith?: readonly Power[];
  /**
   * 33.2 Maintaining the Status Quo: "If the UK is the primary belligerent and
   * the defender in a war (including after playing Balance of Power), it can
   * ask allied players **and neutral players** to join the war during the
   * alliance step."  Only `moves.ts#callWarAlly`/`joinWarAsAlly` set this, and
   * only for a UK that is the war's primary defender in the alliance step.
   */
  statusQuo?: boolean;
  /**
   * The alliance box the invited neutral enters when rule 8.2's direction is
   * undetermined (both chits neutral).  The 14.0 consent decision offers the
   * invited neutral the printed choice; direct callers get the deterministic
   * Triple-Entente-first default.
   */
  allianceSide?: AllianceSide;
}

export interface AllyCallValidation {
  ok: boolean;
  caller: Power;
  ally: Power;
  side: WarSideName | null;
  cardId: CardId | null;
  budget: number;
  reason?: AllyBlockReason;
  refusal: AllyRefusalPenalty;
  /** True when the join is the 33.2 Status Quo neutral invitation. */
  statusQuo: boolean;
  /** The alliance box side a Status Quo neutral enters; null for a normal call. */
  allianceSide: AllianceSide | null;
}

/** Rule 14.0 refusal penalties, by the refusing player's alliance box. */
export const allyRefusalPenalty = (
  G: ImperialElegyState,
  ally: Power,
  exemptForTruce = false,
): AllyRefusalPenalty => {
  if (exemptForTruce) return {stability: 0, neutralInfluence: 0, exemptForTruce: true};
  const box = G.powers[ally]?.alliance;
  if (box === "teCommitted" || box === "taCommitted") {
    return {stability: -1, neutralInfluence: 10, exemptForTruce: false};
  }
  if (box === "teAligned" || box === "taAligned") {
    return {stability: 0, neutralInfluence: 5, exemptForTruce: false};
  }
  return {stability: 0, neutralInfluence: 0, exemptForTruce: false};
};

export interface AllyRefusalResult extends AllyRefusalPenalty {
  applied: boolean;
  caller: Power | null;
  ally: Power;
  /** Side the ally was asked to join, when known. */
  side: WarSideName | null;
}

/**
 * Rule 14.0: apply the printed consequences of a player ally refusing a call
 * to war.  An aligned box takes 5 neutral influence on the MPIT; a committed
 * box loses 1 stability and takes 10.  A refusal forced by an existing truce
 * (rule 14.0 exception) carries no penalty at all.
 *
 * Rule 13.4.1/13.4.2 refusals call this too.  Rule 13.4.1's own -1 stability is
 * a separate penalty and is not suppressed here; only an explicit caller that
 * has already charged the same loss should pass `skipStability`.
 *
 * The helper is pure state mutation: no CP, cards or phase events are touched,
 * so the `callWarAlly` consent decision can use it directly.
 */
export const applyAllyRefusal = (
  G: ImperialElegyState,
  war: WarState | null,
  caller: Power,
  ally: Power,
  options: AllyRefusalOptions = {},
  ctx?: Ctx,
): AllyRefusalResult => {
  if (!G.powers[ally]) {
    return {applied: false, caller, ally, side: null, stability: 0, neutralInfluence: 0, exemptForTruce: false};
  }
  const side = war ? sideOf(war, caller) : null;
  const penalty = allyRefusalPenalty(G, ally, options.exemptForTruce === true);
  const stability = options.skipStability === true ? 0 : penalty.stability;
  if (stability !== 0) {
    changeStability(G, ally, stability, ctx, {cause: "war"});
  }
  if (penalty.neutralInfluence > 0) {
    G.powers[ally].mpit.neutral += penalty.neutralInfluence;
  }
  log(G, ally, "allyRefusedWar", {
    caller,
    side: side ?? "unknown",
    stability,
    neutralInfluence: penalty.neutralInfluence,
    exemptForTruce: penalty.exemptForTruce,
  });
  return {applied: true, caller, ally, side, ...penalty, stability};
};

/** First hand card that may legally be played into a CP war budget. */
export const warBudgetCardId = (G: ImperialElegyState, power: Power): CardId | null => {
  const hand = G.powers[power]?.hand ?? [];
  for (const cardId of hand) {
    if (!isCardId(cardId)) continue;
    const card = cardById(cardId);
    // Mandatory events, responses and combat cards cannot be played for CP.
    if (card.type === "event") return cardId;
  }
  return null;
};

const sideOf = (war: WarState, power: Power): WarSideName | null => {
  if (war.attacker === power) return "attacker";
  if (war.defender === power) return "defender";
  if (war.attackerAllies.includes(power)) return "attacker";
  if (war.defenderAllies.includes(power)) return "defender";
  return null;
};

const opposingPrimary = (war: WarState, side: WarSideName): Power =>
  side === "attacker" ? war.defender : war.attacker;

/** Rule 14.0: starting with the attacker, a primary belligerent may call player allies. */
export const allyCallEligibility = (
  G: ImperialElegyState,
  war: WarState | null,
  caller: Power,
  ally: Power,
  options: AllyCallOptions = {},
): AllyCallValidation => {
  const side = war ? sideOf(war, caller) : null;
  const callerIsPrimary = war !== null && (caller === war.attacker || caller === war.defender);
  // Rule 13.5: an ally may not join a war against any power it holds a truce
  // with.  Live callers pass `truceRivals(G, ally)`; the caller itself and the
  // opposing primary are kept for direct callers that pass a single power.
  const opposing = war !== null && side !== null
    ? sidePowers(war, side === "attacker" ? "defender" : "attacker")
    : [];
  const truce = options.truceWith?.includes(caller) === true ||
    (war !== null && side !== null && options.truceWith?.includes(opposingPrimary(war, side)) === true) ||
    opposing.some((power) => options.truceWith?.includes(power) === true);
  const penalty = allyRefusalPenalty(G, ally, truce);
  const block = (reason: AllyBlockReason, cardId: CardId | null = null, budget = 0): AllyCallValidation => ({
    ok: false,
    caller,
    ally,
    side,
    cardId,
    budget,
    reason,
    refusal: penalty,
    statusQuo: false,
    allianceSide: null,
  });

  if (!war) return block("no-war");
  if (!callerIsPrimary || side === null) return block("not-primary");
  if (ally === caller) return block("not-allied");
  if (G.powers[ally]?.eliminated) return block("eliminated");
  if (sideOf(war, ally) !== null) return block("already-belligerent");
  if (truce) return block("truce");

  // 33.2 Maintaining the Status Quo: only the UK, only as the primary defender
  // (originally or after Balance of Power), and only during the alliance step.
  const statusQuoEligible =
    options.statusQuo === true && caller === "UK" && war.defender === "UK" && war.status === "alliance";

  const callerAlliance = allianceOf(G.powers[caller].alliance);
  const allyAlliance = allianceOf(G.powers[ally]?.alliance ?? "neutral");
  // Rule 8.2 / 14.2: a Status Quo neutral joins away from the attacker.  The
  // both-neutral case is the printed "the defending power chooses which
  // alliance box to shift into"; the consent decision offers that choice.
  let allianceSide: AllianceSide | null = null;
  if (callerAlliance === null || callerAlliance !== allyAlliance) {
    if (!statusQuoEligible || allyAlliance !== null) return block("not-allied");
    const derived = declarationShiftDirection(
      G.powers[war.attacker].alliance,
      G.powers[ally].alliance,
    );
    const preferred =
      derived ??
      options.allianceSide ??
      (canJoinAlliance(G, ally, "te") ? "te" : "ta");
    if (!canJoinAlliance(G, ally, preferred)) return block("alliance-full");
    allianceSide = preferred;
  }

  const cardId = options.cardId ?? warBudgetCardId(G, ally);
  if (cardId === null || !G.powers[ally].hand.includes(cardId)) return block("no-valid-card");
  if (!isCardId(cardId)) return block("no-valid-card");
  const card = cardById(cardId);
  if (card.type !== "event") return block("no-valid-card");

  return {
    ok: true,
    caller,
    ally,
    side,
    cardId,
    budget: warBudgetFor(G, ally, card.cp),
    refusal: penalty,
    statusQuo: allianceSide !== null,
    allianceSide,
  };
};

export interface AllyJoinResult extends AllyCallValidation {
  applied: boolean;
}

/** Apply a successful player-ally call (discard the card, add the side/budget). */
export const joinWarAsAlly = (
  G: ImperialElegyState,
  war: WarState | null,
  caller: Power,
  ally: Power,
  options: AllyCallOptions = {},
): AllyJoinResult => {
  const call = allyCallEligibility(G, war, caller, ally, options);
  if (!call.ok || !war || !call.cardId || call.side === null) return {...call, applied: false};

  G.powers[ally].hand = G.powers[ally].hand.filter((id) => id !== call.cardId);
  G.discard.push(call.cardId);
  if (call.side === "attacker") war.attackerAllies.push(ally);
  else war.defenderAllies.push(ally);
  war.budgets[ally] = call.budget;
  log(G, caller, "allyJoinedWar", {ally, card: call.cardId, side: call.side});
  // 33.2 Status Quo / 8.2: the joining neutral takes a legal alliance box on
  // the defender's side.  The cap was enforced by the eligibility check above;
  // this is the printed "shift away from the attacker" step.
  if (call.allianceSide !== null) {
    const shift = shiftAlliance(G, ally, call.allianceSide, 1);
    log(G, ally, "allianceShifted", {
      from: shift.from,
      to: shift.to,
      steps: shift.steps,
      statusQuo: true,
      attacker: war.attacker,
    });
  } else if (call.side === "defender" && war.minorTarget !== undefined) {
    // Rule 14.2: "This includes a player ally that just agreed to aid a minor
    // power."  The joining defender shifts away from the attacker, with rule
    // 8.4's three-player maximum enforced.
    const shift = allyAidShift(G, war.attacker, ally);
    log(G, ally, "allianceShifted", {
      from: shift.from,
      to: shift.to,
      steps: shift.steps,
      attacker: war.attacker,
      aidMinor: war.minorTarget.minor,
      blocked: shift.blocked,
      fallback: shift.defaultDirection,
    });
  }
  return {...call, applied: true};
};

export interface MinorJoinResult {
  ok: boolean;
  caller: Power;
  minor: string;
  side: WarSideName | null;
  reason?: "no-war" | "not-primary" | "unknown-minor" | "not-allied" | "already-belligerent";
  applied: boolean;
}

/** Rule 14.0: minor allies (and unified Italy) join at the primary's discretion, for free. */
export const joinWarAsMinor = (
  G: ImperialElegyState,
  war: WarState | null,
  caller: Power,
  minor: string,
): MinorJoinResult => {
  const side = war ? sideOf(war, caller) : null;
  if (!war) return {ok: false, caller, minor, side, reason: "no-war", applied: false};
  if (side === null || (caller !== war.attacker && caller !== war.defender)) {
    return {ok: false, caller, minor, side, reason: "not-primary", applied: false};
  }
  const home = MINOR_POWER_HOMES[minor];
  if (!home) return {ok: false, caller, minor, side, reason: "unknown-minor", applied: false};
  const allied = G.spaces[home]?.ally === caller ||
    Object.values(G.spaces).some((state) => state.control === minor && state.ally === caller);
  if (!allied) return {ok: false, caller, minor, side, reason: "not-allied", applied: false};
  if (war.attackerMinors.includes(minor) || war.defenderMinors.includes(minor)) {
    return {ok: false, caller, minor, side, reason: "already-belligerent", applied: false};
  }
  if (side === "attacker") war.attackerMinors.push(minor);
  else war.defenderMinors.push(minor);
  log(G, caller, "minorJoinedWar", {minor, side});
  return {ok: true, caller, minor, side, applied: true};
};

// ---------------------------------------------------------------------------
// Initiative (rules 14.3 / 33.1)
// ---------------------------------------------------------------------------

export interface InitiativeOptions {
  /** Override each belligerent's card CP (defaults to budget minus industry). */
  cardCp?: Partial<Record<Power, number>>;
  /** Bewegungskrieg: Germany wins all initiative ties (rule 33.1). */
  bewegungskrieg?: boolean;
  /** Final tie-break after CP, GE and industry; defaults to seat order. */
  tieBreak?: (a: Power, b: Power) => number;
}

/** Player belligerents in side order: attacker, defender, then allies. */
/**
 * Rules 13.5 / 16.3: the powers `power` currently holds a truce with — every
 * belligerent on the other side of a settled war whose truce has not yet
 * counted down to 0.  Players cannot attack, or join a war against, them.
 */
export const truceRivals = (G: ImperialElegyState, power: Power): Power[] => {
  const rivals = new Set<Power>();
  for (const war of G.wars ?? []) {
    if (war === G.war || !(war.truceTurns > 0)) continue;
    const attackers = sidePowers(war, "attacker");
    const defenders = sidePowers(war, "defender");
    if (attackers.includes(power)) defenders.forEach((rival) => rivals.add(rival));
    if (defenders.includes(power)) attackers.forEach((rival) => rivals.add(rival));
  }
  rivals.delete(power);
  return [...rivals];
};

/** Rule 13.5: whether `a` and `b` hold an active truce with each other. */
export const hasTruce = (G: ImperialElegyState, a: Power, b: Power): boolean =>
  truceRivals(G, a).includes(b);

/**
 * Rule 15.4.2: only players take wartime impulses.  A lone non-player defender
 * never moves or attacks, so it is deliberately absent from the belligerent
 * and initiative lists; its units still defend (18.0).
 */
export const belligerentsOf = (war: WarState): Power[] => {
  const order: PowerOrMinor[] = [war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies];
  return [...new Set(order)].filter(isPower);
};

export const sidePowers = (war: WarState, side: WarSideName): Power[] =>
  (side === "attacker" ? [war.attacker, ...war.attackerAllies] : [war.defender, ...war.defenderAllies]).filter(
    isPower,
  );

/**
 * 15.2.3 Deploy Reserves: reserve armies equal to half the power's industry,
 * rounded up, with a minimum of 1 and a maximum of 3.
 *
 * A063 Rapid Mobilization's second clause deploys one extra reserve army
 * during that war, still capped at the printed maximum of three.
 */
export const deployReserveLimit = (
  G: ImperialElegyState,
  power: Power,
  war: WarState | null = G.war,
): number => {
  const p = G.powers[power];
  if (!p) return 0;
  const base = Math.min(3, Math.max(1, Math.ceil(p.industry / 2)));
  const rapid = Boolean(
    war &&
    war.status === "maneuver" &&
    !G.gw?.active &&
    p.flags.rapidMobilization === true,
  );
  return rapid ? Math.min(3, base + 1) : base;
};

/**
 * A063's first clause: during the playing belligerent's first maneuver
 * impulse they may conduct one free deploy reserves action.  The engine
 * tracks the free use with `rapidFreeDeployUsed`; "first impulse" is any
 * action before that belligerent first passes.
 */
export const rapidMobilizationFreeDeploy = (
  G: ImperialElegyState,
  power: Power,
  war: WarState | null = G.war,
): boolean => {
  const p = G.powers[power];
  if (!p || !war) return false;
  if (war.status !== "maneuver" || G.gw?.active) return false;
  if (p.flags.rapidMobilization !== true) return false;
  if (p.flags.rapidFreeDeployUsed === true) return false;
  return !war.passed.includes(power);
};

/** Card CP inferred from the war budget (budget = card CP + industry). */
export const warCardCp = (G: ImperialElegyState, war: WarState, power: Power): number =>
  Math.max(0, (war.budgets[power] ?? 0) - (G.powers[power]?.industry ?? 0));

/**
 * Rule 14.3 order: higher CP card, then GE wins ties, then higher industry,
 * then the supplied roll-off.  Without `tieBreak` the final tie falls back to
 * seat order (pure callers/tests); `startWarManeuver` passes
 * `initiativeRollOff` so live wars roll off as printed.
 */
/**
 * Rule 14.3's final tie-break: "players roll off to break further ties".
 * Returns a comparator for `InitiativeOptions.tieBreak`.  Each power's rolls
 * are drawn lazily and memoised, and a tied roll is rerolled by extending both
 * sequences, so the comparator is a consistent total order and no die is used
 * unless two powers are genuinely tied.  Seat order is the last resort after
 * `maxRolls` tied rolls.
 */
export const initiativeRollOff = (
  rollDie: () => number,
  maxRolls = 20,
): ((a: Power, b: Power) => number) => {
  const rolls = new Map<Power, number[]>();
  const rollAt = (power: Power, index: number): number => {
    const seq = rolls.get(power) ?? [];
    while (seq.length <= index) seq.push(rollDie());
    rolls.set(power, seq);
    return seq[index];
  };
  return (a, b) => {
    if (a === b) return 0;
    for (let i = 0; i < maxRolls; i += 1) {
      const diff = rollAt(b, i) - rollAt(a, i);
      if (diff !== 0) return diff;
    }
    return POWER_ORDER[a] - POWER_ORDER[b];
  };
};

export const initiativeOrder = (
  G: ImperialElegyState,
  war: WarState,
  options: InitiativeOptions = {},
): Power[] => {
  const useBewegungskrieg = options.bewegungskrieg ?? true;
  const fallback = options.tieBreak ?? ((a, b) => POWER_ORDER[a] - POWER_ORDER[b]);
  const cp = (power: Power): number => options.cardCp?.[power] ?? warCardCp(G, war, power);
  const industry = (power: Power): number => G.powers[power]?.industry ?? 0;

  return [...belligerentsOf(war)].sort((a, b) => {
    const cpDiff = cp(b) - cp(a);
    if (cpDiff !== 0) return cpDiff;
    if (useBewegungskrieg && (a === "GE" || b === "GE") && a !== b) return a === "GE" ? -1 : 1;
    const industryDiff = industry(b) - industry(a);
    if (industryDiff !== 0) return industryDiff;
    return fallback(a, b);
  });
};

// ---------------------------------------------------------------------------
// Victory classification (rules 15.5 / 16.1)
// ---------------------------------------------------------------------------

export type PrimaryVictoryKind = "major" | "normal" | "defensive" | "negotiated" | "whitePeace";
export type WarVictoryKind = PrimaryVictoryKind | "allyKnockout";

export interface AllyKnockout {
  power: Power;
  by: WarSideName;
  /** Primary belligerent on the occupying side. */
  occupier: Power;
  /**
   * Rule 16.1.6: the power that actually took the capital (may be an ally of
   * the side primary).  That power chooses the losing side's treaty option.
   */
  captor: Power;
  capital: SpaceId;
  treatyOptions: 1;
}

export interface VictoryClassification {
  /** Primary outcome, plus `allyKnockout` when that is the only result. */
  kind: WarVictoryKind;
  /** The underlying primary outcome (white peace when only an ally fell). */
  primary: PrimaryVictoryKind;
  victor: WarSideName | null;
  /**
   * Rule 16.1.6: in a white peace with knockouts on both sides there is no
   * victor, so no printed order says which side answers its (mandatory)
   * knockout option first.  The live settlement negotiates it between the two
   * primaries (proposal, response, counter) and records the agreed order here;
   * absent means the initiative-order fallback.
   */
  firstSide?: WarSideName;
  winner: Power | null;
  loser: Power | null;
  /** Treaty options from the primary outcome. */
  treatyOptions: number;
  /**
   * Rule 16.1.6: the winner's extra options, each usable only against an ally
   * of the loser that the winner knocked out.
   */
  allyKnockoutTreatyOptions: number;
  /** The winner's total picks (primary outcome + its ally-knockout options). */
  totalTreatyOptions: number;
  /**
   * Rule 16.1.6: "If a player lost a war but knocked out the winner's ally
   * before the war ended, the loser chooses their treaty option after the
   * winner."  One mandatory option per ally of the winning side that the
   * losing side knocked out, chosen by the losing primary after the winner.
   */
  loserTreatyOptions: number;
  /** Stability hooks (major victory only). */
  stability: {winner: number; loser: number};
  truceTurns: 1 | 2;
  allyKnockouts: AllyKnockout[];
  notes: string[];
}

export interface VictoryOptions {
  /**
   * Explicit negotiated peace (rule 16.1.4): the side conceding one treaty
   * option.  The other side is the victor.
   */
  negotiatedPeace?: WarSideName | null;
  /** Explicit white-peace agreement (rule 16.1.5). */
  whitePeace?: boolean;
  /** Spaces the attacker controlled at the start of the war (defensive victory). */
  attackerControlledAtStart?: readonly SpaceId[];
  /** True when the defender has the attacker blockaded (rule 16.1.3). */
  defenderBlockading?: boolean;
}

/** Printed nationality of a space, for the 13.2.1 Italian-unification test. */
const printedNationalitiesOf = (space: SpaceId): readonly string[] => {
  const printed = SPACES[space]?.nationalities;
  if (printed && printed.length > 0) return printed;
  return DEFAULT_SPACE_NATIONALITIES[space] ?? [];
};

/**
 * Rule 16.2.1: "During an Italian war of unification or during a war of
 * liberation this option [territorial cession] must be selected by a victorious
 * attacker."  A unification war counts as Italian when its objectives contain
 * Italian nationality (13.2.1), which distinguishes it from GE's German
 * unification and AU's citizenship unification.
 */
export const warRequiresMandatoryCession = (war: WarState): boolean =>
  war.warAim === "liberation" ||
  (war.warAim === "unification" && war.objectives.some((space) => printedNationalitiesOf(space).includes("Italians")));

/**
 * Rule 16.2.1: whether a victorious attacker still owes the mandatory
 * territorial cession.  A defensive/white-peace outcome has no victorious
 * attacker and therefore no mandatory cession.
 */
export const mandatoryCessionPending = (
  war: WarState,
  victory: VictoryClassification,
  choices: readonly TreatyChoice[] = [],
): boolean =>
  victory.victor === "attacker" &&
  warRequiresMandatoryCession(war) &&
  !war.treaties.includes("territorialCession") &&
  !choices.some(
    (choice) =>
      choice.option === "territorialCession" &&
      (choice.target === undefined || choice.target === victory.loser),
  );

/**
 * Rule 16.1.6: the side whose treaty picks are answered first.  A classified
 * victory names the victor; a white peace with knockouts has no printed order,
 * so the negotiated `firstSide` wins and the fallback follows the war's
 * initiative order (the first primary belligerent to act; 14.1/14.3).
 */
export const firstTreatySide = (victory: VictoryClassification): WarSideName | null =>
  victory.victor ?? victory.firstSide ?? (victory.kind === "allyKnockout" ? "attacker" : null);

/**
 * Rule 16.1.6: a white peace where both sides knocked out an ally has no
 * classified victor, so the live settlement asks which side chooses first.
 * One-sided knockouts keep the single captor's group (the other side has no
 * mandatory pick), so they need no order choice.
 */
export const needsWhitePeaceOrderChoice = (victory: VictoryClassification): boolean =>
  victory.victor === null &&
  victory.primary === "whitePeace" &&
  victory.kind === "allyKnockout" &&
  victory.allyKnockouts.some((knockout) => knockout.by === "attacker") &&
  victory.allyKnockouts.some((knockout) => knockout.by === "defender");

const spaceHeldBySide = (G: ImperialElegyState, war: WarState, space: SpaceId, side: WarSideName): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  const powers = sidePowers(war, side);
  if (isPower(state.occupiedBy) && powers.includes(state.occupiedBy)) return true;
  if (isPower(state.control) && powers.includes(state.control)) return true;
  if (state.control !== null && state.control !== undefined && !isPower(state.control)) {
    return powers.some((power) => state.ally === power);
  }
  return false;
};

const capitalHeldBySide = (G: ImperialElegyState, war: WarState, power: Power, side: WarSideName): boolean =>
  // 15.5/16.1.1/33.5: the capital is live, so a post-Ankara OT war uses Ankara.
  spaceHeldBySide(G, war, capitalOf(G, power), side);

/**
 * Rule 16.1.6: who made the knockout?  The power that actually holds the
 * occupied capital (an ally of the side primary is possible), falling back to
 * the side primary for hand-written states and old saves.
 */
const knockoutCaptorOf = (
  G: ImperialElegyState,
  war: WarState,
  by: WarSideName,
  capital: SpaceId,
): Power => {
  const primary = by === "attacker" ? war.attacker : war.defender;
  const state = G.spaces[capital];
  if (!state) return primary;
  const side = sidePowers(war, by);
  for (const holder of [state.occupiedBy, state.control]) {
    if (isPower(holder) && side.includes(holder)) return holder;
  }
  return primary;
};

/**
 * 15.6: record one knocked-out ally on the war.  Idempotent — an ally is
 * recorded once, even if later battles move the capital back and forth.
 *
 * `captor` is the power that took the capital (16.1.6); when omitted the live
 * board decides, so a knockout recorded by the safety net still names the
 * ally that actually occupied the capital rather than the side primary.
 */
const recordWarKnockout = (
  G: ImperialElegyState,
  war: WarState,
  power: Power,
  by: WarSideName,
  capital: SpaceId,
  captor?: Power,
): AllyKnockout | null => {
  const list = war.knockedOut ?? (war.knockedOut = []);
  if (list.some((entry) => entry.power === power)) return null;
  // Rule 15.6 knockouts are player-vs-player events; a lone non-player
  // defender never occupies a capital, so it can never be the occupier.
  if (by === "defender" && !isPower(war.defender)) return null;
  const occupier = by === "attacker" ? war.attacker : war.defender;
  const bySide = sidePowers(war, by);
  const actual = captor !== undefined && bySide.includes(captor) ? captor : knockoutCaptorOf(G, war, by, capital);
  const record: WarKnockoutRecord = {power, by, occupier, captor: actual, capital, turn: G.turn};
  list.push(record);
  log(G, occupier, "warAllyKnockout", {power, by, capital, captor: actual});
  // 15.6: "When a player ally (or Italy) is knocked out, displace any allied
  // units in their territory."  Recorded once, so the displacement also runs
  // once per knockout (5.7 targets; the power's own units stay in place).
  displaceAlliedUnitsInTerritory(G, power);
  return {power, by, occupier, captor: actual, capital, treatyOptions: 1};
};

/**
 * 15.6 "Occupying the capital of a player who is not a primary belligerent
 * immediately knocks that player out of the war."  Called from the live capture
 * resolver (`applyGwKeyCapture`) and the amphibious landing path, so the
 * knockout exists in `war.knockedOut` long before the victory step: retaking
 * the capital cannot retroactively avoid the 16.1.6 treaty option.  Minor
 * powers are never knocked out of a war, and a primary belligerent's capital is
 * a victory condition rather than a knockout, so only `*Allies` are considered.
 */
export const recordWarKnockoutCapture = (
  G: ImperialElegyState,
  space: SpaceId,
  captor: Power,
): AllyKnockout | null => {
  const war = G.war;
  if (!war || G.gw?.active || !isPower(captor)) return null;
  const onAttacker = war.attacker === captor || war.attackerAllies.includes(captor);
  const onDefender = war.defender === captor || war.defenderAllies.includes(captor);
  if (onAttacker === onDefender) return null;
  const by: WarSideName = onAttacker ? "attacker" : "defender";
  const victims = by === "attacker" ? war.defenderAllies : war.attackerAllies;
  const power = victims.find((ally) => capitalOf(G, ally) === space);
  if (power === undefined) return null;
  return recordWarKnockout(G, war, power, by, capitalOf(G, power), captor);
};

/**
 * 15.6 safety net: record every player ally whose capital is currently held by
 * the opposing side.  Used before the settlement classifies the war so a
 * knockout that happened through a path without a capture hook is still
 * historical (and a later recapture cannot undo it).  Returns only the new
 * records.
 */
export const recordWarKnockouts = (G: ImperialElegyState): AllyKnockout[] => {
  const war = G.war;
  if (!war || G.gw?.active) return [];
  const out: AllyKnockout[] = [];
  for (const power of [...war.attackerAllies].sort((a, b) => POWER_ORDER[a] - POWER_ORDER[b])) {
    if (!capitalHeldBySide(G, war, power, "defender")) continue;
    const recorded = recordWarKnockout(G, war, power, "defender", capitalOf(G, power));
    if (recorded) out.push(recorded);
  }
  // Rule 15.4.2: a lone non-player defender has no player allies to knock out.
  if (isPower(war.defender)) {
    for (const power of [...war.defenderAllies].sort((a, b) => POWER_ORDER[a] - POWER_ORDER[b])) {
      if (!capitalHeldBySide(G, war, power, "attacker")) continue;
      const recorded = recordWarKnockout(G, war, power, "attacker", capitalOf(G, power));
      if (recorded) out.push(recorded);
    }
  }
  return out;
};

/**
 * 15.6 / 16.1.6: every knocked-out player ally, from the historical record
 * first.  The live capital check remains as the fallback for hand-written
 * states and saves created before `war.knockedOut` existed.
 */
const knockoutsFor = (G: ImperialElegyState, war: WarState): AllyKnockout[] => {
  const recorded = (power: Power): WarKnockoutRecord | undefined =>
    (war.knockedOut ?? []).find((entry) => entry.power === power);
  /** Use the recorded captor, or recover it from the live board (old saves). */
  const captorOf = (record: WarKnockoutRecord, capital: SpaceId): Power => {
    const side = sidePowers(war, record.by);
    if (record.captor !== undefined && side.includes(record.captor)) return record.captor;
    return knockoutCaptorOf(G, war, record.by, capital);
  };
  const out: AllyKnockout[] = [];
  for (const power of [...war.attackerAllies].sort((a, b) => POWER_ORDER[a] - POWER_ORDER[b])) {
    const record = recorded(power);
    if (record) {
      out.push({
        power,
        by: record.by,
        occupier: record.occupier,
        captor: captorOf(record, record.capital),
        capital: record.capital,
        treatyOptions: 1,
      });
    } else if (capitalHeldBySide(G, war, power, "defender")) {
      const capital = capitalOf(G, power);
      out.push({
        power,
        by: "defender",
        occupier: war.defender,
        captor: knockoutCaptorOf(G, war, "defender", capital),
        capital,
        treatyOptions: 1,
      });
    }
  }
  // Rule 15.4.2: a lone non-player defender has no player allies to knock out.
  const defenderAllies = isPower(war.defender)
    ? [...war.defenderAllies].sort((a, b) => POWER_ORDER[a] - POWER_ORDER[b])
    : [];
  for (const power of defenderAllies) {
    const record = recorded(power);
    if (record) {
      out.push({
        power,
        by: record.by,
        occupier: record.occupier,
        captor: captorOf(record, record.capital),
        capital: record.capital,
        treatyOptions: 1,
      });
    } else if (capitalHeldBySide(G, war, power, "attacker")) {
      const capital = capitalOf(G, power);
      out.push({
        power,
        by: "attacker",
        occupier: war.attacker,
        captor: knockoutCaptorOf(G, war, "attacker", capital),
        capital,
        treatyOptions: 1,
      });
    }
  }
  // A recorded knockout whose ally no longer appears on a side roster still
  // counts ("Regardless of the war's outcome, an ally knockout still occurs").
  for (const record of war.knockedOut ?? []) {
    if (out.some((entry) => entry.power === record.power)) continue;
    out.push({
      power: record.power,
      by: record.by,
      occupier: record.occupier,
      captor: captorOf(record, record.capital),
      capital: record.capital,
      treatyOptions: 1,
    });
  }
  return out;
};

/**
 * Classify a war's result.  Explicit agreements take precedence; otherwise a
 * capital (or a recorded surrender in `war.victor`) is a major victory, all
 * attacker objectives is a normal victory, the defensive conditions are next,
 * and no condition met is a white peace.  Ally knockouts are always reported
 * separately and also become the classification when the primary is a white
 * peace.
 */
export const classifyVictory = (
  G: ImperialElegyState,
  war: WarState,
  options: VictoryOptions = {},
): VictoryClassification => {
  const knockouts = knockoutsFor(G, war);
  const notes: string[] = [];
  let primary: PrimaryVictoryKind;
  let victor: WarSideName | null = null;

  if (options.whitePeace) {
    primary = "whitePeace";
    notes.push("whitePeace:agreement");
  } else if (options.negotiatedPeace) {
    const conceding = options.negotiatedPeace;
    victor = conceding === "attacker" ? "defender" : "attacker";
    primary = "negotiated";
    notes.push(`negotiated:${conceding}Concedes`);
  } else {
    // Rule 15.4.2 / 16.1.1: a lone non-player defender has no capital and
    // "major victories cannot be achieved against non-player powers", so the
    // defender-capital condition never applies to such a war.
    const loneDefender = isLoneMinorWar(war);
    const attackerCapital = capitalHeldBySide(G, war, war.attacker, "defender");
    const defenderCapital = !loneDefender && capitalHeldBySide(G, war, war.defender, "attacker");
    const surrendered = war.victor;
    if (defenderCapital || surrendered === "attacker") {
      primary = "major";
      victor = "attacker";
      notes.push(defenderCapital ? "major:defenderCapital" : "major:defenderSurrendered");
    } else if (attackerCapital || surrendered === "defender") {
      if (loneDefender) {
        // 13.6: "Minor powers defending alone without the aid of a player will
        // never surrender", so `surrendered === "defender"` is the attacker
        // conceding.  The lone defender cannot collect a major victory or a
        // treaty option (16.1.1 / 16.1: only a victorious player imposes), so
        // the war ends as a defensive result with no terms.
        primary = "defensive";
        victor = "defender";
        notes.push(attackerCapital ? "defensive:attackerCapital" : "loneDefender:attackerSurrendered");
      } else {
        primary = "major";
        victor = "defender";
        notes.push(attackerCapital ? "major:attackerCapital" : "major:attackerSurrendered");
      }
    } else {
      const objectivesHeld =
        war.objectives.length > 0 &&
        war.objectives.every((space) => spaceHeldBySide(G, war, space, "attacker"));
      if (objectivesHeld) {
        primary = "normal";
        victor = "attacker";
        notes.push("normal:allObjectives");
      } else {
        const attackerStart = options.attackerControlledAtStart ?? [];
        const defenderHoldsStart = attackerStart.some((space) => {
          const state = G.spaces[space];
          if (!state) return false;
          const defenders = sidePowers(war, "defender");
          return defenders.some((power) => state.control === power || state.occupiedBy === power);
        });
        if (defenderHoldsStart || options.defenderBlockading) {
          primary = "defensive";
          victor = "defender";
          notes.push(defenderHoldsStart ? "defensive:attackerSpaceHeld" : "defensive:blockade");
        } else {
          primary = "whitePeace";
          notes.push("whitePeace:noConditionMet");
        }
      }
    }
  }

  const winner = victor === null ? null : victor === "attacker" ? war.attacker : war.defender;
  const loser = victor === null ? null : victor === "attacker" ? war.defender : war.attacker;
  const stability = primary === "major" ? {winner: 1, loser: -1} : {winner: 0, loser: 0};
  // Rule 16.1: "The victorious player imposes treaty options on the loser."
  // A non-player defender that wins can impose nothing (the player-side
  // implementation has no non-player chooser); 16.1.1 already bars a major
  // victory against a non-player power.
  const victorCanImpose = victor === "attacker" || (victor === "defender" && isPower(war.defender));
  const baseTreatyOptions =
    primary === "major" ? 2 : primary === "normal" || primary === "defensive" || primary === "negotiated" ? 1 : 0;
  const treatyOptions = victorCanImpose ? baseTreatyOptions : 0;
  const kind: WarVictoryKind = primary === "whitePeace" && knockouts.length > 0 ? "allyKnockout" : primary;

  // Rule 16.1.6: "Regardless of the war's outcome, an ally knockout still
  // occurs."  When no primary outcome was won, a knockout by a single side
  // names that side as the practical victor, while `primary` stays whitePeace.
  let classifiedVictor = victor;
  let classifiedWinner = winner;
  let classifiedLoser = loser;
  if (kind === "allyKnockout") {
    for (const knockout of knockouts) notes.push(`allyKnockout:${knockout.power}:${knockout.by}`);
    const knockoutSides = new Set(knockouts.map((knockout) => knockout.by));
    if (victor === null && knockoutSides.size === 1) {
      const only = knockouts[0].by;
      classifiedVictor = only;
      classifiedWinner = only === "attacker" ? war.attacker : war.defender;
      // The knocked-out ally is the only target; a single one names the loser.
      classifiedLoser = knockouts.length === 1 ? knockouts[0].power : null;
    } else if (victor === null) {
      // Both sides knocked out an ally in a war with no primary victor.  There
      // is no winner and no primary loser, but both sides still impose their
      // knockout option(s).  The initiative order's first primary is the
      // deterministic fallback when no negotiated order is present.
      notes.push("allyKnockout:bothSides:initiativeFirst");
    }
  }
  // Rule 16.1.6: each side's knockout options belong to the side that did the
  // knocking out.  The first side's picks come first; the second side then
  // chooses its own option(s) against the first side's knocked-out allies.
  const firstSide = classifiedVictor ?? (kind === "allyKnockout" ? "attacker" : null);
  const secondSide = firstSide === null ? null : firstSide === "attacker" ? "defender" : "attacker";
  const allyKnockoutTreatyOptions =
    firstSide === null ? 0 : knockouts.filter((knockout) => knockout.by === firstSide).length;
  const loserTreatyOptions =
    secondSide === null ? 0 : knockouts.filter((knockout) => knockout.by === secondSide).length;

  return {
    kind,
    primary,
    victor: classifiedVictor,
    winner: classifiedWinner,
    loser: classifiedLoser,
    treatyOptions,
    allyKnockoutTreatyOptions,
    totalTreatyOptions: treatyOptions + allyKnockoutTreatyOptions,
    loserTreatyOptions,
    stability,
    truceTurns: primary === "whitePeace" ? 1 : 2,
    allyKnockouts: knockouts,
    notes,
  };
};

export interface OutcomeApplication {
  applied: boolean;
  kind: WarVictoryKind;
  victor: WarSideName | null;
  truceTurns: number;
  stability: {power: Power; delta: number}[];
  /** Hook for the caller: both primaries shift away from each other (16.2). */
  harshTerms: boolean;
}

/** Apply the primary outcome: war.victor, truce length and major-victory stability. */
export const applyVictoryOutcome = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  ctx?: Ctx,
): OutcomeApplication => {
  war.victor = victory.victor;
  war.victoryPrimary = victory.primary;
  war.truceTurns = victory.truceTurns;
  war.status = "victory";

  const stability: {power: Power; delta: number}[] = [];
  if (
    victory.primary === "major" &&
    victory.winner !== null &&
    victory.loser !== null &&
    isPower(victory.winner) &&
    isPower(victory.loser)
  ) {
    changeStability(G, victory.winner, victory.stability.winner, ctx);
    changeStability(G, victory.loser, victory.stability.loser, ctx);
    stability.push({power: victory.winner, delta: victory.stability.winner});
    stability.push({power: victory.loser, delta: victory.stability.loser});
  }

  log(G, victory.winner !== null && isPower(victory.winner) ? victory.winner : undefined, "warVictory", {
    kind: victory.kind,
    primary: victory.primary,
    victor: victory.victor ?? "whitePeace",
    treaties: victory.totalTreatyOptions + victory.loserTreatyOptions,
  });

  return {
    applied: true,
    kind: victory.kind,
    victor: victory.victor,
    truceTurns: victory.truceTurns,
    stability,
    harshTerms: victory.primary === "major" || victory.primary === "negotiated",
  };
};

// ---------------------------------------------------------------------------
// Treaty options (rule 16.2)
// ---------------------------------------------------------------------------

export type TreatyOption =
  | "territorialCession"
  | "realignment"
  | "warReparations"
  | "righteousDefense"
  | "colonialCession";

export interface TreatyChoice {
  option: TreatyOption;
  /** Territorial cession targets; defaults to the war objectives. */
  spaces?: SpaceId[];
  /** Minor power for a realignment. */
  minor?: string;
  /** Space for righteous defense or a colonial cession. */
  space?: SpaceId;
  /**
   * Victorious ally that receives the concession; defaults to the winner.
   * Rule 16.2 also allows an independent minor power ("Spaces and war
   * reparations may be awarded to any of the victorious player's allies,
   * including independent minor powers").
   */
  beneficiary?: PowerOrMinor;
  /** Treaty target when imposing an ally-knockout option. */
  target?: Power;
}

export interface TreatyIssue {
  code: string;
  message: string;
}

export interface TreatyValidation {
  ok: boolean;
  option: TreatyOption;
  imposingSide: WarSideName | null;
  beneficiary: PowerOrMinor | null;
  target: Power | null;
  treatySpaces: SpaceId[];
  issues: TreatyIssue[];
}

const treatyAlreadyUsed = (war: WarState, option: TreatyOption): boolean => war.treaties.includes(option);

const heldByAny = (G: ImperialElegyState, space: SpaceId, powers: readonly Power[]): boolean => {
  const state = G.spaces[space];
  if (!state) return false;
  return powers.some((power) => state.control === power || state.occupiedBy === power);
};

const treatyTargetFor = (war: WarState, victory: VictoryClassification, choice: TreatyChoice): Power | null => {
  if (choice.target) return choice.target;
  if (victory.kind === "allyKnockout" && victory.allyKnockouts.length === 1) {
    return victory.allyKnockouts[0].power;
  }
  return victory.loser;
};

/** Rule 16.2 validation, including the once-per-option restriction. */
export const canApplyTreaty = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  choice: TreatyChoice,
): TreatyValidation => {
  const issues: TreatyIssue[] = [];
  const add = (code: string, message: string) => issues.push({code, message});
  let imposingSide = victory.victor;
  const target = treatyTargetFor(war, victory, choice);
  const targetKnockout = target === null ? undefined : victory.allyKnockouts.find((entry) => entry.power === target);

  if (treatyAlreadyUsed(war, choice.option)) {
    add("already-used", `${choice.option} has already been chosen in this war`);
  }
  if (target === null && choice.option !== "righteousDefense") {
    add("no-target", "no losing power is available for this treaty option");
  }

  // A treaty option may target the primary loser or a player ally that was
  // knocked out of the war (rule 16.1.6).  Anything else is not a legal target.
  if (target !== null && target !== victory.loser && targetKnockout === undefined) {
    add("not-a-target", `${target} is neither the losing primary nor a knocked-out ally`);
  }
  if (targetKnockout !== undefined) {
    // Rule 16.1.6: only the side that knocked the ally out may impose the
    // option on them.  That side may be the winner (its pick comes first) or
    // the loser ("the loser chooses their treaty option after the winner").
    imposingSide = targetKnockout.by;
  }
  if (victory.kind === "allyKnockout" && target) {
    const knockout = victory.allyKnockouts.find((entry) => entry.power === target);
    if (!knockout) add("not-knocked-out", `${target} was not knocked out of this war`);
    else imposingSide = knockout.by;
  }
  if (imposingSide === null) add("no-victor", "no side may impose a treaty option");
  // Rule 16.1: "The victorious player imposes treaty options"; a lone
  // non-player defender (15.4.2) has no player to choose or receive one.
  if (imposingSide === "defender" && !isPower(war.defender)) {
    add("non-player-defender", "a non-player defender cannot impose or receive treaty options");
  }

  const victoriousPowers = imposingSide === null ? [] : sidePowers(war, imposingSide);
  const primary = imposingSide === null ? null : imposingSide === "attacker" ? war.attacker : war.defender;
  if (choice.beneficiary !== undefined && imposingSide !== null) {
    if (isPower(choice.beneficiary)) {
      if (!victoriousPowers.includes(choice.beneficiary)) {
        add("beneficiary-not-victorious", `${choice.beneficiary} is not on the victorious side`);
      }
    } else if (!independentMinorBeneficiaries(G, war, imposingSide).includes(choice.beneficiary)) {
      // Rule 16.2: only an *independent* minor power allied to the victorious
      // side may be a beneficiary; an eliminated or player-controlled minor
      // is not a free agent and cannot receive the concession.
      add(
        isIndependentMinor(G, choice.beneficiary) ? "beneficiary-minor-not-ally" : "beneficiary-minor-not-independent",
        `${choice.beneficiary} is not an independent minor ally of the victorious side`,
      );
    }
  }
  const beneficiary = choice.beneficiary ?? primary;
  const allyBeneficiary = beneficiary !== null && primary !== null && beneficiary !== primary;

  // Rule 16.2: "Spaces and war reparations may be awarded to any of the
  // victorious player's allies".  A colonial cession is a space, so an ally or
  // an independent minor ally may receive it; only realignment must stay with
  // the imposing primary ("replace it with your own").
  if (allyBeneficiary && choice.option === "realignment") {
    add("beneficiary-must-be-primary", `${choice.option} may only be imposed by the primary belligerent`);
  }
  if (allyBeneficiary && choice.option === "righteousDefense" && imposingSide !== "defender") {
    add("beneficiary-not-defender", "righteous defense returns a home space to the defender or their allies");
  }

  if (choice.option === "territorialCession") {
    if (victory.primary === "whitePeace" || imposingSide === null) {
      add("no-primary-victory", "territorial cession requires a primary victory");
    }
    const spaces = choice.spaces ?? war.objectives;
    if (spaces.length === 0) add("no-objectives", "territorial cession needs at least one target space");
    for (const space of spaces) {
      if (!war.objectives.includes(space)) add("not-an-objective", `${space} was not a war objective`);
      else if (target && !controlledBy(G, space, target)) {
        add("not-controlled-by-loser", `${space} is not controlled by ${target}`);
      }
    }
  } else if (choice.option === "realignment") {
    const minor = choice.minor;
    const germanUnification = war.warAim === "unification" && beneficiary === "GE";
    if (minor) {
      const home = MINOR_POWER_HOMES[minor];
      if (!home) add("unknown-minor", `unknown minor power ${minor}`);
      else if (target && G.spaces[home]?.ally !== target && !Object.values(G.spaces).some((state) => state.control === minor && state.ally === target)) {
        add("minor-not-allied-to-loser", `${minor} is not allied with ${target}`);
      }
    } else if (germanUnification) {
      const germanAllies = Object.values(SPACES).filter(
        (def) => def.flashpoints?.includes("germany") === true && G.spaces[def.id]?.ally === target,
      );
      if (germanAllies.length === 0) add("no-german-minor-allies", `${target} has no German minor allies to realign`);
    } else {
      add("minor-required", "realignment requires a minor power");
    }
  } else if (choice.option === "warReparations") {
    if (!target || !POWERS.includes(target)) add("not-a-player", "war reparations can only be imposed on a player");
    if (target) {
      // Rule 16.2.3: the winning side must occupy at least one home controlled
      // by the losing power; the marker itself may be awarded to any ally.
      const occupiedHome = Object.values(SPACES).some(
        (def) =>
          def.home === target &&
          victoriousPowers.some(
            (power) => G.spaces[def.id]?.occupiedBy === power || G.spaces[def.id]?.control === power,
          ),
      );
      if (!occupiedHome) add("no-occupied-home", `the winning side does not occupy a home space controlled by ${target}`);
    }
  } else if (choice.option === "righteousDefense") {
    if (imposingSide !== "defender") add("defender-only", "righteous defense is only available to the defender");
    const space = choice.space;
    if (!space) {
      add("space-required", "righteous defense requires a target space");
    } else {
      const def = SPACES[space];
      const state = G.spaces[space];
      if (!def || !state) add("unknown-space", `unknown space ${space}`);
      else if (
        isNavalBox(space) ||
        (effectiveKeyType(G, space) === undefined && def.type !== "territory" && def.type !== "navalBase")
      ) {
        add("not-key-or-territory", `${space} is not a key, territory or naval base`);
      } else {
        const attackerPowers = sidePowers(war, "attacker");
        const defenderPowers = sidePowers(war, "defender");
        const enemyControlled = heldByAny(G, space, attackerPowers);
        const defenderHome = def.home === war.defender && enemyControlled;
        const occupiedByDefender = state.occupiedBy !== null && state.occupiedBy !== undefined && defenderPowers.includes(state.occupiedBy as Power);
        if (allyBeneficiary) {
          // Rule 16.2.4: an ally may only receive a returned defender home.
          if (!defenderHome) add("not-defender-home", `${space} is not a ${war.defender} home space controlled by the enemy`);
        } else if (!defenderHome && !(enemyControlled && occupiedByDefender)) {
          add("not-eligible-space", `${space} is not an occupied enemy space or a controlled defender home`);
        }
        if (isPower(war.defender) && !hasLoc(G, war.defender, space, {requireTwoSources: false})) {
          add("no-loc", `${war.defender} cannot trace a LoC to ${space}`);
        }
      }
    }
  } else if (choice.option === "colonialCession") {
    // Rule 16.2.5: the space is "controlled by the losing player", so a
    // non-player defender (15.4.2) is never a colonial cession target.
    if (target !== null && !isPower(target)) add("not-a-player", "colonial cession targets a losing player");
    const space = choice.space;
    if (!space) {
      add("space-required", "colonial cession requires a target space");
    } else {
      const def = SPACES[space];
      const state = G.spaces[space];
      if (!def || !state) add("unknown-space", `unknown space ${space}`);
      else {
        const isColonial = def.keyType === "colonial";
        const isBase = def.type === "navalBase";
        if (!isColonial && !isBase) add("not-colonial", `${space} is not a colonial key or naval base`);
        if (target && state.control !== target) add("not-controlled-by-loser", `${space} is not controlled by ${target}`);
        // A colonial home space is only ceded when the winner occupies it.
        if (def.home === target && target && !heldByAny(G, space, victoriousPowers)) {
          add("colonial-home-not-occupied", `${space} is a colonial home and must be occupied`);
        }
      }
    }
  }

  return {
    ok: issues.length === 0,
    option: choice.option,
    imposingSide,
    beneficiary,
    target,
    treatySpaces: choice.option === "territorialCession" ? [...(choice.spaces ?? war.objectives)] : choice.space ? [choice.space] : [],
    issues,
  };
};

const setControl = (
  G: ImperialElegyState,
  space: SpaceId,
  control: PowerOrMinor,
  options: {ally?: Power | null; homeOverride?: Power | null} = {},
): void => {
  const state = G.spaces[space];
  if (!state) return;
  setSpaceControl(G, space, control);
  if (options.ally !== undefined) state.ally = options.ally;
  if (options.homeOverride !== undefined) state.homeOverride = options.homeOverride;
};

const realignMinor = (G: ImperialElegyState, minor: string, from: Power | null, to: Power): SpaceId[] => {
  const affected: SpaceId[] = [];
  const home = MINOR_POWER_HOMES[minor];
  if (home && G.spaces[home]) {
    if (from === null || G.spaces[home].ally === from) {
      G.spaces[home].ally = to;
      affected.push(home);
    }
  }
  for (const def of Object.values(SPACES)) {
    const state = G.spaces[def.id];
    if (!state) continue;
    if (state.control !== minor && def.minorHome !== minor) continue;
    if (from !== null && state.ally !== from) continue;
    state.ally = to;
    if (!affected.includes(def.id)) affected.push(def.id);
  }
  return affected;
};

export interface TreatyResult extends TreatyValidation {
  applied: boolean;
  affectedSpaces: SpaceId[];
  affectedMinor?: string;
  notes: string[];
}

/**
 * Apply one treaty option.  The caller should run `applyVictoryOutcome` first
 * and must not apply more options than `victory.totalTreatyOptions`.
 */
export const applyTreaty = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  choice: TreatyChoice,
): TreatyResult => {
  const validation = canApplyTreaty(G, war, victory, choice);
  if (!validation.ok) return {...validation, applied: false, affectedSpaces: [], notes: validation.issues.map((issue) => issue.message)};

  const primary = validation.imposingSide === "defender" ? war.defender : war.attacker;
  const beneficiary = validation.beneficiary ?? primary;
  const target = validation.target;
  const affectedSpaces: SpaceId[] = [];
  const notes: string[] = [];
  let affectedMinor: string | undefined;

  if (choice.option === "territorialCession") {
    const spaces = choice.spaces ?? war.objectives;
    for (const space of spaces) {
      const original = SPACES[space]?.control ?? null;
      if (war.warAim === "liberation" && original !== null && !isPower(original) && isPower(beneficiary)) {
        // A liberated minor immediately becomes allied to the liberator (13.1.1).
        setControl(G, space, original, {ally: beneficiary});
      } else {
        // A player or an independent minor beneficiary takes control directly.
        setControl(G, space, beneficiary, {ally: null});
      }
      affectedSpaces.push(space);
    }
    notes.push(`territorialCession:${affectedSpaces.join(",")}`);
  } else if (choice.option === "realignment") {
    // 16.2.2: realignment belongs to the imposing primary; `canApplyTreaty`
    // rejects a minor-power beneficiary, so this narrows to the primary.
    const realignTo = isPower(beneficiary) ? beneficiary : primary;
    if (choice.minor) {
      affectedMinor = choice.minor;
      affectedSpaces.push(...realignMinor(G, choice.minor, target, realignTo));
      notes.push(`realignment:${choice.minor}->${realignTo}`);
    } else if (war.warAim === "unification" && realignTo === "GE" && target) {
      // GE unification special: all German minor allies of the loser join GE.
      for (const def of Object.values(SPACES)) {
        if (def.flashpoints?.includes("germany") !== true) continue;
        if (G.spaces[def.id]?.ally !== target) continue;
        G.spaces[def.id].ally = "GE";
        affectedSpaces.push(def.id);
      }
      affectedMinor = affectedSpaces.length > 0 ? "German minors" : undefined;
      notes.push(`realignment:germanMinors->GE:${affectedSpaces.join(",")}`);
    }
  } else if (choice.option === "warReparations") {
    if (target && POWERS.includes(target)) {
      if (isPower(beneficiary)) {
        G.powers[beneficiary].cardMarkers += 1;
      } else {
        // 16.2 lets an independent minor power receive the +1 marker; minors
        // never hold a hand, so the awarded marker is public bookkeeping.
        const markers = G.minorCardMarkers ?? (G.minorCardMarkers = {});
        markers[beneficiary] = (markers[beneficiary] ?? 0) + 1;
      }
      G.powers[target].cardMarkers -= 1;
      notes.push(`warReparations:${beneficiary}+1,${target}-1`);
    }
  } else if (choice.option === "righteousDefense" || choice.option === "colonialCession") {
    if (choice.space) {
      setControl(G, choice.space, beneficiary, {ally: null});
      affectedSpaces.push(choice.space);
      notes.push(`${choice.option}:${choice.space}->${beneficiary}`);
    }
  }

  war.treaties.push(choice.option);
  log(G, isPower(beneficiary) ? beneficiary : undefined, "treatyApplied", {
    option: choice.option,
    target,
    targetKnockedOut: target !== null && victory.allyKnockouts.some((entry) => entry.power === target),
    beneficiary,
    allocatedTo: beneficiary === primary ? "primary" : "ally",
    spaces: affectedSpaces.join(","),
    minor: affectedMinor,
  });
  return {...validation, applied: true, affectedSpaces, affectedMinor, notes};
};

// ---------------------------------------------------------------------------
// Demobilization (rule 17.0)
// ---------------------------------------------------------------------------

export interface DemobilizationFreeAction {
  power: Power;
  side: WarSideName;
  /** 1 = winning side (or attacker on a white peace), 2 = losing side. */
  order: 1 | 2;
  redeploy: true;
  navalMove: true;
}

export interface DemobilizationResult {
  ok: boolean;
  war: WarState | null;
  reservesReturned: {power: PowerOrMinor; unitIds: string[]}[];
  historyRecorded: boolean;
  phase: GamePhase;
  activePower: Power;
  freeActions: DemobilizationFreeAction[];
  notes: string[];
}

/**
 * Return every reserve army on the map to its owner's reserve box.  The player
 * powers use `PowerState.reserves`; rule 22.5's two Polish reserve armies go
 * back to the Polish reserve armies holding box (3.8) instead.
 */
export const returnReserveArmies = (G: ImperialElegyState): {power: PowerOrMinor; unitIds: string[]}[] => {
  const byPower = new Map<PowerOrMinor, string[]>();
  for (const unit of Object.values(G.units)) {
    if (unit.kind !== "reserveArmy") continue;
    if (unit.owner === POLAND) {
      const wasOnMap = Boolean(unit.space);
      if (wasOnMap) {
        const state = G.spaces[unit.space!];
        if (state) state.units = state.units.filter((id) => id !== unit.id);
        unit.space = null;
      }
      const box = (G.nonPlayerBuildBox ??= initialNonPlayerBuildBox());
      const polish = (box.poland ??= {reserveArmies: []});
      if (!polish.reserveArmies.includes(unit.id)) polish.reserveArmies.push(unit.id);
      if (!wasOnMap) continue;
      const polishList = byPower.get(POLAND) ?? [];
      if (!polishList.includes(unit.id)) polishList.push(unit.id);
      byPower.set(POLAND, polishList);
      continue;
    }
    if (!isPower(unit.owner)) continue;
    const power = unit.owner;
    const wasOnMap = Boolean(unit.space);
    if (wasOnMap) {
      const state = G.spaces[unit.space!];
      if (state) state.units = state.units.filter((id) => id !== unit.id);
      unit.space = null;
    }
    const reserves = G.powers[power].reserves;
    if (!reserves.includes(unit.id)) reserves.push(unit.id);
    if (!wasOnMap) continue;
    const list = byPower.get(power) ?? [];
    if (!list.includes(unit.id)) list.push(unit.id);
    byPower.set(power, list);
  }
  return [...byPower.entries()].map(([power, unitIds]) => ({power, unitIds}));
};

/**
 * Rule 17.0: return reserves, clear the active war, record its history and
 * hand the game back to the action phase.  Free redeploy/naval actions are
 * returned for the caller to prompt (winner first, loser second).
 */
export const demobilizeWar = (
  G: ImperialElegyState,
  war: WarState | null = G.war,
  ctx?: Ctx,
): DemobilizationResult => {
  if (!war) {
    return {
      ok: false,
      war: null,
      reservesReturned: [],
      historyRecorded: false,
      phase: G.phase,
      activePower: G.activePower,
      freeActions: [],
      notes: ["no-active-war"],
    };
  }
  if (war.status === "done" || G.war !== war) {
    return {
      ok: false,
      war,
      reservesReturned: [],
      historyRecorded: false,
      phase: G.phase,
      activePower: G.activePower,
      freeActions: [],
      notes: ["war-not-active"],
    };
  }

  const reservesReturned = returnReserveArmies(G);
  // Rule 17.0's first step: "Check for blockade [17.1]."  A blockaded player
  // gains a -1 card marker, except a player on the side that won a major
  // victory ("a player (or players belonging to an alliance) that won a major
  // victory can never be blockaded").  Blockading is optional in the printed
  // rule; the engine enforces it deterministically because the only effect is
  // the opponent's card marker and the live game has no blockader prompt.
  const majorVictorySide =
    war.victoryPrimary === "major" && war.victor !== null ? war.victor : null;
  // 15.6: a knocked-out ally is out of the war, so it is no longer one of the
  // "players involved in the war" that 17.0 demobilises (and its occupied
  // capital is not a 17.1 blockade check).
  const knockedOut = new Set(knockoutsFor(G, war).map((knockout) => knockout.power));
  const blockaded = belligerentsOf(war).filter(
    (power) =>
      !knockedOut.has(power) &&
      !(majorVictorySide !== null && sidePowers(war, majorVictorySide).includes(power)) &&
      blockadedAt(G, power),
  );
  for (const power of blockaded) {
    G.powers[power].cardMarkers -= 1;
    log(G, power, "warBlockade", {penalty: -1, cardMarkers: G.powers[power].cardMarkers});
  }
  // Rule 17.0: "Displace any units in enemy controlled territory [5.7]."
  // A space is enemy territory for a unit when its control marker (or the
  // minor controlling it) belongs to the other side of this war; neutrals and
  // same-side allies stay.  The reusable 5.7 helper moves each such land unit
  // to the closest friendly controlled space with a LoC (or eliminates it) and
  // sends naval units to an adjacent box.
  const belligerents = new Set(belligerentsOf(war));
  const sideOfUnit = (unit: Unit): WarSideName | null => {
    if (isPower(unit.owner)) return sideOf(war, unit.owner);
    const controller = minorController(G, unit.owner);
    return controller === null ? null : sideOf(war, controller);
  };
  for (const [space, state] of Object.entries(G.spaces)) {
    const rawController = state.control;
    if (rawController === null || rawController === undefined) continue;
    const controller = isPower(rawController) ? rawController : minorController(G, rawController);
    if (controller === null || !belligerents.has(controller)) continue;
    const controllerSide = sideOf(war, controller);
    if (controllerSide === null) continue;
    const enemySide: WarSideName = controllerSide === "attacker" ? "defender" : "attacker";
    for (const id of [...state.units]) {
      const unit = G.units[id];
      if (!unit || sideOfUnit(unit) !== enemySide) continue;
      displaceUnitToFriendlyLoc(G, id);
    }
  }
  war.status = "done";
  // 15.3: occupation is a wartime status.  Once the war is settled every
  // occupation marker leaves play — the treaty already moved the formal control
  // of any ceded space, and a space that was merely occupied reverts to its
  // untouched control marker.  Without this, persistence would leak a wartime
  // occupation into peacetime LoC traces (5.6 traces only through controlled
  // spaces at peace).
  for (const state of Object.values(G.spaces)) state.occupiedBy = null;
  const historyRecorded = !G.wars.includes(war);
  if (historyRecorded) G.wars.push(war);
  G.war = null;

  const winnerSide: WarSideName = war.victor ?? "attacker";
  const loserSide: WarSideName = winnerSide === "attacker" ? "defender" : "attacker";
  const freeActions: DemobilizationFreeAction[] = [
    ...sidePowers(war, winnerSide).map((power) => ({power, side: winnerSide, order: 1 as const, redeploy: true as const, navalMove: true as const})),
    ...sidePowers(war, loserSide).map((power) => ({power, side: loserSide, order: 2 as const, redeploy: true as const, navalMove: true as const})),
  ];
  // Rule 17.0 pre-war-history: record which powers were entitled to the free
  // redeployment / naval movement action, in winner-then-loser order.
  war.freeActionEntitlements = freeActions.map(({power, side, order}) => ({power, side, order}));

  const winner = winnerSide === "attacker" ? war.attacker : war.defender;
  // Rule 15.4.2: a lone non-player defender can win the war but takes no
  // impulse; the attacker remains the active player for the rule 17.0 free
  // actions (the non-player has none).
  const actingWinner: Power = isPower(winner) ? winner : war.attacker;
  G.phase = "action";
  G.activePower = actingWinner;
  G.passed = [];
  G.cpRemaining = 0;
  G.impulseCard = null;
  ctx?.events?.setPhase?.("action");

  log(G, actingWinner, "warEnded", {
    victor: war.victor ?? "whitePeace",
    truceTurns: war.truceTurns,
    reserves: reservesReturned.reduce((total, entry) => total + entry.unitIds.length, 0),
  });
  // 22.5(1) / 5.1.2(3): Polish reserve armies always return to their holding
  // box at demobilisation; a deployed one must not stay on the map at peace.
  const polishReturned = reservesReturned.find((entry) => entry.power === POLAND)?.unitIds.length ?? 0;
  if (polishReturned > 0) {
    log(G, actingWinner, "polishReserveReturned", {count: polishReturned});
  }

  return {
    ok: true,
    war,
    reservesReturned,
    historyRecorded,
    phase: G.phase,
    activePower: G.activePower,
    freeActions,
    notes: [`winnerGoesFirst:${winnerSide}`, `truceTurns:${war.truceTurns}`],
  };
};

// ---------------------------------------------------------------------------
// Convenience settlement pipeline
// ---------------------------------------------------------------------------

export interface SettlementResult {
  ok: boolean;
  victory: VictoryClassification;
  outcome: OutcomeApplication | null;
  treaties: TreatyResult[];
  demobilization: DemobilizationResult | null;
  issues: string[];
}

/**
 * Apply an already-classified victory, its treaty choices and demobilization
 * in rule order.  Invalid treaty choices are reported, not thrown, so the UI
 * can re-prompt.
 */
export const settleLimitedWar = (
  G: ImperialElegyState,
  victory: VictoryClassification,
  choices: readonly TreatyChoice[] = [],
  ctx?: Ctx,
): SettlementResult => {
  const war = G.war;
  if (!war) {
    return {ok: false, victory, outcome: null, treaties: [], demobilization: null, issues: ["no-active-war"]};
  }
  const totalOptions = victory.totalTreatyOptions + victory.loserTreatyOptions;
  if (choices.length > totalOptions) {
    return {
      ok: false,
      victory,
      outcome: null,
      treaties: [],
      demobilization: null,
      issues: [`too-many-treaties:${choices.length}>${totalOptions}`],
    };
  }
  // 16.2.1: a victorious attacker must select territorial cession before the
  // settlement can be applied.  Rejecting here keeps the state untouched so the
  // caller can re-prompt or supply the missing option.
  if (mandatoryCessionPending(war, victory, choices)) {
    return {
      ok: false,
      victory,
      outcome: null,
      treaties: [],
      demobilization: null,
      issues: ["mandatory-cession-missing"],
    };
  }

  const outcome = applyVictoryOutcome(G, war, victory, ctx);
  // Rule 16.1.6: the first side's options come first, then the second side's
  // knockout options.  Applying them in printed order matters because each
  // treaty option can only be chosen once per war.  A white peace has no
  // classified victor; the attacker is the deterministic first side.
  const firstSide: WarSideName = victory.victor ?? "attacker";
  const imposingSideOf = (choice: TreatyChoice): WarSideName | null => {
    const target = choice.target ?? null;
    if (target !== null) {
      const knockout = victory.allyKnockouts.find((entry) => entry.power === target);
      if (knockout !== undefined) return knockout.by;
    }
    return victory.victor;
  };
  const orderedChoices = choices
    .map((choice, index) => ({choice, index, side: imposingSideOf(choice)}))
    .sort((a, b) => {
      const rankFor = (side: WarSideName | null): number => (side !== null && side === firstSide ? 0 : 1);
      return rankFor(a.side) - rankFor(b.side) || a.index - b.index;
    })
    .map((entry) => entry.choice);
  const treaties = orderedChoices.map((choice) => applyTreaty(G, war, victory, choice));
  const invalid = treaties.filter((treaty) => !treaty.applied).map((treaty) => treaty.option);
  const demobilization = demobilizeWar(G, war, ctx);
  return {
    ok: invalid.length === 0,
    victory,
    outcome,
    treaties,
    demobilization,
    issues: invalid.map((option) => `treaty-not-applied:${option}`),
  };
};
