/**
 * The War tab's movement half.
 *
 * Reported as "帝国挽歌的单位移动ui 在战局标签里面也放一份 战争时不用来回切换".
 * Once a war runs the turn panel parks on the War tab, but every march, rail,
 * naval move and battle still lived on the Orders page, so a wartime player had
 * to switch tabs between the war situation and the units doing the fighting.
 *
 * This is the same two controls the Orders page prints — the unit picker and
 * the space's action rows — restricted to the player aid's "Move & battle"
 * group, mounted a second time inside the War tab.  Nothing is re-implemented:
 * `useSpaceActions` and `SpaceActionsPanel` are shared, so the labels, costs,
 * legal gates and the printed refusal reasons cannot drift between the copies,
 * and the War copy prefixes its test ids (`ie-war-unit-…`) so the two mounted
 * bodies never answer to the same selector.
 *
 * The selection is the board's single selection, not a copy: picking a unit
 * here rings the same legal destinations on the map, and the Orders page shows
 * the same unit pressed.  The console stays mounted while another tab is in
 * front (the turn panel only hides inactive bodies), so a half-made selection
 * and the bots' effects survive a switch.
 */
import React from "react";
import {SPACES} from "../constant/spaces";
import {bi} from "./boardHelpers";
import {IEPanel} from "./theme";
import {SpaceActionsPanel, SpaceUnitPicker} from "./SpacePanel";
import {useSpaceActions} from "./spaceActionModel";
import type {OrdersSlice} from "./boardSlices";
import type {SpaceAction} from "./actionAvailability";

export interface MoveConsoleProps extends OrdersSlice {
  /** The live `ie_show_unavailable` preference, shared with the Orders page. */
  showUnavailable?: boolean;
  setShowUnavailable?: (open: boolean) => void;
}

/** The rows this console prints: the player aid's "Move & battle" group. */
export const isMovementRow = (row: SpaceAction): boolean => row.group === "move";

/** The selected space's printed name, or null when nothing is selected. */
export const moveConsoleSpaceLabel = (
  locale: "en" | "zh_CN",
  selected: OrdersSlice["selected"],
): string | null =>
  selected !== null && SPACES[selected] !== undefined
    ? (locale === "zh_CN" ? SPACES[selected].nameZh : SPACES[selected].name)
    : null;

/** The War tab's copy of every move/battle row for the selected space. */
export const MoveConsole = (props: MoveConsoleProps) => {
  const {
    G, viewer, me, locale, t, phase, canAct, cpBudget, canActionCard,
    pending, canDecide, war, moves, doAction,
    selected, selectedUnit, setSelectedUnit, selectedUnitIds, toggleUnitSelection, selectUnitGroup,
    battleFrom, setBattleFrom, navalFrom, setNavalFrom, startMoveTargeting, selectedUnitDef,
    gwJointNavalAllies, gwJointNavalUnitIds, polishReserve, setPolishReserve,
    deployLimit, deployFree, canDeployHere, canGwDraft, canGwDeployHere,
    polishArmyDecision, polishReserveDecision, myOnMapArmies, myForts, myMinorAllies,
    ownLandInSelected, ownNavalInSelected, potentialLandTargets, potentialNavalTargets,
    onOpenReference, showUnavailable, setShowUnavailable,
  } = props;

  // The same hook the Orders page uses, over the same engine gates, so a row
  // the rules refuse here is refused there too — with the same printed reason.
  const rows = useSpaceActions({
    G, viewer, phase, selected, selectedUnit,
    cp: cpBudget(), canAct, canActionCard, war, me, moves, doAction,
    myOnMapArmies, myForts, myMinorAllies, ownLandInSelected, ownNavalInSelected,
    potentialLandTargets, potentialNavalTargets, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere, polishArmyDecision, polishReserveDecision, polishReserve,
    gwJointNavalAllies, gwJointNavalUnitIds, startMoveTargeting,
    startBattle: () => battleFrom !== selected && setBattleFrom.current(selected),
    startNavalBattle: () => navalFrom !== selected && setNavalFrom.current(selected),
    locale, battleFrom, navalFrom,
  });

  const spaceName = moveConsoleSpaceLabel(locale, selected);
  const legal = rows.filter((row) => isMovementRow(row) && row.enabled).length;

  return (
    <IEPanel
      className="ie-move-console"
      title={bi(locale, "Move & battle", "移动与战斗")}
      actions={spaceName === null ? undefined : <span className="ie-move-console-space">{spaceName}</span>}
    >
      <div className="ie-move-console-body" data-testid="ie-war-move-console">
        {spaceName === null ? (
          <div className="ie-muted" data-testid="ie-war-move-hint">
            {bi(locale,
              "Pick one of your spaces on the map, then one of its units, to move or fight from here — no need to leave the War tab.",
              "先在地图上点选己方空间，再点选单位，即可在此移动或作战，无需离开战局标签。")}
          </div>
        ) : (
          <>
            <div className="ie-move-console-head" data-testid="ie-war-move-space">
              <b>{spaceName}</b>
              <span className="ie-muted">
                {canAct
                  ? ` · ${bi(locale, `${legal} move/battle available`, `${legal} 项移动或战斗可用`)}`
                  : ` · ${bi(locale, "read-only", "只读")}`}
              </span>
            </div>
            {/* Choosing a unit is the first click of every move, so the picker
                leads — exactly as it does on the Orders page. */}
            <SpaceUnitPicker
              G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
              selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
              selectedUnitIds={selectedUnitIds}
              toggleUnitSelection={toggleUnitSelection}
              selectUnitGroup={selectUnitGroup}
              pending={pending} canDecide={canDecide}
              doAction={doAction} moves={moves}
              testIdPrefix="ie-war-"
            />
            <SpaceActionsPanel
              G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
              onOpenReference={onOpenReference}
              rows={rows}
              rowFilter={isMovementRow}
              testIdPrefix="ie-war-"
              showHead={false}
              cpRemaining={cpBudget()}
              polishReserve={polishReserve} setPolishReserve={setPolishReserve}
              selectedUnitDef={selectedUnitDef} setSelectedUnit={setSelectedUnit}
              battleFrom={battleFrom} setBattleFrom={(id) => setBattleFrom.current(id)}
              navalFrom={navalFrom} setNavalFrom={(id) => setNavalFrom.current(id)}
              showUnavailable={showUnavailable} setShowUnavailable={setShowUnavailable}
            />
            {selectedUnitDef === undefined && (
              <div className="ie-hint" data-testid="ie-war-move-pick-unit">
                {bi(locale, "Pick a unit above to see its legal destinations on the map.", "点选上方单位后，地图会标出合法目的地。")}
              </div>
            )}
          </>
        )}
      </div>
    </IEPanel>
  );
};
