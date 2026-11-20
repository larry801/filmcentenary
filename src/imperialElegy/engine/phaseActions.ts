/**
 * 15.2 / 27.5 — which actions a player may take, by phase.
 *
 * 12.1 lists the **peacetime** actions.  15.2 replaces that list during a
 * limited war:
 *
 *   "During the maneuver step, players are limited to the following wartime
 *    actions: Naval movement, Joint naval operations, Deploy reserves, March,
 *    Rail movement, Land battle…  Play Note: players cannot perform
 *    recruitment or refit actions in wartime…"
 *
 * 27.5 prints the Great War list (Deploy Reserves, Land Battle, Rail, March,
 * Naval Movement, Joint Naval Operations plus the GW-only Refit Fleet, Refit,
 * Draft and Elite Corps).
 *
 * Before this module every peacetime action was *accepted* during a war: a
 * hotseat limited war let a seat recruit, build a fort, place influence, form a
 * minor alliance, pacify and industrialise, all on the war budget.  The engine
 * checked CP and the space, never the phase, so the two printed action lists
 * were not enforced at all.
 *
 * The gate lives in one place and returns a reason code, so the moves and the
 * Orders panel cannot drift apart: a row the panel disables is a move the
 * engine refuses.
 */
import type {ImperialElegyState} from "../types";

/** The phase-dependent action family each move belongs to. */
export type ActionFamily =
  // 12.1 peacetime actions, all absent from 15.2 and 27.5.
  | "recruit"
  | "constructFleet"
  | "refitFleet"
  | "placeInfluence"
  | "removeInfluence"
  | "placeDiplomacy"
  | "minorAlliance"
  | "breakAlliance"
  | "buildEf"
  | "pacify"
  | "buildFort"
  | "industrialize"
  | "placeMpit"
  | "cpChain"
  | "jihad"
  | "colonialAction"
  // Actions printed by 15.2 (wartime) and 27.5 (Great War).
  | "navalMovement"
  | "jointNaval"
  | "deployReserves"
  | "march"
  | "rail"
  | "landBattle"
  // Great-War-only 27.5 actions.
  | "gwRefit"
  | "gwRefitFleet"
  | "gwDraft"
  | "gwEliteCorps"
  // Rulebook actions that are legal in every phase that reaches them.
  | "tableAction";

/**
 * 12.1's peacetime action list applies only to the action phase: the prep,
 * diplomacy and end phases have their own moves, and the war/GW phases replace
 * the list.
 */

/** 15.2's limited-war list (plus the GW's, when the war phase hands over). */
const WARTIME_ACTIONS: ReadonlySet<ActionFamily> = new Set<ActionFamily>([
  "navalMovement",
  "jointNaval",
  "deployReserves",
  "march",
  "rail",
  "landBattle",
  "tableAction",
]);

/** 27.5's Great War list. */
const GW_ACTIONS: ReadonlySet<ActionFamily> = new Set<ActionFamily>([
  "navalMovement",
  "jointNaval",
  "deployReserves",
  "march",
  "rail",
  "landBattle",
  "gwRefit",
  "gwRefitFleet",
  "gwDraft",
  "gwEliteCorps",
  "tableAction",
]);

/** Why an action is not available in the current phase, or null when it is. */
export type PhaseActionProblem =
  /** 15.2: a 12.1 peacetime action is not on the limited-war list. */
  | "wartime-only"
  /** 27.5: the Great War prints its own, shorter action list. */
  | "gw-only"
  /** 12.1's actions belong to the action phase. */
  | "peacetime-only";

/** 27.5's Great War-only actions (marked `*` in the printed list). */
const GW_ONLY_ACTIONS: ReadonlySet<ActionFamily> = new Set<ActionFamily>([
  "gwRefit",
  "gwRefitFleet",
  "gwDraft",
  "gwEliteCorps",
]);

/**
 * The reason `family` cannot be taken right now, or null when it can.
 *
 * A `tableAction` (the card-driven events, and every move that is not an action
 * at all) is always allowed: the printed lists constrain *actions*, not the
 * cards' own text.
 */
export const phaseActionProblem = (
  G: ImperialElegyState,
  family: ActionFamily,
): PhaseActionProblem | null => {
  if (family === "tableAction") return null;
  const peacetime = G.phase === "action";
  // 15.2's list is for the limited war's maneuver step.  `warAim`, `alliance`
  // and the other war steps have their own moves and are not action impulses.
  const wartime = G.phase === "wartime" && G.war !== null && G.war.status === "maneuver";
  const greatWar = G.phase === "gwManeuver";
  // 27.5's asterisked actions exist only in the Great War.
  if (GW_ONLY_ACTIONS.has(family)) return greatWar ? null : "gw-only";
  if (greatWar) return GW_ACTIONS.has(family) ? null : "gw-only";
  if (wartime) return WARTIME_ACTIONS.has(family) ? null : "wartime-only";
  if (peacetime) return null;
  // Any other phase (prep/diplomacy/end/war steps/GW planning) has no 12.1
  // actions; the move-layer guards above already reject them, and this makes
  // the panel agree.
  return "peacetime-only";
};

/** True when `family` may be taken right now. */
export const phaseActionAllowed = (G: ImperialElegyState, family: ActionFamily): boolean =>
  phaseActionProblem(G, family) === null;
