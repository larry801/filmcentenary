import React from "react";
import {GwActionKind, ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, neighboursOf, spaceLabel} from "../constant/spaces";
import {effectiveKeyType, gwAllyImpulseFor, hasLoc, minorController} from "../engine/rules";
import {gwActionAllowance} from "../engine/gwImpulse";
import {polishReserveDeployer} from "../engine/poland";
import {IEBadge, IEPanel} from "./theme";
import {ConfirmButton} from "./ConfirmButton";
import {RuleLink} from "./RuleRef";
import {ieT} from "./i18n";
import {bi, controlLabel, isPowerKey, unitLabel} from "./boardHelpers";
import {ACTION_GROUP_LABELS, spaceActions, type SpaceAction} from "./actionAvailability";

export interface SpacePanelProps {
  /** Opens the reference drawer (the "?" next to the action list). */
  onOpenReference?: (anchor: string) => void;
  G: ImperialElegyState;
  selected: SpaceId | null;
  selectedUnit: string | null;
  setSelectedUnit: (id: string | null) => void;
  /** Every unit of the current selection, primary first (12.15/16.1 stacks). */
  selectedUnitIds?: string[];
  /** Add or remove one unit from the current selection (the stack form). */
  toggleUnitSelection?: (id: string) => void;
  /**
   * Replace the selection with a whole stack in one dispatch.  A loop of
   * `toggleUnitSelection` cannot build a group: React batches the dispatches
   * and each reducer call still sees the pre-batch state.
   */
  selectUnitGroup?: (ids: string[]) => void;
  /**
   * Arm the map's move rings for the current selection.  The board owns this
   * because only it may enter targeting (the panel must never guess a
   * destination, and only a ring click may spend CP).
   */
  startMoveTargeting?: () => void;
  battleFrom: SpaceId | null;
  setBattleFrom: (id: SpaceId | null) => void;
  navalFrom: SpaceId | null;
  setNavalFrom: (id: SpaceId | null) => void;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  phase: string;
  canAct: boolean;
  canSpend: (cost: number) => boolean;
  cpRemaining: number;
  canActionCard: boolean;
  pending: ImperialElegyState["pending"];
  canDecide: boolean;
  war: ImperialElegyState["war"];
  // Space-derived state
  warAim: "conquest" | "liberation" | "unification";
  setWarAim: (a: "conquest" | "liberation" | "unification") => void;
  warCp: number;
  setWarCp: (n: number) => void;
  secondObjective: SpaceId | "";
  setSecondObjective: (s: SpaceId | "") => void;
  targetControlledSpaces: SpaceId[];
  warTargetControl: Power | null;
  canDeclareWar: boolean;
  // Unit selections
  gwJointNavalAllies: Power[];
  gwJointNavalUnitIds: (ally: Power) => string[];
  // Deploy
  polishReserve: boolean;
  setPolishReserve: (b: boolean) => void;
  deployLimit: number;
  deployFree: boolean;
  canDeployHere: boolean;
  // GW
  canGwDraft: boolean;
  canGwDeployHere: boolean;
  // Polish
  polishArmyDecision: {allowed: boolean; cost: number; reasons: string[]} | null;
  polishReserveDecision: {allowed: boolean; cost: number; reasons: string[]} | null;
  // Counts
  myOnMapArmies: number;
  myForts: number;
  myMinorAllies: number;
  // Units in space
  ownLandInSelected: Unit[];
  ownNavalInSelected: Unit[];
  potentialLandTargets: SpaceId[];
  potentialNavalTargets: SpaceId[];
  selectedUnitDef: Unit | undefined;
  /** Runs a move; `describe` lets the board explain a refusal. */
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  /** Arm irreversible controls first (the `confirmActions` preference). */
  confirmActions?: boolean;
  moves: Record<string, (...args: any[]) => void>;
}

export const SpacePanel = (props: SpacePanelProps) => {
  const {
    onOpenReference,
    G, selected, selectedUnit, setSelectedUnit, battleFrom, setBattleFrom, navalFrom, setNavalFrom,
    selectedUnitIds = [], toggleUnitSelection, selectUnitGroup, startMoveTargeting,
    viewer, me, locale, t, phase, canAct, canSpend, cpRemaining, canActionCard, pending, canDecide, war,
    warAim, setWarAim, warCp, setWarCp, secondObjective, setSecondObjective,
    targetControlledSpaces, warTargetControl, canDeclareWar,
    gwJointNavalAllies, gwJointNavalUnitIds,
    polishReserve, setPolishReserve, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere,
    polishArmyDecision, polishReserveDecision,
    myOnMapArmies, myForts, myMinorAllies,
    ownLandInSelected, ownNavalInSelected, potentialLandTargets, potentialNavalTargets,
    selectedUnitDef, doAction, confirmActions = true, moves,
  } = props;

  const selectedSpace = selected ? SPACES[selected] : null;
  const selectedState = selected ? G.spaces[selected] : null;
  const commandedOwner = viewer === null ? null : gwAllyImpulseFor(G, viewer) ?? viewer;
  const commanded = (unit: Unit): boolean => unit.owner === commandedOwner ||
    (phase === "gwManeuver" && viewer !== null && commandedOwner === viewer && !isPowerKey(unit.owner) &&
      unit.owner !== "US" && unit.owner !== "IT" && minorController(G, unit.owner) === viewer);
  const gwAllowed = (kind: GwActionKind): boolean => canAct && viewer !== null && gwActionAllowance(G, viewer, kind).ok;

  // The player aid's action list, computed once: every row carries its cost,
  // its enable flag and the UI's own reason, so the panel below is a renderer.
  // Memoised on the inputs that can change a row: the list runs every engine
  // gate (`canRecruitIn`, `influencePlacementProblem`, `gwActionAllowance`, …)
  // for ~15 rows, and the panel re-renders on every clock, hover and selection
  // change, none of which can change a row's legality.
  const rows: SpaceAction[] = React.useMemo(() => (viewer === null || selected === null ? [] : spaceActions({
    G,
    viewer,
    phase,
    space: selected,
    selectedUnit,
    cp: cpRemaining,
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
    startBattle: () => battleFrom !== selected && setBattleFrom(selected),
    startNavalBattle: () => navalFrom !== selected && setNavalFrom(selected),
    startMove: () => startMoveTargeting?.(),
    warCp,
    onDeclareWar: () => null,
    describeRow: (row) => ({label: row.label, reason: row.reason}),
    locale,
  // `doAction`, `moves`, `spaceActions`' own helpers and the setters are stable
  // (useCallback / module scope), so the state that can flip a row is listed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [
    G, viewer, phase, selected, selectedUnit, selectedUnitIds, startMoveTargeting, cpRemaining, canAct, canActionCard, war,
    myOnMapArmies, myForts, myMinorAllies, ownLandInSelected, ownNavalInSelected,
    potentialLandTargets, potentialNavalTargets, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere, polishArmyDecision, polishReserveDecision, polishReserve,
    gwJointNavalAllies, battleFrom, navalFrom, warCp, locale,
  ]);
  /**
   * The historic test ids for rows that used to be their own buttons.  The
   * e2e specs, the bot suites and the control tests address these names, so a
   * row keeps the name of the button it replaced.
   */
  /**
   * The second objective is the *other* space of the war: the one clicked on
   * the map is the first objective, so offering it again here would let a
   * declaration name the same space twice.
   */
  const secondObjectiveCandidates = targetControlledSpaces.filter((id) => id !== selected);

  const LEGACY_ACTION_IDS: Partial<Record<SpaceAction["id"], string>> = {
    gwMarch: "ie-gw-march",
    gwRail: "ie-gw-rail",
    gwDeploy: "ie-gw-deploy-action",
    gwElite: "ie-gw-elite-corps",
    gwNaval: "ie-gw-naval",
    refit: "ie-gw-refit",
    refitFleet: "ie-refit-fleet",
    deployReserves: "ie-deploy-reserves",
  };

  /**
   * Run a row; the engine's refusal is explained with the row's own reason.
   * A legal row still runs inside `spaceActions`' own `doAction` wrapper, so
   * this only adds the label the notice needs.
   */
  const runAction = (item: SpaceAction): void => {
    // `run` already funnels through `doAction`; the notice needs the row's
    // label and reason, so the row re-enters that wrapper with them.
    if (!item.enabled) return;
    doAction(() => item.run(), {label: item.label, reason: item.enabled ? undefined : item.reason});
  };

  /** One row: a button with a cost chip and a reason line under it. */
  const actionButton = (item: SpaceAction) => (
    <div
      key={item.uid ?? item.id}
      className="ie-action"
      data-testid={`ie-action-${item.uid ?? item.id}`}
      data-legacy-testid={LEGACY_ACTION_IDS[item.id]}
      data-enabled={item.enabled ? "true" : "false"}
    >
      <button
        type="button"
        className="ie-btn"
        data-testid={LEGACY_ACTION_IDS[item.id]}
        disabled={!item.enabled}
        title={item.reason}
        onClick={() => runAction(item)}
      >
        {item.label}
        {item.cost > 0 && <span className="ie-action-cost" aria-hidden="true"> · {item.cost} CP</span>}
      </button>
      {/* 22.5(2): the deploy row carries its Polish-reserve modifier with it. */}
      {item.id === "deployReserves" && viewer !== null && polishReserveDeployer(G) === viewer && (
        <label className="ie-inline ie-check" data-testid="ie-polish-reserve-toggle" title={bi(locale, "22.5(2): a deploy-reserves action may also deploy one Polish reserve army.", "22.5(2)：部署预备军行动可额外部署 1 支波兰预备军。")}>
          <input type="checkbox" checked={polishReserve} onChange={(e) => setPolishReserve(e.target.checked)} />
          {bi(locale, "Also deploy 1 Polish reserve army", "同时部署 1 支波兰预备军")}
        </label>
      )}
      {!item.enabled && item.reason !== undefined && (
        <span className="ie-action-reason">{item.reason}</span>
      )}
    </div>
  );
  const groupRows = (group: SpaceAction["group"]): SpaceAction[] => rows.filter((item) => item.group === group);

  /**
   * The legal rows, cheapest first, for the "available now" strip.
   *
   * Cost order rather than rulebook order: the strip exists to be clicked
   * without reading, and a 1 CP build sits above a 4 CP alliance.  Ties keep
   * their list order so the strip is stable between renders.
   */
  const enabledRows: SpaceAction[] = React.useMemo(
    () => rows.filter((item) => item.enabled).sort((a, b) => a.cost - b.cost),
    [rows],
  );

  /** A group's rows, legal ones first so the useful buttons stay above the fold. */
  const orderedRows = (group: SpaceAction["group"]): SpaceAction[] => {
    const items = groupRows(group);
    return [...items.filter((item) => item.enabled), ...items.filter((item) => !item.enabled)];
  };

  return (
    <IEPanel title={t.selectSpace}>
      {!selectedSpace || !selectedState ? <div className="ie-muted">{t.noSpace}</div> : (
        <div className="ie-space-detail" data-testid="ie-space-detail">
          <h4>{locale === "zh_CN" ? selectedSpace.nameZh : selectedSpace.name} <span className="ie-muted">({selectedSpace.type})</span></h4>
          <div>
            <strong>{t.control}:</strong> {controlLabel(t, selectedState.control)} · <strong>{t.influence}:</strong> {controlLabel(t, selectedState.influence ?? null)} · <strong>{t.diplomacy}:</strong> {controlLabel(t, selectedState.diplomacy ?? null)} · <strong>{t.ally}:</strong> {controlLabel(t, selectedState.ally ?? null)}
          </div>
          <div>
            <strong>{t.fort}:</strong> {selectedState.fort ? `${selectedState.fort.level} (${selectedState.fort.power})` : "—"} · <strong>{t.pacification}:</strong> {selectedState.pacification ?? 0} · <strong>{t.rebellion}:</strong> {selectedState.rebellion ? `${selectedState.rebellion.minor} (${selectedState.rebellion.step})` : "—"}
          </div>
          {selectedSpace.ports?.length ? <div><strong>{t.ports}:</strong> {selectedSpace.ports.map((p) => spaceLabel(p, locale)).join(", ")}</div> : null}
          {effectiveKeyType(G, selected!) !== undefined && (
            <div data-testid="ie-space-key-type">
              <strong>{t.keyType}:</strong>{" "}
              {effectiveKeyType(G, selected!) === "colonial" ? t.keyTypeColonial : t.keyTypeTerritorial}
              {selectedState.keyTypeOverride !== undefined && selectedState.keyTypeOverride !== selectedSpace.keyType
                ? ` (${bi(locale, "changed in play", "游戏中变更")})`
                : ""}
            </div>
          )}
          <div><strong>{t.connections}:</strong> {neighboursOf(selected!).map((id) => spaceLabel(id, locale)).join(", ")}</div>
          {viewer && me && <div><strong>{t.supply}:</strong> {hasLoc(G, viewer, selected!) ? t.inSupply : t.outOfSupply}</div>}
          <div className="ie-space-units"><strong>{t.units}:</strong> {selectedState.units.length === 0 ? "—" : selectedState.units.map((id) => {
            const u = G.units[id];
            if (!u) return null;
            const mine = viewer !== null && commanded(u);
            const isPendingUnit = canDecide && pending !== null && pending.options.some((o) => o.id === id);
            if (!mine) return <span key={id} className={`ie-unit-chip${isPendingUnit ? " pending" : ""}`}>{unitLabel(u, t)}</span>;
            if (isPendingUnit) return <button key={id} className="ie-btn secondary selected" aria-pressed onClick={() => doAction(() => moves.resolvePending(id), {label: unitLabel(u, t)})}>{unitLabel(u, t)}</button>;
            const selectedHere = selectedUnitIds.includes(id);
            // Clicking toggles the unit in the selection instead of replacing
            // it, so several units of one space can move as a single action
            // (12.15 land stacks, 16.1 fleets).  A single click still behaves
            // exactly as before when nothing else is selected.
            const onClick = toggleUnitSelection !== undefined
              ? () => (selectedUnit === id && selectedUnitIds.length === 1 ? setSelectedUnit(null) : toggleUnitSelection(id))
              : () => setSelectedUnit(id);
            return <button key={id} data-testid={`ie-unit-${id}`} className="ie-btn secondary" aria-pressed={selectedHere} onClick={onClick}>{unitLabel(u, t)}</button>;
          })}</div>
          {/*
            * A whole-stack shortcut.  Both rules that move several units at
            * once (12.15 redeployment, 16.1 naval movement) move "all" of them,
            * so selecting each one by hand is busywork; the button selects every
            * commanded unit in the space that can actually leave.
            */}
          {canAct && (() => {
            const movable = selectedState.units
              .map((id) => G.units[id])
              .filter((u): u is Unit => u !== undefined && viewer !== null && commanded(u) && !(u.flags?.deployedThisImpulse === true));
            if (movable.length < 2) return null;
            const allSelected = movable.every((u) => selectedUnitIds.includes(u.id));
            return (
              <div className="ie-space-select-all">
                <button
                  type="button"
                  className="ie-btn secondary ie-mini"
                  data-testid="ie-select-stack"
                  data-all-selected={allSelected ? "true" : "false"}
                  onClick={() => {
                    if (allSelected) { setSelectedUnit(null); return; }
                    // One dispatch, not "select the first then toggle the rest":
                    // React batches these, so a second dispatch would still read
                    // the pre-batch state and drop the first unit.
                    selectUnitGroup?.(movable.map((unit) => unit.id));
                  }}
                >
                  {allSelected
                    ? bi(locale, "Clear selection", "取消选择")
                    : bi(locale, `Select all ${movable.length} units`, `全选 ${movable.length} 个单位`)}
                </button>
              </div>
            );
          })()}
          {selectedUnitDef && commanded(selectedUnitDef) && (
            <div className="ie-hint">
              {bi(locale, "Selected:", "已选：")} {unitLabel(selectedUnitDef, t)}
              {selectedUnitIds.length > 1 && ` +${selectedUnitIds.length - 1} ${bi(locale, "more", "个")}`}
              {selectedUnitDef.space && selectedUnitDef.space !== selected && <span> · {bi(locale, "click a highlighted space to move here.", "点击高亮空间移动至此。")}</span>}
              <button className="ie-btn secondary ie-mini" onClick={() => setSelectedUnit(null)}>{t.cancel}</button>
            </div>
          )}

          {canAct && rows.length > 0 && (
            <div className="ie-action-groups" data-testid="ie-action-list">
              <div className="ie-action-groups-head">
                <span className="ie-cp-remaining">⚡ {cpRemaining} CP</span>
                <span className="ie-action-groups-hint">{bi(locale, "Every action the rules allow here, with its cost.", "此处规则允许的全部行动及其花费。")}</span>
                {/* The player aid's cost list, rendered from ACTION_COSTS. */}
                <RuleLink anchor="rules:costs" locale={locale} onOpenReference={onOpenReference} testId="ie-rule-ref-action-costs"/>
              </div>
              {/**
                * "Available now" strip.
                *
                * The groups below must keep every row the rules offer — a
                * disabled row's reason is how the player learns the
                * restriction — but at a typical space twelve rows are refused
                * for two that are legal, so the legal ones were pushed below
                * the fold.  This strip repeats just the legal rows at the top,
                * in cost order, so the next click never needs a scroll.  It is
                * a shortcut, not the list: the rows below are unchanged.
                */}
              {enabledRows.length > 0 && (
                <div className="ie-action-now" data-testid="ie-action-available" data-count={enabledRows.length}>
                  <span className="ie-action-now-label">
                    {bi(locale, `${enabledRows.length} available now`, `${enabledRows.length} 项现在可用`)}
                  </span>
                  <div className="ie-actions-grid">
                    {enabledRows.map((item) => (
                      <button
                        key={item.uid ?? item.id}
                        type="button"
                        className="ie-btn ie-btn-xs" data-testid={`ie-action-now-${item.uid ?? item.id}`}
                        title={item.label}
                        onClick={() => runAction(item)}
                      >
                        {item.label}
                        {item.cost > 0 && <span className="ie-action-cost" aria-hidden="true"> · {item.cost} CP</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(["recruit", "build", "diplomacy", "move", "greatWar"] as const).map((group) => {
                const items = groupRows(group);
                if (items.length === 0) return null;
                const available = items.filter((item) => item.enabled).length;
                return (
                  <section key={group} className="ie-action-group" data-testid={`ie-actions-${group}`} data-available={available}>
                    <h5 className="ie-action-group-title">
                      {locale === "zh_CN" ? ACTION_GROUP_LABELS[group].zh : ACTION_GROUP_LABELS[group].en}
                      <span className="ie-action-group-badge" aria-label={bi(locale, `${available} available`, `${available} 项可用`)}>{available}</span>
                    </h5>
                    <div className="ie-actions-grid">{orderedRows(group).map(actionButton)}</div>
                  </section>
                );
              })}
            </div>
          )}
          {canAct && (battleFrom !== null || navalFrom !== null) && (
            <div className="ie-target-hint" data-testid="ie-target-hint">
              <strong>{battleFrom ?? navalFrom}</strong>: {bi(locale, "choose a highlighted adjacent target space on the map.", "在地图上选择高亮的相邻目标空间。")}
              <button className="ie-btn secondary ie-mini" onClick={() => { setBattleFrom(null); setNavalFrom(null); }}>{t.cancel}</button>
            </div>
          )}

          {canActionCard && war === null && warTargetControl !== null && (
            <div className="ie-war-declare" data-testid="ie-war-declare">
              <div className="ie-action-group-title">{t.declareWar}</div>
              <div className="ie-inline">
                <IEBadge tone={warTargetControl.toLowerCase()}>{t.target}: {t.seats[warTargetControl]}</IEBadge>
                <select className="ie-select" value={warAim} onChange={(e) => setWarAim(e.target.value as typeof warAim)} title={t.warAim}>
                  <option value="conquest">{t.conquest}</option>
                  <option value="liberation">{t.liberation}</option>
                  <option value="unification">{t.unification}</option>
                </select>
                <select className="ie-select" value={warCp} onChange={(e) => setWarCp(Number(e.target.value))} title={t.cp}>
                  {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} CP</option>)}
                </select>
                {secondObjectiveCandidates.length > 0 && (
                  <select className="ie-select" value={secondObjective} onChange={(e) => setSecondObjective(e.target.value as SpaceId | "")} title={t.objectives}>
                    <option value="">{bi(locale, "One objective", "单一目标")}</option>
                    {secondObjectiveCandidates.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
                  </select>
                )}
                {/* Declaring a war cannot be undone, so it arms first like every
                    other irreversible control.  The label carries the CP price
                    so the confirmation names what the click is about to spend. */}
                <ConfirmButton
                  className="ie-btn"
                  data-testid="ie-declare-war"
                  disabled={!canDeclareWar}
                  confirm={confirmActions}
                  confirmLabel={bi(locale,
                    `Confirm: declare war (${warCp} CP)`,
                    `确认：宣战（${warCp} CP）`)}
                  onConfirm={() => doAction(
                    () => moves.declareWar(warTargetControl, warAim, secondObjective ? [selected!, secondObjective] : [selected!], warCp),
                    {label: bi(locale, `Declare war (${warCp} CP)`, `宣战（${warCp} CP）`), reason: canDeclareWar ? undefined : bi(locale, `Needs ${warCp} CP in this impulse.`, `本行动轮需要 ${warCp} CP。`)},
                  )}
                >
                  {t.declareWar}
                </ConfirmButton>
              </div>
              {G.wtt >= 3 && <div className="ie-hint">{bi(locale, "World Tension is 3+; a new war cannot be declared.", "世界紧张达到 3+，无法发动新的战争。")}</div>}
              {!canDeclareWar && G.wtt < 3 && <div className="ie-hint">{bi(locale, `Needs ${warCp} CP in this impulse.`, `本行动轮需要 ${warCp} CP。`)}</div>}
            </div>
          )}
        </div>
      )}
    </IEPanel>
  );
};
