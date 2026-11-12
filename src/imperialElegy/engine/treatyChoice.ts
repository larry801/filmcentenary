/**
 * Live treaty chooser for limited wars (Imperial Elegy rule 16.2).
 *
 * `limitedWar.ts` already knows how to validate and apply a single
 * `TreatyChoice`, but nothing in the move layer asks the winner which option
 * to impose.  This module is the pure decision layer between the two:
 *
 *   classifyVictory()            (limitedWar.ts)
 *        -> treatyOptionsFor()   legal options + display labels
 *        -> buildTreatyPending() `treatyOption` PendingDecision
 *        -> applyTreatyChoice()  validate + applyTreaty(), or no-op
 *        -> treatySpaceOptions() follow-up `treatySpace` options
 *        -> treatyMinorOptions() follow-up realignment minor options
 *
 * Nothing here touches boardgame.io plumbing.  `buildTreatyPending` returns
 * the same shape as `Omit<PendingDecision, "id" | "createdAt">` so the caller
 * can hand it to `openDecision`; `applyTreatyChoice` only mutates the state
 * through `applyTreaty`, which validates before writing, so an invalid or
 * already-used option leaves the state untouched.
 */

import {
  ImperialElegyState,
  PendingDecision,
  PendingOption,
  Power,
  PowerOrMinor,
  SpaceId,
  WarState,
} from "../types";
import {SPACES, isNavalBox, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {
  TreatyChoice,
  TreatyOption,
  TreatyResult,
  VictoryClassification,
  applyTreaty,
  canApplyTreaty,
  firstTreatySide,
  warRequiresMandatoryCession,
  independentMinorBeneficiaries,
  sidePowers,
  type WarSideName,
} from "./limitedWar";
import {POWER_ORDER, controlledBy, hasLoc, isPower, powerLabel} from "./rules";
import {isIndependentIndia} from "./characteristics";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const TREATY_OPTION_LABELS: Readonly<Record<TreatyOption, string>> = {
  territorialCession: "Territorial Cession",
  realignment: "Realignment",
  warReparations: "War Reparations",
  righteousDefense: "Righteous Defense",
  colonialCession: "Colonial Cession",
};

/** Stable presentation order (matches rule 16.2's list). */
export const TREATY_OPTION_ORDER: readonly TreatyOption[] = [
  "territorialCession",
  "realignment",
  "warReparations",
  "righteousDefense",
  "colonialCession",
];

export const isTreatyOption = (value: unknown): value is TreatyOption =>
  value === "territorialCession" ||
  value === "realignment" ||
  value === "warReparations" ||
  value === "righteousDefense" ||
  value === "colonialCession";

/** One legal treaty option, ready to become a `PendingOption`. */
export interface TreatyOptionEntry {
  option: TreatyOption;
  /**
   * Stable pending-option id.  It is the bare option name for the primary
   * beneficiary + primary target (backward compatible with stored pendings),
   * and gains `@ally` / `#knockoutTarget` suffixes for the extra allocations.
   */
  id: string;
  /** Display label without the winner, e.g. "Territorial Cession". */
  label: string;
  /** Power that receives the concession (primary by default). */
  beneficiary: PowerOrMinor;
  /** All powers the option may be awarded to (primary first, then allies). */
  beneficiaries: PowerOrMinor[];
  /** Display label of that power, e.g. "Germany". */
  winnerLabel: string;
  /** Power that answers this pick (16.1.6: the knockout's captor). */
  chooser: Power;
  /** Losing power the option is imposed on. */
  target: Power | null;
  /** Which kind of pick this entry consumes. */
  pick: "primary" | "knockout" | "loserKnockout";
  /** Knocked-out allies this option could be imposed on (rule 16.1.6). */
  knockoutTargets: Power[];
  /** Default choice used when the player simply picks the option. */
  choice: TreatyChoice;
  /** Spaces a follow-up `treatySpace` decision may offer. */
  spaces: SpaceId[];
  /** Minor powers a follow-up realignment choice may offer. */
  minors: string[];
  /** True when the option needs a concrete space before it can be applied. */
  requiresSpace: boolean;
  /** True when realignment needs a specific minor power. */
  requiresMinor: boolean;
  /** True when the winner must choose one of several beneficiaries. */
  requiresBeneficiary: boolean;
}

// ---------------------------------------------------------------------------
// Candidate generation
// ---------------------------------------------------------------------------

const spaceIds = (): SpaceId[] => Object.keys(SPACES);

const colonialSpaceIds = (): SpaceId[] =>
  spaceIds().filter((id) => {
    const def = SPACES[id];
    return def !== undefined && (def.keyType === "colonial" || def.type === "navalBase");
  });

/** Spaces righteous defense may target, before the LoC check. */
const righteousSpaceIds = (): SpaceId[] =>
  spaceIds().filter((id) => {
    const def = SPACES[id];
    if (def === undefined || isNavalBox(id)) return false;
    return def.keyType !== undefined || def.type === "territory" || def.type === "navalBase";
  });

/** Largest cessions first, so the default choice takes every legal objective. */
const nonEmptySubsets = <T>(items: readonly T[]): T[][] => {
  const out: T[][] = [];
  if (items.length === 0) return out;
  if (items.length > 6) {
    out.push([...items]);
    for (const item of items) out.push([item]);
    return out;
  }
  for (let mask = 1; mask < 1 << items.length; mask++) {
    const subset: T[] = [];
    for (let index = 0; index < items.length; index++) {
      if ((mask & (1 << index)) !== 0) subset.push(items[index]);
    }
    out.push(subset);
  }
  return out.sort((a, b) => b.length - a.length);
};

/** Metadata shared by every allocation of one option. */
interface EntryMeta {
  beneficiary: PowerOrMinor;
  beneficiaries: PowerOrMinor[];
  /** Power that answers this pick (16.1.6: the knockout's captor). */
  chooser: Power;
  /** Target for this allocation (primary loser or a knocked-out ally). */
  target: Power | null;
  /** Default target of the war (the primary loser). */
  primaryTarget: Power | null;
  /** Primary belligerent of the side imposing this option. */
  primaryBeneficiary: Power;
  pick: "primary" | "knockout" | "loserKnockout";
  knockoutTargets: Power[];
}

/**
 * Stable pending-option id.  The bare option name is kept for the primary
 * beneficiary + primary target so stored pendings and existing clients keep
 * working; the extra allocations are disambiguated with `@ally` and
 * `#knockoutTarget` suffixes.
 */
const entryId = (option: TreatyOption, meta: EntryMeta): string => {
  let id: string = option;
  if (meta.beneficiary !== meta.primaryBeneficiary) id += `@${meta.beneficiary}`;
  if (meta.target !== null && meta.target !== meta.primaryTarget) id += `#${meta.target}`;
  return id;
};

/**
 * Include `target` in a choice only when it is not the default loser.  A
 * knockout pick always names its target explicitly, even in a knockout-only
 * victory where the knocked-out ally is also `victory.loser`, so the applied
 * choice can never be mistaken for a primary pick when the pick counts are
 * recomputed.
 */
const choiceTarget = (meta: EntryMeta): Pick<TreatyChoice, "target"> =>
  meta.target !== null && (meta.pick !== "primary" || meta.target !== meta.primaryTarget)
    ? {target: meta.target}
    : {};

/** Display label for a player power or a minor-power beneficiary. */
const beneficiaryLabel = (beneficiary: PowerOrMinor): string =>
  isPower(beneficiary) ? powerLabel(beneficiary) : beneficiary;

const entryExtras = (meta: EntryMeta): Pick<
  TreatyOptionEntry,
  "beneficiary" | "beneficiaries" | "chooser" | "pick" | "knockoutTargets" | "requiresBeneficiary" | "winnerLabel"
> => ({
  beneficiary: meta.beneficiary,
  beneficiaries: meta.beneficiaries,
  chooser: meta.chooser,
  pick: meta.pick,
  knockoutTargets: meta.knockoutTargets,
  requiresBeneficiary: meta.beneficiaries.length > 1,
  winnerLabel: beneficiaryLabel(meta.beneficiary),
});

const entryForTerritorialCession = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  meta: EntryMeta,
): TreatyOptionEntry | null => {
  const objectives = [...new Set(war.objectives)].filter((space) => !isIndependentIndia(G, space));
  for (const spaces of nonEmptySubsets(objectives)) {
    const validation = canApplyTreaty(G, war, victory, {
      option: "territorialCession",
      spaces,
      beneficiary: meta.beneficiary,
      ...choiceTarget(meta),
    });
    if (!validation.ok) continue;
    return {
      ...entryExtras(meta),
      id: entryId("territorialCession", meta),
      option: "territorialCession",
      label: TREATY_OPTION_LABELS.territorialCession,
      target: meta.target,
      choice: {option: "territorialCession", spaces, beneficiary: meta.beneficiary, ...choiceTarget(meta)},
      spaces: objectives,
      minors: [],
      // A single-objective war is unambiguous; more than one objective may be
      // split across a follow-up `treatySpace` decision.
      requiresSpace: objectives.length > 1,
      requiresMinor: false,
    };
  }
  return null;
};

const entryForRealignment = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  meta: EntryMeta,
): TreatyOptionEntry | null => {
  const minors: string[] = [];
  let choice: TreatyChoice | null = null;

  for (const minor of Object.keys(MINOR_POWER_HOMES)) {
    const validation = canApplyTreaty(G, war, victory, {
      option: "realignment",
      minor,
      beneficiary: meta.beneficiary,
      ...choiceTarget(meta),
    });
    if (!validation.ok) continue;
    minors.push(minor);
    if (choice === null) {
      choice = {option: "realignment", minor, beneficiary: meta.beneficiary, ...choiceTarget(meta)};
    }
  }

  // The GE unification special case realigns every German minor of the loser
  // without naming a minor (limitedWar.applyTreaty handles it).
  if (choice === null) {
    const validation = canApplyTreaty(G, war, victory, {
      option: "realignment",
      beneficiary: meta.beneficiary,
      ...choiceTarget(meta),
    });
    if (!validation.ok) return null;
    choice = {option: "realignment", beneficiary: meta.beneficiary, ...choiceTarget(meta)};
  }

  return {
    ...entryExtras(meta),
    id: entryId("realignment", meta),
    option: "realignment",
    label: TREATY_OPTION_LABELS.realignment,
    target: meta.target,
    choice,
    spaces: [],
    minors,
    requiresSpace: false,
    requiresMinor: minors.length > 0,
  };
};

const entryForWarReparations = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  meta: EntryMeta,
): TreatyOptionEntry | null => {
  const validation = canApplyTreaty(G, war, victory, {
    option: "warReparations",
    beneficiary: meta.beneficiary,
    ...choiceTarget(meta),
  });
  if (!validation.ok) return null;
  return {
    ...entryExtras(meta),
    id: entryId("warReparations", meta),
    option: "warReparations",
    label: TREATY_OPTION_LABELS.warReparations,
    target: meta.target,
    choice: {option: "warReparations", beneficiary: meta.beneficiary, ...choiceTarget(meta)},
    spaces: [],
    minors: [],
    requiresSpace: false,
    requiresMinor: false,
  };
};

const entryForSpaceOption = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  meta: EntryMeta,
  option: "righteousDefense" | "colonialCession",
): TreatyOptionEntry | null => {
  const candidates = (option === "colonialCession" ? colonialSpaceIds() : righteousSpaceIds()).filter(
    (space) => !isIndependentIndia(G, space),
  );
  const spaces: SpaceId[] = [];
  let choice: TreatyChoice | null = null;

  for (const space of candidates) {
    const validation = canApplyTreaty(G, war, victory, {
      option,
      space,
      beneficiary: meta.beneficiary,
      ...choiceTarget(meta),
    });
    if (!validation.ok) continue;
    spaces.push(space);
    if (choice === null) {
      choice = {option, space, beneficiary: meta.beneficiary, ...choiceTarget(meta)};
    }
  }

  if (choice === null) return null;
  return {
    ...entryExtras(meta),
    id: entryId(option, meta),
    option,
    label: TREATY_OPTION_LABELS[option],
    target: meta.target,
    choice,
    spaces,
    minors: [],
    requiresSpace: true,
    requiresMinor: false,
  };
};

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

/** Which picks a settlement still has available. */
export interface TreatyPickAvailability {
  /** Primary-outcome treaty options (rule 16.1). */
  primary?: boolean;
  /** Extra options usable only against knocked-out allies (rule 16.1.6). */
  knockout?: boolean;
  /**
   * Rule 16.1.6: the losing side's mandatory option against an ally of the
   * winner that it knocked out, chosen after the winner's picks.
   */
  loserKnockout?: boolean;
  /** Restrict the first side's knockout entries to these targets. */
  knockoutTargets?: readonly Power[];
  /** Restrict the second side's knockout entries to this captor's targets. */
  loserChooser?: Power;
  /** Restrict the second side's knockout entries to these targets. */
  loserTargets?: readonly Power[];
}

/**
 * Rule 16.1 / 16.1.6: how many primary and ally-knockout treaty picks each side
 * has.  The first side chooses first; the second side then chooses one
 * mandatory option per ally of the first side that it knocked out
 * (`loserKnockout`).
 *
 * In a white peace with no primary victor the live settlement negotiates the
 * order between the two primaries (16.1.6); this helper falls back to the war's
 * initiative order (the first primary to act) for explicit/unattended callers.
 */
export const treatyPickCounts = (
  victory: VictoryClassification,
): {primary: number; knockout: number; loserKnockout: number} => {
  const firstSide = firstTreatySide(victory);
  if (firstSide === null) return {primary: 0, knockout: 0, loserKnockout: 0};
  const secondSide = firstSide === "attacker" ? "defender" : "attacker";
  return {
    primary: victory.victor === null ? 0 : victory.treatyOptions,
    knockout: victory.allyKnockouts.filter((knockout) => knockout.by === firstSide).length,
    loserKnockout: victory.allyKnockouts.filter((knockout) => knockout.by === secondSide).length,
  };
};

/**
 * Rule 16.2: who may receive a treaty concession.  "Spaces and war reparations
 * may be awarded to any of the victorious player's allies, including
 * independent minor powers"; the other options belong to the primary
 * belligerent (righteous defense additionally lets the defender return a home
 * space to an ally, rule 16.2.4).
 */
const beneficiaryCandidates = (
  G: ImperialElegyState,
  war: WarState,
  option: TreatyOption,
  imposingSide: WarSideName,
): PowerOrMinor[] => {
  const primary = imposingSide === "attacker" ? war.attacker : war.defender;
  // Rule 15.4.2 / 16.1: a lone non-player defender is not a player and can
  // never be a treaty beneficiary or chooser.
  const primaryPlayers: Power[] = isPower(primary) ? [primary] : [];
  const allies = sidePowers(war, imposingSide).filter(
    (power) => power !== primary && G.powers[power]?.eliminated !== true,
  );
  if (option === "territorialCession" || option === "warReparations" || option === "righteousDefense") {
    return [primary, ...allies, ...independentMinorBeneficiaries(G, war, imposingSide)];
  }
  return primaryPlayers;
};

/** One chooser's turn at the treaty table (rule 16.1.6). */
export interface TreatyChooserGroup {
  /** The power that answers this group's picks. */
  power: Power;
  /** The war side the group imposes for. */
  side: WarSideName;
  /** Primary-outcome picks in this group. */
  primary: number;
  /** Knocked-out allies this group imposes options on. */
  targets: Power[];
}

/** Group knockout targets by the power that actually made the knockout. */
const byCaptor = (knockouts: readonly AllyKnockoutLike[]): {captor: Power; targets: Power[]}[] => {
  const groups = new Map<Power, Power[]>();
  for (const knockout of knockouts) {
    const list = groups.get(knockout.captor) ?? [];
    list.push(knockout.power);
    groups.set(knockout.captor, list);
  }
  return [...groups.entries()]
    .sort((a, b) => POWER_ORDER[a[0]] - POWER_ORDER[b[0]])
    .map(([captor, targets]) => ({captor, targets}));
};

/** The `AllyKnockout` fields the chooser grouping reads. */
interface AllyKnockoutLike {
  power: Power;
  by: WarSideName;
  captor: Power;
}

/**
 * Rule 16.1.6 settlement order: the first side's primary pick and its own
 * knockout options, then one mandatory group per power on the second side that
 * made a knockout.  In a normal victory the winner primary answers for its own
 * side (rule 16.2's "final say"); on the losing side the power that made the
 * knockout answers ("the loser chooses their treaty option after the winner").
 * In a white peace with knockouts on both sides there is no winner, so every
 * knockout is answered by its captor and the chosen first side's groups come
 * first (the attacker by default).
 */
export const treatyChooserGroups = (war: WarState, victory: VictoryClassification): TreatyChooserGroup[] => {
  const firstSide = firstTreatySide(victory);
  if (firstSide === null) return [];
  const secondSide: WarSideName = firstSide === "attacker" ? "defender" : "attacker";
  const firstPrimary = firstSide === "attacker" ? war.attacker : war.defender;
  const firstKnockouts = victory.allyKnockouts.filter((knockout) => knockout.by === firstSide);
  const secondKnockouts = victory.allyKnockouts.filter((knockout) => knockout.by === secondSide);

  const groups: TreatyChooserGroup[] = [];
  if (victory.victor !== null) {
    // A classified victory: the primary has the final say (16.2), including over
    // its own side's knockout options.
    if (victory.treatyOptions > 0 || firstKnockouts.length > 0) {
      groups.push({
        power: firstPrimary,
        side: firstSide,
        primary: victory.treatyOptions,
        targets: firstKnockouts.map((knockout) => knockout.power),
      });
    }
  } else if (firstKnockouts.length > 0) {
    // White peace: no primary pick and no primary chooser, so each knockout is
    // answered by the power that made it.
    for (const group of byCaptor(firstKnockouts)) {
      groups.push({power: group.captor, side: firstSide, primary: 0, targets: group.targets});
    }
  }
  for (const group of byCaptor(secondKnockouts)) {
    groups.push({power: group.captor, side: secondSide, primary: 0, targets: group.targets});
  }
  return groups;
};

/**
 * Legal treaty options for a classified victory, in rulebook order.
 *
 * Every candidate is run through `canApplyTreaty`, which enforces the
 * once-per-option rule (`war.treaties`), the white-peace restriction and the
 * option-specific requirements, so this list is safe to show as-is.  Options
 * that need a space (righteous defense / colonial cession) are still returned
 * with their legal candidate spaces; `applyTreatyChoice` will refuse them
 * until a space is supplied through the context of a `treatySpace` decision.
 *
 * When the winning side has allied belligerents (or knocked-out enemy allies)
 * each option is expanded into one entry per eligible allocation, so the
 * primary's "final say" (rule 16.2) is exercised by picking an option rather
 * than silently defaulting to the primary.  `picks` narrows the entries to one
 * chooser's outstanding picks; `entry.chooser` names the power that answers it.
 */
export const treatyOptionsFor = (
  G: ImperialElegyState,
  war: WarState,
  victory: VictoryClassification,
  picks: TreatyPickAvailability = {},
): TreatyOptionEntry[] => {
  if (victory.totalTreatyOptions + victory.loserTreatyOptions <= 0) return [];
  const firstSide = firstTreatySide(victory);
  if (firstSide === null) return [];
  const secondSide: WarSideName = firstSide === "attacker" ? "defender" : "attacker";
  const firstPrimary = firstSide === "attacker" ? war.attacker : war.defender;
  const counts = treatyPickCounts(victory);
  const primaryEnabled = (picks.primary ?? true) && counts.primary > 0;
  const knockoutAllowed = picks.knockout ?? true;
  const loserKnockoutAllowed = picks.loserKnockout ?? true;
  const primaryTarget = victory.loser;
  const firstTargets = victory.allyKnockouts
    .filter((knockout) => knockout.by === firstSide)
    .filter((knockout) => picks.knockoutTargets === undefined || picks.knockoutTargets.includes(knockout.power))
    .map((knockout) => knockout.power);
  const secondTargets = victory.allyKnockouts
    .filter((knockout) => knockout.by === secondSide)
    .filter((knockout) => picks.loserTargets === undefined || picks.loserTargets.includes(knockout.power))
    .filter((knockout) => picks.loserChooser === undefined || knockout.captor === picks.loserChooser)
    .map((knockout) => knockout.power);

  interface PickPlan {
    target: Power | null;
    pick: "primary" | "knockout" | "loserKnockout";
    imposingSide: WarSideName;
    chooser: Power;
    knockoutTargets: Power[];
  }
  const pickPlans: PickPlan[] = [];
  if (primaryTarget !== null && primaryEnabled) {
    pickPlans.push({
      target: primaryTarget,
      pick: "primary",
      imposingSide: firstSide,
      chooser: firstPrimary,
      knockoutTargets: victory.allyKnockouts
        .filter((knockout) => knockout.by === firstSide)
        .map((knockout) => knockout.power),
    });
  }
  if (knockoutAllowed) {
    for (const knockout of victory.allyKnockouts.filter((entry) => entry.by === firstSide)) {
      if (!firstTargets.includes(knockout.power)) continue;
      // A classified winner's primary has the final say over its side's
      // knockouts; with no primary victory the captor chooses its own.
      const chooser = victory.victor !== null ? firstPrimary : knockout.captor;
      pickPlans.push({
        target: knockout.power,
        pick: "knockout",
        imposingSide: firstSide,
        chooser,
        knockoutTargets: firstTargets,
      });
    }
  }
  if (loserKnockoutAllowed) {
    for (const knockout of victory.allyKnockouts.filter((entry) => entry.by === secondSide)) {
      if (!secondTargets.includes(knockout.power)) continue;
      pickPlans.push({
        target: knockout.power,
        pick: "loserKnockout",
        imposingSide: secondSide,
        chooser: knockout.captor,
        knockoutTargets: secondTargets,
      });
    }
  }
  if (pickPlans.length === 0) return [];

  const entries: TreatyOptionEntry[] = [];
  for (const option of TREATY_OPTION_ORDER) {
    // A treaty option may be imposed only once per war (rule 16.2).
    if (war.treaties.includes(option)) continue;

    for (const plan of pickPlans) {
      // Rule 16.2.4: righteous defense is only available to the defender, so
      // it can never be a losing attacker's knockout option.
      if (option === "righteousDefense" && plan.imposingSide !== "defender") continue;
      const beneficiaries = beneficiaryCandidates(G, war, option, plan.imposingSide);
      if (beneficiaries.length === 0) continue;
      // A lone non-player defender never imposes a treaty (16.1).
      const planPrimaryRaw = plan.imposingSide === "attacker" ? war.attacker : war.defender;
      if (!isPower(planPrimaryRaw)) continue;
      const planPrimary = planPrimaryRaw;

      for (const beneficiary of beneficiaries) {
        const meta: EntryMeta = {
          beneficiary,
          beneficiaries,
          chooser: plan.chooser,
          target: plan.target,
          primaryTarget,
          primaryBeneficiary: planPrimary,
          pick: plan.pick,
          knockoutTargets: plan.knockoutTargets,
        };
        let entry: TreatyOptionEntry | null = null;
        if (option === "territorialCession") {
          entry = entryForTerritorialCession(G, war, victory, meta);
        } else if (option === "realignment") {
          entry = entryForRealignment(G, war, victory, meta);
        } else if (option === "warReparations") {
          entry = entryForWarReparations(G, war, victory, meta);
        } else {
          entry = entryForSpaceOption(G, war, victory, meta, option);
        }
        if (entry !== null) entries.push(entry);
      }
    }
  }
  // 16.2.1: a victorious attacker in a liberation / Italian-unification war
  // must select territorial cession.  While it is still outstanding, the
  // primary-outcome picks are restricted to that option; the knockout picks are
  // unaffected.  If no legal cession entry exists at all, fall back to the full
  // list so the settlement can still finish rather than deadlock.
  if (
    primaryEnabled &&
    victory.victor === "attacker" &&
    warRequiresMandatoryCession(war) &&
    !war.treaties.includes("territorialCession")
  ) {
    const cession = entries.filter((entry) => entry.pick === "primary" && entry.option === "territorialCession");
    if (cession.length > 0) {
      // Hide the same option from the knockout allocations until the primary
      // cession is taken: the once-per-war rule would otherwise let a knockout
      // pick consume it and make the mandatory cession impossible.
      return [
        ...cession,
        ...entries.filter((entry) => entry.pick !== "primary" && entry.option !== "territorialCession"),
      ];
    }
  }
  return entries;
};

// ---------------------------------------------------------------------------
// Pending decision
// ---------------------------------------------------------------------------

/** Options carried by the pending decision's opaque context. */
export interface TreatyPendingContext {
  victory: VictoryClassification;
  /** Picks still available; defaults to the primary + knockout pick counts. */
  remaining?: number;
  /** Primary-outcome picks still available. */
  remainingPrimary?: number;
  /** Ally-knockout picks still available (rule 16.1.6). */
  remainingKnockout?: number;
  /** The losing side's knockout picks still available (rule 16.1.6). */
  remainingLoserKnockout?: number;
  /** Which side is choosing: the winner first, then the losing primary. */
  stage?: "winner" | "loser";
  /** Choices already applied during this settlement. */
  applied?: readonly TreatyChoice[];
  /**
   * Sides whose optional primary picks were explicitly finished with `done`;
   * their outstanding mandatory knockout groups are still opened.
   */
  skippedSides?: readonly WarSideName[];
}

const entryContext = (entry: TreatyOptionEntry): Record<string, unknown> => ({
  id: entry.id,
  chooser: entry.chooser,
  option: entry.option,
  label: entry.label,
  beneficiary: entry.beneficiary,
  beneficiaries: [...entry.beneficiaries],
  winnerLabel: entry.winnerLabel,
  target: entry.target,
  knockoutTargets: [...entry.knockoutTargets],
  pick: entry.pick,
  choice: entry.choice,
  spaces: [...entry.spaces],
  minors: [...entry.minors],
  requiresSpace: entry.requiresSpace,
  requiresMinor: entry.requiresMinor,
  requiresBeneficiary: entry.requiresBeneficiary,
});

/** Display label for a treaty target: a player name, or the non-player id. */
const treatyTargetLabel = (target: EntryMeta["target"]): string =>
  target === null ? "knocked-out ally" : isPower(target) ? powerLabel(target) : target;

const pendingOptionFor = (entry: TreatyOptionEntry): PendingOption => {
  const label = entry.winnerLabel ? `${entry.label} (${entry.winnerLabel})` : entry.label;
  const knockout = entry.pick === "knockout" || entry.pick === "loserKnockout";
  const knockedOut = treatyTargetLabel(entry.target);
  return {
    id: entry.id,
    label: knockout ? `${label} — ${knockedOut}` : label,
    data: entryContext(entry),
  };
};

/**
 * Build the `treatyOption` decision for `actor` from the entries returned by
 * `treatyOptionsFor`.  The returned object is ready for `openDecision`; it
 * carries the complete victory classification and the option list in
 * `context` so the chooser can be resumed later.
 *
 * `context.beneficiaries` lists every eligible recipient and
 * `context.knockoutTargets` every knocked-out ally that may receive the
 * ally-knockout options, so a client can render the allocation choice without
 * re-deriving the rules.
 */
export const buildTreatyPending = (
  G: ImperialElegyState,
  actor: Power,
  options: readonly TreatyOptionEntry[],
  context: TreatyPendingContext,
): Omit<PendingDecision, "id" | "createdAt"> => {
  const winner = context.victory.winner;
  // Rule 15.4.2: a lone non-player defender can win but never chooses, so its
  // id is not a player label; the caller does not open a pending for it.
  const winnerLabel = winner !== null && isPower(winner) ? powerLabel(winner) : "";
  const counts = treatyPickCounts(context.victory);
  const remainingPrimary = context.remainingPrimary ?? counts.primary;
  const remainingKnockout = context.remainingKnockout ?? counts.knockout;
  const remainingLoserKnockout = context.remainingLoserKnockout ?? counts.loserKnockout;
  const remaining = context.remaining ?? remainingPrimary + remainingKnockout + remainingLoserKnockout;
  const beneficiaries = [...new Set(options.map((entry) => entry.beneficiary))];
  const knockoutTargets = [...new Set(options.flatMap((entry) => entry.knockoutTargets))];

  return {
    kind: "treatyOption",
    power: actor,
    prompt: "Choose a treaty option",
    promptArgs: {
      winner: winner ?? "",
      winnerLabel,
      remaining,
      remainingPrimary,
      remainingKnockout,
      remainingLoserKnockout,
      stage: context.stage ?? "winner",
      count: options.length,
    },
    options: options.map(pendingOptionFor),
    context: {
      victory: context.victory,
      options: options.map(entryContext),
      applied: [...(context.applied ?? [])],
      skippedSides: [...(context.skippedSides ?? [])],
      remaining,
      remainingPrimary,
      remainingKnockout,
      remainingLoserKnockout,
      stage: context.stage ?? "winner",
      winner,
      winnerLabel,
      beneficiaries,
      knockoutTargets,
      turn: G.turn,
    },
    blocking: true,
  };
};

// ---------------------------------------------------------------------------
// Applying a choice
// ---------------------------------------------------------------------------

/** Resume context; overrides only needed for tests or unusual settlements. */
export interface TreatyResumeContext {
  war?: WarState | null;
  victory?: VictoryClassification;
}

export type TreatyChoiceError =
  | "no-pending"
  | "unsupported-kind"
  | "unknown-option"
  | "no-war"
  | "no-victory"
  | "invalid-treaty";

export interface TreatyChoiceResult {
  ok: boolean;
  /** Present whenever an option was recognised, even if it was illegal. */
  result?: TreatyResult;
  error?: TreatyChoiceError;
  issues: string[];
}

const victoryFromPending = (pending: PendingDecision): VictoryClassification | null => {
  const value = pending.context?.victory;
  if (value === null || typeof value !== "object") return null;
  return value as VictoryClassification;
};

/** A player power or an independent minor power named as a beneficiary. */
const asBeneficiary = (value: unknown): PowerOrMinor | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const choiceFor = (
  pending: PendingDecision,
  chosen: PendingOption,
  choiceId: string,
): TreatyChoice | null => {
  const data = chosen.data ?? {};
  const stored = data.choice;
  const base = stored !== null && typeof stored === "object" ? (stored as TreatyChoice) : null;

  if (pending.kind === "treatyOption") {
    if (base !== null) {
      // A stale context must not silently apply a different option.  The
      // pending id may carry a `@beneficiary` / `#knockoutTarget` suffix, so
      // compare the underlying option, not the decorated id.
      const entryOption = data.option;
      return isTreatyOption(entryOption) && entryOption === base.option ? base : null;
    }
    if (isTreatyOption(data.option)) return {option: data.option};
    return isTreatyOption(chosen.id) ? {option: chosen.id} : null;
  }

  // A follow-up `treatySpace` decision with `context.kind === "minor"` is the
  // realignment minor chooser; `choiceId` is the minor power's name.
  if (pending.context?.kind === "minor") {
    const dataOption = data.option;
    if (isTreatyOption(dataOption) && dataOption !== "realignment") return null;
    if (base !== null && base.option !== "realignment") return null;
    const minor = typeof data.minor === "string" ? data.minor : choiceId;
    if (minor.length === 0) return null;
    const beneficiary = asBeneficiary(data.beneficiary) ?? base?.beneficiary;
    const target = (isPower(data.target) ? data.target : undefined) ?? base?.target;
    return {
      option: "realignment",
      minor,
      ...(beneficiary === undefined ? {} : {beneficiary}),
      ...(target === undefined ? {} : {target}),
    };
  }

  // A follow-up `treatySpace` decision: `choiceId` is the space id.
  const space = typeof data.space === "string" ? data.space : choiceId;
  const dataOption = isTreatyOption(data.option) ? data.option : base?.option;
  if (dataOption === undefined) return null;
  const resume = base !== null && base.option === dataOption ? base : null;
  if (dataOption === "territorialCession") {
    return {...(resume ?? {option: dataOption}), option: dataOption, spaces: [space]};
  }
  return {...(resume ?? {option: dataOption}), option: dataOption, space};
};

/**
 * 33.2.2: an independent India is never a treaty target.  Territorial cession
 * writes control into the ceded space, so it is rejected before `applyTreaty`
 * even when a stale pending still names India.  Bengal is a separate space and
 * is unaffected.
 */
const treatyTouchesIndependentIndia = (G: ImperialElegyState, choice: TreatyChoice): boolean => {
  if (choice.space !== undefined && isIndependentIndia(G, choice.space)) return true;
  return (choice.spaces ?? []).some((space) => isIndependentIndia(G, space));
};

/**
 * Apply the option chosen in a `treatyOption` (or `treatySpace`) decision.
 *
 * The chosen `PendingOption` carries a validated default `TreatyChoice`; a
 * space decision replaces its `space`/`spaces` field.  Application goes
 * through `applyTreaty`, so the once-per-option guard, white-peace check and
 * every option rule are re-validated against the live state.  On any failure
 * (unknown id, unsupported decision kind, illegal treaty) the function
 * returns `ok: false` without mutating `G`.
 */
export const applyTreatyChoice = (
  G: ImperialElegyState,
  pending: PendingDecision | null,
  choiceId: string,
  ctx: TreatyResumeContext = {},
): TreatyChoiceResult => {
  if (pending === null) {
    return {ok: false, error: "no-pending", issues: ["no-pending-decision"]};
  }
  if (pending.kind !== "treatyOption" && pending.kind !== "treatySpace") {
    return {ok: false, error: "unsupported-kind", issues: [`unsupported-decision:${pending.kind}`]};
  }

  const chosen = pending.options.find((entry) => entry.id === choiceId);
  if (chosen === undefined) {
    return {ok: false, error: "unknown-option", issues: [`unknown-option:${choiceId}`]};
  }

  const war = ctx.war ?? G.war;
  if (war === null || war === undefined) {
    return {ok: false, error: "no-war", issues: ["no-active-war"]};
  }
  const victory = ctx.victory ?? victoryFromPending(pending);
  if (victory === null) {
    return {ok: false, error: "no-victory", issues: ["no-victory-classification"]};
  }

  const choice = choiceFor(pending, chosen, choiceId);
  if (choice === null) {
    return {ok: false, error: "unknown-option", issues: [`unknown-option:${choiceId}`]};
  }
  if (treatyTouchesIndependentIndia(G, choice)) {
    return {ok: false, error: "invalid-treaty", issues: ["independent-india"]};
  }

  const result = applyTreaty(G, war, victory, choice);
  if (!result.applied) {
    const issues = result.notes.length > 0 ? result.notes : result.issues.map((issue) => issue.message);
    return {ok: false, error: "invalid-treaty", result, issues};
  }
  return {ok: true, result, issues: []};
};

// ---------------------------------------------------------------------------
// Follow-up space choice
// ---------------------------------------------------------------------------

const fallbackSpaces = (
  G: ImperialElegyState,
  war: WarState,
  option: "territorialCession" | "righteousDefense" | "colonialCession",
  target: Power | null,
): SpaceId[] => {
  if (option === "territorialCession") {
    return [...new Set(war.objectives)];
  }
  if (option === "colonialCession") {
    return colonialSpaceIds().filter((id) => {
      const state = G.spaces[id];
      if (state === undefined) return false;
      if (target !== null) return state.control === target;
      return isPower(state.control);
    });
  }

  const attacker = sidePowers(war, "attacker");
  const defender = sidePowers(war, "defender");
  return righteousSpaceIds().filter((id) => {
    const def = SPACES[id];
    const state = G.spaces[id];
    if (def === undefined || state === undefined) return false;
    const enemyControlled =
      (isPower(state.occupiedBy) && attacker.includes(state.occupiedBy)) ||
      (isPower(state.control) && attacker.includes(state.control));
    const defenderHome = def.home === war.defender && enemyControlled;
    const occupiedByDefender = isPower(state.occupiedBy) && defender.includes(state.occupiedBy);
    if (!defenderHome && !(enemyControlled && occupiedByDefender)) return false;
    // Rule 15.4.2: an unaided non-player defender cannot impose righteous
    // defense and has no LoC to trace; `canApplyTreaty` already refuses it.
    return isPower(war.defender) && hasLoc(G, war.defender, id, {requireTwoSources: false});
  });
};

/**
 * Options for the realignment minor-power follow-up.
 *
 * This is deliberately separate from `treatySpaceOptions`: realignment picks a
 * minor name, not a space, and `treatySpaceOptions` must keep returning an
 * empty list for it.  Only the minors `treatyOptionsFor` already validated as
 * legal are offered.
 */
export const treatyMinorOptions = (entry: TreatyOptionEntry): PendingOption[] =>
  entry.minors.map((minor) => ({
    id: minor,
    label: minor,
    data: {
      minor,
      option: "realignment",
      beneficiary: entry.beneficiary,
      target: entry.target,
    },
  }));

/**
 * Options for a follow-up `treatySpace` decision.
 *
 * Territorial cession offers the war objectives that the loser still controls
 * (or, with `victory`, every objective that would validate as a one-space
 * cession).  Righteous defense and colonial cession offer the spaces accepted
 * by `canApplyTreaty`.  Realignment (a minor-power choice) and war reparations
 * (no choice) return an empty list.
 */
export const treatySpaceOptions = (
  G: ImperialElegyState,
  option: TreatyOption | TreatyOptionEntry,
  victory?: VictoryClassification,
): PendingOption[] => {
  const entry = typeof option === "string" ? null : option;
  const kind = typeof option === "string" ? option : option.option;
  if (kind !== "territorialCession" && kind !== "righteousDefense" && kind !== "colonialCession") {
    return [];
  }

  const war = G.war;
  if (war === null) return [];

  const beneficiary = entry?.beneficiary ?? victory?.winner ?? null;
  const target = entry?.target ?? victory?.loser ?? null;
  const candidates =
    entry !== null ? [...entry.spaces] : fallbackSpaces(G, war, kind, target);

  const spaces: SpaceId[] = [];
  for (const space of candidates) {
    // 33.2.2: after independence India cannot be controlled by any player, so
    // no treaty cession/realignment/liberation may name it.
    if (isIndependentIndia(G, space)) continue;
    if (victory !== undefined) {
      const choice: TreatyChoice =
        kind === "territorialCession"
          ? {
              option: kind,
              spaces: [space],
              ...(beneficiary === null ? {} : {beneficiary}),
            }
          : {
              option: kind,
              space,
              ...(beneficiary === null ? {} : {beneficiary}),
            };
      if (!canApplyTreaty(G, war, victory, choice).ok) continue;
    } else if (kind === "territorialCession") {
      if (target !== null && !controlledBy(G, space, target)) continue;
    } else if (kind === "colonialCession") {
      if (target !== null && G.spaces[space]?.control !== target) continue;
    }
    if (!spaces.includes(space)) spaces.push(space);
  }

  return spaces.map((space) => ({
    id: space,
    label: spaceLabel(space, "en"),
    data: {space, option: kind},
  }));
};
