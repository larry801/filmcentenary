/**
 * Presentation-only board layout.
 *
 * Every value comes from `BoardModel`; this file owns markup, CSS classes and
 * test ids so the rules/state logic can be tested without a renderer and the
 * layout can be changed without touching the rules wiring.
 */
import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState, PendingOption, Power, POWERS, SpaceId, Unit} from "../types";
import {SPACES, TSRR_ROUTE, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "../constant/spaces";
import {POWER_DEFS} from "../constant/powers";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {cpBudgetFor, effectiveKeyType, friendlySpace, gwAllyImpulseFor, hasLoc, isArmyKind, isHomeSpace, landStackingLimit, landUnitsIn, minorAlliesOf, minorController, navalUnitsIn, ownsKey} from "../engine/rules";
import {CARD_BY_ID, cardById, decadeLabel} from "../engine/deck";
import {Decade} from "../constant/cards";
import {cpChainResolution} from "../engine/economy";
import {GOALS_BY_ID} from "../constant/goals";
import {IEBadge, IEChip, IEPanel, IESurface} from "./theme";
import {ieT} from "./i18n";
import {logText} from "./logText";
import i18n from "../../constant/i18n";
import {
  BALANCE_OF_POWER_CARD,
  amphibiousAssaultCheck,
  navalInterceptCheck,
  navalTransportCheck,
  responseCardEligibility,
} from "../moves";
import {planNavalTransport} from "../engine/navalMovement";
import {
  AU_NATIONALITIES,
  auIncorporateDecision,
  auRightsDecision,
  canGrantCitizenship,
  isCwArmySpace,
  jihadUse,
  passRestriction,
  superiorStaffWorkFreeDeploy,
  TSRR_RAIL_ARMY_KINDS,
  tsrrRail,
} from "../engine/characteristics";
import {polishController, polishRecruitDecision} from "../engine/poland";
import {deployReserveLimit, isLoneMinorWar, loneMinorDefender, rapidMobilizationFreeDeploy} from "../engine/limitedWar";
import {polishReserveDeployer} from "../engine/poland";
import {italyAllianceBox, italyAllianceSide} from "../engine/italyEntry";
import {isIndependentItaly} from "../engine/greatWarFlow";
import {gwActionAllowance} from "../engine/gwImpulse";
import {treatyOptionLabel} from "../engine/treatyChoice";
import {
  POWER_KEYS,
  amphibiousReasonText,
  bi,
  BATTLE_STAGE,
  controlLabel,
  interceptReasonText,
  isPowerKey,
  OPTION_ZH,
  PHASE_LABEL,
  pickActionTarget,
  PROMPT_ZH,
  powerOrMinorLabel,
  responseReasonText,
  transportReasonText,
  unitLabel,
} from "./boardHelpers";
import {MapPanel} from "./MapPanel";
import {SpacePanel} from "./SpacePanel";
import {PendingPanel} from "./PendingPanel";
import {HandChoices} from "./HandChoices";
import {CardChoiceFace} from "./CardChoice";
import {PhaseAction, PhaseActions} from "./PhaseActions";
import {HandTray} from "./HandTray";
import {CommandBar} from "./CommandBar";
import {RailTabs} from "./RailTabs";
import {SpaceOverlay} from "./SpaceOverlay";
import {DashboardPanel} from "./DashboardPanel";
import {MpitPanel} from "./MpitPanel";
import {NationalActionsPanel} from "./NationalActionsPanel";
import {AmphibiousPanel, NavalTransportPanel, NavalInterceptPanel} from "./NavalPanel";
import {WarPanel} from "./WarPanel";
import {GreatWarPanel} from "./GreatWarPanel";
import {SeatAlert} from "./SeatStrip";

import type {BoardModel} from "./useBoardModel";


const LogLine = React.memo(({entry, locale}: {entry: ImperialElegyState["log"][number]; locale: "en" | "zh_CN"}) => (
  <div><span className="t">T{entry.turn}</span>{logText(entry, locale)}</div>
));

export interface BoardLayoutProps {
  model: BoardModel;
}

export const BoardLayout = ({model}: BoardLayoutProps) => {
  const {
    otherSeatPending,
    isCurrentSeat,
    mapBattleTargets,
    mapLegalTargets,
    G,
    ctx,
    moves,
    playerID,
    hotseat,
    modePill,
    t,
    actualLocale,
    decade,
    viewer,
    selected,
    selectedUnit,
    targeting,
    battleFrom,
    navalFrom,
    seatUi,
    me,
    phase,
    active,
    isActive,
    eliminated,
    botSeats,
    isBotViewer,
    pending,
    canDecide,
    war,
    gw,
    battle,
    warWasActive,
    warBelligerents,
    isPrincipal,
    isBelligerent,
    cpBudget,
    canAct,
    canSpend,
    canActionCard,
    canPhaseAct,
    forcedPass,
    forcedCardIds,
    forcedGwCard,
    forcedPassTitle,
    hasPhaseButtons,
    phaseActions,
    nationalActionPhase,
    auRightsEligible,
    auReformValue,
    auReformDecision,
    auCitizenEligible,
    auCitizenValue,
    auCitizenDecision,
    auIncorporateCandidates,
    auIncorporateEligible,
    auIncorporateValue,
    auIncorporate,
    zouaveInPlay,
    zouaveReason,
    tsrrPhase,
    tsrrArmies,
    tsrrUnitValue,
    tsrrFrom,
    tsrrDestinations,
    tsrrToValue,
    tsrrDecision,
    showNationalActions,
    needsCp,
    auReformReason,
    auCitizenReason,
    auIncorporateReason,
    tsrrReason,
    jihadDecision,
    jihadReason,
    polishOwner,
    polishArmyDecision,
    polishReserveDecision,
    lastLog,
    lastNavalBox,
    lastNavalMover,
    amphibiousVisible,
    ownLoadedArmyAt,
    amphibiousOrigins,
    amphibiousFromValue,
    amphibiousTargets,
    amphibiousToValue,
    amphibiousBox,
    amphibiousArmies,
    chosenAmphibiousArmies,
    amphibiousArmyValue,
    amphibiousCheck,
    amphibiousPhaseOk,
    amphibiousReason,
    amphibiousCanGo,
    toggleAmphibiousArmy,
    transportVisible,
    transportMajor,
    transportOwns,
    transportable,
    transportOrigins,
    transportFromValue,
    transportLands,
    transportLandValue,
    transportFleet,
    transportReachableFrom,
    transportTargets,
    transportToValue,
    transportCheck,
    transportPhaseOk,
    transportReason,
    transportCanGo,
    adjacentPortsToBox,
    ownAdjacentPorts,
    interceptPorts,
    interceptPortValue,
    interceptCheck,
    interceptReason,
    interceptVisible,
    botTimerRef,
    botFailureRef,
    selectedState,
    selectedUnitDef,
    commandedOwner,
    commandsSelected,
    ownUnitsInSelected,
    ownLandInSelected,
    ownNavalInSelected,
    enemyLandTargetsFrom,
    enemyNavalTargetsFrom,
    potentialLandTargets,
    potentialNavalTargets,
    unitMoveTargets,
    pendingSpaceTargets,
    battleTargets,
    myOnMapArmies,
    myForts,
    myMinorAllies,
    hand,
    handCounts,
    goalCounts,
    doAction,
    beginTargeting,
    setBattleFrom,
    setNavalFrom,
    setSelectedUnit,
    submitTargeting,
    onSelectImpl,
    onSelect,
    pendingKindLabels,
    pendingKind,
    pendingPrompt,
    optionCardId,
    optionLabel,
    optionFace,
    optionAction,
    canDecline,
    warStatusLabels,
    warStatusLabel,
    warAimLabel,
    callableAllies,
    warAllyValue,
    callableMinors,
    warMinorValue,
    warBudgetRows,
    warDefenderMinors,
    minorMarkerRows,
    warTargetControl,
    targetControlledSpaces,
    canDeclareWar,
    gwOrderPowers,
    gwBudgetOrder,
    gwSlotLabel,
    italyBox,
    italySide,
    italyBoxLabel,
    italyShowing,
    italyHow,
    canGwDraft,
    gwDeployRoom,
    canGwDeployHere,
    gwSideAllies,
    gwTransferToValue,
    gwTransferAmountValue,
    canGwTransfer,
    gwJointNavalAllies,
    gwJointNavalUnitIds,
    gwCardId,
    gwCombatCardHeld,
    gwCardAlreadyFaceup,
    canGwReveal,
    deployFree,
    deployLimit,
    deployRoom,
    canDeployHere,
    homeCardTitle,
    saveList,
    ngChoices,
    giveCards,
    giveCardValue,
    responseInHand,
    responseWindow,
    chainInfo,
    chainUsed,
    chainNonEmpty,
    chainReady,
    chainSpendable,
    chainCap,
    chainDisabledReason,
    targetingHint,
    choicesProps,
    choiceKinds,
    dockChoices,
    dockVisible,
    dockSummary,
    handChoicesHint,
    mapHint,
    board,
    setBoard,
    railTab,
    setRailTab,
    warAim,
    setWarAim,
    warCp,
    setWarCp,
    secondObjective,
    setSecondObjective,
    mpitTarget,
    setMpitTarget,
    mpitTrack,
    setMpitTrack,
    warAlly,
    setWarAlly,
    warMinor,
    setWarMinor,
    giveTarget,
    setGiveTarget,
    giveCardId,
    setGiveCardId,
    confirmSurrender,
    setConfirmSurrender,
    auReformTarget,
    setAuReformTarget,
    auCitizenTarget,
    setAuCitizenTarget,
    auIncorporateTarget,
    setAuIncorporateTarget,
    auSacrifice,
    setAuSacrifice,
    tsrrUnitId,
    setTsrrUnitId,
    tsrrTo,
    setTsrrTo,
    polishReserve,
    setPolishReserve,
    gwTransferTo,
    setGwTransferTo,
    gwTransferAmount,
    setGwTransferAmount,
    dockCollapsed,
    setDockCollapsed,
    trayOpen,
    setTrayOpen,
    trayExpanded,
    setTrayExpanded,
    cardFaceMode,
    setCardFaceMode,
    amphibiousFrom,
    setAmphibiousFrom,
    amphibiousTo,
    setAmphibiousTo,
    amphibiousUnitIds,
    setAmphibiousUnitIds,
    transportFrom,
    setTransportFrom,
    transportTo,
    setTransportTo,
    transportLand,
    setTransportLand,
    interceptPort,
    setInterceptPort,
    interaction,
    dispatch,
  } = model;

/** One-line entry that renders a bulky panel only after it is opened. */
const MoreActions = ({label, testId, children}: {label: string; testId: string; children: React.ReactNode}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="ie-more-actions" data-testid={testId}>
      <button
        type="button"
        className="ie-more-actions-trigger"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((value) => !value)}
      >
        {label} <span aria-hidden="true">▸</span>
      </button>
      {open && <div className="ie-more-actions-body">{children}</div>}
    </div>
  );
};

/** Card-face display preference; lives in the command bar menu. */
const DisplayMenu = ({mode, setMode, locale}: {
  mode: "svg" | "print";
  setMode: (mode: "svg" | "print") => void;
  locale: "en" | "zh_CN";
}) => (
  <details className="ie-display-menu" data-testid="ie-display-menu">
    <summary className="ie-display-trigger" title={bi(locale, "Display options", "显示选项")}>
      {bi(locale, "Display", "显示")} <span aria-hidden="true">▾</span>
    </summary>
    <div className="ie-display-panel">
      <div className="ie-display-title">{bi(locale, "Card face", "卡面")}</div>
      <div className="ie-display-options" role="group" aria-label={bi(locale, "Card face", "卡面")}>
        <button
          type="button"
          className={`ie-display-option${mode === "svg" ? " selected" : ""}`}
          aria-pressed={mode === "svg"}
          data-testid="ie-card-face-svg"
          onClick={() => setMode("svg")}
        >
          {bi(locale, "SVG (fast)", "SVG（快速）")}
        </button>
        <button
          type="button"
          className={`ie-display-option${mode === "print" ? " selected" : ""}`}
          aria-pressed={mode === "print"}
          data-testid="ie-card-face-print"
          onClick={() => setMode("print")}
        >
          {bi(locale, "Printed scans", "印刷卡图")}
        </button>
      </div>
      <div className="ie-display-note">
        {bi(locale, "Printed scans load the 14 MB card image set.", "印刷卡图会加载约 14 MB 的卡图资源。")}
      </div>
    </div>
  </details>
);

const RulesReference = ({locale}: {locale: "en" | "zh_CN"}) => (
  <div className="ie-rules-reference">
    <p>{locale === "zh_CN" ? "本实现覆盖 1850–1920 六年玩家战役：准备、外交、行动、结束阶段，有限战争（战争目标、联盟、先手、机动、胜利、复员），大战（爆发、计划、机动、冬季、消灭与胜利），以及卡牌事件、响应窗口、国家特性、外交与联盟、征募、工业、殖民、移动、补给、陆战/海战、条约、危机、国家目标与全部战役胜利条件。" : "This implementation covers the 1850–1920 six-player campaign: Prep, Diplomacy, Action and End phases; limited wars (war aims, alliance, initiative, maneuver, victory, demobilization); the Great War (outbreak, planning, maneuver, winter, elimination and victory); card events, response windows, national characteristics, diplomacy and alliances, recruitment, industry, colonial actions, movement, supply, land/naval combat, treaties, crises, national goals and every campaign victory condition."}</p>
    <p>{locale === "zh_CN" ? "资产来自 VASSAL 模块 1.1.0-beta.4；卡牌文字以卡面为准，OCR 仅作辅助。威廉二世 #82 与法国目标 #22 为文本重建，详见 docs/imperial-elegy/CORRECTIONS.md。" : "Assets come from VASSAL module 1.1.0-beta.4; card text follows the printed faces and OCR was advisory only. Wilhelm II #82 and French goal #22 are text reconstructions; see docs/imperial-elegy/CORRECTIONS.md."}</p>
  </div>
);


  const displayMenu = <DisplayMenu mode={cardFaceMode} setMode={setCardFaceMode} locale={actualLocale}/>;

  const amphibiousNode = viewer !== null ? (
    <AmphibiousPanel show G={G} viewer={viewer} locale={actualLocale} t={t}
      amphibiousOrigins={amphibiousOrigins} amphibiousFromValue={amphibiousFromValue} setAmphibiousFrom={setAmphibiousFrom}
      amphibiousTargets={amphibiousTargets} amphibiousToValue={amphibiousToValue} setAmphibiousTo={setAmphibiousTo}
      amphibiousArmies={amphibiousArmies} amphibiousArmyValue={amphibiousArmyValue} toggleAmphibiousArmy={toggleAmphibiousArmy}
      amphibiousCanGo={amphibiousCanGo} amphibiousReason={amphibiousReason} amphibiousCheck={amphibiousCheck}
      doAction={doAction} moves={moves}/>
  ) : null;
  const transportNode = viewer !== null ? (
    <NavalTransportPanel show G={G} viewer={viewer} locale={actualLocale} t={t}
      transportOrigins={transportOrigins} transportFromValue={transportFromValue} setTransportFrom={setTransportFrom}
      transportLands={transportLands} transportLandValue={transportLandValue} setTransportLand={setTransportLand}
      transportTargets={transportTargets} transportToValue={transportToValue} setTransportTo={setTransportTo}
      transportFleet={transportFleet} transportCanGo={transportCanGo} transportReason={transportReason}
      doAction={doAction} moves={moves}/>
  ) : null;
  const interceptNode = (
    <NavalInterceptPanel show lastNavalBox={lastNavalBox as SpaceId} lastNavalMover={lastNavalMover}
      viewer={viewer} locale={actualLocale} t={t}
      interceptPorts={interceptPorts} interceptPortValue={interceptPortValue} setInterceptPort={setInterceptPort}
      interceptCheck={interceptCheck} interceptReason={interceptReason}
      doAction={doAction} moves={moves}/>
  );

  const actionRail = (
    <>
      <SpacePanel
        G={G}
        selected={selected}
        selectedUnit={selectedUnit}
        setSelectedUnit={setSelectedUnit}
        battleFrom={battleFrom}
        setBattleFrom={(id) => setBattleFrom.current(id)}
        navalFrom={navalFrom}
        setNavalFrom={(id) => setNavalFrom.current(id)}
        viewer={viewer}
        me={me}
        locale={actualLocale}
        t={t}
        phase={phase}
        canAct={canAct}
        canSpend={canSpend}
        cpRemaining={cpBudget()}
        canActionCard={canActionCard}
        pending={pending}
        canDecide={canDecide}
        war={war}
        warAim={warAim}
        setWarAim={setWarAim}
        warCp={warCp}
        setWarCp={setWarCp}
        secondObjective={secondObjective}
        setSecondObjective={setSecondObjective}
        targetControlledSpaces={targetControlledSpaces}
        warTargetControl={warTargetControl}
        canDeclareWar={canDeclareWar}
        gwJointNavalAllies={gwJointNavalAllies}
        gwJointNavalUnitIds={gwJointNavalUnitIds}
        polishReserve={polishReserve}
        setPolishReserve={setPolishReserve}
        deployLimit={deployLimit}
        deployFree={deployFree}
        canDeployHere={canDeployHere}
        canGwDraft={canGwDraft}
        canGwDeployHere={canGwDeployHere}
        polishArmyDecision={polishArmyDecision}
        polishReserveDecision={polishReserveDecision}
        myOnMapArmies={myOnMapArmies}
        myForts={myForts}
        myMinorAllies={myMinorAllies}
        ownLandInSelected={ownLandInSelected}
        ownNavalInSelected={ownNavalInSelected}
        potentialLandTargets={potentialLandTargets}
        potentialNavalTargets={potentialNavalTargets}
        selectedUnitDef={selectedUnitDef}
        doAction={doAction}
        moves={moves}
      />
      <NationalActionsPanel
        show={showNationalActions && viewer !== null}
        viewer={viewer as Power}
        locale={actualLocale}
        t={t}
        cpBudget={cpBudget}
        zouaveInPlay={zouaveInPlay}
        zouaveReason={zouaveReason}
        auReformValue={auReformValue}
        setAuReformTarget={setAuReformTarget}
        auReformDecision={auReformDecision}
        auReformReason={auReformReason}
        auCitizenValue={auCitizenValue}
        setAuCitizenTarget={setAuCitizenTarget}
        auCitizenDecision={auCitizenDecision}
        auCitizenReason={auCitizenReason}
        auSacrifice={auSacrifice}
        setAuSacrifice={setAuSacrifice}
        auIncorporateCandidates={auIncorporateCandidates}
        auIncorporateValue={auIncorporateValue}
        setAuIncorporateTarget={setAuIncorporateTarget}
        auIncorporate={auIncorporate}
        auIncorporateReason={auIncorporateReason}
        tsrrArmies={tsrrArmies}
        tsrrUnitValue={tsrrUnitValue}
        setTsrrUnitId={setTsrrUnitId}
        tsrrDestinations={tsrrDestinations}
        tsrrToValue={tsrrToValue}
        setTsrrTo={setTsrrTo}
        tsrrDecision={tsrrDecision}
        tsrrReason={tsrrReason}
        doAction={doAction}
        moves={moves}
      />
      {/* Legal naval actions render in full; with nothing legal they fold into
          one "More actions" line instead of three always-open panels. */}
      {amphibiousVisible && viewer !== null && amphibiousOrigins.length > 0 && amphibiousNode}
      {transportVisible && viewer !== null && transportOrigins.length > 0 && transportNode}
      {interceptVisible && interceptNode}
      {!(amphibiousVisible && viewer !== null && amphibiousOrigins.length > 0) &&
        !(transportVisible && viewer !== null && transportOrigins.length > 0) &&
        !interceptVisible && (amphibiousVisible || transportVisible) && (
        <MoreActions label={bi(actualLocale, "More actions", "更多行动")} testId="ie-more-actions">
          {amphibiousVisible && viewer !== null && amphibiousNode}
          {transportVisible && viewer !== null && transportNode}
        </MoreActions>
      )}
    </>
  );

  const warRail = (
    <>
      {war && (
        <WarPanel
          war={war} G={G} viewer={viewer} active={active} phase={phase} locale={actualLocale} t={t}
          warStatusLabel={warStatusLabel} warAimLabel={warAimLabel} warBelligerents={warBelligerents}
          isPrincipal={isPrincipal} isBelligerent={isBelligerent} eliminated={eliminated} pending={pending}
          isActive={isActive} warBudgetRows={warBudgetRows} warDefenderMinors={warDefenderMinors}
          callableAllies={callableAllies} warAllyValue={warAllyValue} setWarAlly={setWarAlly}
          callableMinors={callableMinors} warMinorValue={warMinorValue} setWarMinor={setWarMinor}
          confirmSurrender={confirmSurrender} setConfirmSurrender={setConfirmSurrender}
          doAction={doAction} moves={moves}
        />
      )}
      {gw && (
        <GreatWarPanel
          gw={gw} G={G} viewer={viewer} me={me} active={active} phase={phase} locale={actualLocale} t={t}
          eliminated={eliminated} pending={pending} isActive={isActive} selected={selected}
          gwBudgetOrder={gwBudgetOrder} gwSlotLabel={gwSlotLabel} italyShowing={italyShowing}
          italyBox={italyBox} italyBoxLabel={italyBoxLabel} italyHow={italyHow}
          gwTransferToValue={gwTransferToValue} setGwTransferTo={setGwTransferTo}
          gwTransferAmountValue={gwTransferAmountValue} setGwTransferAmount={setGwTransferAmount}
          canGwTransfer={canGwTransfer} gwSideAllies={gwSideAllies} canGwReveal={canGwReveal}
          canGwDraft={canGwDraft} canGwDeployHere={canGwDeployHere} forcedGwCard={forcedGwCard}
          doAction={doAction} moves={moves}
        />
      )}
      {!war && !gw && <div className="ie-muted">{bi(actualLocale, "No war is in progress.", "当前没有进行中的战争。")}</div>}
    </>
  );

  const referenceRail = (
    <>
      <details className="ie-reference" open>
        <summary>{t.charts}</summary>
        <div className="ie-chart-grid">
          {[
            ["map-flashpoints", "Flashpoints"],
            ["combat-crt", "Combat & CRT"],
            ["colonial-great-wars", "Colonial & Great Wars"],
            ["war-aims-minors", "War Aims & Minors"],
            ["crisis", "Crisis Table"],
            ["influence-track", "Major Power Influence"],
            ["italy-legend", "Italy & Legend"],
            ["sequence-of-play", "Sequence of Play"],
            ["counter-count", "Counter Count"],
          ].map(([id, caption]) => (
            <figure key={id}><img src={`/imperial-elegy/charts/${id}.png`} alt={caption}/><figcaption>{caption}</figcaption></figure>
          ))}
        </div>
      </details>
      <DashboardPanel
        G={G} active={active} viewer={viewer} locale={actualLocale} t={t}
        handCounts={handCounts} goalCounts={goalCounts} homeCardTitle={homeCardTitle}
        minorMarkerRows={minorMarkerRows as [string, number][]}
      />
      <MpitPanel
        G={G} canAct={canAct} viewer={viewer} me={me} cpBudget={cpBudget} canSpend={canSpend}
        mpitTarget={mpitTarget} setMpitTarget={setMpitTarget} mpitTrack={mpitTrack} setMpitTrack={setMpitTrack}
        locale={actualLocale} t={t} doAction={doAction} moves={moves}
      />
      <details className="ie-reference">
        <summary>{t.rulesCoverage}</summary>
        <RulesReference locale={actualLocale}/>
      </details>
      <section className="ie-log-panel">
        <h3>{t.log}</h3>
        <div className="ie-log" data-testid="ie-log">
          {G.log.slice(-80).reverse().map((entry) => <LogLine key={entry.id} entry={entry} locale={actualLocale}/>)}
        </div>
      </section>
    </>
  );

  const commandStatus = (
    <div className="ie-status">
      <div className="ie-sub">{t.subtitle} · {t.turn} {G.turn} · {bi(actualLocale, decade.en, decade.zh)}</div>
      <IEBadge tone={G.wtt >= 4 ? "warn" : "default"}>{t.wtt}: {G.wtt}/5</IEBadge>
      {G.gw?.active && <IEBadge tone="warn">GW {G.gw.turn}</IEBadge>}
      {battle && <IEBadge tone="warn">{bi(actualLocale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")}</IEBadge>}
      {pending && <IEBadge tone="warn">{t.pending}: {t.seats[pending.power]}</IEBadge>}
      {responseWindow && <IEBadge tone="warn">{t.responseWindow}</IEBadge>}
      {viewer && <IEBadge tone={viewer.toLowerCase()}>{t.seats[viewer]}</IEBadge>}
      {!viewer && <IEBadge>{t.spectators}</IEBadge>}
      {hotseat && viewer !== null && botSeats.has(viewer) && (
        <div className="ie-bot-banner" role="status" aria-live="polite">
          🤖 {t.seats[viewer]} — {t.botSeatBadge} · {t.seatBotHint}
        </div>
      )}
    </div>
  );
  const commandMenu = (
    <div className="ie-command-menu">
      {displayMenu}
      <button className="ie-btn secondary ie-mini" data-testid="ie-open-charts" onClick={() => setRailTab("reference")}>{t.charts}</button>
      <button className="ie-btn secondary ie-mini" data-testid="ie-open-rules" onClick={() => setRailTab("reference")}>{t.rulesCoverage}</button>
    </div>
  );

  return (
    <IESurface className="ie-board">

      <CommandBar
        summary={dockSummary}
        collapsed={dockCollapsed}
        onToggleCollapsed={() => setDockCollapsed((value) => !value)}
        locale={actualLocale}
        phaseLabel={PHASE_LABEL(t, phase)}
        activeLabel={`${t.active}: ${t.seats[active]}`}
        turn={G.turn}
        cp={viewer ? cpBudget() : G.cpRemaining}
        actions={<PhaseActions title={t.yourTurnActions} locale={actualLocale} actions={phaseActions}/>}
        menu={commandMenu}
        status={commandStatus}
        notice={otherSeatPending && pending !== null && seatUi.onSwitchSeat ? (
          <SeatAlert
            pendingPower={pending.power}
            pendingKind={pendingPrompt !== "" ? pendingPrompt : pendingKind}
            locale={actualLocale}
            onGo={() => seatUi.onSwitchSeat!(pending.power)}
          />
        ) : undefined}
        dockVisible={dockVisible}
      >
        {dockChoices && <HandChoices {...choicesProps}/>}
        {(pending || battle || G.result) && (
          <PendingPanel
            G={G}
            pending={pending}
            canDecide={canDecide}
            pendingKind={pendingKind}
            pendingPrompt={pendingPrompt}
            optionLabel={optionLabel}
            optionFace={optionFace}
            optionAction={optionAction}
            canDecline={canDecline}
            pendingSpaceTargets={pendingSpaceTargets}
            viewer={viewer}
            locale={actualLocale}
            t={t}
            jihadDecision={jihadDecision}
            jihadReason={jihadReason}
            doAction={doAction}
            moves={moves}
            dock
          />
        )}
      </CommandBar>


      <div className="ie-layout">
        <main className="ie-play-column">
          <MapPanel
            G={G}
            selected={selected}
            onSelect={onSelect}
            board={board}
            setBoard={setBoard}
            pendingSpaceTargets={mapLegalTargets}
            unitMoveTargets={unitMoveTargets}
            battleTargets={mapBattleTargets}
            locale={actualLocale}
            t={t}
            mapHint={mapHint}
            modePill={modePill}
            overlay={<SpaceOverlay G={G} selected={selected} viewer={viewer} locale={actualLocale}/>}
          />
        </main>
        <RailTabs
          tabs={[
            {key: "action", label: bi(actualLocale, "Action", "行动"), content: actionRail, badge: pending !== null && viewer !== null && pending.power === viewer ? "!" : undefined},
            {key: "war", label: bi(actualLocale, "War", "战局"), content: warRail, visible: Boolean(war || gw), badge: war ? "⚔" : undefined},
            {key: "reference", label: bi(actualLocale, "Reference", "参考"), content: referenceRail},
          ]}
          active={railTab}
          onChange={setRailTab}
          label={bi(actualLocale, "Context", "语境栏")}
        />
      </div>

      {viewer === null && (
        <div className="ie-private-info" data-testid="ie-private-info">
          {t.privateInfo}: {t.hidden}. {t.spectators}.
        </div>
      )}
      <HandTray
        G={G}
        viewer={viewer}
        me={me}
        locale={actualLocale}
        t={t}
        phase={phase}
        isActive={isActive}
        eliminated={eliminated}
        pending={pending}
        canActionCard={canActionCard}
        isBelligerent={isBelligerent}
        war={war}
        forcedCardIds={forcedCardIds}
        hand={hand}
        saveList={saveList}
        giveCards={giveCards}
        giveCardId={giveCardId}
        setGiveCardId={setGiveCardId}
        giveTarget={giveTarget}
        setGiveTarget={setGiveTarget}
        giveCardValue={giveCardValue}
        responseInHand={responseInHand}
        responseWindow={responseWindow}
        chainNonEmpty={chainNonEmpty}
        chainSpendable={chainSpendable}
        chainCap={chainCap}
        chainReady={chainReady}
        chainDisabledReason={chainDisabledReason}
        cpBudget={cpBudget}
        doAction={doAction}
        moves={moves}
        handChoicesHint={handChoicesHint}
        cardFaceMode={cardFaceMode}
        open={trayOpen}
        onToggleOpen={() => setTrayOpen((value) => !value)}
        expanded={trayExpanded}
        onToggleExpanded={() => setTrayExpanded((value) => !value)}
      />
    </IESurface>
  );
};
