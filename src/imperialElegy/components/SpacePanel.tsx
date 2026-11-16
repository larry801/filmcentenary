import React from "react";
import {GwActionKind, ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, neighboursOf, portBoxes, spaceLabel, isNavalBox} from "../constant/spaces";
import {effectiveKeyType, gwAllyImpulseFor, hasLoc, isArmyKind, isHomeSpace, landUnitsIn, minorController, ownsKey} from "../engine/rules";
import {gwActionAllowance} from "../engine/gwImpulse";
import {isCwArmySpace} from "../engine/characteristics";
import {polishReserveDeployer} from "../engine/poland";
import {IEBadge, IEPanel} from "./theme";
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
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
}

export const SpacePanel = (props: SpacePanelProps) => {
  const {
    onOpenReference,
    G, selected, selectedUnit, setSelectedUnit, battleFrom, setBattleFrom, navalFrom, setNavalFrom,
    viewer, me, locale, t, phase, canAct, canSpend, cpRemaining, canActionCard, pending, canDecide, war,
    warAim, setWarAim, warCp, setWarCp, secondObjective, setSecondObjective,
    targetControlledSpaces, warTargetControl, canDeclareWar,
    gwJointNavalAllies, gwJointNavalUnitIds,
    polishReserve, setPolishReserve, deployLimit, deployFree, canDeployHere,
    canGwDraft, canGwDeployHere,
    polishArmyDecision, polishReserveDecision,
    myOnMapArmies, myForts, myMinorAllies,
    ownLandInSelected, ownNavalInSelected, potentialLandTargets, potentialNavalTargets,
    selectedUnitDef, doAction, moves,
  } = props;

  const selectedSpace = selected ? SPACES[selected] : null;
  const selectedState = selected ? G.spaces[selected] : null;
  const commandedOwner = viewer === null ? null : gwAllyImpulseFor(G, viewer) ?? viewer;
  const commanded = (unit: Unit): boolean => unit.owner === commandedOwner ||
    (phase === "gwManeuver" && viewer !== null && commandedOwner === viewer && !isPowerKey(unit.owner) &&
      unit.owner !== "US" && unit.owner !== "IT" && minorController(G, unit.owner) === viewer);
  const gwAllowed = (kind: GwActionKind): boolean => canAct && viewer !== null && gwActionAllowance(G, viewer, kind).ok;

  const actionGroup = (key: string, title: string, children: React.ReactNode) => {
    const content = React.Children.toArray(children);
    if (content.length === 0) return null;
    return (
      <div className="ie-action-group" data-testid={`ie-actions-${key}`}>
        <div className="ie-action-group-title">{title}</div>
        <div className="ie-actions-grid">{content}</div>
      </div>
    );
  };

  // The player aid's action list, computed once: every row carries its cost,
  // its enable flag and the UI's own reason, so the panel below is a renderer.
  const rows: SpaceAction[] = viewer === null || selected === null ? [] : spaceActions({
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
    warCp,
    onDeclareWar: () => null,
    locale,
  });
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
    deployReserves: "ie-deploy-reserves",
  };

  /** One row: a button with a cost chip and a reason line under it. */
  const actionButton = (item: SpaceAction) => (
    <div
      key={item.id}
      className="ie-action"
      data-testid={`ie-action-${item.id}`}
      data-legacy-testid={LEGACY_ACTION_IDS[item.id]}
      data-enabled={item.enabled ? "true" : "false"}
    >
      <button
        type="button"
        className="ie-btn"
        data-testid={LEGACY_ACTION_IDS[item.id]}
        disabled={!item.enabled}
        title={item.reason}
        onClick={item.run}
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
            if (isPendingUnit) return <button key={id} className="ie-btn secondary selected" aria-pressed onClick={() => doAction(() => moves.resolvePending(id))}>{unitLabel(u, t)}</button>;
            return <button key={id} data-testid={`ie-unit-${id}`} className="ie-btn secondary" aria-pressed={selectedUnit === id} onClick={() => setSelectedUnit(id)}>{unitLabel(u, t)}</button>;
          })}</div>
          {selectedUnitDef && commanded(selectedUnitDef) && (
            <div className="ie-hint">
              {bi(locale, "Selected:", "已选：")} {unitLabel(selectedUnitDef, t)}
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
                    <div className="ie-actions-grid">{items.map(actionButton)}</div>
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
                <button className="ie-btn" disabled={!canDeclareWar} onClick={() => doAction(() => moves.declareWar(warTargetControl, warAim, secondObjective ? [selected!, secondObjective] : [selected!], warCp))}>{t.declareWar}</button>
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
