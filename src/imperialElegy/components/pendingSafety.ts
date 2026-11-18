/**
 * Which pending decisions destroy something, and what to warn about.
 *
 * The rules ask the deciding seat to give something up — units, cards, a
 * character, stability, a war aim — and several of those options are one-way.
 * The turn panel renders a confirmation on exactly those, while a harmless
 * "pick a space" stays a single click.
 *
 * Pure: given the pending decision's kind and option, it says whether the
 * option needs a second click and what the warning should read.  The UI reads
 * it; the tests pin it.
 */
import type {PendingOption} from "../types";

export interface PendingKindLike {
  kind: string;
  options?: readonly PendingOption[];
}

/**
 * Decision kinds whose *every* option is irreversible: committing to a side,
 * discarding a card, giving a unit up, choosing a treaty.  The player aid's
 * flow treats these as "say it twice".
 */
const DESTRUCTIVE_KINDS: readonly string[] = [
  "discardForStability",
  "combatElite",
  "combatDiscard",
  "combatLosses",
  "hydraulicRecoil",
  "combatRetreat",
  "combatAdvance",
  "impulseLoss",
  "manpowerExcess",
  "treatyOption",
  "treatySpace",
  "warAim",
  "warAllyConsent",
  "navalAvoid",
  "mineRetreat",
  "gwWinter",
  "militarism",
  "allianceTie",
  "whitePeaceOrder",
  "scoringChoice",
  "gwNeutralEntry",
  "crisis",
  "crisisIncident",
  "italianInternalWar",
  "italianPetition",
  "italyOttomanWar",
];

/**
 * Words in an option's label that mark it as one-way even in a mixed list.
 * The Chinese patterns mirror the English verbs above them, so a control that
 * arms in one locale arms in the other (labels are often localized into a
 * single language, e.g. a Chinese-only "拒绝").
 */
const DESTRUCTIVE_WORDS: readonly RegExp[] = [
  /\bdiscard\b/i, /\bsurrender\b/i, /\bsacrifice\b/i, /\bremove\b/i, /\bdestroy\b/i,
  /\bdecline\b/i, /\brefuse\b/i, /\bbreak\b/i, /\blose\b/i, /\bcede\b/i, /\bpay\b/i,
  /\bwithdraw\b/i, /\babandon\b/i,
  /弃/, /消灭/, /摧毁/, /投降/, /失去/, /割让/, /支付/,
  /拒绝/, /放弃/, /撤回/, /牺牲/, /移除/, /破坏/,
];

export interface PendingSafety {
  /** True when this option needs a second click. */
  confirm: boolean;
  /** The one-line warning shown on the armed option, or undefined. */
  reason: string | undefined;
}

export const pendingOptionSafety = (
  pending: PendingKindLike | null | undefined,
  option: PendingOption | null | undefined,
  locale: "en" | "zh_CN",
): PendingSafety => {
  if (pending === null || pending === undefined || option === null || option === undefined) {
    return {confirm: false, reason: undefined};
  }
  const bi = (en: string, zh: string): string => (locale === "zh_CN" ? zh : en);
  if (DESTRUCTIVE_KINDS.includes(pending.kind)) {
    return {
      confirm: true,
      reason: bi("This cannot be undone.", "此操作不可撤销。"),
    };
  }
  const label = `${option.label ?? ""} ${option.labelZh ?? ""}`;
  if (DESTRUCTIVE_WORDS.some((pattern) => pattern.test(label))) {
    return {
      confirm: true,
      reason: bi("This cannot be undone.", "此操作不可撤销。"),
    };
  }
  return {confirm: false, reason: undefined};
};

/** True when the kind is one the rules call final (used by the map-click path). */
export const pendingKindIsDestructive = (kind: string | null | undefined): boolean =>
  kind !== null && kind !== undefined && DESTRUCTIVE_KINDS.includes(kind);
