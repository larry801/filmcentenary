/**
 * Presentation-only board layout.
 *
 * Every value comes from `BoardModel`; this file owns markup, CSS classes and
 * test ids so the rules/state logic can be tested without a renderer and the
 * layout can be changed without touching the rules wiring.
 *
 * The layout is split by region.  Each region takes exactly one slice of the
 * model (`boardSlices.ts`) as plain props — never through React context, which
 * four suites stub out:
 *
 *   core        shell: track strip, the map column, and what is mounted
 *   interaction map selection and targeting
 *   orders      the turn panel's Action tab
 *   hand        the hand tray
 *   war         the turn panel's War tab
 *   reference   the reference drawer
 *
 * The board computes every tab's node once, so switching tabs never unmounts a
 * panel the derived state or the bots' effects depend on.
 */
import React from "react";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {IEBadge, IESurface} from "./theme";
import {bi, PHASE_LABEL} from "./boardHelpers";
import {logText} from "./logText";
import {MapPanel} from "./MapPanel";
import {SpacePanel} from "./SpacePanel";
import {PendingPanel} from "./PendingPanel";
import {HandChoices} from "./HandChoices";
import {HandTray} from "./HandTray";
import {TrackStrip} from "./TrackStrip";
import {TurnPanel} from "./TurnPanel";
import {PlayerMat} from "./PlayerMat";
import {ReferenceDrawer} from "./ReferenceDrawer";
import {NationalActionsPanel} from "./NationalActionsPanel";
import {AmphibiousPanel, NavalTransportPanel, NavalInterceptPanel} from "./NavalPanel";
import {WarPanel} from "./WarPanel";
import {GreatWarPanel} from "./GreatWarPanel";
import {SeatAlert} from "./SeatStrip";
import {IntentChooser} from "./IntentChooser";
import {TrenchBoard} from "./TrenchBoard";
import {MpitPanel} from "./MpitPanel";
import {Toast} from "./Toast";
import {MobileDock, type MobileDockTab} from "./MobileDock";
import type {MobileTab} from "./modelValues";
import type {BoardModel} from "./useBoardModel";
import type {CoreSlice, HandSlice, InteractionSlice, OrdersSlice, ReferenceSlice, WarSlice, T} from "./boardSlices";

const LogLine = React.memo(({entry, locale}: {entry: ImperialElegyState["log"][number]; locale: "en" | "zh_CN"}) => (
  <div><span className="t">T{entry.turn}</span>{logText(entry, locale)}</div>
));

export interface BoardLayoutProps {
  model: BoardModel;
}

export const BoardLayout = ({model}: BoardLayoutProps) => (
  <IESurface className="ie-board">
    <ShellRegion
      core={model.core}
      interaction={model.interaction}
      orders={model.orders}
      war={model.war}
      hand={model.hand}
      reference={model.reference}
    />
  </IESurface>
);

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

/**
 * Display preferences; lives in the track strip's menu.
 *
 * Both switches are stored in `localStorage` (`preferences.ts`) and read by the
 * tray and the phase buttons; the card face is read from this component's own
 * state, so flipping it here re-renders the board.  The `confirmActions` switch
 * is passed down as a prop for the same reason: storage alone only reaches a
 * consumer on its next mount.
 */
const DisplayMenu = ({mode, setMode, confirmActions, setConfirmActions, locale}: {
  mode: "svg" | "print";
  setMode: (mode: "svg" | "print") => void;
  confirmActions: boolean;
  setConfirmActions: (enabled: boolean) => void;
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

      <div className="ie-display-title">{bi(locale, "Confirmation", "确认")}</div>
      <label className="ie-display-toggle">
        <input
          type="checkbox"
          data-testid="ie-confirm-actions"
          checked={confirmActions}
          onChange={(event) => setConfirmActions(event.target.checked)}
        />
        <span>{bi(locale, "Ask before irreversible actions", "不可撤销的操作需要二次确认")}</span>
      </label>
      <div className="ie-display-note">
        {bi(locale,
          "Play for CP, events, pass, ending a phase and destructive decisions arm first when this is on.",
          "开启时，作 CP 打出、事件、停牌、结束阶段与破坏性决策都需先点击蓄势、再点击确认。")}
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

// ---------------------------------------------------------------------------
// Turn panel tabs
// ---------------------------------------------------------------------------

/** Action tab: the selected space and everything the player may do there. */
export const OrdersRegion = (props: OrdersSlice) => {
  const {
    onOpenReference,
    G, selected, selectedUnit, setSelectedUnit, battleFrom, setBattleFrom, navalFrom, setNavalFrom,
    viewer, me, locale, t, phase, canAct, canSpend, cpBudget, canActionCard, pending, canDecide, war,
    warAim, setWarAim, warCp, setWarCp, secondObjective, setSecondObjective,
    targetControlledSpaces, warTargetControl, canDeclareWar, gwJointNavalAllies, gwJointNavalUnitIds,
    polishReserve, setPolishReserve, deployLimit, deployFree, canDeployHere, canGwDraft, canGwDeployHere,
    polishArmyDecision, polishReserveDecision, myOnMapArmies, myForts, myMinorAllies, ownLandInSelected,
    ownNavalInSelected, potentialLandTargets, potentialNavalTargets, selectedUnitDef, doAction, confirmActions, moves,
    showNationalActions, zouaveInPlay, zouaveReason, auReformValue, setAuReformTarget, auReformDecision,
    auReformReason, auCitizenValue, setAuCitizenTarget, auCitizenDecision, auCitizenReason, auSacrifice,
    setAuSacrifice, auIncorporateCandidates, auIncorporateValue, setAuIncorporateTarget, auIncorporate,
    auIncorporateReason, tsrrArmies, tsrrUnitValue, setTsrrUnitId, tsrrDestinations, tsrrToValue,
    setTsrrTo, tsrrDecision, tsrrReason, amphibiousVisible, amphibiousOrigins, amphibiousFromValue,
    setAmphibiousFrom, amphibiousTargets, amphibiousToValue, setAmphibiousTo, amphibiousArmies,
    amphibiousArmyValue, toggleAmphibiousArmy, amphibiousCanGo, amphibiousReason, amphibiousCheck,
    transportVisible, transportOrigins, transportFromValue, setTransportFrom, transportLands,
    transportLandValue, setTransportLand, transportTargets, transportToValue, setTransportTo,
    transportFleet, transportCanGo, transportReason, interceptVisible, lastNavalBox, lastNavalMover,
    interceptPorts, interceptPortValue, setInterceptPort, interceptCheck, interceptReason,
    beginAmphibiousTargeting, beginNavalTransportTargeting, beginNavalInterceptTargeting,
    mpitTarget, setMpitTarget, mpitTrack, setMpitTrack,
  } = props;

  const amphibiousNode = viewer !== null ? (
    <AmphibiousPanel show G={G} viewer={viewer} locale={locale} t={t}
      amphibiousOrigins={amphibiousOrigins} amphibiousFromValue={amphibiousFromValue} setAmphibiousFrom={setAmphibiousFrom}
      amphibiousTargets={amphibiousTargets} amphibiousToValue={amphibiousToValue} setAmphibiousTo={setAmphibiousTo}
      amphibiousArmies={amphibiousArmies} amphibiousArmyValue={amphibiousArmyValue} toggleAmphibiousArmy={toggleAmphibiousArmy}
      amphibiousCanGo={amphibiousCanGo} amphibiousReason={amphibiousReason} amphibiousCheck={amphibiousCheck as never}
      onPickMap={beginAmphibiousTargeting} doAction={doAction} moves={moves}/>
  ) : null;
  const transportNode = viewer !== null ? (
    <NavalTransportPanel show G={G} viewer={viewer} locale={locale} t={t}
      transportOrigins={transportOrigins} transportFromValue={transportFromValue} setTransportFrom={setTransportFrom}
      transportLands={transportLands} transportLandValue={transportLandValue} setTransportLand={setTransportLand}
      transportTargets={transportTargets} transportToValue={transportToValue} setTransportTo={setTransportTo}
      transportFleet={transportFleet} transportCanGo={transportCanGo} transportReason={transportReason}
      onPickMap={beginNavalTransportTargeting} doAction={doAction} moves={moves}/>
  ) : null;
  const interceptNode = (
    <NavalInterceptPanel show lastNavalBox={lastNavalBox as SpaceId} lastNavalMover={lastNavalMover}
      viewer={viewer} locale={locale} t={t}
      interceptPorts={interceptPorts} interceptPortValue={interceptPortValue} setInterceptPort={setInterceptPort}
      interceptCheck={interceptCheck as never} interceptReason={interceptReason}
      onPickMap={beginNavalInterceptTargeting} doAction={doAction} moves={moves}/>
  );

  return (
    <>
      <SpacePanel
        onOpenReference={onOpenReference}
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
        locale={locale}
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
        confirmActions={confirmActions}
        moves={moves}
      />
      <NationalActionsPanel
        show={showNationalActions && viewer !== null}
        viewer={viewer as Power}
        locale={locale}
        t={t}
        cpBudget={cpBudget}
        zouaveInPlay={zouaveInPlay}
        zouaveReason={zouaveReason}
        auReformValue={auReformValue}
        setAuReformTarget={setAuReformTarget}
        auReformDecision={auReformDecision as never}
        auReformReason={auReformReason}
        auCitizenValue={auCitizenValue}
        setAuCitizenTarget={setAuCitizenTarget}
        auCitizenDecision={auCitizenDecision as never}
        auCitizenReason={auCitizenReason}
        auSacrifice={auSacrifice}
        setAuSacrifice={setAuSacrifice}
        auIncorporateCandidates={auIncorporateCandidates}
        auIncorporateValue={auIncorporateValue}
        setAuIncorporateTarget={setAuIncorporateTarget}
        auIncorporate={auIncorporate as never}
        auIncorporateReason={auIncorporateReason}
        tsrrArmies={tsrrArmies}
        tsrrUnitValue={tsrrUnitValue}
        setTsrrUnitId={setTsrrUnitId}
        tsrrDestinations={tsrrDestinations}
        tsrrToValue={tsrrToValue}
        setTsrrTo={setTsrrTo}
        tsrrDecision={tsrrDecision as never}
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
        <MoreActions label={bi(locale, "More actions", "更多行动")} testId="ie-more-actions">
          {amphibiousVisible && viewer !== null && amphibiousNode}
          {transportVisible && viewer !== null && transportNode}
        </MoreActions>
      )}
      {/* 8.0: placing a major-power influence marker is an action the player
          takes on their own impulse, so it belongs with the Orders, not in the
          reference drawer (which is for reading the printed tables). */}
      <MpitPanel
        G={G} canAct={canAct} viewer={viewer} me={me} cpBudget={cpBudget} canSpend={canSpend}
        mpitTarget={mpitTarget} setMpitTarget={setMpitTarget}
        mpitTrack={mpitTrack} setMpitTrack={setMpitTrack}
        locale={locale} t={t} doAction={doAction} moves={moves}
      />
    </>
  );
};

/** War tab: the limited war (when there is one) and the Great War (when there is). */
export const WarRegion = (props: WarSlice) => {
  const {
    war, G, viewer, me, active, phase, locale, t, warStatusLabel, warAimLabel, warBelligerents,
    isPrincipal, isBelligerent, eliminated, pending, isActive, warBudgetRows, warDefenderMinors,
    callableAllies, warAllyValue, setWarAlly, callableMinors, warMinorValue, setWarMinor,
    confirmSurrender, setConfirmSurrender, doAction, moves, gw, gwBudgetOrder, gwSlotLabel,
    italyShowing, italyBox, italyBoxLabel, italyHow, gwTransferToValue, setGwTransferTo,
    gwTransferAmountValue, setGwTransferAmount, canGwTransfer, gwSideAllies, canGwReveal,
    canGwDraft, canGwDeployHere, forcedGwCard, selected, trenchRows, onSelect, onOpenReference,
  } = props;
  const viewerCanSeeTrenches = gw !== null && gw !== undefined && gw.active;
  return (
    <>
      {viewerCanSeeTrenches && (
        <TrenchBoard rows={trenchRows} locale={locale} selected={selected} onSelect={onSelect}/>
      )}
      {war && (
        <WarPanel
          war={war} G={G} viewer={viewer} active={active} phase={phase} locale={locale} t={t}
          warStatusLabel={warStatusLabel} warAimLabel={warAimLabel} warBelligerents={warBelligerents}
          isPrincipal={isPrincipal} isBelligerent={isBelligerent} eliminated={eliminated} pending={pending}
          isActive={isActive} warBudgetRows={warBudgetRows} warDefenderMinors={warDefenderMinors}
          callableAllies={callableAllies} warAllyValue={warAllyValue} setWarAlly={setWarAlly}
          callableMinors={callableMinors} warMinorValue={warMinorValue} setWarMinor={setWarMinor}
          confirmSurrender={confirmSurrender} setConfirmSurrender={setConfirmSurrender}
          doAction={doAction} moves={moves} onOpenReference={onOpenReference}
        />
      )}
      {gw && (
        <GreatWarPanel
          gw={gw} G={G} viewer={viewer} me={me} active={active} phase={phase} locale={locale} t={t}
          eliminated={eliminated} pending={pending} isActive={isActive} selected={selected}
          gwBudgetOrder={gwBudgetOrder} gwSlotLabel={gwSlotLabel} italyShowing={italyShowing}
          italyBox={italyBox as never} italyBoxLabel={italyBoxLabel} italyHow={italyHow}
          gwTransferToValue={gwTransferToValue} setGwTransferTo={setGwTransferTo}
          gwTransferAmountValue={gwTransferAmountValue} setGwTransferAmount={setGwTransferAmount}
          canGwTransfer={canGwTransfer} gwSideAllies={gwSideAllies} canGwReveal={canGwReveal}
          canGwDraft={canGwDraft} canGwDeployHere={canGwDeployHere} forcedGwCard={forcedGwCard}
          doAction={doAction} moves={moves} onOpenReference={onOpenReference}
        />
      )}
      {!war && !gw && <div className="ie-muted">{bi(locale, "No war is in progress.", "当前没有进行中的战争。")}</div>}
    </>
  );
};

/** Reference drawer: the printed charts, the other powers and the log. */
export const ReferenceRegion = (props: ReferenceSlice) => {
  const {
    G, viewer, active, locale, t, me, cpBudget, canAct, canSpend, mpitTarget, setMpitTarget,
    mpitTrack, setMpitTrack, doAction, moves, handCounts, goalCounts, homeCardTitle, minorMarkerRows,
  } = props;
  return (
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
      <details className="ie-reference">
        <summary>{t.rulesCoverage}</summary>
        <RulesReference locale={locale}/>
      </details>
    </>
  );
};

/** Hand region: the tray under the map. */
/**
 * The hand slice carries the tray's own state; the language does not live in
 * it, so the board passes its own `locale`/`t` — otherwise every bilingual
 * string in the tray (the CP-chain button, the give-card hint, the filter
 * labels) silently fell back to English.
 */
export const HandRegion = (props: HandSlice & {locale: "en" | "zh_CN"; t: T; decisionPeek?: boolean}) => <HandTray {...props}/>;

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface ShellProps {
  core: CoreSlice;
  interaction: InteractionSlice;
  orders: OrdersSlice;
  war: WarSlice;
  hand: HandSlice;
  reference: ReferenceSlice;
}

const ShellRegion = ({core, interaction, orders, war, hand, reference}: ShellProps) => {
  const {
    G, hotseat, t, locale, viewer, phase, active, botSeats, pending, battle, phaseActions,
    otherSeatPending, seatUi, pendingPrompt, pendingKind, responseWindow, cardFaceMode,
    setCardFaceMode, confirmActions, setConfirmActions, board, setBoard, choiceKinds, choicesProps, pendingSpaceTargets,
    optionLabel, optionFace, optionAction, canDecline, jihadDecision, jihadReason, doAction,
    moves, mapHint, cpBudget, canDecide, refAnchor, setRefAnchor, toast, dismissToast, goalCounts,
    isPhone, mobileTab, setMobileTab, trayOpen, setTrayOpen, trayExpanded, setTrayExpanded,
  } = core;
  const {selected, onSelect, modePill, mapTargets, mapFocusedTarget, chooser} = interaction;
  // The one definition of "a decision is owed and on screen".  The panel uses
  // it for its label and badges, the phone layout to show only the decision
  // body, and the hand sheet to fold itself out of the map's way.
  const decisionOwed = Boolean(pending || battle || G.result);
  const warVisible = Boolean(war.war || war.gw);

  // The phone's one bottom sheet: Orders / Hand / Mat / Log, plus War only
  // while there is a war to report.  The two private tabs are for a seated
  // viewer only, so a spectator's dock never offers a hand or a mat it cannot
  // read.
  const mobileTabs: MobileDockTab[] = [
    {
      key: "orders",
      label: decisionOwed ? bi(locale, "Decision", "决策") : bi(locale, "Orders", "指令"),
      badge: pending !== null && viewer !== null && pending.power === viewer ? "!" : undefined,
    },
    ...(viewer !== null
      ? [
          {key: "hand" as MobileTab, label: bi(locale, "Hand", "手牌")},
          {key: "mat" as MobileTab, label: bi(locale, "Mat", "面板")},
        ]
      : []),
    {key: "log", label: bi(locale, "Log", "记录")},
    ...(warVisible
      ? [{key: "war" as MobileTab, label: bi(locale, "War", "战局"), badge: war.war ? "⚔" : undefined}]
      : []),
  ];
  // A tab can disappear under the reader (the war ends, a hotseat switch turns
  // the seat into a spectator).  The sheet must not be left with no body, so
  // the dock falls back to Orders exactly as the turn panel falls back to its
  // Action tab.
  const activeMobileTab: MobileTab = (mobileTab === "war" && !warVisible) ||
    ((mobileTab === "hand" || mobileTab === "mat") && viewer === null)
    ? "orders"
    : mobileTab;
  // The turn panel keeps its own tabs on desktop; on a phone the dock's tab
  // chooses its body, and Hand/Mat have no counterpart there (their bodies are
  // the other two panels), so they leave Orders in front.
  const phoneTurnTab = activeMobileTab === "war" ? "war" : activeMobileTab === "log" ? "log" : "action";

  const displayMenu = (
    <DisplayMenu
      mode={cardFaceMode}
      setMode={setCardFaceMode}
      confirmActions={confirmActions}
      setConfirmActions={setConfirmActions}
      locale={locale}
    />
  );

  const commandStatus = (
    <div className="ie-status">
      <IEBadge tone={G.wtt >= 4 ? "warn" : "default"}>{t.wtt}: {G.wtt}/5</IEBadge>
      {G.gw?.active && <IEBadge tone="warn">GW {G.gw.turn}</IEBadge>}
      {battle && <IEBadge tone="warn">{bi(locale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")}</IEBadge>}
      {pending && <IEBadge tone="warn">{t.pending}: {t.seats[pending.power]}</IEBadge>}
      {responseWindow && <IEBadge tone="warn">{t.responseWindow}</IEBadge>}
      {viewer && <IEBadge tone={viewer.toLowerCase()}>{t.seats[viewer]}</IEBadge>}
      {!viewer && <IEBadge>{t.spectators}</IEBadge>}
      {hotseat && viewer !== null && botSeats.has(viewer) && (
        <div className="ie-bot-banner" data-testid="ie-bot-banner" role="status" aria-live="polite">
          🤖 {t.seats[viewer]} — {t.botSeatBadge} · {t.seatBotHint}
        </div>
      )}
    </div>
  );
  const commandMenu = (
    <div className="ie-command-menu">
      {displayMenu}
      <button className="ie-btn secondary ie-mini" data-testid="ie-open-scores" onClick={() => setRefAnchor("rules:scores")}>{t.scores}</button>
      <button className="ie-btn secondary ie-mini" data-testid="ie-open-charts" onClick={() => setRefAnchor("chart:sequence-of-play")}>{t.charts}</button>
      <button className="ie-btn secondary ie-mini" data-testid="ie-open-rules" onClick={() => setRefAnchor("rules:crt")}>{t.rulesCoverage}</button>
    </div>
  );

  return (
    <>
      <TrackStrip
        G={G}
        locale={locale}
        t={t}
        viewer={viewer}
        active={active}
        phase={phase}
        war={war.war}
        gw={war.gw}
        cp={viewer ? cpBudget() : G.cpRemaining}
        cpBudget={cpBudget}
        menu={commandMenu}
        status={commandStatus}
        onOpenReference={(anchor) => setRefAnchor(anchor)}
        notice={otherSeatPending && pending !== null && seatUi.onSwitchSeat ? (
          <SeatAlert
            pendingPower={pending.power}
            pendingKind={pendingPrompt !== "" ? pendingPrompt : pendingKind ?? ""}
            locale={locale}
            onGo={() => seatUi.onSwitchSeat!(pending.power)}
          />
        ) : undefined}
      />

      <div className="ie-table">
        <div className="ie-map-region">
          <MapPanel
            G={G}
            selected={selected}
            onSelect={onSelect}
            targets={mapTargets}
            focusedTarget={mapFocusedTarget}
            locale={locale}
            t={t}
            mapHint={mapHint}
            modePill={modePill}
            viewer={viewer}
          />
        </div>

        {/* One bottom sheet on a phone: the turn panel, the mat and the hand
            are its three bodies, and the dock's tab bar decides which is in
            front.  On desktop the wrapper and the body are `display: contents`
            (stylesheet), so these three keep their grid areas and the bar is
            hidden; nothing here is conditional on the viewport. */}
        <MobileDock
          open={trayOpen}
          expanded={trayExpanded}
          tab={activeMobileTab}
          tabs={mobileTabs}
          decision={decisionOwed}
          locale={locale}
          onTab={(key) => setMobileTab(key)}
          onToggleOpen={() => {
            // Closing is just closing.  Reopening always starts at half height,
            // so a collapsed sheet never comes back covering the whole map.
            if (trayOpen) setTrayOpen(false);
            else {
              setTrayOpen(true);
              setTrayExpanded(false);
            }
          }}
          onToggleExpanded={() => setTrayExpanded((value) => !value)}
        >
          <TurnPanel
            locale={locale}
            t={t}
            cp={viewer ? cpBudget() : G.cpRemaining}
            phaseActions={phaseActions}
            phaseLabel={PHASE_LABEL(t, phase)}
            activeLabel={`${t.active}: ${t.seats[active]}`}
            turn={G.turn}
            summary={core.dockSummary}
            warVisible={warVisible}
            hasDecision={decisionOwed}
            // The dock owns the phone decision cap; the turn panel itself is
            // never narrowed by the decision.
            decisionOnlyOnPhone={false}
            decisionBadge={pending !== null && viewer !== null && pending.power === viewer}
            confirmActions={confirmActions}
            warBadge={war.war ? "⚔" : undefined}
            activeTab={isPhone ? phoneTurnTab : undefined}
            tabs={{
              action: (
                <>
                  {choiceKinds.required || choiceKinds.optional ? <HandChoices {...choicesProps}/> : null}
                  {(pending || battle || G.result) && (
                    <PendingPanel
                      G={G}
                      pending={pending}
                      canDecide={canDecide}
                      pendingKind={pendingKind ?? ""}
                      pendingPrompt={pendingPrompt}
                      optionLabel={optionLabel}
                      optionFace={optionFace}
                      optionAction={optionAction}
                      canDecline={canDecline}
                      pendingSpaceTargets={pendingSpaceTargets}
                      viewer={viewer}
                      locale={locale}
                      t={t}
                      jihadDecision={jihadDecision}
                      jihadReason={jihadReason}
                      goalCounts={goalCounts}
                      doAction={doAction}
                      confirmActions={confirmActions}
                      moves={moves}
                      dock
                    />
                  )}
                  {!pending && !battle && G.result === null ? <OrdersRegion {...orders}/> : null}
                </>
              ),
              war: <WarRegion key={`war-${locale}`} {...war} locale={locale} t={t}/>,
              log: <LogRegion key={`log-${locale}`} G={G} locale={locale} t={t}/>,
            }}
          />
          <PlayerMat
            G={G}
            viewer={viewer}
            me={core.me}
            active={active}
            locale={locale}
            t={t}
            forceOpen={isPhone}
          />
          {/* The Display menu's `confirmActions` switch is live: the tray gets
              the shell's current value, not the one it read from storage on
              mount.  On a phone the dock owns the height and the peek, so the
              tray is mounted open and never expands itself. */}
          <HandRegion
            {...hand}
            locale={locale}
            t={t}
            open={isPhone ? true : hand.open}
            expanded={isPhone ? false : hand.expanded}
            decisionPeek={isPhone ? false : decisionOwed}
            confirmActions={confirmActions}
          />
        </MobileDock>
        {chooser !== null && (
          <IntentChooser
            locale={locale}
            targetLabel={chooser.targetLabel}
            intents={chooser.intents}
            onChoose={chooser.onChoose}
            onCancel={chooser.onCancel}
          />
        )}
        {viewer === null && (
          <div className="ie-private-info" data-testid="ie-private-info">
            {t.privateInfo}: {t.hidden}. {t.spectators}.
          </div>
        )}
      </div>

      {/* A refused move is explained here: the engine answers a bare
          INVALID_MOVE, so the board says what it tried and why it is not
          allowed, without stealing focus or blocking the map. */}
      <Toast toast={toast} locale={locale} onDismiss={dismissToast}/>

      <ReferenceDrawer
        core={core}
        reference={reference}
        open={refAnchor !== null}
        anchor={refAnchor}
        onOpen={(anchor) => setRefAnchor(anchor)}
        onClose={() => setRefAnchor(null)}
      />
    </>
  );
};

/** The Log tab: the public history, newest first. */
const LogRegion = ({G, locale, t}: {G: ImperialElegyState; locale: "en" | "zh_CN"; t: T}) => (
  <section className="ie-log-panel">
    <h3>{t.log}</h3>
    <div className="ie-log" data-testid="ie-log">
      {G.log.slice(-80).reverse().map((entry) => <LogLine key={entry.id} entry={entry} locale={locale}/>)}
    </div>
  </section>
);
