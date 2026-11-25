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
import {Icon} from "./Icon";
import {ImperialElegyState, Power, SpaceId} from "../types";
import {SPACES} from "../constant/spaces";
import {IEBadge, IESurface} from "./theme";
import {bi, PHASE_LABEL} from "./boardHelpers";
import {LogList} from "./LogList";
import type {CardFaceMode} from "./preferences";
import {MapPanel} from "./MapPanel";
import {SpaceActionsPanel, SpaceDetailPanel, SpaceUnitPicker} from "./SpacePanel";
import {useSpaceActions} from "./spaceActionModel";
import {OrdersPanel} from "./OrdersPanel";
import {DiplomacyPanel} from "./DiplomacyPanel";
import {PendingPanel} from "./PendingPanel";
import {HandChoices} from "./HandChoices";
import {HandTray} from "./HandTray";
import {TrackStrip} from "./TrackStrip";
import {TurnPanel} from "./TurnPanel";
import {PlayerMat} from "./PlayerMat";
import {ReferenceDrawer} from "./ReferenceDrawer";
import {CHARTS} from "./ChartLightbox";
import {NationalActionsPanel} from "./NationalActionsPanel";
import {AmphibiousPanel, NavalTransportPanel, NavalInterceptPanel} from "./NavalPanel";
import {WarPanel} from "./WarPanel";
import {WarDeclarationPanel} from "./WarDeclarationPanel";
import {MoveConsole} from "./MoveConsole";
import {GreatWarPanel} from "./GreatWarPanel";
import {SeatAlert, SeatStrip} from "./SeatStrip";
import {decidingText} from "./i18n";
import {IntentChooser} from "./IntentChooser";
import {TrenchBoard} from "./TrenchBoard";
import {MpitPanel} from "./MpitPanel";
import {CardChoiceModal} from "./CardChoiceModal";
import {DecisionModal} from "./DecisionModal";
import {BattleResultModal} from "./BattleResultModal";
import {Toast} from "./Toast";
import {readShowUnavailable, writeShowUnavailable} from "./preferences";
import {MobileDock, type MobileDockTab} from "./MobileDock";
import type {MobileTab} from "./modelValues";
import {mobileTabForTurnTab, resolveTurnTab, turnTabForMobileTab, type TurnTab} from "./turnPanelTab";
import {botDifficultyLabel} from "./localSetup";
import {botDifficultyOf} from "../configuration";
import {auFormedForState, seatPowerName} from "./seatNames";
import type {BoardModel} from "./useBoardModel";
import type {CoreSlice, HandSlice, InteractionSlice, OrdersSlice, ReferenceSlice, WarSlice, T} from "./boardSlices";

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

/**
 * Display preferences; lives in the track strip's menu.
 *
 * Both switches are stored in `localStorage` (`preferences.ts`) and read by the
 * tray and the phase buttons; the card face is read from this component's own
 * state, so flipping it here re-renders the board.  The `confirmActions` switch
 * is passed down as a prop for the same reason: storage alone only reaches a
 * consumer on its next mount.
 */
const DisplayMenu = ({mode, setMode, confirmActions, setConfirmActions, showUnavailable, setShowUnavailable, locale}: {
  mode: "svg" | "print";
  setMode: (mode: "svg" | "print") => void;
  confirmActions: boolean;
  setConfirmActions: (enabled: boolean) => void;
  showUnavailable: boolean;
  setShowUnavailable: (open: boolean) => void;
  locale: "en" | "zh_CN";
}) => (
  <details className="ie-display-menu" data-testid="ie-display-menu">
    <summary className="ie-display-trigger" title={bi(locale, "Display options", "显示选项")}>
      {bi(locale, "Display", "显示")} <Icon name="chevron-down" size={14}/>
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

      <div className="ie-display-title">{bi(locale, "Orders panel", "指令面板")}</div>
      <label className="ie-display-toggle">
        <input
          type="checkbox"
          data-testid="ie-show-unavailable"
          checked={showUnavailable}
          onChange={(event) => setShowUnavailable(event.target.checked)}
        />
        <span>{bi(locale, "Show unavailable actions", "显示不可用行动")}</span>
      </label>
      <div className="ie-display-note">
        {bi(locale,
          "The Actions page prints the legal rows first and folds the refused ones, with their printed reasons, into one section. This switch opens that section, and the fold remembers your choice.",
          "行动页先列出可用行动，再把不可用行动连同其规则原因折叠成一节。此开关控制该节是否展开，并会记住你的选择。")}
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

/**
 * The Orders page: five pages behind one segmented control.
 *
 * Before, this was a single column holding the space's facts, its action list,
 * the MPIT matrix, the national characteristics and three naval flows.  Each is
 * a different question ("what may I do *here*", "what *is* here", "who do I
 * influence", "is a naval flow open"), so each has its own page now.
 *
 * The pages stay mounted so an armed confirmation, a half-filled naval form and
 * the bots' effects survive a switch; `hidden` is the only thing that changes.
 */
export const OrdersRegion = (props: OrdersSlice & {
  /** The optional-card-choice line (or a required choice while a decision owns the body). */
  actionsTopSlot?: React.ReactNode;
  /** The `ie_show_unavailable` preference, live from the Display menu / the fold itself. */
  showUnavailable?: boolean;
  setShowUnavailable?: (open: boolean) => void;
}) => {
  const {
    G, viewer, me, locale, t, phase, eliminated, canAct, canSpend, cpBudget, canActionCard, pending, canDecide, war,
    gwJointNavalAllies, gwJointNavalUnitIds,
    polishReserve, setPolishReserve, deployLimit, deployFree, canDeployHere, canGwDraft, canGwDeployHere,
    polishArmyDecision, polishReserveDecision, myOnMapArmies, myForts, myMinorAllies, ownLandInSelected,
    ownNavalInSelected, potentialLandTargets, potentialNavalTargets, doAction, confirmActions, moves,
    selected, selectedUnit, setSelectedUnit, selectedUnitIds, toggleUnitSelection, selectUnitGroup,
    startMoveTargeting, battleFrom, setBattleFrom, navalFrom, setNavalFrom,
    ordersTab, setOrdersTab, navalVisible, deals, dealsVisible, pendingDeals, myDealOffers,
    homeChoice, setHomeCardDialogOpen,
    dealTarget, setDealTarget, dealGive, setDealGive, dealTake, setDealTake, dealPromises, setDealPromises,
    handCounts,
    showNationalActions, zouaveInPlay, zouaveReason, auReformValue, setAuReformTarget, auReformDecision,
    auReformReason, auCitizenValue, setAuCitizenTarget, auCitizenDecision, auCitizenRoll, auCitizenReason, auSacrifice,
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
    selectedUnitDef, onOpenReference, commandedOwner: _commandedOwner, commandsSelected: _commandsSelected,
    actionsTopSlot, showUnavailable, setShowUnavailable,
  } = props;

  // The space's rows, computed once for the two pages that read them.
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

  const spaceName = selected !== null && SPACES[selected] !== undefined
    ? (locale === "zh_CN" ? SPACES[selected].nameZh : SPACES[selected].name)
    : null;
  const legalCount = rows.filter((row) => row.enabled).length;
  const heading = spaceName === null ? undefined : (
    <>
      <b>{spaceName}</b>
      <span className="ie-orders-heading-count">
        {canAct
          ? bi(locale, `${legalCount} available`, `${legalCount} 项可用`)
          : bi(locale, "read-only", "只读")}
      </span>
    </>
  );

  return (
    <OrdersPanel
      locale={locale}
      labels={{
        actions: t.ordersActions,
        space: t.ordersSpace,
        influence: t.ordersInfluence,
        deals: t.ordersDeals,
        naval: t.ordersNaval,
      }}
      active={ordersTab}
      onTab={setOrdersTab}
      navalVisible={navalVisible}
      navalUrgent={interceptVisible}
      dealsVisible={dealsVisible}
      dealUrgent={pendingDeals.length > 0}
      heading={heading}
      tabs={{
        actions: (
          <>
            {actionsTopSlot}
            {/* The unit chips come first: choosing a unit is the first click of
                most actions and arms the map's rings, so it must not cost a page
                switch.  The Space page prints the same units read-only. */}
            <SpaceUnitPicker
              G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
              selectedUnit={selectedUnit} setSelectedUnit={setSelectedUnit}
              selectedUnitIds={selectedUnitIds}
              toggleUnitSelection={toggleUnitSelection}
              selectUnitGroup={selectUnitGroup}
              pending={pending} canDecide={canDecide}
              doAction={doAction} moves={moves}
            />
            <SpaceActionsPanel
              G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
              onOpenReference={onOpenReference}
              rows={rows}
              cpRemaining={cpBudget()}
              polishReserve={polishReserve} setPolishReserve={setPolishReserve}
              selectedUnitDef={selectedUnitDef} setSelectedUnit={setSelectedUnit}
              battleFrom={battleFrom} setBattleFrom={(id) => setBattleFrom.current(id)}
              navalFrom={navalFrom} setNavalFrom={(id) => setNavalFrom.current(id)}
              showUnavailable={showUnavailable} setShowUnavailable={setShowUnavailable}
            />
          </>
        ),
        space: (
          <SpaceDetailPanel
            G={G} selected={selected} viewer={viewer} me={me} locale={locale} t={t} phase={phase} canAct={canAct}
            selectedUnitIds={selectedUnitIds}
            pending={pending} canDecide={canDecide}
            doAction={doAction} moves={moves}
          />
        ),
        influence: (
          <>
            <MpitPanel
              // 8.0's marker is a 12.1 peacetime action: the engine already
              // refuses it in a war or Great War phase (15.2 / 27.5), so the
              // matrix must not offer a button that only logs an invalid move.
              G={G} canAct={canAct && phase === "action"} viewer={viewer} me={me} cpBudget={cpBudget} canSpend={canSpend}
              locale={locale} t={t} doAction={doAction} moves={moves} confirmActions={confirmActions}
              lockedReason={canAct && phase !== "action"
                ? bi(locale,
                  "Influence markers are placed in the action phase only (8.0); wartime and Great War impulses use their own action lists.",
                  "影响力标记只能在行动阶段放置（8.0）；战时与大战行动轮使用各自的行动列表。")
                : undefined}
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
              auCitizenRoll={auCitizenRoll}
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
          </>
        ),
        deals: (
          <DiplomacyPanel
            G={G} locale={locale} viewer={viewer} me={me} phase={phase} eliminated={eliminated}
            doAction={doAction} moves={moves}
            deals={deals} pendingDeals={pendingDeals} myDealOffers={myDealOffers}
            dealTarget={dealTarget} setDealTarget={setDealTarget}
            dealGive={dealGive} setDealGive={setDealGive}
            dealTake={dealTake} setDealTake={setDealTake}
            dealPromises={dealPromises} setDealPromises={setDealPromises}
            handCounts={handCounts}
            homeChoice={homeChoice}
            onOpenHomeChoice={setHomeCardDialogOpen !== undefined ? () => setHomeCardDialogOpen(true) : undefined}
          />
        ),
        naval: (
          <>
            {amphibiousVisible && viewer !== null && amphibiousNode}
            {transportVisible && viewer !== null && transportNode}
            {interceptVisible && interceptNode}
            {!amphibiousVisible && !transportVisible && !interceptVisible && (
              <div className="ie-muted">{t.noSpace}</div>
            )}
          </>
        ),
      }}
    />
  );
};

/** War tab: the limited war (when there is one) and the Great War (when there is). */
export const WarRegion = (props: WarSlice & {
  /**
   * The War tab's own unit-move console (move & battle rows for the selected
   * space).  The shell builds it from the Orders slice because the movers, the
   * selection and the CP budget all live there, and renders it inside this tab
   * so a wartime player does not have to switch to Orders to march or fight.
   */
  moveConsole?: React.ReactNode;
}) => {
  const {
    war, G, viewer, me, active, phase, locale, t, warStatusLabel, warAimLabel, warBelligerents,
    isPrincipal, isBelligerent, eliminated, pending, isActive, warBudgetRows, warDefenderMinors,
    callableAllies, warAllyValue, setWarAlly, callableMinors, warMinorValue, setWarMinor,
    confirmSurrender, setConfirmSurrender, doAction, moves, gw, gwBudgetOrder, gwSlotLabel,
    italyShowing, italyBox, italyBoxLabel, italyHow, gwTransferToValue, setGwTransferTo,
    gwTransferAmountValue, setGwTransferAmount, canGwTransfer, gwSideAllies, canGwReveal,
    canGwDraft, canGwDeployHere, forcedGwCard, selected, trenchRows, onSelect, onOpenReference,
    canActionCard, cpBudget, confirmActions, homeCardTitle, moveConsole,
  } = props;
  const viewerCanSeeTrenches = gw !== null && gw !== undefined && gw.active;
  // Before a war exists the War body is where a declaration is made: defender,
  // aim, objective and the 14.1 clauses are all picked here, with no map
  // selection.  During the Great War there is nothing to declare.
  const declaration = !war && !gw && viewer !== null
    ? (
      <WarDeclarationPanel
        G={G} viewer={viewer} locale={locale} t={t} homeCardTitle={homeCardTitle}
        canActionCard={canActionCard} cpRemaining={cpBudget()} confirmActions={confirmActions}
        doAction={doAction} moves={moves}
      />
    )
    : null;
  return (
    <>
      {viewerCanSeeTrenches && (
        <TrenchBoard rows={trenchRows} locale={locale} selected={selected} onSelect={onSelect}/>
      )}
      {declaration}
      {/* The movement half of the Orders page, printed here as well: a unit can
          be picked, marched, railed or sent into battle without leaving the War
          tab.  It leads the war report because it is what a wartime player uses
          most; it appears once a war or the Great War runs (a declaration form
          has no units to move) and never for a spectator. */}
      {viewer !== null && !eliminated && (war !== null || (gw !== null && gw !== undefined)) && moveConsole}
      {war && (
        <WarPanel
          war={war} G={G} viewer={viewer} active={active} phase={phase} locale={locale} t={t}
          warStatusLabel={warStatusLabel} warAimLabel={warAimLabel} warBelligerents={warBelligerents}
          isPrincipal={isPrincipal} isBelligerent={isBelligerent} eliminated={eliminated} pending={pending}
          warBudgetRows={warBudgetRows} warDefenderMinors={warDefenderMinors}
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
          confirmActions={confirmActions}
          doAction={doAction} moves={moves} onOpenReference={onOpenReference}
        />
      )}
      {!war && !gw && declaration === null && (
        <div className="ie-muted">{bi(locale, "No war is in progress.", "当前没有进行中的战争。")}</div>
      )}
    </>
  );
};

/** Reference drawer: the printed charts, the other powers and the log. */
export const ReferenceRegion = (props: ReferenceSlice) => {
  const {
    G, viewer, active, locale, t, me, cpBudget, canAct, canSpend, doAction, moves, handCounts,
    goalCounts, homeCardTitle, minorMarkerRows,
  } = props;
  return (
    <>
      <details className="ie-reference" open>
        <summary>{t.charts}</summary>
        <div className="ie-chart-grid">
          {CHARTS.map((chart) => {
            const caption = locale === "zh_CN" ? chart.titleZh : chart.title;
            return (
              <figure key={chart.id}>
                <img src={`/imperial-elegy/charts/${chart.file}.png`} alt={caption}/>
                <figcaption>{caption}</figcaption>
              </figure>
            );
          })}
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
export const HandRegion = (props: HandSlice & {locale: "en" | "zh_CN"; t: T; decisionPeek?: boolean; decisionPeekLabel?: string}) => <HandTray {...props} compact/>;

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
    G, t, locale, viewer, phase, active, botSeats, pending, battle, phaseActions,
    canHandOverSeat, setSeatBot, hotseat,
    otherSeatPending, seatUi, pendingPrompt, pendingKind, responseWindow, cardFaceMode,
    setCardFaceMode, confirmActions, setConfirmActions, board, setBoard, choiceKinds, choicesProps, pendingSpaceTargets,
    homeChoice, goalChoice, homeCardDialogOpen, setHomeCardDialogOpen,
    optionLabel, optionFace, optionAction, canDecline, jihadDecision, jihadReason, doAction,
    moves, mapHint, cpBudget, canDecide, refAnchor, setRefAnchor, toast, dismissToast, goalCounts,
    isPhone, mobileTab, setMobileTab, trayOpen, setTrayOpen, trayExpanded, setTrayExpanded, isCurrentSeat,
    railTab, setRailTab,
  } = core;
  const {selected, onSelect, modePill, mapTargets, mapFocusedTarget, chooser} = interaction;
  // The one definition of "a decision is owed and on screen".  The panel uses
  // it for its label and badges, the phone layout to show only the decision
  // body, and the hand sheet to fold itself out of the map's way.
  const decisionOwed = Boolean(pending || battle || G.result);
  // A decision on another seat is read-only here (online, or a hotseat board
  // whose seat is not the one looking).  It is named rather than reported as
  // "waiting": the reader sees who is deciding and what is being decided.
  const pendingElsewhere = pending !== null && pending.power !== viewer;
  const decidingLabel = pendingElsewhere && pending !== null
    ? decidingText(t.seats[pending.power], locale)
    : undefined;

  /**
   * The required card choices are dialogs.
   *
   * The end-step National Goal pick is a blocker and still raises itself: the
   * step cannot continue without it, and continuing keeps the first Goal, so
   * the reader may close it.
   *
   * The diplomacy home card is different.  9.1 puts the negotiation segment
   * first — players talk, show cards (11.0) and agree on random draws (11.1)
   * before anyone chooses a Home card — so raising the choice as diplomacy
   * opened covered the negotiation table and made talking impossible.  It is
   * now opened by the seat, from the `ie-open-home-card` button in the dock,
   * and it closes with `ie-choice-close` / `ie-choice-continue` without
   * answering: the choice stays outstanding and the button brings it back.
   *
   * A hotseat mounts six boards at once, so both dialogs are limited to the
   * seat being looked at: `useFocusTrap` focuses into its dialog on mount, and
   * a hidden seat must never pull the keyboard out of the visible board.
   */
  const goalChoiceOpen = goalChoice;
  const choiceReachable = isCurrentSeat;
  // A Goal pick the reader closed stays closed for that set of Goals; a new
  // draw (a different set) opens it again.
  const [dismissedGoals, setDismissedGoals] = React.useState<string | null>(null);
  const goalSignature = choicesProps.ngChoices.join(",");
  const goalDismissed = dismissedGoals === goalSignature;
  // While a pending decision, a battle or the result owns the Orders body, a
  // raised Goal dialog would be a second modal asking to be answered at the
  // same time: the choice falls back to the inline form on the Actions page.
  const goalModalOpen = choiceReachable && !decisionOwed && goalChoiceOpen && !goalDismissed;
  const homeModalOpen = choiceReachable && homeChoice && homeCardDialogOpen && !decisionOwed;
  const choiceModalOpen = goalModalOpen || homeModalOpen;
  const choiceModalTitle = goalModalOpen ? t.chooseGoalTitle : t.chooseHomeTitle;
  // The home card may be closed without answering (the choice stays owed), the
  // Goal pick closes by keeping the first Goal.
  const closeChoice = (): void => {
    if (goalModalOpen) setDismissedGoals(goalSignature);
    else setHomeCardDialogOpen(false);
  };

  /**
   * A decision this seat owes is a dialog too.
   *
   * Every decision is a blocker — nothing in the Orders panel may be played
   * around it — so it is raised over the board instead of taking the Orders
   * body hostage.  The inline `PendingPanel` stays for the two cases that are
   * *not* this seat's to answer: another seat's pending decision (a hotseat
   * shows it read-only) and the battle/result status, which are reports, not
   * choices.
   *
   * Only the seat being looked at raises the dialog, for the same reason the
   * card choice does: six boards are mounted at once and a hidden one must not
   * steal the keyboard.
   */
  const decisionModalOpen = decisionOwed && canDecide && isCurrentSeat;
  // The inline panel is a report (another seat's decision, a battle, the final
  // score) whenever this seat is not the one being asked.
  const showInlineDecision = decisionOwed && !decisionModalOpen;

  /**
   * The finished battle's report is public state, so every client raises the
   * same dialog even when this seat was not the one answering the loss
   * decisions.  It is dismissible and remembers only the report id it closed,
   * which lets the next battle's report open by itself.
   *
   * It waits while this seat owes a decision (or a required card choice): two
   * blockers over one board would fight for the keyboard, and the report can
   * still be dismissed after the decision is answered.  A live battle hides
   * the previous report; the new one replaces it when it ends.
   */
  const battleReport = G.battleReport ?? null;
  const [dismissedBattleReport, setDismissedBattleReport] = React.useState<string | null>(null);
  const battleReportOpen = battleReport !== null &&
    battleReport.id !== dismissedBattleReport &&
    isCurrentSeat &&
    G.battle === null &&
    !decisionModalOpen &&
    !choiceModalOpen;

  /**
   * The optional prep discard is a real choice but a skippable one, so it stays
   * one line at the top of the Actions page instead of becoming a dialog.
   * `HandChoices` renders the required choice too; while a decision already owns
   * the Orders body the choice cannot be a dialog (two modals at once), so it
   * falls back to that same inline slot.
   */
  const actionsTopSlot = choiceKinds.optional
    ? <HandChoices {...choicesProps}/>
    : null;

  const [showUnavailableMenu, setShowUnavailableMenu] = React.useState<boolean>(() => readShowUnavailable());
  const setUnavailablePreference = (open: boolean) => {
    setShowUnavailableMenu(open);
    writeShowUnavailable(open);
  };

  // The phone's one bottom sheet: Orders / Hand / Mat / Log / War.  The two
  // private tabs are for a seated viewer only, so a spectator's dock never
  // offers a hand or a mat it cannot read.  War is always offered because it
  // is where a declaration is made, not only where a running war is reported.
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
    {
      key: "war" as MobileTab,
      label: bi(locale, "War", "战局"),
      badge: war.war
        ? <Icon name="crossed-sabres" size={14}/>
        : war.declarationWaiting ? "!" : undefined,
    },
  ];
  // A hotseat switch can turn the seat into a spectator, and Hand/Mat are
  // private.  The sheet must not be left with no body, so the dock falls back
  // to Orders exactly as the turn panel falls back to its Action tab.
  const activeMobileTab: MobileTab =
    ((mobileTab === "hand" || mobileTab === "mat") && viewer === null) ? "orders" : mobileTab;
  // The turn panel keeps its own tabs on desktop; on a phone the dock's tab
  // chooses its body, and Hand/Mat have no counterpart there (their bodies are
  // the other two panels), so they leave Orders in front.
  const phoneTurnTab = turnTabForMobileTab(activeMobileTab);

  const displayMenu = (
    <DisplayMenu
      mode={cardFaceMode}
      setMode={setCardFaceMode}
      confirmActions={confirmActions}
      setConfirmActions={setConfirmActions}
      showUnavailable={showUnavailableMenu}
      setShowUnavailable={setUnavailablePreference}
      locale={locale}
    />
  );

  const commandStats = core.me === null ? undefined : (
    <span className="ie-stats-row" data-testid="ie-stat-row">
      {([
        [bi(locale, "VP", "VP"), core.me.vp],
        [bi(locale, "Stability", "稳定"), core.me.stability],
        [bi(locale, "Manpower", "人力"), core.me.manpower],
        [bi(locale, "Industry", "工业"), core.me.industry],
      ] as const).map(([label, value]) => (
        <span key={label} className="ie-stat" title={label}>
          <span className="ie-stat-label">{label}</span>
          <b>{value}</b>
        </span>
      ))}
    </span>
  );

  const commandStatus = (
    <div className="ie-status">
      <IEBadge tone={G.wtt >= 4 ? "warn" : "default"}>{t.wtt}: {G.wtt}/5</IEBadge>
      {G.gw?.active && <IEBadge tone="warn">GW {G.gw.turn}</IEBadge>}
      {battle && <IEBadge tone="warn">{bi(locale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")}</IEBadge>}
      {pending && <IEBadge tone="warn">{canDecide ? t.yourDecision : decidingText(t.seats[pending.power], locale)}</IEBadge>}
      {responseWindow && <IEBadge tone="warn">{t.responseWindow}</IEBadge>}
      {viewer && <IEBadge tone={viewer.toLowerCase()}>{t.seats[viewer]}</IEBadge>}
      {!viewer && <IEBadge>{t.spectators}</IEBadge>}
      {viewer !== null && !botSeats.has(viewer) && canHandOverSeat && (
        <button
          type="button"
          className="ie-btn secondary ie-mini"
          data-testid="ie-hand-over-seat"
          title={t.handOverToBotHint}
          onClick={() => setSeatBot(true)}
        >
          {t.handOverToBot}
        </button>
      )}
      {viewer !== null && botSeats.has(viewer) && (
        <div className="ie-bot-banner" data-testid="ie-bot-banner" role="status" aria-live="polite">
          <Icon name="bot" size={14}/> {seatPowerName(t, viewer, locale, auFormedForState(G))} — {t.botSeatBadge} · {t.botDifficultyLabel} {botDifficultyLabel(botDifficultyOf(G), locale)} · {t.seatBotHint}
          {/* A local hotseat seat can be taken back; the bot keeps the seat
              until someone claims it, so the control lives on the banner. */}
          {canHandOverSeat && (
            <>
              {" "}
              <button
                type="button"
                className="ie-btn secondary ie-mini"
                data-testid="ie-take-back-seat"
                title={t.takeBackSeatHint}
                onClick={() => setSeatBot(false)}
              >
                {t.takeBackSeat}
              </button>
            </>
          )}
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
      {seatUi.shellMenu}
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
        stats={commandStats}
        seats={seatUi.seats !== undefined && seatUi.onSwitchSeat !== undefined ? (
          <SeatStrip
            seats={seatUi.seats}
            onSelect={seatUi.onSwitchSeat}
            locale={locale}
            auFormed={auFormedForState(G)}
          />
        ) : undefined}
        notice={pending !== null && pendingElsewhere && (!hotseat || otherSeatPending) ? (
          <SeatAlert
            pendingPower={pending.power}
            pendingKind={pendingPrompt !== "" ? pendingPrompt : pendingKind ?? ""}
            locale={locale}
            onGo={otherSeatPending && seatUi.onSwitchSeat ? () => seatUi.onSwitchSeat!(pending.power) : undefined}
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
          decisionLabel={decidingLabel}
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
            activeLabel={`${t.active}: ${seatPowerName(t, active, locale, auFormedForState(G))}`}
            turn={G.turn}
            summary={core.dockSummary}
            nextSteps={core.dockNextSteps}
            hasDecision={decisionOwed}
            // The dock owns the phone decision cap; the turn panel itself is
            // never narrowed by the decision.
            decisionOnlyOnPhone={false}
            decisionBadge={pending !== null && viewer !== null && pending.power === viewer}
            confirmActions={confirmActions}
            warBadge={war.war
              ? <Icon name="crossed-sabres" size={14}/>
              : war.declarationWaiting ? "!" : undefined}
            // A war starting brings its panel to the front once, on both shells:
            // the desktop turn panel's tab comes from `railTab`, and the phone's
            // one bottom sheet opens on its War body.  Without this the player
            // declared a war and stayed on the Orders page, so the declaration
            // looked like it had done nothing.
            activeTab={isPhone ? phoneTurnTab : resolveTurnTab(railTab)}
            onTabChange={(tab) => {
              const next = tab as TurnTab;
              if (isPhone) setMobileTab(mobileTabForTurnTab(next));
              else setRailTab(next);
            }}
            tabs={{
              action: (
                <>
                  {/* While another seat's decision, a battle or the result owns
                      this body, a required card choice cannot be a dialog (two
                      modals at once), so it falls back to the inline form here.
                      A decision *this* seat owes is itself a dialog: the card
                      choice waits behind it and opens once the decision is
                      answered. */}
                  {showInlineDecision && choiceKinds.required ? <HandChoices {...choicesProps}/> : null}
                  {showInlineDecision && (
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
                  {!showInlineDecision ? (
                    <OrdersRegion
                      {...orders}
                      actionsTopSlot={actionsTopSlot}
                      showUnavailable={showUnavailableMenu}
                      setShowUnavailable={setUnavailablePreference}
                    />
                  ) : null}
                </>
              ),
              war: (
                <WarRegion
                  key={`war-${locale}`}
                  {...war}
                  locale={locale}
                  t={t}
                  moveConsole={
                    <MoveConsole
                      {...orders}
                      showUnavailable={showUnavailableMenu}
                      setShowUnavailable={setUnavailablePreference}
                    />
                  }
                />
              ),
              log: <LogRegion key={`log-${locale}`} G={G} locale={locale} t={t} mode={cardFaceMode}/>,
            }}
          />
          {isPhone && (
            <PlayerMat
              G={G}
              viewer={viewer}
              me={core.me}
              active={active}
              locale={locale}
              t={t}
              forceOpen
              // The mat's "Printed display" and reserve-box links open the
              // drawer at the chart they name, like every other reference link.
              onOpenReference={(anchor) => setRefAnchor(anchor)}
            />
          )}
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
            decisionPeekLabel={decidingLabel}
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

      {/* The card choices, as dialogs.  They sit outside the table so they
          cover the board while answered, and they are never mounted for a seat
          the reader is not looking at (a hotseat's six boards).  The home card
          has to be opened from the dock, so the negotiation table is reachable
          first; either may be closed without answering and reopened later. */}
      <CardChoiceModal
        open={choiceModalOpen}
        dismissible
        locale={locale}
        title={choiceModalTitle}
        // A dismissible choice keeps whatever the printed rule keeps when it is
        // closed: the Goal pick keeps the first Goal, and a closed home-card
        // dialog leaves the choice owed so `ie-open-home-card` brings it back.
        continueLabel={goalModalOpen
          ? bi(locale, "Continue with the first Goal", "继续（保留第一张目标）")
          : bi(locale, "Close for now — choose later", "暂时关闭——稍后再选")}
        onClose={closeChoice}
      >
        <HandChoices {...choicesProps}/>
      </CardChoiceModal>

      {/* A decision this seat owes, as a dialog for the same reason: it is a
          blocker, and inline it pushed the action list below the fold.  Another
          seat's decision (and a battle or the result, which are reports) stays
          in the Orders body. */}
      <DecisionModal
        open={decisionModalOpen}
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
      />

      {/* The finished battle's public report.  Every seat gets its own copy of
          this dialog; dismissing one seat's copy leaves the other seats' copies
          (and a hotseat switch) untouched. */}
      <BattleResultModal
        report={battleReport}
        open={battleReportOpen}
        locale={locale}
        t={t}
        onClose={() => {
          if (battleReport !== null) setDismissedBattleReport(battleReport.id);
        }}
      />

      {/* A refused move is explained here: the engine answers a bare
          INVALID_MOVE, so the board says what it tried and why it is not
          allowed, without stealing focus or blocking the map. */}
      <Toast toast={toast} locale={locale} onDismiss={dismissToast}/>

      <ReferenceDrawer
        core={core}
        reference={reference}
        mat={isPhone ? undefined : (
          <PlayerMat
            G={G}
            viewer={viewer}
            me={core.me}
            active={active}
            locale={locale}
            t={t}
            forceOpen
            onOpenReference={(anchor) => setRefAnchor(anchor)}
          />
        )}
        open={refAnchor !== null}
        anchor={refAnchor}
        onOpen={(anchor) => setRefAnchor(anchor)}
        onClose={() => setRefAnchor(null)}
      />
    </>
  );
};

/**
 * The Log tab: the public history, newest first.
 *
 * The lines come from `LogList` rather than a bare list here, so a card the
 * entry names is a chip that opens the inspector — the same read affordance the
 * reference drawer's copy of the log gets.
 */
const LogRegion = ({G, locale, t, mode}: {
  G: ImperialElegyState;
  locale: "en" | "zh_CN";
  t: T;
  mode?: CardFaceMode;
}) => (
  <section className="ie-log-panel">
    <h3>{t.log}</h3>
    <LogList entries={G.log.slice(-80).reverse()} locale={locale} testId="ie-log" mode={mode}/>
  </section>
);
