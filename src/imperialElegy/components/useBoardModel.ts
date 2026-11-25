/**
 * Derived state for the Imperial Elegy board.
 *
 * The whole non-presentational body of the board lives here: React state,
 * effects (bot driver, seat reporting, keyboard targeting), rules helpers and
 * every value the layout needs.  BoardLayout never computes game state; it only
 * renders this model, which keeps the rules-facing code testable and the
 * presentation file focused on markup.
 */
import React from "react";
import {Ctx} from "boardgame.io";
import {ImperialElegyState, PendingOption, Power, SpaceId, Unit} from "../types";
import {SPACES, TSRR_ROUTE, isNavalBox, neighboursOf, portBoxes, spaceLabel} from "../constant/spaces";
import {MINOR_POWER_HOMES} from "../constant/setup";
import {cpBudgetFor, freeGrantCp, friendlySpace, gwAllyImpulseFor, hasLoc, hostileOwner, isArmyKind, isHomeSpace, landStackingLimit, landUnitsIn, legalLandBattleTarget, minorAlliesOf, minorController, navalUnitsIn, ownsKey, warDeclarationEntitlement} from "../engine/rules";
import {CARD_BY_ID, cardById, decadeLabel} from "../engine/deck";
import {Decade} from "../constant/cards";
import {cpChainResolution} from "../engine/economy";
import {GOALS_BY_ID} from "../constant/goals";
import {decidingText, ieT} from "./i18n";
import {cardDisplayName} from "./cardDisplay";
import i18n from "../../constant/i18n";
import {amphibiousAssaultCheck, canPassNow, hasActedThisImpulse, navalInterceptCheck, navalTransportCheck, responseCardEligibility} from "../moves";
import {planNavalTransport} from "../engine/navalMovement";
import {AU_NATIONALITIES, auIncorporateDecision, auRightsDecision, canGrantCitizenship, jihadUse, passRestriction, superiorStaffWorkFreeDeploy, TSRR_RAIL_ARMY_KINDS, tsrrRail} from "../engine/characteristics";
import {polishController, polishRecruitDecision} from "../engine/poland";
import {deployReserveLimit, loneMinorDefender, minorWarAlly, rapidMobilizationFreeDeploy} from "../engine/limitedWar";
import {italyAllianceBox, italyAllianceSide} from "../engine/italyEntry";
import {gwDraftProblem, isIndependentItaly} from "../engine/greatWarFlow";
import {currentGwImpulse, gwActionAllowance, gwCanEndTurn, gwFinishImpulseProblem} from "../engine/gwImpulse";
import {POWER_KEYS, amphibiousReasonText, bi, gwImpulseReasonText, interceptReasonText, isPowerKey, OPTION_ZH, pickActionTarget, PROMPT_ZH, powerOrMinorLabel, transportReasonText, unitIsCommanded, unitLabel} from "./boardHelpers";
import {handChoiceAvailability} from "./HandChoices";
import {CardChoiceFace} from "./CardChoice";
import {PhaseAction} from "./PhaseActions";
import {BotSeatsContext} from "./botContext";
import {negotiationConcluded, negotiationDoneFor} from "../engine/negotiation";
import {useBotAutoSubmit} from "./botDriver";
import {SeatUiContext} from "./seatUiContext";
import {useInteraction, interactionPrompt} from "./useInteraction";
import {useCardFaceMode, useConfirmActions} from "./preferences";
import {sliceModel, type BoardSlices} from "./boardSlices";
import {resolveLocale} from "./modelValues";
import type {OrdersTab} from "./OrdersPanel";
import type {MapTarget} from "./map";
import {intentStyle, legalUnitTargets, type UnitIntent} from "./legalTargets";
import {trenchRows} from "./trenchRows";
import {intentsAt, selectedUnitIds, submitNow} from "./useInteraction";
import {
  canProbeRefusal,
  feedbackTimeoutMs,
  FEEDBACK_POLL_MS,
  moveWasRefused,
  refusalNotice,
  type DoAction,
  type MoveDescription,
} from "./moveFeedback";
import {pendingOptionSafety} from "./pendingSafety";
import {pendingDeclinesItself} from "./PendingPanel";
import {engineReasonText} from "./reasonText";
import {ARM_MS} from "./ConfirmButton";
import {actionHints} from "./actionHints";
import type {InjectedUi, MobileTab, ModelValues} from "./modelValues";
import {panelLocaleView} from "./panelLocale";
import {BoardLayout} from "./BoardLayout";
import {botPowersOf} from "../configuration";

const EMPTY_SEATS: ReadonlySet<Power> = new Set<Power>();

/**
 * Decisions whose printed benefit is mandatory ("gains", "set manpower", a tied
 * alliance direction, returning an NG).  The panel's generic 拒绝 is only a
 * convenience for optional windows; offering it here would let a player decline
 * a benefit the rules grant, so these kinds answer only through their printed
 * options.  The engine's `declinePending` stays available as the unattended
 * fallback for bots and stale clients.
 */
const MANDATORY_PENDING_KINDS: ReadonlySet<string> = new Set([
  "metternich",
  "militarism",
  "manpowerExcess",
  "allianceTie",
  "goalChoice",
  // 2.4/20.11 ("keep one, return the other two") and the 1870/1880 printed
  // setup choices: every one of these must be answered, so the generic 拒绝
  // must not be offered.  Declining them only re-opens the same decision.
  "startingGoal",
  "scenarioGoalChoice",
  "francoPrussianConcession",
]);

export interface BoardModelProps {
  G: ImperialElegyState;
  ctx: Ctx;
  moves: Record<string, (...args: any[]) => void>;
  playerID: string | null;
  hotseat?: boolean;
  /** Rule 34 seat hand-over is offered; the solo page sets this false. */
  allowSeatHandover?: boolean;
  /**
   * Force the hand tray open (or shut) instead of the viewport default.  The
   * board itself never passes this; it exists for embeds and for the rules
   * suites, which assert on the tray's contents.
   */
  handOpen?: boolean;
  /** Draw every hand card's operations inline (tests/embeds). */
  expandHand?: boolean;
  /** boardgame.io state counter; a rejected move leaves it untouched. */
  _stateID?: number;
  /** False when the socket is down (remote play). */
  isConnected?: boolean | null;
  /** Test seam: a suite that stubs React hooks renders `BoardLayout` itself. */
  injectedUi?: InjectedUi;
}

/** The phone breakpoint, shared by the dock and the stylesheet. */
const PHONE_QUERY = "(max-width: 767px)";

/**
 * Whether the layout is the phone one.
 *
 * SSR and the node test environment have no `window`, and the safe default
 * there is the desktop layout: the phone dock only makes sense once a real
 * viewport exists.  The query is subscribed to so a resize (or a rotate) flips
 * the shell without remounting the board.
 */
export const useIsPhone = (): boolean => {
  const read = (): boolean =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(PHONE_QUERY).matches
      : false;
  const [isPhone, setIsPhone] = React.useState(read);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsPhone(event.matches);
    // The initial value was read before the first paint of an effect; re-read
    // in case the viewport changed between render and subscribe.
    setIsPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isPhone;
};

export const useBoardModel = ({
  G, ctx, moves, playerID, hotseat = false, allowSeatHandover = true,
  handOpen, expandHand = false, _stateID, isConnected = true, injectedUi,
}: BoardModelProps) => {
  i18n.use();
  const t = injectedUi?.i18n ?? ieT();
  // A suite that stubs the i18n module publishes its locale through
  // `panelLocale.ts`; production never sets it and the real locale wins.
  const actualLocale = resolveLocale(
    injectedUi?.locale !== undefined ? injectedUi : {...injectedUi, locale: panelLocaleView},
    () => i18n.getLocaleName(),
  );
  const decade = decadeLabel(G.decade as Decade);
  const viewer = playerID === null || playerID === undefined ? null : POWER_KEYS[Number(playerID)] ?? null;

  const [confirmActions, setConfirmActions] = useConfirmActions();
  const {interaction, dispatch} = useInteraction();
  const selected: SpaceId | null = interaction.kind === "idle" ? null
    : interaction.kind === "targeting" ? interaction.from
      : interaction.space;
  /**
   * The selected unit(s).
   *
   * A targeting interaction carries `sources`, and the soft mode enters
   * targeting the moment a unit is selected — so reading the selection only
   * from `kind: "unit"` made it vanish on the very next render.  That is why
   * `aria-pressed` never lit up and why the Orders rows for a selected unit
   * could not be found: the selection was real for one frame only.  The
   * selection now survives its own targeting mode.
   */
  /**
   * A stable key for the selection.  `selectionSources` is rebuilt on every
   * render, so anything memoised on the array identity (the Orders rows, the
   * soft-targeting effect) would recompute every frame.
   */
  const selectionKey = interaction.kind === "unit"
    ? [interaction.unit, ...(interaction.extra ?? [])].join(",")
    : interaction.kind === "targeting" ? interaction.sources.join(",") : "";
  const selectionSources: string[] = React.useMemo(
    () => selectedUnitIds(interaction),
    // The key is the identity: same units, same array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectionKey],
  );
  const selectedUnit: string | null = selectionSources[0] ?? null;
  const targeting = interaction.kind === "targeting" ? interaction : null;
  const battleFrom: SpaceId | null = targeting?.intent === "landBattle" ? targeting.from : null;
  const navalFrom: SpaceId | null = targeting?.intent === "navalBattle" ? targeting.from : null;
  const [board, setBoard] = React.useState<"world" | "greatWar">("world");
  const [railTab, setRailTab] = React.useState("action");
  // The Orders panel's page.  A view preference: it is not part of `G`, so a
  // save or a seat switch leaves it behind, and the panel falls back to the
  // actions page whenever a page stops existing (the naval one is conditional).
  const [ordersTab, setOrdersTab] = React.useState<OrdersTab>("actions");
  // Phone layout: the context rail folds to its tab strip so the map owns the
  // screen.  `narrow` is read once on mount (and on resize) rather than per
  // render; SSR has no window and stays on the desktop column.
  const [railOpen, setRailOpen] = React.useState(false);
  const [narrow, setNarrow] = React.useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768);
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  // The declaration form's own choices (defender, aim, objective, CP and the
  // 14.1 clauses) live inside `WarDeclarationPanel`; the model only reports
  // whether a declaration is waiting, for the War tab's badge.
  const [warAlly, setWarAlly] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [warMinor, setWarMinor] = React.useState<string>("");
  // 11.1: the deals page's own form state (target, counts, promises).
  const [dealTarget, setDealTarget] = React.useState<Power>(POWER_KEYS.find((p) => p !== viewer) ?? "UK");
  const [dealGive, setDealGive] = React.useState(1);
  const [dealTake, setDealTake] = React.useState(0);
  const [dealPromises, setDealPromises] = React.useState<string>("");
  const [confirmSurrender, setConfirmSurrender] = React.useState(false);
  const [auReformTarget, setAuReformTarget] = React.useState<string>("");
  const [auCitizenTarget, setAuCitizenTarget] = React.useState<string>("");
  const [auIncorporateTarget, setAuIncorporateTarget] = React.useState<string>("");
  const [auSacrifice, setAuSacrifice] = React.useState(false);
  const [tsrrUnitId, setTsrrUnitId] = React.useState<string>("");
  const [tsrrTo, setTsrrTo] = React.useState<string>("");
  // 22.5(2): the Polish reserve army is optional, so it has its own opt-out.
  // Keep this hook after `tsrrTo`: hook order is observable to the suites that
  // stub `React.useState` positionally.
  const [polishReserve, setPolishReserve] = React.useState(true);
  const [gwTransferTo, setGwTransferTo] = React.useState<string>("");
  const [gwTransferAmount, setGwTransferAmount] = React.useState(1);
  const [dockCollapsed, setDockCollapsed] = React.useState(false);
  // The required card choices are dialogs the player opens, not pop-ups.  The
  // diplomacy home card used to raise itself the instant the phase began, which
  // covered the negotiation table (11.0/11.1) before anyone could talk; the
  // seat now negotiates first and opens the choice when it is done.  A closed
  // dialog keeps the choice outstanding, so the dock's button brings it back.
  // The home-card chooser is a dialog the reader opens; the shell keeps the
  // flag for a hotseat, because a seat's board is built only while it is in
  // front and would otherwise forget that it had opened the chooser.
  const [localHomeCardDialogOpen, setLocalHomeCardDialogOpen] = React.useState(false);
  // The phone shell is one bottom sheet; `mobileTab` picks the body it shows.
  const isPhone = useIsPhone();
  const [mobileTab, setMobileTab] = React.useState<MobileTab>("orders");
  // Both shells start with the hand folded to its 44 px bar: the map is the
  // surface a player reads first, and the bar already carries the card count.
  // An explicit `handOpen` (tests, embeds) still opens it.
  const [trayOpen, setTrayOpen] = React.useState(() => handOpen ?? false);
  const [trayExpanded, setTrayExpanded] = React.useState(false);
  // The instruction panel is a drawer on desktop: the map owns the screen until
  // a decision, a battle or the reader asks for the orders.
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [cardFaceMode, setCardFaceMode] = useCardFaceMode();
  const [amphibiousFrom, setAmphibiousFrom] = React.useState<string>("");
  const [amphibiousTo, setAmphibiousTo] = React.useState<string>("");
  const [amphibiousUnitIds, setAmphibiousUnitIds] = React.useState<string[]>([]);
  const [transportFrom, setTransportFrom] = React.useState<string>("");
  const [transportTo, setTransportTo] = React.useState<string>("");
  const [transportLand, setTransportLand] = React.useState<string>("");
  const [interceptPort, setInterceptPort] = React.useState<string>("");
  // A test/SSR renderer may mock useContext without a provider; the default
  // context value is equivalent to this fallback.
  const seatUi = React.useContext(SeatUiContext) ?? injectedUi?.seatUi ?? {currentSeat: null};
  const shellChoiceOpen = viewer !== null && seatUi.choiceOpen !== undefined
    ? seatUi.choiceOpen[viewer] === true
    : undefined;
  const homeCardDialogOpen = shellChoiceOpen ?? localHomeCardDialogOpen;
  const setHomeCardDialogOpen = React.useCallback((open: boolean) => {
    if (viewer !== null && seatUi.setChoiceOpen !== undefined) seatUi.setChoiceOpen(viewer, open);
    else setLocalHomeCardDialogOpen(open);
  }, [viewer, seatUi.setChoiceOpen]);

  React.useEffect(() => {
    // Only the visible seat reports to the shared strip.  Hidden boards keep
    // their effects running (the bots depend on them) but must not make the
    // shell re-render on every one of their state syncs.
    if (hotseat && seatUi.currentSeat !== viewer) return;
    seatUi.onGameState?.(G);
    // The report carries public seat fields only; explicit deps keep the loop
    // closed (a snapshot update cannot change G or the current seat).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, hotseat, viewer, seatUi.currentSeat, seatUi.onGameState]);

  const me = viewer ? G.powers[viewer] : null;
  const phase = G.phase;
  const active = G.activePower;
  const isActive = viewer !== null && viewer === active;
  const eliminated = me?.eliminated === true;
  // Rule 34: a bot seat is driven by the bot and is read-only for whoever is
  // looking at it.  Hotseat names its bots in the client-side seat toggles, an
  // online match names them in the public `G.bots` list that the lobby's
  // `setupData.bots` produced, so both sources are folded together here.  Every
  // "may act" flag below folds this in, so no control on a bot seat can be
  // clicked.
  const botContext = React.useContext(BotSeatsContext);
  const contextBotSeats = botContext?.seats ?? injectedUi?.botSeats ?? EMPTY_SEATS;
  // Rule 34 sources of truth:
  //  - online matches list their server-driven seats in `G.bots`;
  //  - a hotseat match's seat setup lives in the shell (the context), and an
  //    in-match handover writes both that set and the public `G.bots` list, so
  //    the engine, a saved replay and the server driver all agree.
  //
  // The union covers a state-only transition (an online match, or a seat the
  // server took over); a take-back clears both sides, so a reclaimed seat is
  // not kept alive by the stale half.
  const botSeats = React.useMemo<ReadonlySet<Power>>(() => {
    const matchBots = botPowersOf(G);
    if (contextBotSeats.size === 0) return new Set<Power>(matchBots);
    return new Set<Power>([...contextBotSeats, ...matchBots]);
  }, [G, contextBotSeats]);
  const isBotViewer = viewer !== null && botSeats.has(viewer);
  const pending = G.pending;
  const canDecide = pending !== null && viewer !== null && pending.power === viewer && !isBotViewer;
  const war = G.war;
  const gw = G.gw;
  const battle = G.battle;
  // When a war (or the Great War) starts, bring its panel into view once; the
  // player can still switch back to Action without the tab fighting them.  Both
  // shells are driven: a desktop turn panel reads `railTab`, and a phone's one
  // bottom sheet reads `mobileTab`.  Declaring a war used to leave the reader on
  // Orders, where the declaration appeared to have done nothing.
  const warWasActive = React.useRef(war !== null || gw !== null);
  React.useEffect(() => {
    const hasWar = war !== null || gw !== null;
    if (hasWar && !warWasActive.current) {
      setRailTab("war");
      // The phone's War body only shows while its sheet is open, so the same
      // edge brings the sheet up at half height (the decision edge does the
      // same); a reader who collapses it afterwards keeps it collapsed.
      setMobileTab("war");
      if (isPhone) {
        setTrayOpen(true);
        setTrayExpanded(false);
      }
    }
    warWasActive.current = hasWar;
  }, [war, gw, isPhone]);

  // A finished bot war leaves the War body in front; the next human impulse
  // then has no visible Orders tab (action/space/influence/naval), so the seat
  // that just took the impulse sees no way to act.  Bring Orders back on the
  // false→true edge of "this viewer holds the action impulse", exactly once, so
  // a player who deliberately opened War during their own turn stays there.
  const viewerHoldsImpulse = viewer !== null && G.activePower === viewer
    && (G.phase === "action" || G.phase === "wartime");
  const viewerHeldImpulse = React.useRef(false);
  React.useEffect(() => {
    if (viewerHoldsImpulse && !viewerHeldImpulse.current) {
      setRailTab("action");
      setMobileTab("orders");
    }
    viewerHeldImpulse.current = viewerHoldsImpulse;
  }, [viewerHoldsImpulse]);

  // A decision arriving on a phone brings the one bottom sheet up to half
  // height on the Orders tab.  It fires on the false→true edge only, so a
  // player who collapses the sheet while answering keeps it collapsed; when the
  // decision clears the state is left alone, so the sheet does not jump.
  // Desktop's tray behaviour is untouched.
  const decisionOwed = Boolean(pending || battle || G.result);
  const decisionWasOwed = React.useRef(decisionOwed);
  React.useEffect(() => {
    if (isPhone && decisionOwed && !decisionWasOwed.current) {
      setTrayOpen(true);
      setTrayExpanded(false);
      setMobileTab("orders");
    }
    decisionWasOwed.current = decisionOwed;
  }, [decisionOwed, isPhone]);

  const warBelligerents = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])]
    : [];
  const isPrincipal = viewer !== null && war !== null && (viewer === war.attacker || viewer === war.defender);
  const isBelligerent = viewer !== null && warBelligerents.includes(viewer);

  const cpBudget = (): number => viewer === null ? 0 : cpBudgetFor(G, viewer);
  const canAct = viewer !== null && !eliminated && !isBotViewer && isActive && pending === null &&
    (phase === "action" || phase === "wartime" || (phase === "gwManeuver" && !gw?.neutralImpulses));
  const canSpend = (cost: number): boolean => canAct && cpBudget() >= cost;
  const canActionCard = viewer !== null && !eliminated && !isBotViewer && isActive && phase === "action" && pending === null;
  const canPhaseAct = viewer !== null && !eliminated && !isBotViewer && (phase === "end" || phase === "gwPlanning" ? true : isActive);
  const forcedPass = viewer !== null ? passRestriction(G, viewer).forced : false;
  const forcedCardIds = viewer !== null ? passRestriction(G, viewer).cards.map((c) => c.card) : [];
  const forcedGwCard = viewer !== null && phase === "gwManeuver" && G.powers[viewer].gwCard
    ? passRestriction(G, viewer, [G.powers[viewer].gwCard as string]).forced
    : false;
  const forcedPassTitle = bi(actualLocale,
    "A card in hand forbids passing (The Dual Monarchy / Exhaustion). Play it for CP or its event first.",
    "手中有禁止停牌的牌（二元君主国 / 精疲力竭）。请先作为 CP 或事件打出。");
  // 12.0 has no "end my impulse" action: one button finishes a used impulse and
  // skips an unused one.  Only the unused case can be illegal — a hand that is
  // too full, or holds a home card / mandatory event.
  const actedThisImpulse = viewer !== null && hasActedThisImpulse(G, viewer);
  const passBlocked = viewer !== null && phase === "action" && !actedThisImpulse && !canPassNow(G, viewer);
  const passBlockedTitle = bi(actualLocale,
    "Passing needs at most one card in hand (two for the UK), with no home card or mandatory event.",
    "停牌需要手牌不超过 1 张（英国 2 张），且不能持有本国牌或强制事件。");
  // 27.1/27.3: the Great War's own exit lives in the pinned dock too.  The
  // War tab keeps its copies, but a seat that only reads the dock (the way
  // every campaign phase is played) used to have no visible way to end an
  // impulse, so the maneuver looked stalled after the first action.
  const gwImpulseProblem = viewer !== null && phase === "gwManeuver" ? gwFinishImpulseProblem(G, viewer) : null;
  const gwImpulseActed = viewer !== null && phase === "gwManeuver"
    ? currentGwImpulse(G, viewer).acted === true || G.gw?.neutralImpulses !== undefined
    : false;
  const canGwEndTurnNow = viewer !== null && phase === "gwManeuver" && gwCanEndTurn(G, viewer);
  const hasPhaseButtons = viewer !== null && !eliminated && (
    (phase === "prep" || phase === "diplomacy") ? canPhaseAct
      : phase === "action" ? isActive
        : phase === "end" ? canPhaseAct
          : phase === "gwPlanning" ? pending === null && battle === null && G.result === null
            : phase === "gwManeuver" ? isActive && pending === null && battle === null && G.result === null
              : false
  );
  // 6.0 / 9.1: the diplomacy home-card selection is a step of its own, after the
  // negotiation segment.  Whether it is still outstanding is the same test
  // `HandChoices` uses, so the dock button and the dialog can never disagree.
  const homeCardChoicePending = phase === "diplomacy" && me !== null &&
    me.homeCards.length > 0 && me.selectedHomeCard === null && me.flags.homeChosen !== true;
  // 9.1: the negotiation segment runs before the home-card step.  The home card
  // stays unavailable until every surviving seat has ended its negotiation,
  // and the seat's own "finish negotiating" button is offered to every seat,
  // not only the one whose diplomacy turn it is.
  const negotiationConcludedNow = negotiationConcluded(G);
  const negotiationsOwed = viewer !== null && !negotiationDoneFor(G, viewer);
  const canFinishNegotiation = phase === "diplomacy" && viewer !== null && !eliminated && !isBotViewer &&
    negotiationsOwed && pending === null && battle === null && G.result === null;
  // Buttons that end or continue the current phase step.  They belong in the
  // pinned dock with the pending decisions: both answer "what may I do now",
  // and neither may be pushed below the fold by a tall map or a long hand.
  const phaseActions: PhaseAction[] = [
    ...(canFinishNegotiation
      ? [{
          key: "finishNegotiation",
          label: bi(actualLocale, "Finish negotiating", "结束谈判"),
          testId: "ie-finish-negotiation",
          onClick: () => doAction(() => moves.finishNegotiation(), {label: bi(actualLocale, "Finish negotiating", "结束谈判")}),
        }]
      : []),
    ...(hasPhaseButtons ? [
    ...(phase === "prep" && canPhaseAct && !me?.flags.prepDone
      ? [{key: "finishPrep", label: t.finishPrep, testId: "ie-finish-prep", onClick: () => doAction(() => moves.finishPrep(), {label: t.finishPrep})}]
      : []),
    ...(phase === "diplomacy" && canPhaseAct && homeCardChoicePending && negotiationConcludedNow && pending === null && battle === null && G.result === null
      // 9.1/11.0: the negotiation segment runs before the home card, so the
      // choice is opened by the player, never raised over the table.  A decision
      // or battle already owns the board; the choice waits for it rather than
      // fighting it for focus.
      ? [{key: "chooseHomeCard", label: t.chooseHome, testId: "ie-open-home-card", onClick: () => setHomeCardDialogOpen(true)}]
      : []),
    ...(phase === "diplomacy" && canPhaseAct && me?.selectedHomeCard && negotiationConcludedNow
      // 6.0: once diplomacy ends there is no way back, so it confirms.
      ? [{key: "endDiplomacy", label: t.endDiplomacy, testId: "ie-end-diplomacy", confirm: true, onClick: () => doAction(() => moves.endDiplomacy(), {label: t.endDiplomacy})}]
      : []),
    ...(phase === "action" && isActive && !eliminated
      ? [{
          key: "pass",
          // 12.0: one move, two readings. A seat that has already acted is
          // handing over a used impulse; a seat that has not is passing, and
          // the hand restriction decides whether that is legal.
          label: actedThisImpulse ? t.endImpulse : t.pass,
          testId: "ie-pass",
          disabled: passBlocked,
          title: forcedPass ? forcedPassTitle : passBlocked ? passBlockedTitle : undefined,
          // 12.0: ending the impulse hands the turn over; undo does not exist.
          confirm: true,
          onClick: () => doAction(() => moves.pass(), {label: actedThisImpulse ? t.endImpulse : t.pass, reason: passBlocked ? passBlockedTitle : undefined}),
        }]
      : []),
    ...(phase === "end" && canPhaseAct
      ? [{key: "endPhaseTurn", label: t.continue, testId: "ie-end-phase-turn", confirm: true, onClick: () => doAction(() => moves.endPhaseTurn(), {label: t.continue})}]
      : []),
    // 26.0/27.0: the GW tutorial opens on the planning step only so the cards
    // and budgets are dealt; the table moves on to the maneuver.
    ...(phase === "gwPlanning" && pending === null && battle === null && G.result === null
      ? [{
          key: "endGwPlanning",
          label: bi(actualLocale, "Start GW maneuver", "开始大战机动"),
          testId: "ie-gw-start-dock",
          confirm: true,
          onClick: () => doAction(() => moves.endGwPlanningMove(), {label: bi(actualLocale, "Start GW maneuver", "开始大战机动")}),
        }]
      : []),
    // 27.1: the one impulse exit.  It is refused while the budget action is
    // still owed (a war budget above 2 may not pass) and while Exhaustion is
    // in hand; the title carries the printed reason instead of going silent.
    ...(phase === "gwManeuver" && isActive && pending === null && battle === null && G.result === null
      ? [
          {
            key: "gwPass",
            label: gwImpulseActed ? bi(actualLocale, "End impulse", "结束行动轮") : t.gwPass,
            testId: "ie-gw-pass-dock",
            disabled: gwImpulseProblem !== null,
            title: gwImpulseReasonText(actualLocale, gwImpulseProblem),
            confirm: true,
            onClick: () => doAction(() => moves.gwPass(), {
              label: gwImpulseActed ? bi(actualLocale, "End impulse", "结束行动轮") : t.gwPass,
              reason: gwImpulseReasonText(actualLocale, gwImpulseProblem),
            }),
          },
          ...(canGwEndTurnNow
            ? [{
                key: "gwEndTurn",
                label: t.gwEnd,
                testId: "ie-gw-end-dock",
                confirm: true,
                onClick: () => doAction(() => moves.gwEndTurn(), {label: t.gwEnd}),
              }]
            : []),
        ]
      : []),
    ] : []),
  ];

  // ------------------------------------------------------------- 33.x national actions
  const nationalActionPhase = viewer !== null && !eliminated && isActive && phase === "action" && pending === null;
  const auRightsEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => auRightsDecision(G, nationality).allowed)
    : [];
  const auReformValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auReformTarget, AU_NATIONALITIES, auRightsEligible)
    : "";
  const auReformDecision = auReformValue !== "" ? auRightsDecision(G, auReformValue) : null;
  const auCitizenEligible = nationalActionPhase && viewer === "AU"
    ? AU_NATIONALITIES.filter((nationality) => canGrantCitizenship(G, "AU", nationality, {sacrificeStability: auSacrifice}).allowed)
    : [];
  const auCitizenValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auCitizenTarget, AU_NATIONALITIES, auCitizenEligible)
    : "";
  const auCitizenDecision = auCitizenValue !== ""
    ? canGrantCitizenship(G, "AU", auCitizenValue, {sacrificeStability: auSacrifice})
    : null;
  // 33.4: only an allied minor that already has a nationality with full AU
  // citizenship can be incorporated.  The picker must not offer the others
  // (the reported bug listed the Netherlands and Hanover while the button was
  // disabled); it should list only legal targets.
  const auIncorporateCandidates = nationalActionPhase && viewer === "AU"
    ? Object.values(SPACES)
        .filter((space) => {
          const control = G.spaces[space.id]?.control;
          return typeof control === "string" && !isPowerKey(control) && G.spaces[space.id]?.ally === "AU";
        })
        .map((space) => space.id)
        .filter((space) => auIncorporateDecision(G, space).allowed)
    : [];
  const auIncorporateEligible = auIncorporateCandidates.filter((space) => auIncorporateDecision(G, space).allowed);
  const auIncorporateValue = nationalActionPhase && viewer === "AU"
    ? pickActionTarget(auIncorporateTarget, auIncorporateCandidates, auIncorporateEligible)
    : "";
  const auIncorporate = auIncorporateValue !== "" ? auIncorporateDecision(G, auIncorporateValue) : null;
  const zouaveInPlay = Object.values(G.units).some((unit) => unit.kind === "zouave" && unit.owner === "FR");
  const zouaveReason = zouaveInPlay
    ? bi(actualLocale, "The Zouaves are already in play.", "祖阿夫已在场上。")
    : cpBudget() < 1
      ? bi(actualLocale, "Needs 1 CP in this impulse.", "本行动轮需要 1 CP。")
      : undefined;
  const tsrrPhase = viewer !== null && !eliminated && isActive && (phase === "action" || phase === "wartime") && pending === null;
  const tsrrArmies = tsrrPhase && viewer !== null
    ? Object.values(G.units).filter((unit) => unit.owner === viewer && TSRR_RAIL_ARMY_KINDS.includes(unit.kind) && unit.space && TSRR_ROUTE.includes(unit.space))
    : [];
  const tsrrUnitValue = tsrrPhase && viewer !== null
    ? pickActionTarget(tsrrUnitId, tsrrArmies.map((unit) => unit.id), tsrrArmies.map((unit) => unit.id))
    : "";
  const tsrrFrom = tsrrUnitValue !== "" ? G.units[tsrrUnitValue]?.space ?? null : null;
  const tsrrDestinations = tsrrFrom !== null ? TSRR_ROUTE.filter((space) => space !== tsrrFrom) : [];
  const tsrrToValue = tsrrFrom !== null ? pickActionTarget(tsrrTo, tsrrDestinations, tsrrDestinations) : "";
  const tsrrDecision = tsrrUnitValue !== "" && tsrrToValue !== ""
    ? tsrrRail(G, viewer as Power, tsrrUnitValue, tsrrToValue)
    : null;
  const showNationalActions = viewer !== null && (
    (nationalActionPhase && (viewer === "FR" || viewer === "AU" || viewer === "RU")) || tsrrArmies.length > 0
  );
  const needsCp = (cost: number): string => bi(actualLocale, `Needs ${cost} CP in this impulse.`, `本行动轮需要 ${cost} CP。`);
  const auReformReason = auReformDecision === null
    ? undefined
    : auReformDecision.allowed !== true
      ? engineReasonText(actualLocale, auReformDecision.reasons.join(" · "))
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const auCitizenReason = auCitizenDecision === null
    ? undefined
    : auCitizenDecision.allowed !== true
      ? engineReasonText(actualLocale, auCitizenDecision.reasons.join(" · "))
      : cpBudget() < 3 ? needsCp(3) : undefined;
  // 33.4: show the citizenship roll the player is paying 3 CP for — the base
  // 3+, +1 per existing citizen, -2 when the stability sacrifice is ticked —
  // instead of leaving the number to be recomputed from the eight-item list.
  const auCitizenRoll = auCitizenDecision === null
    ? null
    : {
        difficulty: auCitizenDecision.difficulty,
        rollNeeded: auCitizenDecision.rollNeeded,
        guaranteed: auCitizenDecision.guaranteed,
        impossible: auCitizenDecision.impossible,
      };
  const auIncorporateReason = auIncorporate === null
    ? bi(actualLocale, "No allied minor power is eligible.", "没有符合条件的盟国小国。")
    : auIncorporate.allowed !== true
      ? engineReasonText(actualLocale, auIncorporate.reasons.join(" · "))
      : cpBudget() < 3 ? needsCp(3) : undefined;
  const tsrrReason = tsrrArmies.length === 0
    ? bi(actualLocale, "No army is on the Trans-Siberian Railroad.", "西伯利亚铁路上没有军团。")
    : tsrrDecision !== null && tsrrDecision.allowed !== true
      ? engineReasonText(actualLocale, tsrrDecision.reasons.join(" · "))
      : undefined;
  const jihadDecision = battle !== null ? jihadUse(G, "OT", battle) : null;
  const jihadReason = jihadDecision !== null && jihadDecision.allowed !== true
    ? engineReasonText(actualLocale, jihadDecision.reasons.join(" · "))
    : undefined;
  const polishOwner = viewer === null ? null : polishController(G);
  const polishArmyDecision = viewer !== null && selected !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "army", selected, 2)
    : null;
  const polishReserveDecision = viewer !== null && phase === "action" && polishOwner === viewer
    ? polishRecruitDecision(G, viewer, "reserveArmy", null, 2)
    : null;

  // ------------------------------------------------------- 19.10 / 19.1 naval controls
  const lastLog = G.log[G.log.length - 1];
  const lastNavalBox: SpaceId | null = (() => {
    if (!lastLog || lastLog.turn !== G.turn) return null;
    const destination = (): SpaceId | null => {
      if (lastLog.key === "navalMove" && typeof lastLog.args?.to === "string") return lastLog.args.to as SpaceId;
      if (lastLog.key === "gwManeuverAction" && lastLog.args?.kind === "naval" && typeof lastLog.args?.to === "string") {
        return lastLog.args.to as SpaceId;
      }
      return null;
    };
    const box = destination();
    return box !== null && isNavalBox(box) ? box : null;
  })();
  const lastNavalMover: Power | null = lastNavalBox !== null && lastLog?.power !== undefined ? lastLog.power : null;

  // 27.5 lists naval movement in the GW, and 19.10's assault is one: the
  // Historical Great War's own UK restriction (p. 7) needs this control.
  const amphibiousVisible = viewer !== null && !eliminated && (phase === "action" || phase === "wartime" || phase === "gwManeuver") && pending === null;
  const ownLoadedArmyAt = (space: SpaceId): boolean =>
    G.spaces[space]?.units.some((id) => {
      const unit = G.units[id];
      return unit !== undefined && unit.owner === viewer && isArmyKind(unit.kind) && !unit.naval;
    }) ?? false;
  const amphibiousOrigins: SpaceId[] = !amphibiousVisible || viewer === null
    ? []
    : Object.values(SPACES)
        .filter((def) => {
          if (!ownLoadedArmyAt(def.id)) return false;
          if (isNavalBox(def.id)) return true;
          return (def.ports?.length ?? 0) > 0 && friendlySpace(G, def.id, viewer);
        })
        .map((def) => def.id);
  const amphibiousFromValue = pickActionTarget(amphibiousFrom, amphibiousOrigins, amphibiousOrigins);
  const amphibiousTargets: SpaceId[] = React.useMemo(() => {
    if (!amphibiousVisible || viewer === null || amphibiousFromValue === "") return [];
    const boxes = isNavalBox(amphibiousFromValue) ? [amphibiousFromValue] : portBoxes(amphibiousFromValue);
    return Object.values(SPACES)
      .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0)
      .filter((def) => (def.ports ?? []).some((box) => boxes.includes(box)))
      .filter((def) => !friendlySpace(G, def.id, viewer))
      .map((def) => def.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amphibiousVisible, viewer, amphibiousFromValue, G.spaces]);
  const amphibiousToValue = pickActionTarget(amphibiousTo, amphibiousTargets, amphibiousTargets);
  const amphibiousBox: SpaceId | null = (() => {
    if (amphibiousFromValue === "" || amphibiousToValue === "") return null;
    if (isNavalBox(amphibiousFromValue)) {
      return portBoxes(amphibiousToValue).includes(amphibiousFromValue) ? amphibiousFromValue : null;
    }
    return portBoxes(amphibiousFromValue).find((box) => portBoxes(amphibiousToValue).includes(box)) ?? null;
  })();
  const amphibiousArmies: string[] = amphibiousBox === null || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => unit.owner === viewer && !unit.naval && isArmyKind(unit.kind) && (unit.space === amphibiousBox || unit.space === amphibiousFromValue))
        .map((unit) => unit.id);
  const chosenAmphibiousArmies = amphibiousUnitIds.filter((id) => amphibiousArmies.includes(id));
  const amphibiousArmyValue = chosenAmphibiousArmies.length > 0
    ? chosenAmphibiousArmies.slice(0, 2)
    : amphibiousArmies.slice(0, 2);
  const amphibiousCheck = amphibiousVisible && viewer !== null
    ? amphibiousAssaultCheck(G, viewer, amphibiousFromValue, amphibiousToValue, amphibiousArmyValue)
    : null;
  const amphibiousPhaseOk = phase === "action" || phase === "gwManeuver" ? isActive : phase === "wartime" ? isBelligerent : false;
  const amphibiousReason = amphibiousCheck === null
    ? undefined
    : amphibiousOrigins.length === 0
      ? bi(actualLocale, "No friendly army is loaded in a port or naval box.", "没有已装载于港口或海域的友方军团。")
      : amphibiousReasonText(actualLocale, amphibiousCheck);
  const amphibiousCanGo = amphibiousCheck?.ok === true && amphibiousPhaseOk;
  const toggleAmphibiousArmy = (id: string, checked: boolean): void => {
    const base = amphibiousArmyValue;
    const next = checked
      ? (base.includes(id) ? base : [...base, id]).slice(0, 2)
      : base.filter((entry) => entry !== id);
    setAmphibiousUnitIds(next);
  };

  // ------------------------------------------------------- 12.3 naval transport
  const transportVisible = viewer !== null && !eliminated && pending === null && battle === null &&
    (phase === "action" || phase === "wartime" || phase === "gwManeuver");
  const transportMajor = viewer !== null ? gwAllyImpulseFor(G, viewer) : null;
  const transportOwns = (owner: string | undefined): boolean =>
    viewer !== null && (owner === viewer || (transportMajor !== null && owner === transportMajor));
  const transportable = (id: string): boolean => {
    const unit = G.units[id];
    return unit !== undefined && transportOwns(unit.owner) && unit.naval !== true && isArmyKind(unit.kind) && Boolean(unit.space);
  };
  const transportOrigins: SpaceId[] = !transportVisible || viewer === null
    ? []
    : [...new Set(Object.values(G.units).filter((unit) => transportable(unit.id)).map((unit) => unit.space as SpaceId))]
        .filter((space) => G.spaces[space] && (isNavalBox(space) || portBoxes(space).length > 0))
        .sort();
  const transportFromValue = pickActionTarget(transportFrom, transportOrigins, transportOrigins);
  const transportLands = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units).filter((unit) => transportable(unit.id) && unit.space === transportFromValue).map((unit) => unit.id);
  const transportLandValue = pickActionTarget(transportLand, transportLands, transportLands);
  const transportFleet = transportFromValue === "" || viewer === null
    ? []
    : Object.values(G.units)
        .filter((unit) => transportOwns(unit.owner) && unit.naval === true && unit.space === transportFromValue)
        .map((unit) => unit.id);
  const transportReachableFrom = (target: SpaceId): boolean =>
    viewer !== null && transportLandValue !== "" &&
    planNavalTransport(
      G,
      viewer,
      G.units[transportLandValue],
      transportFleet.map((id) => G.units[id]),
      target,
    ).ok;
  const transportTargets: SpaceId[] = React.useMemo(
    () => !transportVisible || viewer === null || transportLandValue === ""
      ? []
      : Object.values(SPACES)
          .filter((def) => !isNavalBox(def.id) && (def.ports?.length ?? 0) > 0 && def.id !== transportFromValue)
          .filter((def) => transportReachableFrom(def.id))
          .map((def) => def.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transportVisible, viewer, transportLandValue, transportFromValue, transportFleet.join(","), G.spaces],
  );
  const transportToValue = pickActionTarget(transportTo, transportTargets, transportTargets);
  const transportCheck = transportVisible && viewer !== null
    ? navalTransportCheck(G, viewer, transportLandValue, transportFleet, transportToValue)
    : null;
  const transportPhaseOk = phase === "action" ? isActive
    : phase === "wartime" ? isActive && war?.status === "maneuver"
      : phase === "gwManeuver" ? isActive
        : false;
  const transportReason = transportCheck === null
    ? undefined
    : transportOrigins.length === 0
      ? bi(actualLocale, "No land unit is in a friendly port or naval box.", "没有位于友好港口或海域的陆军单位。")
      : transportTargets.length === 0
        ? bi(actualLocale, "No friendly port is reachable with this force.", "该部队没有可抵达的友好港口。")
        : transportReasonText(actualLocale, transportCheck.reason);
  const transportCanGo = transportCheck?.ok === true && transportPhaseOk;

  const adjacentPortsToBox: SpaceId[] = lastNavalBox === null
    ? []
    : Object.values(SPACES).filter((def) => (def.ports ?? []).includes(lastNavalBox)).map((def) => def.id);
  const ownAdjacentPorts = viewer === null ? [] : adjacentPortsToBox.filter((id) => friendlySpace(G, id, viewer));
  const interceptPorts = ownAdjacentPorts.length > 0 ? ownAdjacentPorts : adjacentPortsToBox;
  const interceptPortValue = pickActionTarget(interceptPort, interceptPorts, interceptPorts);
  const interceptCheck = lastNavalBox !== null
    ? navalInterceptCheck(G, viewer, interceptPortValue, lastNavalBox)
    : null;
  const interceptReason = interceptCheck === null ? undefined : interceptReasonText(actualLocale, interceptCheck);
  const interceptVisible = lastNavalBox !== null && viewer !== null && !eliminated;

  // --------------------------------------------------- Orders panel page state
  /** A naval flow is on offer: the fourth page exists only while it is. */
  const navalVisible = amphibiousVisible || transportVisible || interceptVisible;
  // An interception window is short and belongs to the defender, so it pulls
  // its page to the front when it opens; a window closing under the reader must
  // not leave the panel on a page that no longer exists (`OrdersPanel` also
  // falls back on its own, this just keeps the state honest).
  const interceptWasVisible = React.useRef(interceptVisible);
  React.useEffect(() => {
    if (interceptVisible && !interceptWasVisible.current) setOrdersTab("naval");
    else if (!navalVisible && ordersTab === "naval") setOrdersTab("actions");
    interceptWasVisible.current = interceptVisible;
  }, [interceptVisible, navalVisible, ordersTab]);

  React.useEffect(() => { (window as any).__IE_STATE__ = G; }, [G]);
  React.useEffect(() => { setConfirmSurrender(false); }, [selected]);
  React.useEffect(() => { setConfirmSurrender(false); }, [war?.status, war?.attacker, war?.defender]);
  React.useEffect(() => { dispatch({type: "reset"}); }, [phase]);

  // ------------------------------------------------------------------ bot auto-submit (Rule 34)
  // This board's own seat, when it is a bot and the person in front of it may
  // only watch.  The hotseat seats that are not in front render no interface at
  // all (see `board.tsx`); they are driven by the same hook from there, so the
  // rule, the timing and the refusal fallback exist once, in `botDriver.ts`.
  //
  // An online match lists its bot seats in `G.bots` and the server drives them
  // (`src/game/ieBotDriver.ts`); a client must never send those moves too, so
  // this driver is gated on `hotseat` alone even though `botSeats` also carries
  // the online list (the badge and the read-only flags use it either way).
  useBotAutoSubmit({
    G,
    ctx,
    moves,
    viewer,
    enabled: hotseat && viewer !== null && botSeats.has(viewer) && !eliminated,
  });


  const selectedState = selected ? G.spaces[selected] : null;
  const selectedUnitDef = selectedUnit ? G.units[selectedUnit] : undefined;
  const commandedOwner = viewer === null ? null : gwAllyImpulseFor(G, viewer) ?? viewer;
  const commandsSelected = (unit: Unit): boolean => unitIsCommanded(G, viewer, unit, phase);
  const ownUnitsInSelected = selectedState
    ? selectedState.units.map((id) => G.units[id]).filter((u): u is Unit => u !== undefined && viewer !== null && commandsSelected(u))
    : [];
  const ownLandInSelected = ownUnitsInSelected.filter((u) => !u.naval);
  const ownNavalInSelected = ownUnitsInSelected.filter((u) => u.naval);

  /**
   * A unit in an adjacent space that this seat may fight at sea.  `hostileOwner`
   * mirrors the engine's own naval defender filter, so a neighbour that holds
   * only friendly or allied ships offers no battle while an enemy that entered
   * a space this seat controls is still attackable.  Land targets use
   * `legalLandBattleTarget` instead (12.16/13.4): a neutral non-player is not a
   * legal land target until a declaration makes it a belligerent.
   */
  const hostileUnit = (unit: Unit): boolean => {
    if (viewer === null || unit.owner === viewer) return false;
    if (!isPowerKey(unit.owner) && unit.owner !== "US" && unit.owner !== "IT"
      && minorController(G, unit.owner) === viewer) return false;
    return hostileOwner(G, viewer, unit.owner);
  };
  const enemyLandTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && !u.naval && legalLandBattleTarget(G, viewer, u.owner);
      });
    });
  };
  const enemyNavalTargetsFrom = (from: SpaceId | null): SpaceId[] => {
    if (!from || viewer === null) return [];
    return neighboursOf(from).filter((id) => {
      const state = G.spaces[id];
      if (!state) return false;
      return state.units.some((uid) => {
        const u = G.units[uid];
        return u !== undefined && u.naval === true && hostileUnit(u);
      });
    });
  };
  const potentialLandTargets = enemyLandTargetsFrom(selected);
  const potentialNavalTargets = enemyNavalTargetsFrom(selected);

  // The legal destinations come from the engine's own predicates
  // (`legalTargets.ts`), not from a neighbour heuristic: a ring means the
  // engine will accept that move.
  const unitIntents: Map<SpaceId, UnitIntent[]> = React.useMemo(() => {
    if (!selectedUnitDef || !selectedUnitDef.space || viewer === null || !commandsSelected(selectedUnitDef)) return new Map();
    return legalUnitTargets({G, power: viewer, unit: selectedUnitDef, phase});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, phase, viewer, selectedUnitDef]);
  const unitMoveTargets: SpaceId[] = React.useMemo(() => [...unitIntents.keys()], [unitIntents]);

  const pendingSpaceTargets: SpaceId[] = canDecide && pending
    ? pending.options.filter((o) => SPACES[o.id]).map((o) => o.id as SpaceId)
    : [];
  const battleTargets = [...enemyLandTargetsFrom(battleFrom), ...enemyNavalTargetsFrom(navalFrom)];

  const myOnMapArmies = viewer === null ? 0 : Object.values(G.units).filter((u) => u.owner === viewer && isArmyKind(u.kind) && u.space).length;
  const myForts = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.fort?.power === viewer).length;
  const myMinorAllies = viewer === null ? 0 : Object.values(G.spaces).filter((s) => s.ally === viewer).length;

  const hand = viewer ? G.powers[viewer].hand : [];
  const handCounts = (G as unknown as {handCounts?: Partial<Record<Power, number>>}).handCounts ?? {};
  const goalCounts = (G as unknown as {goalCounts?: Partial<Record<Power, number>>}).goalCounts ?? {};

  /**
   * The rejection notice.
   *
   * boardgame.io answers a refused move with a bare `INVALID_MOVE` — no reason,
   * and it still broadcasts the view — but it does not advance `_stateID`.
   * The board therefore wraps the moves a player starts from a labelled
   * control, remembers the counter, and probes the latest counter for the
   * board's budget (400 ms local, 4 s remote).  A move that advanced the
   * counter happened and says nothing; a move that never moved it was refused,
   * and the toast names the control plus the reason the UI already computed.
   */
  const latestStateId = React.useRef<number | undefined>(_stateID);
  latestStateId.current = _stateID;
  // A destructive pending option resolved by clicking the map arms first: the
  // first click warns, a second click on the same space within ARM_MS resolves.
  const pendingArm = React.useRef<{pending: string; option: string; at: number} | null>(null);
  const feedbackTimers = React.useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  React.useEffect(() => () => {
    for (const timer of feedbackTimers.current) clearTimeout(timer);
    feedbackTimers.current.clear();
  }, []);
  const [toast, setToast] = React.useState<ModelValues["toast"]>(null);
  const dismissToast = React.useCallback(() => setToast(null), []);

  const doAction: DoAction = React.useCallback((fn, describe?: MoveDescription) => {
    // Only the newest control matters: an older probe must not toast after the
    // player has already moved on to another action.
    for (const timer of feedbackTimers.current) clearTimeout(timer);
    feedbackTimers.current.clear();

    const before = latestStateId.current;
    const localBi = (en: string, zh: string) => bi(actualLocale, en, zh);
    try {
      fn();
    } catch (error) {
      // A move that throws synchronously never reached the engine; the console
      // keeps the detail and the notice still explains the refusal.
      console.warn("illegal Imperial Elegy action", error);
      if (describe !== undefined) setToast(refusalNotice(describe, localBi));
      return;
    }
    if (describe === undefined || !canProbeRefusal(before)) return;

    const deadline = Date.now() + feedbackTimeoutMs(hotseat);
    const probe = () => {
      if (!moveWasRefused(before, latestStateId.current)) return;
      if (Date.now() < deadline) {
        const timer = setTimeout(() => {
          feedbackTimers.current.delete(timer);
          probe();
        }, FEEDBACK_POLL_MS);
        feedbackTimers.current.add(timer);
        return;
      }
      // The counter never moved: the engine refused the action.  The toast is
      // polite and self-dismissing, so the map keeps the player's attention.
      setToast(refusalNotice(describe, localBi));
    };
    const timer = setTimeout(() => {
      feedbackTimers.current.delete(timer);
      probe();
    }, FEEDBACK_POLL_MS);
    feedbackTimers.current.add(timer);
  }, [hotseat, actualLocale]);

  // ------------------------------------------------------------------ Rule 34 handover
  // A seat can be handed to the bot, or taken back, at any moment.  The engine
  // move writes the public `G.bots` list, so an online match's server driver
  // picks the change up on its next tick and every board (hotseat included)
  // reads it from that same list.  The local shell also records the choice in
  // its saved seat setup through the context callback.
  //
  // The control is hidden while a decision or battle is open: those are answered
  // through the engine's own gates, and handing a seat over mid-question would
  // leave the question with a controller that cannot see it.
  const handoverBlocked = pending !== null || battle !== null;
  const canHandOverSeat = allowSeatHandover && viewer !== null && !handoverBlocked &&
    typeof moves.setSeatBot === "function";
  const setSeatBot = React.useCallback((bot: boolean) => {
    if (!allowSeatHandover || viewer === null || handoverBlocked || typeof moves.setSeatBot !== "function") return;
    doAction(
      () => moves.setSeatBot(bot),
      {label: bi(actualLocale, bot ? "Hand this seat to the bot" : "Take this seat back", bot ? "交给机器人托管" : "收回席位")},
    );
    botContext?.setSeatBot?.(viewer, bot);
  }, [allowSeatHandover, botContext, viewer, handoverBlocked, moves, doAction, actualLocale]);

    const beginTargeting = React.useRef<(intent: Parameters<typeof interactionPrompt>[0], from: SpaceId, targets: SpaceId[], sources?: string[]) => void>(() => {});
  beginTargeting.current = (intent, from, targets, sources = []) => {
    dispatch({type: "beginTargeting", intent, from, sources, targets});
  };

  // The naval panels keep their select-based form (a keyboard fallback), and
  // add a "pick on the map" path: the same checks decide whether the button is
  // live, but the destination is a ringed space instead of a select value.
  const beginAmphibiousTargeting = React.useCallback(() => {
    if (amphibiousFromValue === "" || amphibiousTargets.length === 0) return;
    beginTargeting.current("amphibious", amphibiousFromValue, amphibiousTargets, amphibiousArmyValue);
  }, [amphibiousFromValue, amphibiousTargets, amphibiousArmyValue]);
  const beginNavalTransportTargeting = React.useCallback(() => {
    if (transportLandValue === "" || transportToValue === "") return;
    beginTargeting.current("navalTransport", transportLandValue, transportTargets,
      [transportLandValue, ...transportFleet]);
  }, [transportLandValue, transportToValue, transportTargets, transportFleet]);
  const beginNavalInterceptTargeting = React.useCallback(() => {
    if (lastNavalBox === null || interceptPortValue === "") return;
    beginTargeting.current("navalIntercept", interceptPortValue, [lastNavalBox]);
  }, [lastNavalBox, interceptPortValue]);

  /** SpacePanel's "in this space" buttons enter targeting; only these clicks
   *  (and never a plain map click) can start a CP-spending action. */
  const setBattleFrom = React.useRef<(id: SpaceId | null) => void>(() => {});
  setBattleFrom.current = (id: SpaceId | null) => {
    if (id === null) { dispatch({type: "cancel"}); return; }
    beginTargeting.current("landBattle", id, enemyLandTargetsFrom(id));
  };
  const setNavalFrom = React.useRef<(id: SpaceId | null) => void>(() => {});
  setNavalFrom.current = (id: SpaceId | null) => {
    if (id === null) { dispatch({type: "cancel"}); return; }
    beginTargeting.current("navalBattle", id, enemyNavalTargetsFrom(id));
  };
  /**
   * The Orders row's "Move selected units…": re-arm the rings for the current
   * selection and hold them open.  Same targets the soft mode computes, but
   * armed (a miss is ignored rather than moving the selection), because the
   * player asked for a move explicitly.
   */
  const startMoveTargeting = React.useCallback(() => {
    if (viewer === null || selectedUnitDef === undefined || !selectedUnitDef.space) return;
    if (!commandsSelected(selectedUnitDef)) return;
    const intents = legalUnitTargets({G, power: viewer, unit: selectedUnitDef, phase});
    if (intents.size === 0) return;
    const byTarget: Record<SpaceId, Parameters<typeof interactionPrompt>[0][]> = {};
    for (const [id, list] of intents) byTarget[id] = list;
    const first = [...intents.values()][0];
    dispatch({
      type: "beginTargeting",
      intent: first[0],
      from: selectedUnitDef.space,
      sources: selectionSources,
      targets: [...intents.keys()],
      byTarget,
    });
    // `commandsSelected` closes over G/phase; the selection is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, phase, viewer, selectedUnitDef, selectionSources]);
  const setSelectedUnit = React.useCallback((id: string | null) => {
    if (id === null) {
      if (interaction.kind === "unit") dispatch({type: "selectSpace", space: interaction.space});
      else if (interaction.kind === "targeting") dispatch({type: "cancel"});
      return;
    }
    if (selected !== null) dispatch({type: "selectUnit", space: selected, unit: id});
  }, [dispatch, interaction, selected]);
  /**
   * Add/remove one unit from the current selection (the space panel's shift-
   * style toggle).  Selecting a whole stack is what makes one click a whole
   * move: 12.15 moves all land units for 1 CP and 16.1 moves the fleet.
   */
  const toggleUnitSelection = React.useCallback((id: string) => {
    if (selected === null) return;
    dispatch({type: "toggleUnit", space: selected, unit: id});
  }, [dispatch, selected]);
  /** Select a whole stack at once (one dispatch; see `SpacePanel`'s note). */
  const selectUnitGroup = React.useCallback((ids: string[]) => {
    if (selected === null || ids.length === 0) return;
    dispatch({type: "selectUnit", space: selected, unit: ids[0], extra: ids.slice(1)});
  }, [dispatch, selected]);
  /**
   * Soft targeting: selecting one of your own units auto-enters targeting when
   * it has at least one legal destination.  The rings appear without a click,
   * and — unlike an armed Orders button — a miss falls back to selecting the
   * clicked space (never to a submission), so the map is forgiving.
   */
  const commandedForSoft = React.useMemo(() => {
    if (viewer === null || interaction.kind !== "unit") return null;
    const unit = G.units[interaction.unit];
    if (unit === undefined || !commandsSelected(unit)) return null;
    return unit;
    // commandsSelected closes over the phase/G; the unit id is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [G, interaction, viewer, phase]);
  React.useEffect(() => {
    if (commandedForSoft === null || viewer === null) return;
    const intents = legalUnitTargets({G, power: viewer, unit: commandedForSoft, phase});
    if (intents.size === 0) return;
    const byTarget: Record<SpaceId, Parameters<typeof interactionPrompt>[0][]> = {};
    for (const [id, list] of intents) byTarget[id] = list;
    const first = [...intents.values()][0];
    dispatch({
      type: "beginTargeting",
      intent: first[0],
      from: commandedForSoft.space ?? "",
      // Every selected unit travels together, so the rings and the eventual
      // submission both describe the stack, not just the clicked unit.
      sources: selectionSources,
      targets: [...intents.keys()],
      soft: true,
      byTarget,
    });
    // Only a new unit selection re-enters soft targeting; a re-render from G
    // must not fight a cancel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  /**
   * Submit the pending targeting action.  This is the ONLY path that spends CP
   * from a map click; every other click just moves the selection.  An
   * out-of-target click is ignored instead of being treated as a confirmation.
   */
  const submitTargeting = (target: SpaceId, override?: Parameters<typeof interactionPrompt>[0]) => {
    if (interaction.kind !== "targeting") return;
    if (!interaction.targets.includes(target)) return;
    const {from, sources} = interaction;
    const intent = override ?? (submitNow(interaction, target) ?? interaction.intent);
    const battleAllowed = phase === "gwManeuver"
      ? canAct && viewer !== null && gwActionAllowance(G, viewer, intent === "navalBattle" ? "naval" : "landBattle").ok
      : canSpend(1);
    if ((intent === "landBattle" || intent === "navalBattle") && !battleAllowed) {
      dispatch({type: "cancel"});
      return;
    }
    const label = (en: string, zh: string) => bi(actualLocale, en, zh);
    switch (intent) {
      case "landBattle":
        doAction(() => moves.landBattle(from, target), {label: label("Land battle", "陆战")});
        break;
      case "navalBattle":
        doAction(() => moves.navalBattle(from, target), {label: label("Naval battle", "海战")});
        break;
      case "redeploy": {
        // The whole selection moves as one action: 12.15 for land units (the
        // action is paid once per impulse) and 16.1 for a fleet, where "all
        // naval units ... may move with one Naval Move action".
        const units = sources.filter((id) => G.units[id] !== undefined);
        if (units.length === 0) break;
        const naval = G.units[units[0]]?.naval === true;
        const count = units.length;
        doAction(
          () => naval ? moves.navalMove(units, target) : moves.redeploy(units, target),
          {label: count > 1 ? label(`Move ${count} units`, `移动 ${count} 个单位`) : label("Move unit", "移动单位")},
        );
        break;
      }
      case "gwMarch":
        if (sources[0]) doAction(() => moves.gwMarch(sources[0], target), {label: label("Great War march", "大战行军")});
        break;
      case "gwRail":
        if (sources[0]) doAction(() => moves.gwRail(sources[0], target), {label: label("Great War rail", "大战铁路")});
        break;
      case "amphibious":
        doAction(() => moves.amphibiousAssault(from, target, sources), {label: label("Amphibious assault", "两栖突击")});
        break;
      case "navalIntercept":
        doAction(() => moves.navalIntercept(from, target), {label: label("Naval interception", "海上拦截")});
        break;
      case "navalTransport":
        if (sources[0]) doAction(() => moves.navalTransport(sources[0], sources.slice(1), target), {label: label("Naval transport", "海上运输")});
        break;
    }
    // Every action, successful or not, leaves targeting: no stale mode can
    // swallow the next map click and silently spend CP again.
    dispatch({type: "commit", space: target});
  };

  const interactionIntents = (state: Extract<typeof interaction, {kind: "targeting"}>, space: SpaceId) =>
    intentsAt(state, space);

  /** Esc from the chooser: back to plain targeting, not out of the mode. */
  const submitChooserCancel = () => {
    if (interaction.kind === "targeting" && interaction.choosing !== undefined) {
      dispatch({type: "beginTargeting", intent: interaction.intent, from: interaction.from,
        sources: interaction.sources, targets: interaction.targets, soft: interaction.soft, byTarget: interaction.byTarget});
    }
  };

  const onSelectImpl = React.useRef<(id: SpaceId) => void>(() => {});
  onSelectImpl.current = (id: SpaceId) => {
    if (interaction.kind === "targeting") {
      const isTarget = interaction.targets.includes(id);
      if (!isTarget && interaction.soft === true) {
        // A soft miss cancels the auto mode and selects what was clicked; a
        // miss while armed is ignored exactly as before.
        dispatch({type: "cancel"});
        dispatch({type: "selectSpace", space: id});
        return;
      }
      if (isTarget && submitNow(interaction, id) === null && interaction.choosing !== id) {
        // Two intents at this destination: ask which one, and spend nothing.
        dispatch({type: "choose", space: id});
        return;
      }
      submitTargeting(id);
      return;
    }
    if (canDecide && pending) {
      const option = pending.options.find((o) => o.id === id && SPACES[o.id]);
      if (option !== undefined) {
        const safety = pendingOptionSafety(pending, option, actualLocale);
        const armed = pendingArm.current;
        const now = Date.now();
        if (confirmActions && safety.confirm && (armed === null || armed.pending !== pending.id || armed.option !== option.id || now - armed.at > ARM_MS)) {
          pendingArm.current = {pending: pending.id, option: option.id, at: now};
          setToast({
            title: bi(actualLocale, "Click the highlighted space again to confirm", "再次点击高亮空间以确认"),
            body: safety.reason,
            tone: "info",
          });
          return;
        }
        pendingArm.current = null;
        doAction(() => moves.resolvePending(id), {label: optionLabel(option)});
        return;
      }
    }
    // Any click that does not repeat the armed space disarms it.
    pendingArm.current = null;
    // A unit stays selected while the space cursor moves, so SpacePanel can
    // offer the explicit "move here" button; the map click itself never moves.
    if (interaction.kind === "unit") {
      dispatch({type: "selectUnit", space: id, unit: interaction.unit});
      return;
    }
    dispatch({type: "selectSpace", space: id});
  };
  const onSelect = React.useCallback((id: SpaceId) => onSelectImpl.current(id), []);

  // Esc leaves targeting (or clears the selection); a single legal target can
  // be confirmed with Enter.  Both keys stand down while a form control has
  // focus so typing in a space picker never fires a battle.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
      const target = event.target as HTMLElement | null;
      if (target && typeof target.closest === "function" &&
        target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])") !== null) return;
      if (event.key === "Escape" || event.key === "Esc") {
        pendingArm.current = null;
        // Ordering matters: the chooser is a targeting sub-mode, so it must be
        // tested before the generic cancel.  Esc with the chooser open closes
        // only the chooser (the rings stay up); the next Esc cancels targeting.
        if (interaction.kind === "targeting" && interaction.choosing !== undefined) {
          event.preventDefault();
          submitChooserCancel();
          return;
        }
        if (interaction.kind === "targeting" || interaction.kind === "unit" || interaction.kind === "space") {
          event.preventDefault();
          dispatch({type: "cancel"});
        }
        return;
      }
      if ((event.key === "Enter" || event.key === "Return") && interaction.kind === "targeting" && interaction.targets.length === 1) {
        event.preventDefault();
        submitTargeting(interaction.targets[0]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  // submitTargeting intentionally closes over the current targeting state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interaction, dispatch]);

  const pendingKindLabels = t.pendingKind as unknown as Record<string, string>;
  const pendingKind = pending ? pendingKindLabels[pending.kind] ?? t.pendingDecision : null;
  // A prompt the engine assembled from state carries its own Chinese wording
  // (`promptZh`); a fixed one comes from the board's table, and anything
  // unlisted stays as the engine wrote it rather than showing a blank line.
  const pendingPrompt = pending === null
    ? ""
    : actualLocale === "zh_CN"
      ? pending.promptZh ?? PROMPT_ZH[pending.prompt] ?? pending.prompt
      : pending.prompt;
  /** The card id an option names, from `data.card` or a `card:<id>[:mode]` id. */
  const optionCardId = (o: PendingOption): string | null => {
    const data = o.data?.card;
    if (typeof data === "string" && CARD_BY_ID[data]) return data;
    if (o.id.startsWith("card:")) {
      const card = o.id.split(":")[1];
      if (card && CARD_BY_ID[card]) return card;
    }
    if (o.label.startsWith("Play ") && CARD_BY_ID[o.label.slice(5)]) return o.label.slice(5);
    return null;
  };
  const optionLabel = (o: PendingOption): string => {
    // `playerView` already clears the options of a decision that is not ours.
    // The extra mask is a safety net for any caller that renders raw state;
    // the deciding seat must still read its own face-down bid card.
    if (o.secret && (viewer === null || pending === null || pending.power !== viewer)) return t.hidden;
    if (actualLocale === "zh_CN" && o.labelZh !== undefined && o.labelZh !== "") return o.labelZh;
    if (o.id === "done") return o.label === "No more support" ? bi(actualLocale, "No more support", "不再支援") : t.skip;
    const optionCard = typeof o.data?.card === "string" ? o.data.card : null;
    if (optionCard && CARD_BY_ID[optionCard]) {
      const c = CARD_BY_ID[optionCard];
      const title = cardDisplayName(c, actualLocale);
      // Only the combat discard window spends the card; an auction bids with it.
      return pending?.kind === "combatDiscard" ? `${title} (${bi(actualLocale, "discard", "弃牌")})` : title;
    }
    if (o.id.startsWith("battle:") || o.id.startsWith("move:")) {
      const target = o.id.slice(o.id.indexOf(":") + 1);
      if (SPACES[target]) {
        const prefix = o.id.startsWith("battle:")
          ? bi(actualLocale, "Another battle", "再战")
          : bi(actualLocale, "Move one space", "移动一格");
        return `${prefix}: ${spaceLabel(target, actualLocale)}`;
      }
    }
    if (SPACES[o.id]) return spaceLabel(o.id, actualLocale);
    if (G.units[o.id]) return unitLabel(G.units[o.id], t, actualLocale);
    if (o.label.startsWith("Play ") && CARD_BY_ID[o.label.slice(5)]) {
      const c = CARD_BY_ID[o.label.slice(5)];
      return `${t.cardType.combat}: ${cardDisplayName(c, actualLocale)}`;
    }
    return actualLocale === "zh_CN" ? OPTION_ZH[o.label] ?? o.label : o.label;
  };
  /**
   * A pending option that names a card or a National Goal shows its printed
   * face, so "pick a card" decisions do not degrade to title-only buttons.
   * A face-down auction bid keeps its face private until the auction reveals.
   */
  const optionFace = (o: PendingOption): CardChoiceFace | null => {
    if (o.secret && (viewer === null || pending === null || pending.power !== viewer)) return null;
    const card = optionCardId(o);
    if (card !== null) return {card: CARD_BY_ID[card]};
    const goal = GOALS_BY_ID[o.id];
    return goal ? {goal} : null;
  };
  /** Action label under a card face: the face already prints the title. */
  const optionAction = (o: PendingOption): string => {
    if (pending?.kind === "combatCard") return bi(actualLocale, "Play this card", "打出此牌");
    if (pending?.kind === "combatDiscard") return bi(actualLocale, "Discard this card", "弃置此牌");
    if (pending?.kind === "goalChoice") return bi(actualLocale, "Keep this Goal", "保留此目标");
    if (o.id.startsWith("card:")) return bi(actualLocale, "Bid with this card", "以此牌竞价");
    return bi(actualLocale, "Choose", "选择");
  };
  // A decision that prints its own "decline" option (13.4.2's aid search, most
  // pending windows) must not also get the generic one: the panel would show
  // two identical 拒绝 buttons whose only difference is the option id.
  const canDecline = canDecide && pending !== null && !pendingDeclinesItself(pending) && !MANDATORY_PENDING_KINDS.has(pending.kind) && pending.kind !== "combatLosses" && pending.kind !== "combatCard" && pending.kind !== "combatDiscard" && pending.kind !== "decisiveBattle";

  // Only the rungs `WarState.status` actually holds; `shift`, `initiative` and
  // `demobilization` are printed steps the engine resolves inside the alliance
  // and victory steps, so they are not war statuses here.
  const warStatusLabels: Record<string, string> = {
    warAim: t.warAim,
    alliance: t.warAlliance,
    maneuver: t.warManeuver,
    victory: t.warVictory,
    done: t.done,
  };
  const warStatusLabel = war ? warStatusLabels[war.status] ?? war.status : "";
  const warAimLabel = (aim: string | null): string =>
    aim === "conquest" ? t.conquest : aim === "liberation" ? t.liberation : aim === "unification" ? t.unification : "—";
  const callableAllies = war && viewer !== null && war.forbidPlayerJoins !== true
    ? POWER_KEYS.filter((p) => p !== viewer && !warBelligerents.includes(p) && (handCounts[p] ?? G.powers[p].hand.length) > 0)
    : [];
  const warAllyValue = callableAllies.includes(warAlly) ? warAlly : callableAllies[0];
  const callableMinors = war && viewer !== null && (viewer === war.attacker || viewer === war.defender)
    ? [
      // 14.0: "all minor power allies, and a unified Italy, join the war at
      // the primary belligerent's discretion."  Italy is a non-player major
      // with no `MINOR_POWER_HOMES` row, so it is offered explicitly.
      ...(G.persistent.italyUnified === true &&
        minorWarAlly(G, "Italy") === viewer &&
        !war.attackerMinors.includes("Italy") &&
        !war.defenderMinors.includes("Italy")
        ? ["Italy"]
        : []),
      ...minorAlliesOf(G, viewer).filter((minor) =>
        MINOR_POWER_HOMES[minor] !== undefined &&
        !war.attackerMinors.includes(minor) &&
        !war.defenderMinors.includes(minor)),
    ]
    : [];
  const warMinorValue = pickActionTarget(warMinor, callableMinors, callableMinors);
  const warBudgetRows = war
    ? [...new Set([war.attacker, war.defender, ...war.attackerAllies, ...war.defenderAllies])].filter(isPowerKey)
    : [];
  const warDefenderMinors = war
    ? [...new Set(war.defenderMinors.filter((m) => m !== war.defender && m !== loneMinorDefender(war)))]
    : [];
  const minorMarkerRows = Object.entries(G.minorCardMarkers ?? {})
    .filter(([, count]) => count !== 0)
    .sort(([a], [b]) => a.localeCompare(b));

  // A home-card event (Bismarck, Aux Armes, Russo-Turkish Wars, Jihad) may
  // leave a war declaration to be made in this impulse; it funds the
  // declaration with the card's CP and carries its own aim/target limits.  The
  // choices themselves live in `WarDeclarationPanel`; the model only needs the
  // entitlement to badge the War tab and to bring it to the front once.
  const warEntitlement = viewer !== null ? warDeclarationEntitlement(G, viewer) : null;
  const declarationWaiting = canActionCard && war === null && warEntitlement !== null;
  // A card that leaves a declaration open brings the War panel to the front
  // once, exactly as a war starting does: the declaration is completed there,
  // so the player should not have to find the tab after playing Bismarck.
  const declarationWasWaiting = React.useRef(false);
  React.useEffect(() => {
    if (declarationWaiting && !declarationWasWaiting.current) {
      setRailTab("war");
      setMobileTab("war");
      if (isPhone) {
        setTrayOpen(true);
        setTrayExpanded(false);
      }
    }
    declarationWasWaiting.current = declarationWaiting;
  }, [declarationWaiting, isPhone]);

  const gwOrderPowers = gw
    ? gw.order.map((slot) => (isPowerKey(slot) ? slot : null)).filter((p): p is Power => p !== null)
    : [];
  const gwBudgetOrder = [...new Set([...gwOrderPowers, ...POWER_KEYS])];
  const gwSlotLabel = (slot: Power | "bonus" | "IT" | "US" | null): string => {
    if (slot === null) return "—";
    if (slot === "bonus") return bi(actualLocale, "Bonus", "奖励");
    if (isPowerKey(slot)) return t.seats[slot];
    if (slot === "IT") {
      return isIndependentItaly(G) ? bi(actualLocale, "Italy (its own)", "意大利（自主）") : bi(actualLocale, "Italy", "意大利");
    }
    return bi(actualLocale, "US", "美国");
  };
  const italyBox = italyAllianceBox(G);
  const italySide = italyAllianceSide(G);
  const italyBoxLabel = italyBox === "neutral"
    ? bi(actualLocale, "neutral box", "中立框")
    : `${italySide === "te" ? "TE" : "TA"} ${italyBox.endsWith("Committed") ? bi(actualLocale, "committed", "承诺框") : bi(actualLocale, "aligned", "倾向框")}`;
  const italyShowing = G.persistent.italyUnified === true && gw !== undefined;
  const italyHow = italyBox === "neutral"
    ? bi(actualLocale, "stays out of the war (25.3)", "不参战（25.3）")
    : italyBox.endsWith("Committed")
      ? bi(actualLocale, "joins automatically at the outbreak (25.3)", "大战爆发时自动参战（25.3）")
      : bi(actualLocale, "roll 4–6 at the outbreak, else back to neutral (25.3)", "爆发时掷 4–6 参战，否则退回中立（25.3）");
  // 27.5.2: the row must ask the same question the move asks.  A full home
  // key and an exhausted army-counter pool both used to leave the Draft row
  // enabled, and the engine then refused it with no visible reason.
  const gwDraftProblemFor = selected !== null && viewer !== null
    ? gwDraftProblem(G, viewer, selected)
    : null;
  const canGwDraft = selected !== null && viewer !== null && me !== null && phase === "gwManeuver" && isActive && pending === null && !eliminated && gwActionAllowance(G, viewer, "draft").ok && me.manpower >= 1 && gwDraftProblemFor === null;
  const gwDeployRoom = selected !== null && selectedState !== null && selectedState !== undefined
    ? Math.max(0, landStackingLimit(selected) - landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length)
    : 0;
  const canGwDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState && phase === "gwManeuver" &&
    isActive && pending === null && !eliminated && gwActionAllowance(G, viewer, "deploy").ok && me.reserves.length > 0 &&
    gwDeployRoom > 0 && !isNavalBox(selected) && friendlySpace(G, selected, viewer) &&
    (isHomeSpace(G, selected, viewer) || ownsKey(G, selected, viewer)) && !selectedState.trench,
  );
  const gwSideAllies: Power[] = viewer === null || !gw
    ? []
    : (gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [])
        .filter((power) => power !== viewer && G.powers[power]?.eliminated !== true);
  const gwTransferToValue: string = gwSideAllies.includes(gwTransferTo as Power)
    ? (gwTransferTo as Power)
    : gwSideAllies[0] ?? "";
  const gwTransferAmountValue = 1;
  const canGwTransfer = Boolean(
    viewer !== null && me !== null && gw !== null && phase === "gwPlanning" && isActive && pending === null &&
    !eliminated && gwTransferToValue !== "" && gwTransferAmountValue <= (me.gwBudget ?? 0) &&
    me.flags.gwCpTransferDone !== true,
  );
  const gwJointNavalAllies: Power[] = (() => {
    if (viewer === null || !gw || phase !== "gwManeuver" || !selectedUnitDef || !selectedUnitDef.naval ||
      selectedUnitDef.owner !== viewer || !selectedUnitDef.space) return [];
    const side = gw.te.includes(viewer) ? gw.te : gw.ta.includes(viewer) ? gw.ta : [];
    return side.filter((ally) =>
      ally !== viewer &&
      G.powers[ally]?.eliminated !== true &&
      navalUnitsIn(G, selectedUnitDef.space!).some((unit) => unit.owner === ally),
    );
  })();
  const gwJointNavalUnitIds = (ally: Power): string[] =>
    selectedUnitDef?.space
      ? navalUnitsIn(G, selectedUnitDef.space).filter((unit) => unit.owner === ally).map((unit) => unit.id)
      : [];
  const gwCardId = me?.gwCard === undefined || me?.gwCard === null ? "" : String(me.gwCard);
  const gwCombatCardHeld = ["IE-GW-03", "IE-GW-04", "IE-GW-06"].includes(gwCardId);
  const gwCardAlreadyFaceup = gwCombatCardHeld && String(me?.flags.gwFaceupCombat ?? "").includes(gwCardId);
  const canGwReveal = Boolean(
    viewer !== null && !eliminated && pending === null && me !== null && gwCombatCardHeld && !gwCardAlreadyFaceup &&
    (phase === "gwPlanning" || phase === "gwManeuver"),
  );
  const deployFree = viewer !== null && phase === "wartime" && (
    rapidMobilizationFreeDeploy(G, viewer, war) || superiorStaffWorkFreeDeploy(G, viewer, war)
  );
  const deployLimit = viewer !== null ? deployReserveLimit(G, viewer, war) : 0;
  const deployRoom = selected !== null
    ? Math.max(0, landStackingLimit(selected) - (selectedState ? landUnitsIn(G, selected).filter((u) => isArmyKind(u.kind)).length : 0))
    : 0;
  const canDeployHere = Boolean(
    viewer !== null && me !== null && selected !== null && selectedState &&
    phase === "wartime" && isActive && pending === null && !eliminated &&
    me.reserves.length > 0 && deployRoom > 0 && deployLimit > 0 &&
    (deployFree || cpBudget() >= 1) &&
    SPACES[selected]?.submap === "main" &&
    (selectedState.control === viewer || selectedState.occupiedBy === viewer) &&
    hasLoc(G, viewer, selected, {landOnly: true}),
  );

  const homeCardTitle = (id: string): string => {
    const card = CARD_BY_ID[id];
    return card ? cardDisplayName(card, actualLocale) : id;
  };
  const saveList = String(me?.flags.savedCards ?? "").split(",").filter(Boolean);
  const ngChoices = String(me?.flags.ngChoices ?? "").split(",").filter(Boolean);
  // 11.0/11.1: the negotiation table as this seat sees it (already redacted by
  // `playerView`).  `shownCards` are this seat's own shows, `cardsShownToMe` the
  // private ones addressed to it, and `deals` the two-sided offers.
  const deals = G.negotiation ?? {offers: [], history: [], shown: [], nextId: 1};
  const shownCards = deals.shown.filter((entry) => entry.from === viewer).map((entry) => entry.card);
  const cardsShownToMe = viewer === null
    ? []
    : deals.shown.filter((entry) => entry.to === viewer).map((entry) => ({card: entry.card, from: entry.from}));
  // 11.0/11.1: the deals page exists for a seated power in the diplomacy phase.
  const diplomacyPhase = phase === "diplomacy";
  const dealsVisible = diplomacyPhase && viewer !== null && !eliminated;
  // 8.0's marker is a 12.1 peacetime action: 15.2 and 27.5 replace the action
  // list, and the outbreak resolves the Alliance Track into `G.gw`'s rosters,
  // so the matrix has nothing left to place and nothing left to read.
  const influenceVisible = G.gw?.active !== true;
  React.useEffect(() => {
    if (!influenceVisible && ordersTab === "influence") setOrdersTab("actions");
  }, [influenceVisible, ordersTab]);
  const myDealOffers = viewer === null ? [] : deals.offers;
  const pendingDeals = myDealOffers.filter((offer) => offer.status === "proposed" && offer.to === viewer);
  // An offer addressed to this seat is something to answer, so its page comes
  // to the front; leaving diplomacy drops it like the naval page does.
  const dealWasPending = React.useRef(pendingDeals.length > 0);
  React.useEffect(() => {
    if (pendingDeals.length > 0 && !dealWasPending.current) setOrdersTab("deals");
    else if (!dealsVisible && ordersTab === "deals") setOrdersTab("actions");
    dealWasPending.current = pendingDeals.length > 0;
  }, [pendingDeals.length, dealsVisible, ordersTab]);
  // 9.1 puts the negotiation segment first, so the diplomacy step brings the
  // table to the front once — also when the board mounts straight into it (a
  // resumed save).  Without this the seat landed on the actions page and had to
  // know the Deals page existed before it could talk.
  const phaseWasDiplomacy = React.useRef(false);
  React.useEffect(() => {
    if (diplomacyPhase && !phaseWasDiplomacy.current && dealsVisible) setOrdersTab("deals");
    phaseWasDiplomacy.current = diplomacyPhase;
  }, [diplomacyPhase, dealsVisible]);

  const responseInHand = hand.some((id) => cardById(id).type === "response");
  const responseWindow = viewer !== null && responseInHand &&
    hand.some((id) => cardById(id).type === "response" && responseCardEligibility(G, viewer, id).ok);

  const chainInfo = viewer !== null && me !== null ? cpChainResolution(G, viewer) : null;
  const chainUsed = G.flags.cpChainSpent === true;
  const chainNonEmpty = me !== null && me.cpChain.length > 0;
  const chainReady = viewer !== null && me !== null && !eliminated && isActive && phase === "action" &&
    pending === null && G.cpRemaining === 0 && chainNonEmpty && !chainUsed && (chainInfo?.cpSpendable ?? 0) > 0;
  const chainSpendable = chainInfo?.cpSpendable ?? 0;
  const chainCap = chainInfo?.singleActionCap ?? 4;
  const chainDisabledReason = chainReady ? undefined
    : !chainNonEmpty ? bi(actualLocale, "No cards in the CP chain.", "CP 链中没有牌。")
      : chainUsed ? bi(actualLocale, "Already used this action phase.", "本行动阶段已使用。")
        : phase !== "action" ? bi(actualLocale, "Only usable during the action phase.", "仅在行动阶段可用。")
          : !isActive || eliminated ? bi(actualLocale, "Only the active power can use its CP chain.", "仅当前行动国家可使用 CP 链。")
            : pending !== null ? bi(actualLocale, "Resolve the pending decision first.", "请先处理待决事项。")
              : G.cpRemaining > 0 ? bi(actualLocale, "Finish this impulse first; the chain starts a fresh one.", "请先结束本次行动；CP 链需从新的行动开始。")
                : chainSpendable <= 0 ? bi(actualLocale, "The chained cards have no CP.", "CP 链中的牌没有 CP。")
                  : bi(actualLocale, "Not available now.", "当前不可用。");
  // A battle selection needs a click on the map. Show that instruction in the
  // pinned dock too, so the player never has to scroll back to the SpacePanel
  // to learn that the map is waiting for a target.
  const targetingHint: {title: string; body: string; cancel: () => void} | null = battleFrom !== null
    ? {
        title: bi(actualLocale, "Choose a battle target", "选择战斗目标"),
        body: bi(actualLocale,
          `From ${spaceLabel(battleFrom, actualLocale)}: click a highlighted adjacent space on the map.`,
          `从${spaceLabel(battleFrom, actualLocale)}出击：在地图上点击高亮的相邻空间。`),
        cancel: () => dispatch({type: "cancel"}),
      }
    : navalFrom !== null
      ? {
          title: bi(actualLocale, "Choose a naval battle space", "选择海战海域"),
          body: bi(actualLocale,
            `From ${spaceLabel(navalFrom, actualLocale)}: click a highlighted adjacent sea space on the map.`,
            `从${spaceLabel(navalFrom, actualLocale)}出击：在地图上点击高亮的相邻海域。`),
          cancel: () => dispatch({type: "cancel"}),
        }
      : null;
  // Card choices that the rules require now (home card, National Goal, the prep
  // stability discard) join the same pinned dock, so a tall map or a long hand
  // cannot hide them. HandPanel only shows a pointer.
  const choicesProps = {
    viewer, me, locale: actualLocale, t, phase, canPhaseAct, hand, ngChoices,
    // 9.1: the home-card faces are not offered while the table is still
    // negotiating, so the inline fallback (a decision owns the board) cannot
    // become a second, premature home-card entry.
    homeReady: negotiationConcludedNow,
    doAction, moves,
  };
  const choiceKinds = handChoiceAvailability(choicesProps);
  // A decision this seat owes opens the panel by itself; the reader can close
  // it again without dismissing the decision.
  const pendingId = pending?.id ?? null;
  const battleKey = battle === null ? null : `${battle.kind}:${battle.to}:${battle.stage}`;
  React.useEffect(() => {
    if (pendingId !== null || battleKey !== null) setPanelOpen(true);
  }, [pendingId, battleKey]);

  const dockChoices = choiceKinds.required || choiceKinds.optional;
  // The home card is a required choice, but it is no longer a blocker that
  // covers the table the moment diplomacy opens: 9.1's negotiation segment
  // comes first, and the seat opens the dialog from the dock when it is done.
  // `choiceKinds.required` still reports the outstanding choice, so the dock's
  // summary and the hand tray's pointer stay truthful.  Only the seat whose
  // diplomacy turn it is may choose (the printed order advances after each
  // pick), so the dock reports it only there.
  const homeChoice = phase === "diplomacy" && choiceKinds.required && canPhaseAct && negotiationConcludedNow;
  const goalChoice = phase === "end" && choiceKinds.required;
  // Choosing the card (or leaving the phase) closes the dialog; the state only
  // ever means "the reader asked to see the choice".
  React.useEffect(() => {
    if (!homeChoice) setHomeCardDialogOpen(false);
  }, [homeChoice]);
  // The dock also carries the phase buttons now, so it must render whenever
  // there is something to press — not only when a decision is pending.
  const dockVisible = pending !== null || battle !== null || G.result !== null ||
    targetingHint !== null || dockChoices || phaseActions.length > 0;
  // A088 / UK-3: a printed free-CP grant is still this impulse's budget even
  // though the wallet (`cpBudgetFor`) reads 0.  The dock says so, and the
  // impulse stays open until the seat spends the grant or hands it over.
  const freeGrantTotal = viewer === null
    ? 0
    : freeGrantCp(G, viewer, "freeColonialCp") + freeGrantCp(G, viewer, "freeOperationCp") + freeGrantCp(G, viewer, "freeIndianCp");
  const dockSummary = pending !== null
    ? canDecide
      ? t.yourDecision
      : decidingText(t.seats[pending.power], actualLocale)
    : battle !== null
      ? bi(actualLocale, battle.kind === "naval" ? "Naval battle" : "Land battle", battle.kind === "naval" ? "海战" : "陆战")
      : G.result !== null
        ? t.gameOver
        : targetingHint !== null
          ? targetingHint.title
          : choiceKinds.required && homeChoice
            // 9.1/11.0: the negotiation segment comes before the home card, so
            // this reads as the step still owed, not as a dialog covering the
            // table.
            ? bi(actualLocale, "Home card not chosen yet", "尚未选择本土牌")
            : phase === "diplomacy" && homeCardChoicePending && !negotiationConcludedNow
              // 9.1: the home card is not refused to the seat, it is simply
              // not its step yet — the whole table is still negotiating.
              ? bi(actualLocale, "Negotiations in progress", "谈判进行中")
              : choiceKinds.required && goalChoice
                ? bi(actualLocale, "Required card choice", "需要选择卡牌")
                : choiceKinds.optional
                  // An optional action must not read as a blocker.
                  ? bi(actualLocale, "Optional: discard a random card for stability", "可选：随机弃牌换稳定")
                  // 26.0/27.1: the Great War's own "what now".  A bare "your
                  // impulse" leaves a player who only reads the dock without
                  // the printed budget and pass rules, which is what made the
                  // maneuver feel stalled after one action.
                  : phase === "gwPlanning"
                    ? bi(actualLocale, "GW planning — cards and war budgets are dealt; start the maneuver", "大战计划——大战卡与战争预算已发放；开始机动")
                    : phase === "gwManeuver"
                      ? !isActive
                        ? bi(actualLocale, "Waiting", "等待")
                        : gwImpulseProblem === "mustAct"
                          ? bi(actualLocale,
                            `Your impulse — spend 1 war-budget CP on an action (budget ${viewer !== null ? cpBudget() : 0}); you may pass only at 2 or less`,
                            `你的行动轮——需用 1 点战争预算执行行动（余额 ${viewer !== null ? cpBudget() : 0}）；预算 ≤2 才能停牌`)
                          : gwImpulseProblem === "exhaustion"
                            ? bi(actualLocale, "Play Exhaustion before passing", "停牌前必须打出“精疲力竭”")
                            : gwImpulseProblem === "bonusPending"
                              ? bi(actualLocale, "GW card bonus — take one immediate non-land-battle action", "大战卡奖励——立刻执行一次非陆战行动")
                            : gwImpulseActed
                              ? bi(actualLocale, "Action done — end your impulse", "行动已完成——结束行动轮")
                              : bi(actualLocale,
                                `Your impulse — click a space, then an action (1 CP of a ${viewer !== null ? cpBudget() : 0} budget)`,
                                `你的行动轮——点击空间再选行动（战争预算 ${viewer !== null ? cpBudget() : 0}，每次 1 CP）`)
                      : phase === "gwWinter"
                        ? bi(actualLocale, "Winter resolves automatically", "冬季自动结算")
                        : canAct
                    ? freeGrantTotal > 0
                      ? bi(actualLocale,
                        `Your impulse — ${freeGrantTotal} event CP still to spend`,
                        `你的行动轮——还有 ${freeGrantTotal} 点事件赠予 CP 可花`)
                      : bi(actualLocale, "Your impulse", "你的行动轮")
                    : bi(actualLocale, "Waiting", "等待");
  // The summary names the rule; these lines name the control that performs it,
  // so a player who only reads the board is never left guessing which button
  // the printed step means (the solo Historical Great War stalled there).
  const dockNextSteps = actionHints(G, viewer, actualLocale, t);
  const handChoicesHint = phase === "diplomacy" && homeCardChoicePending && !negotiationConcludedNow
    ? bi(actualLocale,
      "Finish negotiating first: every seat must press \"Finish negotiating\", then the home-card choice opens.",
      "先结束谈判：所有席位都点击“结束谈判”后，才会开放本土牌选择。")
    : homeChoice
      ? bi(actualLocale,
        "Negotiations are over — open the home-card choice from the Orders dock or the Deals page.",
        "谈判已结束——从指令区按钮或谈判桌打开本土牌选择。")
      : goalChoice
        ? bi(actualLocale, "The National Goal choice is in the dialog over the board.", "国家目标选择在覆盖面板的对话框中。")
        : choiceKinds.optional
          ? bi(actualLocale, "An optional random discard for +1 stability is at the top of the Orders actions.", "可选随机弃牌换 +1 稳定位于指令面板行动页顶部。")
          : null;
  const mapHint = pendingSpaceTargets.length > 0
    ? bi(actualLocale, "Click a highlighted space to answer the pending decision.", "点击高亮空间以完成待决事项。")
    : battleFrom !== null
      ? bi(actualLocale, "Click a highlighted adjacent space to attack it.", "点击高亮的相邻空间发动进攻。")
      : navalFrom !== null
        ? bi(actualLocale, "Click a highlighted adjacent sea space to fight there.", "点击高亮的相邻海域发动海战。")
        : selectedUnitDef
          // The map click only moves the *cursor*: with a unit selected it
          // selects the destination and SpacePanel offers the explicit move
          // row.  The old wording said the click itself moved the unit, so a
          // player who followed it saw nothing happen (reported while playing
          // the Historical Great War).
          ? phase === "gwManeuver"
            ? bi(actualLocale,
              "Click a highlighted space, then press \"March here\" in Orders.",
              "点击高亮空间，再在指令面板点击“行军至此”。")
            : bi(actualLocale,
              "Click a highlighted space, then press \"Move selected units…\" in Orders.",
              "点击高亮空间，再在指令面板点击“移动所选单位…”。")
          : bi(actualLocale, "Click a space; select one of your units to see its legal moves.", "点击空间；选择己方单位以查看合法移动。");

  // The map draws one ring per target with the style that explains it: an
  // ordered targeting mode owns the map, and the pending decision's spaces
  // stay visible underneath so a decision can always be answered by clicking.
  const mapTargets: MapTarget[] = (() => {
    const out: MapTarget[] = [];
    const seen = new Set<SpaceId>();
    const add = (id: SpaceId, style: MapTarget["style"]) => {
      if (seen.has(id)) return;
      seen.add(id);
      out.push({id, style});
    };
    if (targeting !== null) {
      for (const target of targeting.targets) {
        add(target, targeting.intent === "landBattle" || targeting.intent === "navalBattle"
          ? "attack"
          : targeting.intent === "gwRail" ? "rail"
            : targeting.intent === "gwMarch" ? "move"
              : "choice");
      }
    }
    // Soft targeting from a unit selection: one ring per legal destination,
    // styled by what a click would try (a chooser point is gold).
    for (const [id, list] of unitIntents) {
      if (targeting === null || targeting.soft !== true) add(id, intentStyle(list));
    }
    for (const target of pendingSpaceTargets) add(target, "pending");
    return out;
  })();
  const isCurrentSeat = !hotseat || seatUi.currentSeat === viewer;
  const otherSeatPending = hotseat && isCurrentSeat && pending !== null && viewer !== null &&
    pending.power !== viewer && seatUi.onSwitchSeat !== undefined;
  const modePill = targeting !== null ? {
    label: interactionPrompt(targeting.intent, actualLocale),
    from: spaceLabel(targeting.from, actualLocale),
    count: targeting.targets.length,
    cancelLabel: t.cancel,
    onCancel: () => dispatch({type: "cancel"}),
    targets: targeting.targets.map((id) => ({id, label: spaceLabel(id, actualLocale)})),
    onChoose: (id: SpaceId) => submitTargeting(id),
  } : null;

  // The reference drawer is opened from the track strip, the mat and the
  // menus; one stable callback keeps those regions free of their own state.
  const [refAnchor, setRefAnchor] = React.useState<string | null>(null);
  const onOpenReference = React.useCallback((anchor: string) => setRefAnchor(anchor), []);

  const raw = {
    toast,
    dismissToast,
    modePill,
    mapLegalTargets: mapTargets.filter((target) => target.style === "pending").map((target) => target.id),
    mapBattleTargets: mapTargets.filter((target) => target.style === "attack").map((target) => target.id),
    mapTargets,
    // The ring the map paints brightest: the chooser's destination, else the
    // keyboard's focus, else nothing.
    mapFocusedTarget: targeting !== null && targeting.choosing !== undefined ? targeting.choosing : null,
    chooser: targeting !== null && targeting.choosing !== undefined
      ? {
          target: targeting.choosing,
          targetLabel: spaceLabel(targeting.choosing, actualLocale),
          intents: interactionIntents(targeting, targeting.choosing),
          onChoose: (intent: Parameters<typeof interactionPrompt>[0]) => submitTargeting(targeting.choosing!, intent),
          // Esc / "Cancel" closes the chooser and leaves the rings up.
          onCancel: () => submitChooserCancel(),
        }
      : null,
    isCurrentSeat,
    otherSeatPending,
    G,
    ctx,
    moves,
    playerID,
    hotseat,
    t,
    actualLocale,
    decade,
    viewer,
    selected,
    selectedUnit,
    selectedUnitIds: selectionSources,
    toggleUnitSelection,
    selectUnitGroup,
    startMoveTargeting,
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
    canHandOverSeat,
    setSeatBot,
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
    actedThisImpulse,
    passBlocked,
    passBlockedTitle,
    hasPhaseButtons,
    phaseActions,
    nationalActionPhase,
    auRightsEligible,
    auReformValue,
    auReformDecision,
    auCitizenEligible,
    auCitizenValue,
    auCitizenDecision,
    auCitizenRoll,
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
    beginAmphibiousTargeting,
    beginNavalTransportTargeting,
    beginNavalInterceptTargeting,
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
    confirmActions,
    setConfirmActions,
    trenchRows: trenchRows(G),
    declarationWaiting,
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
    shownCards,
    cardsShownToMe,
    deals,
    dealsVisible,
    influenceVisible,
    pendingDeals,
    myDealOffers,
    dealTarget,
    setDealTarget,
    dealGive,
    setDealGive,
    dealTake,
    setDealTake,
    dealPromises,
    setDealPromises,
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
    homeChoice,
    goalChoice,
    homeCardDialogOpen,
    setHomeCardDialogOpen,
    dockChoices,
    dockVisible,
    dockSummary,
    dockNextSteps,
    handChoicesHint,
    mapHint,
    board,
    setBoard,
    railTab,
    setRailTab,
    ordersTab,
    setOrdersTab,
    navalVisible,
    railOpen,
    setRailOpen,
    narrow,
    warAlly,
    setWarAlly,
    warMinor,
    setWarMinor,
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
    isPhone,
    mobileTab,
    setMobileTab,
    trayOpen,
    setTrayOpen,
    trayExpanded,
    setTrayExpanded,
    cardFaceMode,
    setCardFaceMode,
    expandHand,
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
    refAnchor,
    setRefAnchor,
    panelOpen,
    setPanelOpen,
  };
  const values = raw as unknown as ModelValues;
  // The hand slice keeps the tray's controlled three-position state under the
  // names HandTray already uses; `trayOpen`/`trayExpanded` stay in the bag.
  // The layout reads `locale`, while the hook's own bag only has
  // `actualLocale`; the slices need the alias too, or a region that forwards
  // it (the hand tray) silently falls back to English.
  const withTray = {
    ...values,
    locale: values.actualLocale as "en" | "zh_CN",
    expandAll: expandHand,
    open: trayOpen,
    onToggleOpen: () => setTrayOpen((value) => !value),
    expanded: trayExpanded,
    onToggleExpanded: () => setTrayExpanded((value) => !value),
  } as unknown as ModelValues;
  return {
    ...raw,
    locale: values.actualLocale as "en" | "zh_CN",
    ...sliceModel(withTray),
    hand: sliceModel(withTray).hand,
    onOpenReference,
    toast,
    dismissToast,
  };
};

export type BoardModel = ReturnType<typeof useBoardModel> & BoardSlices;

/** The board's props, with the test seam narrowed to production types. */
export type BoardProps = Omit<BoardModelProps, "injectedUi">;

/**
 * The board with its hooks, for hosts that can run effects (local.tsx, online
 * play).  It is `React.memo`ed on the props it reads so a parent re-render (the
 * hotseat shell's snapshot update) cannot restart a bot's auto-submit timer.
 */
export const HostLayout = React.memo(({injectedUi: _injectedUi, ...props}: BoardModelProps & {injectedUi?: undefined}) => {
  const model = useBoardModel(props);
  return React.createElement(BoardLayout, {model});
});

