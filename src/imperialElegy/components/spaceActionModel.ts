/**
 * The selected space's action rows, computed once per render for the two pages
 * that need them.
 *
 * `spaceActions` runs every engine gate (`canRecruitIn`, `influencePlacementProblem`,
 * `gwActionAllowance`, …) for ~15 rows, so the Orders panel's Action page and its
 * Space page must not each compute their own copy: the same hook feeds both, and
 * the memo keys are the inputs that can flip a row.
 *
 * The rows themselves stay a pure description — the pages only group, sort and
 * render them, exactly as `SpacePanel` did before the split.
 */
import React from "react";
import type {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {spaceActions, type SpaceAction} from "./actionAvailability";

export interface UseSpaceActionsInput {
  G: ImperialElegyState;
  viewer: Power | null;
  phase: string;
  /** The space in the map selection; `null` means "nothing selected". */
  selected: SpaceId | null;
  selectedUnit: string | null;
  cp: number;
  canAct: boolean;
  canActionCard: boolean;
  war: ImperialElegyState["war"];
  me: ImperialElegyState["powers"][Power] | null;
  moves: Record<string, (...args: any[]) => void>;
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  myOnMapArmies: number;
  myForts: number;
  myMinorAllies: number;
  ownLandInSelected: Unit[];
  ownNavalInSelected: Unit[];
  potentialLandTargets: SpaceId[];
  potentialNavalTargets: SpaceId[];
  deployLimit: number;
  deployFree: boolean;
  canDeployHere: boolean;
  canGwDraft: boolean;
  canGwDeployHere: boolean;
  polishArmyDecision: {allowed: boolean; cost: number; reasons: string[]} | null;
  polishReserveDecision: {allowed: boolean; cost: number; reasons: string[]} | null;
  polishReserve: boolean;
  gwJointNavalAllies: Power[];
  gwJointNavalUnitIds: (ally: Power) => string[];
  /** 12.15/16.1: arm the map's move rings for the current selection. */
  startMoveTargeting?: () => void;
  /** Land-battle intent: the map picks the target space. */
  startBattle: () => void;
  /** Naval-battle intent: the map picks the target space. */
  startNavalBattle: () => void;
  warCp: number;
  locale: "en" | "zh_CN";
  battleFrom: SpaceId | null;
  navalFrom: SpaceId | null;
}

/**
 * The rows for the selection, in the player aid's order.
 *
 * Memoised on the inputs above (the setters and helpers are stable), because a
 * clock tick, a hover or a selection change inside the same space must not re-run
 * fifteen engine gates.
 */
export const useSpaceActions = (input: UseSpaceActionsInput): SpaceAction[] => {
  const {
    G, viewer, phase, selected, selectedUnit, cp, canAct, canActionCard, war, me, moves, doAction,
    myOnMapArmies, myForts, myMinorAllies, ownLandInSelected, ownNavalInSelected,
    potentialLandTargets, potentialNavalTargets, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere, polishArmyDecision, polishReserveDecision, polishReserve,
    gwJointNavalAllies, gwJointNavalUnitIds, startMoveTargeting, startBattle, startNavalBattle,
    warCp, locale, battleFrom, navalFrom,
  } = input;

  return React.useMemo(() => (viewer === null || selected === null ? [] : spaceActions({
    G,
    viewer,
    phase,
    space: selected,
    selectedUnit,
    cp,
    canAct,
    canActionCard,
    war,
    me: me as never,
    moves: moves as never,
    doAction,
    myOnMapArmies,
    myForts,
    myMinorAllies,
    ownLandInSelected,
    ownNavalInSelected,
    potentialLandTargets,
    potentialNavalTargets,
    deployLimit,
    deployFree,
    canDeployHere,
    canGwDraft,
    canGwDeployHere,
    polishArmyDecision,
    polishReserveDecision,
    polishReserve,
    gwJointNavalAllies,
    gwJointNavalUnitIds,
    startMove: () => startMoveTargeting?.(),
    startBattle,
    startNavalBattle,
    warCp,
    onDeclareWar: () => null,
    describeRow: (row) => ({label: row.label, reason: row.reason}),
    locale,
  // `doAction`, `moves`, `spaceActions`' own helpers and the setters are stable
  // (useCallback / module scope), so the state that can flip a row is listed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [
    G, viewer, phase, selected, selectedUnit, cp, canAct, canActionCard, war,
    myOnMapArmies, myForts, myMinorAllies, ownLandInSelected, ownNavalInSelected,
    potentialLandTargets, potentialNavalTargets, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere, polishArmyDecision, polishReserveDecision, polishReserve,
    gwJointNavalAllies, battleFrom, navalFrom, warCp, locale,
  ]);
};
