import React from "react";
import {ImperialElegyState, Power, SpaceId, Unit} from "../types";
import {SPACES, neighboursOf, portBoxes, spaceLabel, isNavalBox} from "../constant/spaces";
import {effectiveKeyType, hasLoc, isArmyKind, isHomeSpace, landUnitsIn, ownsKey} from "../engine/rules";
import {isCwArmySpace} from "../engine/characteristics";
import {polishReserveDeployer} from "../engine/poland";
import {IEBadge, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {bi, controlLabel, isPowerKey, unitLabel} from "./boardHelpers";

export interface SpacePanelProps {
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
    G, selected, selectedUnit, setSelectedUnit, battleFrom, setBattleFrom, navalFrom, setNavalFrom,
    viewer, me, locale, t, phase, canAct, canSpend, canActionCard, pending, canDecide, war,
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
            const mine = viewer !== null && u.owner === viewer;
            const isPendingUnit = canDecide && pending !== null && pending.options.some((o) => o.id === id);
            if (!mine) return <span key={id} className={`ie-unit-chip${isPendingUnit ? " pending" : ""}`}>{unitLabel(u, t)}</span>;
            if (isPendingUnit) return <button key={id} className="ie-btn secondary selected" aria-pressed onClick={() => doAction(() => moves.resolvePending(id))}>{unitLabel(u, t)}</button>;
            return <button key={id} data-testid={`ie-unit-${id}`} className="ie-btn secondary" aria-pressed={selectedUnit === id} onClick={() => setSelectedUnit(id)}>{unitLabel(u, t)}</button>;
          })}</div>
          {selectedUnitDef && selectedUnitDef.owner === viewer && (
            <div className="ie-hint">
              {bi(locale, "Selected:", "已选：")} {unitLabel(selectedUnitDef, t)}
              {selectedUnitDef.space && selectedUnitDef.space !== selected && <span> · {bi(locale, "click a highlighted space to move here.", "点击高亮空间移动至此。")}</span>}
              <button className="ie-btn secondary ie-mini" onClick={() => setSelectedUnit(null)}>{t.cancel}</button>
            </div>
          )}

          {canAct && (
            <div className="ie-action-groups">
              {actionGroup("recruit", bi(locale, "Recruit", "征募"), [
                <button key="army" className="ie-btn" disabled={!canSpend(1) || !me || viewer === null || !isHomeSpace(G, selected!, viewer) || !ownsKey(G, selected!, viewer) || myOnMapArmies >= me.manpower || me.flags.noBuildArmiesThisImpulse === true} onClick={() => doAction(() => moves.recruit(selected!, "army", 1))}>{t.recruitArmy}</button>,
                viewer === "UK"
                  ? <button key="cw" className="ie-btn" disabled={!canSpend(1) || !me || phase !== "gwManeuver" || !isCwArmySpace(selected) || me.flags.noBuildArmiesThisImpulse === true || (me.secondaryManpower ?? 0) <= 0} onClick={() => doAction(() => moves.recruit(selected!, "army", 1, {cw: true}))}>{bi(locale, "CW army", "自治领军")}</button>
                  : null,
                <button key="reserve" className="ie-btn" disabled={!canSpend(1) || !me || viewer === "UK" || me.reserves.length >= me.industry} onClick={() => doAction(() => moves.recruit(selected!, "reserveArmy", 1))}>{t.recruitReserve}</button>,
                <button key="ec" className="ie-btn" disabled={!canSpend(2) || viewer === null || !landUnitsIn(G, selected!).some((u) => isArmyKind(u.kind) && (u.owner === viewer || G.spaces[selected!].ally === viewer))} onClick={() => doAction(() => moves.recruit(selected!, "eliteCorps", 1))}>{t.recruitEc}</button>,
                polishArmyDecision !== null
                  ? <button key="polishArmy" data-testid="ie-polish-army" className="ie-btn" disabled={polishArmyDecision.allowed !== true || !canSpend(polishArmyDecision.cost)} title={polishArmyDecision.allowed ? undefined : polishArmyDecision.reasons.join(" | ")} onClick={() => doAction(() => moves.polishRecruit("army", selected!, 2))}>{bi(locale, `Polish army (${polishArmyDecision.cost} CP)`, `波兰军团（${polishArmyDecision.cost} CP）`)}</button>
                  : null,
                polishReserveDecision !== null
                  ? <button key="polishReserve" data-testid="ie-polish-reserve" className="ie-btn secondary" disabled={polishReserveDecision.allowed !== true || !canSpend(polishReserveDecision.cost)} title={polishReserveDecision.allowed ? undefined : polishReserveDecision.reasons.join(" | ")} onClick={() => doAction(() => moves.polishRecruit("reserveArmy", null, 2))}>{bi(locale, `Polish reserve (${polishReserveDecision.cost} CP)`, `波兰预备军（${polishReserveDecision.cost} CP）`)}</button>
                  : null,
              ])}
              {actionGroup("build", bi(locale, "Build", "建造"), [
                portBoxes(selected!).length > 0 ? <button key="sq" className="ie-btn" disabled={!canSpend(2) || !me || viewer === null || !isHomeSpace(G, selected!, viewer) || !ownsKey(G, selected!, viewer)} onClick={() => doAction(() => moves.constructFleet(selected!, "squadron", false))}>{t.buildSquadron}</button> : null,
                portBoxes(selected!).length > 0 ? <button key="dn" className="ie-btn" disabled={!canSpend(3) || !me || viewer === null || !isHomeSpace(G, selected!, viewer) || !ownsKey(G, selected!, viewer) || (G.persistent.dreadnoughts !== true && !me.flags.navalLimit)} onClick={() => doAction(() => moves.constructFleet(selected!, "dreadnought", false))}>{t.buildDreadnought}</button> : null,
                <button key="fort" className="ie-btn" disabled={!canSpend(1) || !me || selectedSpace.region !== "europe" || !!selectedState.fort || myForts >= 3 || !!me.flags[`fort_${selected}`]} onClick={() => doAction(() => moves.buildFort(selected!, 1))}>{t.buildFort}</button>,
                <button key="ef" className="ie-btn" disabled={!canSpend(2)} onClick={() => doAction(() => moves.buildEf(selected!))}>{t.buildEf}</button>,
                selectedUnitDef && selectedUnitDef.kind === "expeditionary" && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected
                  ? <button key="efmove" className="ie-btn secondary" disabled={!canSpend(1)} onClick={() => doAction(() => moves.buildEf(selected!, selectedUnitDef.id))}>{bi(locale, "Move selected EF here", "移动所选远征军至此")}</button>
                  : null,
              ])}
              {actionGroup("diplomacy", bi(locale, "Diplomacy & influence", "外交与影响"), [
                <button key="inf" className="ie-btn" disabled={!canSpend(1) || !me || me.flags.alreadyInfluenced === true || selectedState.control !== null || (selectedState.influence ?? null) !== null || viewer === null || !hasLoc(G, viewer, selected!)} onClick={() => doAction(() => moves.placeInfluence(selected!))}>{t.placeInfluence}</button>,
                <button key="dip" className="ie-btn" disabled={!canSpend(1) || !me || me.flags.alreadyInfluenced === true || selectedState.diplomacy !== null || selectedState.control === null || isPowerKey(selectedState.control) || viewer === null || !hasLoc(G, viewer, selected!)} onClick={() => doAction(() => moves.placeDiplomacy(selected!))}>{t.placeDiplomacy}</button>,
                <button key="ally" className="ie-btn" disabled={!canSpend(3) || viewer === null || selectedState.diplomacy !== viewer || (selectedState.ally ?? null) !== null || myMinorAllies >= 5} onClick={() => doAction(() => moves.minorAlliance(selected!))}>{t.minorAlliance}</button>,
                <button key="uninf" className="ie-btn secondary" disabled={!canSpend(1) || !me || me.flags.alreadyRemovedInfluence === true || viewer === null || (selectedState.influence !== viewer && selectedState.diplomacy !== viewer)} onClick={() => doAction(() => moves.removeInfluence(selected!))}>{bi(locale, "Remove influence", "移除影响")}</button>,
                <button key="unally" className="ie-btn secondary" disabled={!canSpend(4) || viewer === null || selectedState.ally !== viewer} onClick={() => doAction(() => moves.removeMinorAlliance(selected!))}>{bi(locale, "Break minor alliance", "解除小国联盟")}</button>,
                <button key="pacify" className="ie-btn" disabled={!canSpend(1) || !me || viewer === null || selectedState.influence !== viewer || !!me.flags[`pacified_${selected}`]} onClick={() => doAction(() => moves.pacify(selected!))}>{t.pacify}</button>,
              ])}
              {actionGroup("move", bi(locale, "Move & battle", "移动与战斗"), [
                selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase !== "gwManeuver"
                  ? <button key="move" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => selectedUnitDef.naval ? moves.navalMove([selectedUnitDef.id], selected!) : moves.redeploy(selectedUnitDef.id, selected!))}>{t.moveHere}</button>
                  : null,
                selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase === "gwManeuver" && selectedUnitDef.naval
                  ? <button key="gwnaval" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.navalMove([selectedUnitDef.id], selected!))}>{t.moveHere}</button>
                  : null,
                selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase === "gwManeuver" && selectedUnitDef.naval
                  ? gwJointNavalAllies.map((ally) => (
                      <button key={`gwjoint-${ally}`} data-testid={`ie-gw-joint-naval-${ally}`} className="ie-btn secondary" disabled={!canSpend(1)}
                        title={bi(locale, "15.2.2: move one contingent from each allied power together.", "15.2.2：两国各派一支分舰队联合行动。")}
                        onClick={() => doAction(() => moves.gwJointNaval(ally, [selectedUnitDef.id], gwJointNavalUnitIds(ally), selected!))}>
                        {bi(locale, `Joint naval with ${t.seats[ally]}`, `与${t.seats[ally]}联合海军`)}
                      </button>
                    ))
                  : null,
                selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.space !== selected && phase === "gwManeuver" && !selectedUnitDef.naval
                  ? <React.Fragment key="gwmove">
                      <button data-testid="ie-gw-march" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.gwMarch(selectedUnitDef.id, selected!))}>{t.gwMarch}</button>
                      <button data-testid="ie-gw-rail" className="ie-btn secondary" disabled={!canSpend(1)} onClick={() => doAction(() => moves.gwRail(selectedUnitDef.id, selected!))}>{t.gwRail}</button>
                    </React.Fragment>
                  : null,
                selectedUnitDef && selectedUnitDef.owner === viewer && selectedUnitDef.steps < 2 && phase === "gwManeuver"
                  ? <button key="refit" className="ie-btn" disabled={!canSpend(1)} onClick={() => doAction(() => moves.gwRefit(selectedUnitDef.id))}>{bi(locale, "Refit selected unit (GW)", "整补所选单位（大战）")}</button>
                  : null,
                viewer === "UK" && me?.rapidDeployment && !me.rapidDeployment.spent
                  && selectedUnitDef && selectedUnitDef.owner === "UK" && selectedUnitDef.naval && selectedUnitDef.space !== selected
                  && (phase === "wartime" || phase === "gwManeuver")
                  ? <button key="rapid" className="ie-btn secondary" onClick={() => doAction(() => moves.rapidDeploy([selectedUnitDef.id], selected!))}>{bi(locale, "Rapid Deployment (free naval move)", "快速部署（免费海军移动）")}</button>
                  : null,
                viewer === "UK" && me?.rapidDeployment && !me.rapidDeployment.spent && (phase === "wartime" || phase === "gwManeuver")
                  ? <button key="rapidDecline" className="ie-btn secondary" onClick={() => doAction(() => moves.declineRapidDeployment())}>{bi(locale, "Decline Rapid Deployment", "放弃快速部署")}</button>
                  : null,
                phase === "wartime" && me && me.reserves.length > 0
                  ? <React.Fragment key="deploy">
                      <button className="ie-btn" disabled={!canDeployHere} onClick={() => doAction(() => moves.deployReserves(selected!, deployLimit, {polishReserve}))}>{t.deployReserves}{deployFree ? bi(locale, " (free)", "（免费）") : ""}</button>
                      {polishReserveDeployer(G) === viewer && (
                        <label className="ie-inline ie-check" data-testid="ie-polish-reserve-toggle" title={bi(locale, "22.5(2): a deploy-reserves action may also deploy one Polish reserve army.", "22.5(2)：部署预备军行动可额外部署 1 支波兰预备军。")}>
                          <input type="checkbox" checked={polishReserve} onChange={(e) => setPolishReserve(e.target.checked)} />
                          {bi(locale, "Also deploy 1 Polish reserve army", "同时部署 1 支波兰预备军")}
                        </label>
                      )}
                    </React.Fragment>
                  : null,
                <button key="land" className="ie-btn secondary" disabled={!canSpend(1) || ownLandInSelected.length === 0 || potentialLandTargets.length === 0} onClick={() => { setNavalFrom(null); setBattleFrom(selected); }}>{t.battleHere}</button>,
                <button key="naval" className="ie-btn secondary" disabled={!canSpend(1) || ownNavalInSelected.length === 0 || potentialNavalTargets.length === 0} onClick={() => { setBattleFrom(null); setNavalFrom(selected); }}>{t.navalBattle}</button>,
              ])}
              {canAct && phase === "gwManeuver" && actionGroup("gw", bi(locale, "Great War", "大战"), [
                <button key="draft" className="ie-btn" disabled={!canGwDraft} onClick={() => doAction(() => moves.gwDraft(selected!))}>{t.gwDraft}</button>,
                <button key="deploy" data-testid="ie-gw-deploy-action" className="ie-btn" title={bi(locale, "Deploy one reserve army here (27.5).", "在此部署一支预备军（27.5）。")} disabled={!canGwDeployHere} onClick={() => doAction(() => moves.gwDeploy(selected!))}>{t.gwDeploy}</button>,
              ])}
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
                {targetControlledSpaces.length > 0 && (
                  <select className="ie-select" value={secondObjective} onChange={(e) => setSecondObjective(e.target.value as SpaceId | "")} title={t.objectives}>
                    <option value="">{bi(locale, "One objective", "单一目标")}</option>
                    {targetControlledSpaces.map((id) => <option key={id} value={id}>{spaceLabel(id, locale)}</option>)}
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
