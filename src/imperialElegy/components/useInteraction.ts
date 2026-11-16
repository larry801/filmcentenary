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
  | {kind: "unit"; space: SpaceId; unit: string}
  | {
      kind: "targeting";
      intent: TargetIntent;
      from: SpaceId;
      sources: string[];
      targets: SpaceId[];
    };

export type InteractionAction =
  | {type: "selectSpace"; space: SpaceId}
  | {type: "selectUnit"; space: SpaceId; unit: string}
  | {
      type: "beginTargeting";
      intent: TargetIntent;
      from: SpaceId;
      sources?: string[];
      targets: SpaceId[];
    }
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
      return {kind: "unit", space: action.space, unit: action.unit};
    case "beginTargeting":
      return {
        kind: "targeting",
        intent: action.intent,
        from: action.from,
        sources: action.sources ? [...action.sources] : [],
        targets: [...action.targets],
      };
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
