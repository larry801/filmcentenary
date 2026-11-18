import {useReducer} from "react";
import type {Dispatch} from "react";
import {SpaceId} from "../types";

/** The action a targeting interaction will eventually submit. */
export type TargetIntent =
  | "redeploy"
  | "landBattle"
  | "navalBattle"
  | "amphibious"
  | "navalTransport"
  | "navalIntercept"
  | "gwMarch"
  | "gwRail";

/**
 * The board's whole map-click state.
 *
 * `targeting` is the only state that submits a move on the next click; every
 * other state merely changes what the player has selected.  Keeping the source
 * space inside the state means a cancelled action can always be restored.
 */
export type Interaction =
  | {kind: "idle"}
  | {kind: "space"; space: SpaceId}
  /**
   * A unit selection.  `unit` is the primary unit (the one the rings follow and
   * the one panels name); `extra` holds the other units of the same space the
   * player added, so a whole stack can move with one click (12.15 "move all
   * their land units", 16.1 "all naval units ... may move with one Naval Move
   * action").  `extra` is always empty for a single-unit selection.
   */
  | {kind: "unit"; space: SpaceId; unit: string; extra?: string[]}
  | {
      kind: "targeting";
      intent: TargetIntent;
      from: SpaceId;
      sources: string[];
      targets: SpaceId[];
      /**
       * Soft targeting is entered automatically from a unit selection: a miss
       * cancels it and selects the clicked space instead of being ignored,
       * so the map never feels stuck.  Armed targeting (started by an Orders
       * button) keeps ignoring misses, as it always has.
       */
      soft?: boolean;
      /** Which intent each target would submit; two or more opens a chooser. */
      byTarget?: Record<SpaceId, TargetIntent[]>;
      /** The destination whose intents are being chosen between. */
      choosing?: SpaceId;
    };

export type InteractionAction =
  | {type: "selectSpace"; space: SpaceId}
  | {type: "selectUnit"; space: SpaceId; unit: string; extra?: string[]}
  /** Add or remove one unit from the current space's selection. */
  | {type: "toggleUnit"; space: SpaceId; unit: string}
  | {
      type: "beginTargeting";
      intent: TargetIntent;
      from: SpaceId;
      sources?: string[];
      targets: SpaceId[];
      soft?: boolean;
      byTarget?: Record<SpaceId, TargetIntent[]>;
    }
  | {type: "choose"; space: SpaceId}
  | {type: "cancel"}
  | {type: "commit"; space: SpaceId}
  | {type: "reset"};

export type TargetingInteraction = Extract<Interaction, {kind: "targeting"}>;

export const initialInteraction: Interaction = {kind: "idle"};

/**
 * Pure transition function for the map interaction state.
 *
 * The four board-level `useState`s this replaces could disagree with each
 * other (a stale `selected` plus a live `battleFrom`); an explicit machine
 * makes the illegal combinations unrepresentable and, more importantly,
 * ensures a stray click while targeting never submits an action.
 */
export const interactionReducer = (
  state: Interaction,
  action: InteractionAction,
): Interaction => {
  switch (action.type) {
    case "selectSpace":
      // A click that lands while an action is targeting is a miss, not a
      // submission and not an exit: ignore it entirely.
      if (state.kind === "targeting") return state;
      return {kind: "space", space: action.space};
    case "selectUnit":
      return {
        kind: "unit", space: action.space, unit: action.unit,
        ...(action.extra !== undefined && action.extra.length > 0 ? {extra: [...action.extra]} : {}),
      };
    case "toggleUnit": {
      // Ctrl/Cmd-click semantics: add the unit to the current selection, or drop
      // it when it is already there.  A toggle in another space starts a new
      // selection there (a stack is always within one space — both 12.15 and
      // 16.1 move units that start together).
      //
      // The selection is read from `sources` while targeting, because the soft
      // mode enters targeting as soon as a unit is selected.
      const current = state.kind === "unit" && state.space === action.space
        ? [state.unit, ...(state.extra ?? [])]
        : state.kind === "targeting" && state.from === action.space
          ? [...state.sources]
          : [];
      if (!current.includes(action.unit)) {
        const next = [...current, action.unit];
        return {kind: "unit", space: action.space, unit: next[0], ...(next.length > 1 ? {extra: next.slice(1)} : {})};
      }
      const next = current.filter((id) => id !== action.unit);
      if (next.length === 0) return {kind: "space", space: action.space};
      return {kind: "unit", space: action.space, unit: next[0], ...(next.length > 1 ? {extra: next.slice(1)} : {})};
    }
    case "beginTargeting":
      return {
        kind: "targeting",
        intent: action.intent,
        from: action.from,
        sources: action.sources ? [...action.sources] : [],
        targets: [...action.targets],
        ...(action.soft === true ? {soft: true} : {}),
        ...(action.byTarget !== undefined ? {byTarget: {...action.byTarget}} : {}),
      };
    case "choose":
      // Asking which intent to use costs nothing and keeps the rings up.
      return state.kind === "targeting" && state.targets.includes(action.space)
        ? {...state, choosing: action.space}
        : state;
    case "cancel":
      return state.kind === "targeting" ? {kind: "space", space: state.from} : {kind: "idle"};
    case "commit":
      // Only a targeting interaction can consume a click; outside it the
      // action is a no-op so a delayed click cannot create phantom movement.
      return state.kind === "targeting" ? {kind: "space", space: action.space} : state;
    case "reset":
      return {kind: "idle"};
  }
};

export const isTargeting = (state: Interaction): state is TargetingInteraction =>
  state.kind === "targeting";

/**
 * Every unit of a selection, primary first.
 *
 * The board, the space panel and the move submission all read the selection
 * through this one helper so a multi-unit selection can never be half-applied
 * (a stack that shows three selected units must submit three ids).
 *
 * A targeting interaction carries the same units in `sources`: the soft mode
 * enters targeting as soon as a unit is selected, so a reader that only
 * accepted `kind: "unit"` lost the selection one render later (the rings
 * appeared but `aria-pressed` cleared and the Orders row vanished).
 */
export const selectedUnitIds = (state: Interaction): string[] =>
  state.kind === "unit" ? [state.unit, ...(state.extra ?? [])]
    : state.kind === "targeting" ? [...state.sources]
      : [];

/** How many intents a target offers (1 = click submits, 2+ = a chooser). */
export const intentsAt = (state: TargetingInteraction, space: SpaceId): TargetIntent[] =>
  state.byTarget?.[space] ?? [state.intent];

/**
 * The intent a click on `space` submits right away, or null when the click
 * must open a chooser first.  This is the only place that decides "one intent
 * spends CP now, several ask first", so the board, the keyboard and the tests
 * share it.
 */
export const submitNow = (state: TargetingInteraction, space: SpaceId): TargetIntent | null => {
  if (!state.targets.includes(space)) return null;
  if (state.choosing !== undefined) {
    // The chooser is open for this destination: its first-order intent applies.
    return state.intent;
  }
  const intents = intentsAt(state, space);
  return intents.length === 1 ? intents[0] : null;
};

const PROMPTS: Record<TargetIntent, {en: string; zh_CN: string}> = {
  redeploy: {en: "Redeploy", zh_CN: "重新部署"},
  landBattle: {en: "Land battle: choose an adjacent target", zh_CN: "陆战：选择相邻目标"},
  navalBattle: {en: "Naval battle", zh_CN: "海战"},
  amphibious: {en: "Amphibious assault", zh_CN: "两栖突击"},
  navalTransport: {en: "Naval transport", zh_CN: "海上运输"},
  navalIntercept: {en: "Naval interception", zh_CN: "海上拦截"},
  gwMarch: {en: "Great War march", zh_CN: "大战行军"},
  gwRail: {en: "Great War rail", zh_CN: "大战铁路"},
};

/** Label for the map mode pill while the given action is targeting. */
export const interactionPrompt = (intent: TargetIntent, locale: "en" | "zh_CN"): string =>
  PROMPTS[intent][locale];

/** Board hook.  Deliberately trivial so the reducer is testable without a DOM. */
export const useInteraction = (): {
  interaction: Interaction;
  dispatch: Dispatch<InteractionAction>;
} => {
  const [interaction, dispatch] = useReducer(interactionReducer, initialInteraction);
  return {interaction, dispatch};
};
