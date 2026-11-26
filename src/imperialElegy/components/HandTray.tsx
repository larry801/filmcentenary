import React from "react";
import {Icon} from "./Icon";
import {ImperialElegyState, Power, POWERS} from "../types";
import {CardDef} from "../constant/cards";
import {GoalDef} from "../constant/goals";
import {GOALS_BY_ID} from "../constant/goals";
import {cardById} from "../engine/deck";
import {IEChip} from "./theme";
import {ieT} from "./i18n";
import {RESPONSE_REASON_TEXT, bi, gwImpulseReasonText} from "./boardHelpers";
import {gwCardProblem} from "../engine/gwImpulse";
import {CardFace} from "./CardFace";
import {CardInspector} from "./CardInspector";
import {Modal} from "./Modal";
import {CardChoiceFace} from "./CardChoice";
import {CardFaceMode, cardImageSrc, readConfirmActions} from "./preferences";
import {RuleLink} from "./RuleRef";
import {ConfirmButton} from "./ConfirmButton";
import {cardAvailability, cardTypeIcon, type CardAvailability} from "./cardAvailability";
import {cardDisplayName, pinHomeCards} from "./cardDisplay";

export interface HandTrayProps {
  /** Live `confirmActions` preference (the Display menu writes it). */
  confirmActions?: boolean;
  /**
   * The desktop card strip: one line per card, its two printed plays in place,
   * everything else in the inspector.  Off for the static suites, which want
   * the whole operation list on the row.
   */
  compact?: boolean;
  G: ImperialElegyState;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  phase: string;
  isActive: boolean;
  eliminated: boolean;
  pending: ImperialElegyState["pending"];
  canActionCard: boolean;
  isBelligerent: boolean;
  war: ImperialElegyState["war"];
  forcedCardIds: string[];
  hand: string[];
  saveList: string[];
  /** 11.0: the cards this seat has shown to the table (or to one power). */
  shownCards: string[];
  /** 11.0: the private shows addressed to this seat, for the read-only list. */
  cardsShownToMe: {card: string; from: Power}[];
  responseInHand: boolean;
  responseWindow: boolean;
  chainNonEmpty: boolean;
  chainSpendable: number;
  chainCap: number;
  chainReady: boolean;
  chainDisabledReason: string | undefined;
  cpBudget: () => number;
  doAction: (fn: () => void, describe?: {label: string; reason?: string}) => void;
  moves: Record<string, (...args: any[]) => void>;
  handChoicesHint: string | null;
  cardFaceMode: CardFaceMode;
  open: boolean;
  onToggleOpen: () => void;
  /**
   * True below 768 px.  On a phone the row stays one line and its operations
   * stay in the CardInspector; a desktop row draws them inline, because a
   * mouse reader expects the buttons in place rather than behind a dialog.
   */
  isPhone?: boolean;
  /**
   * A seat the bot drives: its board is read-only, so its rows never offer an
   * operation (Save in particular is legal outside the seat's own impulse).
   */
  isBotViewer?: boolean;
  /**
   * A decision is owed on screen (phone redesign): the sheet shows a compact
   * peek line instead of the hand, so the map target it asks about stays
   * visible.  The controls stay in the DOM; tapping the toggle still opens it.
   */
  decisionPeek?: boolean;
  /**
   * The peek line's text.  The board names the deciding seat while another
   * player's decision is open; the default asks the reader to answer it.
   */
  decisionPeekLabel?: string;
  /**
   * Draw every card's operations inline.  The board never sets this: a tap on
   * a row opens the CardInspector, which is the one place the operations live.
   * It exists for embeds and for the rules-level suites, which assert on a
   * card's buttons without driving a click through a static render.
   */
  expandAll?: boolean;
  /** Mobile third drawer position: peek (closed), half (open), full (expanded). */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onOpenReference?: (anchor: string) => void;
}

/**
 * The bottom hand tray.
 *
 * A card is one row: CP value, name, type and whether it can be played now.
 * On a desktop the row also draws every operation inline (play for CP, the
 * event, a response, industrialization, the CP chain and Save), so the common
 * play never needs a dialog; tapping the name still opens the CardInspector
 * with the full face and the aggregated "why not" reasons.  On a phone the row
 * stays one line and the operations stay in the inspector — a fingertip row
 * cannot carry six buttons.  `expandAll` (embeds, rules-level suites) draws the
 * operations inline everywhere for a static render.
 */
export const HandTray = (props: HandTrayProps) => {
  const {
    G, viewer, me, locale, t, phase, isActive, eliminated, pending, canActionCard, isBelligerent, war,
    forcedCardIds, hand, saveList, cardsShownToMe,
    responseInHand, responseWindow, chainNonEmpty, chainSpendable, chainCap,
    chainReady, chainDisabledReason, cpBudget, doAction, moves, handChoicesHint,
    cardFaceMode, open, onToggleOpen, expanded = false, onToggleExpanded, decisionPeek = false,
    decisionPeekLabel,
    onOpenReference, expandAll = false, isPhone = false, isBotViewer = false, compact = false,
  } = props;
  const [inspector, setInspector] = React.useState<{face: CardChoiceFace; key: string} | null>(null);
  const [chainCard, setChainCard] = React.useState<string>("");
  /**
   * 11.0: the card whose "show to others" target picker is open.  11.0 lets a
   * seat show an action card to the table or privately to one power, so the
   * row's one button asks whom before it sends the move.
   */
  const [showPickerFor, setShowPickerFor] = React.useState<string | null>(null);
  // Reads the saved preference when the tray mounts; `Preferences` in the
  // command menu writes it, and the tray picks the new value up on remount.
  // The board passes the live preference so the Display menu can flip it; a
  // caller that renders the tray alone still gets the stored value.
  const storedConfirm = React.useMemo(() => readConfirmActions(), []);
  const confirmActions = props.confirmActions ?? storedConfirm;
  /**
   * 25.1 discards every action card (and every home card) at the outbreak, so
   * from the Great War on there is no hand to count and no CP chain to spend:
   * 12.14's chain lives in the action phase, which the war never returns to.
   * The tray still carries the seat's Great War card and its goals.
   */
  const gwActive = G.gw?.active === true;
  /**
   * 26.0/27.2: a seat's Great War card is played from its own slot
   * (`me.gwCard`), never from the hand, so the hand's ordinary operations all
   * belong to moves that look the card up in `hand` and refuse it.  The tray
   * block and the card's inspector both draw the GW controls instead, and this
   * predicate is the one test they share.
   */
  const isGwSlotCard = (id: string): boolean =>
    G.gw?.active === true &&
    (phase === "gwPlanning" || phase === "gwManeuver") &&
    me?.gwCard === id;
  // An inspector is a read view of a face that is still somewhere on screen:
  // a hand card lives in `hand` (playing it removes it), the Great War card
  // lives in its own slot (`me.gwCard`, drawn only while its block is up and
  // emptied when played), and a National Goal lives on the mat and never
  // leaves.  Hand membership alone cannot be the test — the GW card is never
  // in the hand, so a hand-only guard closed its dialog in the same commit
  // that opened it.
  React.useEffect(() => {
    if (inspector === null || !("card" in inspector.face)) return;
    if (!hand.includes(inspector.key) && !isGwSlotCard(inspector.key)) setInspector(null);
  }, [G.gw?.active, hand, inspector, me, phase]);
  // A shown card, a phase change or a seat handover invalidates an open picker.
  React.useEffect(() => {
    if (showPickerFor !== null && (phase !== "diplomacy" || !hand.includes(showPickerFor))) {
      setShowPickerFor(null);
    }
  }, [hand, phase, showPickerFor]);

  if (!viewer || !me) return null;

  // 11.0: every show this seat made this phase, with whom it was shared.
  const ownShows = (G.negotiation?.shown ?? []).filter((entry) => entry.from === viewer);
  // One row per card, listing every recipient: the same card may be shown to
  // several seats, and a duplicate key/test id would make "Hide" ambiguous.
  const shownGroups: {card: string; targets: (Power | null)[]}[] = [];
  for (const entry of ownShows) {
    let group = shownGroups.find((candidate) => candidate.card === entry.card);
    if (group === undefined) {
      group = {card: entry.card, targets: []};
      shownGroups.push(group);
    }
    group.targets.push(entry.to);
  }
  const shownPublicly = (id: string): boolean =>
    ownShows.some((entry) => entry.card === id && entry.to === null);
  const alreadyShownTo = (id: string, to: Power): boolean =>
    ownShows.some((entry) => entry.card === id && entry.to === to);
  const showTargets = POWERS.filter((power) => power !== viewer && G.powers[power]?.eliminated !== true);
  const showCard = (id: string, to: Power | null): void => {
    const target = to === null ? null : to;
    doAction(() => moves.showCard(id, target), {
      label: target === null
        ? bi(locale, "Show this card to the table", "向全桌展示此牌")
        : bi(locale, `Show this card to ${t.seats[target]}`, `向${t.seats[target]}展示此牌`),
    });
    setShowPickerFor(null);
  };

  const homeCardTitle = (id: string): string => {
    const card = cardById(id);
    return card ? cardDisplayName(card, locale) : id;
  };

  const availability = (id: string): CardAvailability => cardAvailability({
    G,
    power: viewer,
    cardId: id,
    phase,
    isActive,
    isBelligerent,
    war,
    canActionCard,
    saveList,
    forcedCardIds,
    industryCard: me.industryCard,
    cpChainLength: me.cpChain.length,
    homeCards: me.selectedHomeCard === null ? [] : [me.selectedHomeCard],
    playBlock: t.playBlock as unknown as Record<string, string>,
    // The reason table lives beside the bilingual helper that owns those
    // strings, not in the i18n bundle.
    responseBlock: Object.fromEntries(Object.entries(RESPONSE_REASON_TEXT)
      .map(([key, text]) => [key, bi(locale, text.en, text.zh_CN)])),
    bi: (en, zh) => bi(locale, en, zh),
  });
  // 12.14: the chain is spent by playing a card for CP, so the UI must name
  // that card instead of silently starting a card-less impulse.
  const chainCardChoices = hand.filter((id) => {
    const card = cardById(id);
    if (card.kind === "home" || card.type === "mandatory" || card.type === "mandatoryResponse") return false;
    return availability(id).cpModeOk;
  });
  const selectedChainCard = chainCardChoices.includes(chainCard) ? chainCard : chainCardChoices[0] ?? "";
  const chainReason = chainDisabledReason ?? (!selectedChainCard
    ? bi(locale, "No non-mandatory card in hand can fund the chain.", "手中没有可用于 CP 链的非强制牌。")
    : undefined);

  /**
   * Whether a card has any operation to offer at all — legal right now, or
   * merely blocked.  A disabled button carrying its reason is how a player
   * learns why a card is stuck, so it is still worth drawing; only a card with
   * no such dimension (a combat card outside a battle) has nothing to say.
   */
  const hasOperation = (id: string): boolean => {
    const a = availability(id);
    return (a.showCp && a.cpAllowed) || a.eventAllowed || a.showResponse;
  };

  // A desktop row draws every operation in place, like the inspector does; a
  // phone row keeps them behind the tap (a fingertip row cannot hold six
  // buttons), and `expandAll` keeps the inline body for the static suites.  A
  // bot seat's board is a read-only view, so it never offers a row operation —
  // Save in particular is legal outside the seat's own impulse.
  const showRowActions = (!isPhone || expandAll) && !isBotViewer;

  const actionButtons = (id: string, where: "row" | "inline" | "inspector"): React.ReactNode => {
    const a = availability(id);
    // The inspector is the full list; a strip row keeps the two printed plays
    // (CP and event) in place and sends the rest to the inspector.
    const all = where === "inspector" || (where === "inline" && showRowActions);
    const mandatoryTitle = a.isMandatory ? bi(locale, "Mandatory card: play its event", "强制牌：需打出其事件") : undefined;
    const cpDisabled = !a.cpModeOk;
    // 12.0's one-card rule and the printed gates both land in `reasons`, so a
    // disabled event button always has a title even when the card's own text is
    // fine (`eventBlockReason` only covers those printed gates).
    const eventDisabledTitle = a.eventBlockReason ?? a.reasons[0];
    // A mandatory event is never "an event" on the table: the printed card type
    // is what the button must say, or the player reads "打出事件" for a card the
    // rules call 强制事件.  A mandatory *response* keeps its own printed type.
    const mandatoryResponse = cardById(id).type === "mandatoryResponse";
    const eventLabel = !a.isMandatory
      ? t.eventMode
      : bi(locale,
        mandatoryResponse ? "Play mandatory response" : "Play mandatory event",
        mandatoryResponse ? "打出强制响应" : "打出强制事件");
    const eventConfirmLabel = !a.isMandatory
      ? bi(locale, "Confirm: play the event", "确认：打出事件")
      : bi(locale,
        mandatoryResponse ? "Confirm: play the mandatory response" : "Confirm: play the mandatory event",
        mandatoryResponse ? "确认：打出强制响应" : "确认：打出强制事件");
    return (
      <>
        {a.showCp && (all || a.cpAllowed) && (
          // Playing a card for CP commits the impulse's CP: a second click
          // confirms it, unless the player has turned confirmations off.
          // A mandatory event has no CP-only mode (`showCp` is false): its CP
          // play resolves the printed event, so the event button below is the
          // one control, not a second identical choice.
          <ConfirmButton
            key="cp"
            className="ie-card-primary"
            data-testid={`ie-play-cp-${id}`}
            disabled={cpDisabled}
            title={cpDisabled ? a.reasons[0] ?? mandatoryTitle : undefined}
            confirm={confirmActions}
            confirmLabel={bi(locale, `Confirm: play for ${cardById(id).cp} CP`, `确认：作 ${cardById(id).cp} CP 打出`)}
            onConfirm={() => doAction(() => moves.playCard(id, "cp"), {
              label: bi(locale,
                `Play ${cardDisplayName(cardById(id), "en")} for ${cardById(id).cp} CP`,
                `打出 ${cardDisplayName(cardById(id), "zh_CN")}：${cardById(id).cp} CP`),
              reason: cpDisabled ? a.reasons[0] ?? mandatoryTitle : undefined,
            })}
          >
            {t.cpMode}
          </ConfirmButton>
        )}
        {(all || a.eventAllowed) && (
          <ConfirmButton
            key="event"
            className="ie-card-primary"
            data-testid={`ie-play-event-${id}`}
            disabled={!a.eventModeOk}
            data-blocked={a.eventBlockKey}
            title={!a.eventModeOk ? eventDisabledTitle : undefined}
            confirm={confirmActions}
            confirmLabel={eventConfirmLabel}
            onConfirm={() => doAction(() => moves.playCard(id, "event"), {
              label: bi(locale, `Play ${cardDisplayName(cardById(id), "en")}'s event`, `打出 ${cardDisplayName(cardById(id), "zh_CN")} 事件`),
              reason: !a.eventModeOk ? eventDisabledTitle : undefined,
            })}
          >
            {eventLabel}
          </ConfirmButton>
        )}
        {(all || a.showResponse) && a.showResponse && (
          <button
            key="response"
            data-testid={`ie-response-${id}`}
            disabled={!a.responseOk}
            title={!a.responseOk ? a.reasons.join(" · ") : undefined}
            onClick={() => doAction(() => moves.playResponseCard(id), {
              label: t.playResponse,
              reason: !a.responseOk ? a.reasons.join(" · ") : undefined,
            })}
          >
            {t.playResponse}
          </button>
        )}
        {all && <button key="industry" data-testid={`ie-industrialize-${id}`} disabled={!a.industOk} title={!a.industOk ? a.firstReason : undefined} onClick={() => doAction(() => moves.industrialize(id), {label: t.industrialize, reason: a.firstReason})}>{t.industrialize}</button>}
        {/* 11.0: "Players are allowed to show other players their action cards."
            The button asks whom: the whole table or one power.  A card already
            faceup to the table has nothing left to show. */}
        {all && phase === "diplomacy" && !shownPublicly(id) && (
          <button
            key="show"
            data-testid={`ie-show-card-${id}`}
            onClick={() => {
              setInspector(null);
              setShowPickerFor(id);
            }}
          >
            {bi(locale, "Show to others", "向他人展示")}
          </button>
        )}
        {all && !gwActive && <button key="chain" data-testid={`ie-cp-chain-add-${id}`} disabled={!a.chainOk} title={!a.chainOk ? a.firstReason : undefined} onClick={() => doAction(() => moves.cpChain(id), {label: t.cpChain, reason: a.firstReason})}>{t.cpChain}</button>}
        {all && <button key="save" data-testid={`ie-save-${id}`} aria-pressed={a.saved} disabled={!a.saveOk} title={!a.saveOk ? a.firstReason : undefined} onClick={() => doAction(() => moves.saveCard(id), {label: a.saved ? t.unsave : t.saveCard, reason: a.firstReason})}>{a.saved ? t.unsave : t.saveCard}</button>}
      </>
    );
  };

  /**
   * 27.2/27.3: the seat's Great War card is played from its own slot — its
   * bonus action (`playGwCardMove("cp")`) and its event — and both are gated
   * by `gwCardProblem`, not by the action phase's `cardAvailability`.  The tray
   * block and the card's inspector share this list so a tap on the card face
   * can no longer show the hand's CP/event/industrialize controls, which the
   * moves behind them (`playCard`, `industrialize`) refuse because the card is
   * not in `hand`.
   */
  const gwActionButtons = (id: string, where: "tray" | "inspector"): React.ReactNode => {
    const card = cardById(id);
    const mandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
    // 27.3's Exhaustion is the GW deck's mandatory event: like a hand's
    // mandatory event, its CP play *is* its event (`playGwCardMove` resolves
    // the text in both modes), so the tray offers one control, not two that do
    // the same thing.
    const showBonus = card.type !== "mandatory";
    const eventLabel = mandatory
      ? bi(locale,
        card.type === "mandatoryResponse" ? "Play mandatory response" : "Play mandatory event",
        card.type === "mandatoryResponse" ? "打出强制响应" : "打出强制事件")
      : t.eventMode;
    const cpProblem = gwCardProblem(G, viewer, "cp");
    const eventProblem = gwCardProblem(G, viewer, "event");
    const canCard = !eliminated && isActive && pending === null;
    // 27.2: an open bonus button carried no tooltip at all, so the two printed
    // restrictions (no repeat of the impulse's budget action, no land battle in
    // an impulse using the card bonus) only surfaced once a move was refused.
    // A refusal, when there is one, still leads the line.
    const bonusRule = bi(locale,
      "Bonus action: skip the event and take one extra action now, paid by this card; it cannot repeat this impulse's budget action, and no land battle may be fought this impulse.",
      "奖励行动：不结算事件，立刻用本牌额外执行一次行动；不能重复本轮预算行动，本轮不能发动陆战。");
    const bonusTitle = [gwImpulseReasonText(locale, cpProblem), bonusRule]
      .filter((text): text is string => text !== undefined).join(" ");
    const testId = (name: string): string => `ie-gw-${name}-${where === "inspector" ? "inspector-" : ""}${id}`;
    return (
      <>
        {showBonus && <button
          key="gw-cp"
          data-testid={testId("bonus")}
          disabled={!canCard || cpProblem !== null}
          title={bonusTitle}
          onClick={() => doAction(() => moves.playGwCardMove("cp"), {label: bi(locale, "Bonus action", "奖励行动"), reason: gwImpulseReasonText(locale, cpProblem) ?? undefined})}
        >
          {bi(locale, "Bonus action", "奖励行动")}
        </button>}
        <button
          key="gw-event"
          data-testid={testId("event")}
          disabled={!canCard || eventProblem !== null}
          title={gwImpulseReasonText(locale, eventProblem) ?? undefined}
          onClick={() => doAction(() => moves.playGwCardMove("event"), {label: eventLabel, reason: gwImpulseReasonText(locale, eventProblem) ?? undefined})}
        >
          {eventLabel}
        </button>
      </>
    );
  };

  const cardFace = (card: CardDef) => {
    const src = cardImageSrc(card.image);
    if (cardFaceMode === "print" && src) {
      return <img className="ie-card-face ie-card-print" src={src} alt={cardDisplayName(card, locale)} data-card-id={card.id} loading="lazy"/>;
    }
    return <CardFace card={card} locale={locale} showTranslation={false} t={t}/>;
  };

  const openInspector = (face: CardChoiceFace, key: string) => setInspector({face, key});
  /**
   * 27.2/27.3: the seat's Great War card is not an action card, so the action
   * phase's reasons ("only during your Action-phase impulse") are wrong for
   * it — the card is played in planning or the maneuver.  The footer names the
   * reason for each printed mode that is shut (the hand's inspector lists the
   * same per-mode reasons), so a touch reader gets the "battle window" line
   * that a mouse reader only sees in the button's tooltip.
   */
  const gwInspectorReasons = (id: string): string[] | null => {
    if (!isGwSlotCard(id)) return null;
    const reasons = [gwCardProblem(G, viewer, "cp"), gwCardProblem(G, viewer, "event")]
      .map((problem) => gwImpulseReasonText(locale, problem))
      .filter((text): text is string => text !== undefined);
    return [...new Set(reasons)];
  };
  const inspectorCard = inspector?.face.card;
  // While a decision is owed the sheet starts folded: it must not cover the
  // map target the decision points at.  The toggle stays live, so a reader can
  // still open the hand deliberately.
  const shownOpen = open && !decisionPeek;

  return (
    <section
      className={`ie-hand-tray${decisionPeek ? " ie-hand-tray-decision" : ""}`}
      data-testid="ie-hand-tray"
      data-open={shownOpen ? "true" : "false"}
      data-expanded={expanded ? "true" : "false"}
      data-decision-peek={decisionPeek ? "true" : "false"}
    >
      <header className="ie-tray-head">
        <button
          type="button"
          className="ie-tray-toggle"
          data-testid="ie-tray-toggle"
          aria-expanded={shownOpen ? "true" : "false"}
          aria-controls="ie-tray-body"
          title={shownOpen ? bi(locale, "Collapse hand", "收起手牌") : bi(locale, "Expand hand", "展开手牌")}
          onClick={onToggleOpen}
        >
          <span aria-hidden="true">{shownOpen ? <Icon name="chevron-down" size={14}/> : <Icon name="chevron-right" size={14}/>}</span>
        </button>
        <h3 className="ie-tray-title">{t.hand}{viewer ? ` · ${t.seats[viewer]}` : ""}</h3>
        <RuleLink anchor="chart:influence-track" locale={locale} onOpenReference={onOpenReference}/>
        {shownOpen && onToggleExpanded !== undefined && (
          <button
            type="button"
            className="ie-tray-expand"
            data-testid="ie-tray-expand"
            aria-pressed={expanded ? "true" : "false"}
            title={expanded ? bi(locale, "Half-height hand", "半屏手牌") : bi(locale, "Full-height hand", "全屏手牌")}
            onClick={onToggleExpanded}
          >
            <span aria-hidden="true">{expanded ? <Icon name="chevron-down" size={14}/> : <Icon name="chevron-up" size={14}/>}</span>
          </button>
        )}
        {!gwActive && <span className="ie-tray-count" data-testid="ie-hand-count">{hand.length} {t.cards}</span>}
        <div className="ie-hand-meta">
          {!gwActive && <IEChip>{t.cpChain}: {me.cpChain.length}/2</IEChip>}
          {saveList.length > 0 && <IEChip>{t.savedCards}: {saveList.map(homeCardTitle).join(", ")}</IEChip>}
          {responseInHand && <IEChip>{t.responseCard}: {hand.filter((id) => cardById(id).type === "response").length}</IEChip>}
          {me.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(me.industryCard)}</IEChip>}
        </div>
        {decisionPeek && (
          <span className="ie-tray-decision-line" data-testid="ie-tray-decision-peek" role="status">
            {decisionPeekLabel ?? bi(locale, "A decision is waiting — answer it in the panel", "有决策待处理——请在面板中作答")}
          </span>
        )}
        {handChoicesHint !== null && (
          <span className="ie-hand-hint" data-testid="ie-hand-choices-hint">{handChoicesHint}</span>
        )}
      </header>

      {shownOpen && (
        <div className="ie-tray-body" id="ie-tray-body">
          <div className="ie-tray-scroll">
            {/* 27.1/27.2: a seat's Great War card is the one card that is not in
                the hand.  It used to be drawn as a 126×118 thumbnail of a
                300×380 face, which put the printed text on screen at 5 px and
                read as a blur.  It is a ledger row now — CP, title and the
                printed line — with its two plays at the end of that row; the
                face itself is one tap away in the inspector. */}
            {G.gw?.active && me.gwCard && (phase === "gwPlanning" || phase === "gwManeuver") && (() => {
              const gwId = me.gwCard!;
              const gwCard = cardById(gwId);
              const gwTitle = cardDisplayName(gwCard, locale);
              return (
                <section className="ie-tray-gw" data-testid={`ie-gw-card-${gwId}`} data-card-id={gwId}>
                  <div className="ie-section-title">
                    {bi(locale, "Great War card", "大战卡")} · {bi(locale, "war budget", "战争预算")} {me.gwBudget ?? 0}
                  </div>
                  <article className="ie-card ie-gw-card">
                    <button type="button" className="ie-card-open" data-testid={`ie-open-gw-card-${gwId}`}
                      aria-haspopup="dialog"
                      aria-label={`${bi(locale, "Great War card", "大战卡")}: ${gwTitle}`}
                      title={bi(locale, `Read ${gwTitle}`, `查看 ${gwTitle}`)}
                      onClick={() => openInspector({card: gwCard}, gwId)}>
                      <span className="ie-gw-head">
                        <span className="ie-card-cp">{gwCard.cp}</span>
                        <span className="ie-card-name">{gwTitle}</span>
                      </span>
                      <span className="ie-gw-text" data-testid={`ie-gw-text-${gwId}`}>
                        {locale === "zh_CN" ? gwCard.textZh : gwCard.text}
                      </span>
                    </button>
                    <div className="ie-card-actions">{gwActionButtons(gwId, "tray")}</div>
                  </article>
                </section>
              );
            })()}

            {!gwActive && (
              <div className="ie-cp-chain" data-testid="ie-cp-chain">
                <span className="ie-tray-chain-title">{t.cpChain}</span>
                <span className="ie-cp-chain-total" data-testid="ie-cp-chain-total">{chainSpendable}/{chainCap}</span>
                <span className="ie-tray-chain-cards">
                  {chainNonEmpty
                    ? me.cpChain.map((id) => <IEChip key={id}>{homeCardTitle(id)}</IEChip>)
                    : <span className="ie-muted">{bi(locale, "No chained cards.", "CP 链中没有牌。")}</span>}
                </span>
                {chainReady && chainCardChoices.length > 0 && (
                  <select
                    className="ie-cp-chain-select"
                    data-testid="ie-cp-chain-card"
                    aria-label={bi(locale, "Card to play for CP with the chain", "用于支付 CP 链的牌")}
                    value={selectedChainCard}
                    onChange={(event) => setChainCard(event.target.value)}
                  >
                    {chainCardChoices.map((id) => <option key={id} value={id}>{homeCardTitle(id)}</option>)}
                  </select>
                )}
                <button className="ie-btn secondary ie-btn-xs" data-testid="ie-use-cp-chain" disabled={!chainReady || !selectedChainCard} title={chainReason} onClick={() => doAction(() => moves.useCpChain(selectedChainCard), {label: bi(locale, "Use the CP chain", "使用 CP 链"), reason: chainReason})}>
                  {bi(locale, "Use CP chain", "使用 CP 链")}
                </button>
                {(!chainReady || !selectedChainCard) && chainReason && <span className="ie-muted ie-tray-chain-reason" data-testid="ie-cp-chain-reason">{chainReason}</span>}
              </div>
            )}

            <div className="ie-hand">
              {pinHomeCards(hand).map((id) => {
                const card = cardById(id);
                const a = availability(id);
                const playable = a.cpModeOk || a.eventModeOk || a.responseOk;
                // `expandAll` is the static-suite body: the face and the
                // buttons inline.  A desktop row draws the same operations
                // directly under the name; a phone row keeps them in the
                // inspector the tap opens.  The face carries no translation
                // either: the printed original is one button away, inside the
                // inspector, so the hand never shows two languages at once.
                const rowOpen = expandAll;
                return (
                  <article
                    key={id}
                    className={`ie-card${playable ? " playable" : ""}${a.saved ? " saved" : ""}${rowOpen ? " expanded" : ""}`}
                    data-expanded={rowOpen ? "true" : "false"}
                    data-testid={`ie-card-${id}`}
                    data-card-kind={card.kind}
                    data-playable={playable ? "true" : "false"}
                    data-card-type={cardTypeIcon(card.kind, card.type)}
                    data-row-actions={showRowActions && !rowOpen ? "true" : "false"}
                  >
                    <button
                      type="button"
                      className="ie-card-open"
                      data-testid={`ie-open-card-${id}`}
                      aria-haspopup="dialog"
                      aria-label={`${bi(locale, "Card", "卡牌")}: ${cardDisplayName(card, locale)}`}
                      onClick={() => openInspector({card}, id)}
                    >
                      <span className="ie-card-cp" data-testid={`ie-card-cp-${id}`}>{card.cp}</span>
                      <span className="ie-card-name">{cardDisplayName(card, locale)}</span>
                      {/* Every card may be played for CP (12.0), so a playable
                          row carries no badge at all.  Only a card that is stuck
                          right now still says why, in the one line it has. */}
                      {!playable && a.firstReason !== undefined && (
                        <span className="ie-card-status" data-testid={`ie-card-status-${id}`} data-playable="false">
                          {a.firstReason}
                        </span>
                      )}
                    </button>
                    {showRowActions && !rowOpen && (
                      // The operations sit on the row itself, so a desktop play
                      // is one click on a visible button rather than a tap, a
                      // dialog and another click.  Blocked buttons carry their
                      // reason as a title, exactly as they do in the inspector.
                      <div className="ie-card-actions ie-card-row-actions" data-testid={`ie-card-row-actions-${id}`}>
                        {actionButtons(id, compact ? "row" : "inline")}
                      </div>
                    )}
                    {rowOpen && (
                      <div className="ie-card-body" id={`ie-card-body-${id}`}>
                        <div className="ie-card-face-holder" data-testid={`ie-card-face-${id}`}>
                          {cardFace(card)}
                        </div>
                        <div className="ie-card-body-actions">
                          {hasOperation(id) ? (
                            <div className="ie-card-actions">{actionButtons(id, "inline")}</div>
                          ) : (
                            <div className="ie-card-why" data-testid={`ie-card-why-${id}`}>
                              <span>{bi(locale, "No operation available right now.", "当前没有可执行的操作。")}</span>
                              {a.reasons.slice(0, 2).map((reason) => (
                                <span key={reason} className="ie-card-why-line">{reason}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {hand.length === 0 && !gwActive && <div className="ie-muted">{t.hand}: 0 {t.cards}</div>}
            </div>

            <div className="ie-tray-extras">
              {responseWindow && <div className="ie-hint ie-response-hint">{bi(locale, "Response window: you may play a response card instead of an impulse.", "响应窗口：你可以打出响应牌代替本次行动。")}</div>}

              {me.goals.length > 0 && (
                <div className="ie-tray-goals">
                  <div className="ie-section-title">{t.goals} · {me.goals.length}</div>
                  <div className="ie-goal-hand">
                    {me.goals.map((id) => {
                      const goal = GOALS_BY_ID[id];
                      if (!goal) return null;
                      return (
                        <button
                          key={id}
                          type="button"
                          className="ie-goal-open"
                          data-testid={`ie-goal-${id}`}
                          onClick={() => openInspector({goal}, id)}
                          title={bi(locale, "Open National Goal", "查看国家目标")}
                        >
                          {locale === "zh_CN" ? goal.titleZh : goal.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {phase === "diplomacy" && shownGroups.length > 0 && (
                <div className="ie-tray-shown" data-testid="ie-shown-cards">
                  {/* 11.0: a card shown this phase stays faceup at the table
                      until the phase closes; the owner may take it back.  One
                      row per card lists every recipient it was shown to. */}
                  <div className="ie-section-title">
                    {bi(locale, "Shown this phase", "本阶段已展示")}
                  </div>
                  <div className="ie-inline">
                    {shownGroups.map((group) => (
                      <span key={group.card} className="ie-inline">
                        <span data-testid={`ie-shown-card-${group.card}`}>
                          {cardDisplayName(cardById(group.card), locale)}
                          {" → "}
                          {group.targets.map((target) => target === null ? bi(locale, "table", "全桌") : t.seats[target]).join(locale === "zh_CN" ? "、" : ", ")}
                        </span>
                        <button
                          type="button"
                          className="ie-btn secondary ie-mini"
                          data-testid={`ie-hide-card-${group.card}`}
                          onClick={() => doAction(() => moves.hideCard(group.card), {label: bi(locale, "Turn face down again", "收回展示")})}
                        >
                          {bi(locale, "Hide", "收回")}
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="ie-hint">
                    {bi(locale, "A shown card stays faceup only until the diplomacy phase ends.", "展示的手牌仅在本外交阶段内保持明置。")}
                  </div>
                </div>
              )}

              {phase === "diplomacy" && cardsShownToMe.length > 0 && (
                <div className="ie-tray-shown" data-testid="ie-shown-to-me">
                  {/* 11.0: what the table (or one power) showed this seat. */}
                  <div className="ie-section-title">
                    {bi(locale, "Shown to you", "他人向你展示")}
                  </div>
                  <div className="ie-inline">
                    {cardsShownToMe.map((entry) => (
                      <span key={`${entry.from}-${entry.card}`} data-testid={`ie-shown-to-me-${entry.card}`}>
                        {t.seats[entry.from]}: {cardDisplayName(cardById(entry.card), locale)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {inspector !== null && (
        <CardInspector
          open
          onClose={() => setInspector(null)}
          locale={locale}
          face={inspector.face}
          mode={cardFaceMode}
          actions={inspectorCard
            ? (isGwSlotCard(inspectorCard.id)
              ? gwActionButtons(inspectorCard.id, "inspector")
              : actionButtons(inspectorCard.id, "inspector"))
            : null}
          unavailable={inspectorCard
            ? gwInspectorReasons(inspectorCard.id) ?? availability(inspectorCard.id).reasons
            : [bi(locale, "National Goals have no card operation - they score at game end.", "国家目标没有卡牌操作——在游戏结束时计分。")]}
        />
      )}

      {/* 11.0: "show other players their action cards" — the table or exactly
          one power.  A target already holding this show is disabled rather than
          hidden, so the reader can see whom they have already told. */}
      {showPickerFor !== null && hand.includes(showPickerFor) && (
        <Modal
          open
          dismissible
          locale={locale}
          title={bi(locale,
            `Show ${cardDisplayName(cardById(showPickerFor), locale)} to…`,
            `向谁展示 ${cardDisplayName(cardById(showPickerFor), locale)}？`)}
          onClose={() => setShowPickerFor(null)}
          testId="ie-show-target-picker"
          backdropTestId="ie-show-target-backdrop"
          closeTestId="ie-show-target-close"
          footer={(
            <button type="button" className="ie-btn" data-testid="ie-show-target-cancel" onClick={() => setShowPickerFor(null)}>
              {bi(locale, "Cancel", "取消")}
            </button>
          )}
        >
          <div className="ie-inline" data-testid="ie-show-target-options">
            <button
              type="button"
              className="ie-btn primary"
              data-testid="ie-show-target-table"
              disabled={shownPublicly(showPickerFor)}
              onClick={() => showCard(showPickerFor, null)}
            >
              {bi(locale, "The table (public)", "全桌（公开）")}
            </button>
            {showTargets.map((power) => (
              <button
                key={power}
                type="button"
                data-testid={`ie-show-target-${power}`}
                disabled={alreadyShownTo(showPickerFor, power)}
                onClick={() => showCard(showPickerFor, power)}
              >
                {bi(locale, `Privately to ${t.seats[power]}`, `私下向${t.seats[power]}展示`)}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </section>
  );
};
