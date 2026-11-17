import React from "react";
import {ImperialElegyState, Power} from "../types";
import {CardDef} from "../constant/cards";
import {GoalDef} from "../constant/goals";
import {GOALS_BY_ID} from "../constant/goals";
import {cardById} from "../engine/deck";
import {eventPlayability} from "../engine/playability";
import {cpChainResolution} from "../engine/economy";
import {responseCardEligibility} from "../moves";
import {IEBadge, IEChip} from "./theme";
import {ieT} from "./i18n";
import {bi, gwImpulseReasonText, responseReasonText} from "./boardHelpers";
import {gwCardProblem} from "../engine/gwImpulse";
import {CardFace} from "./CardFace";
import {CardInspector} from "./CardInspector";
import {CardChoiceFace} from "./CardChoice";
import {CardFaceMode, cardImageSrc} from "./preferences";

export interface HandTrayProps {
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
  giveCards: string[];
  giveCardId: string;
  setGiveCardId: (s: string) => void;
  giveTarget: Power;
  setGiveTarget: (p: Power) => void;
  giveCardValue: string;
  responseInHand: boolean;
  responseWindow: boolean;
  chainNonEmpty: boolean;
  chainSpendable: number;
  chainCap: number;
  chainReady: boolean;
  chainDisabledReason: string | undefined;
  cpBudget: () => number;
  doAction: (fn: () => void) => void;
  moves: Record<string, (...args: any[]) => void>;
  handChoicesHint: string | null;
  cardFaceMode: CardFaceMode;
  open: boolean;
  onToggleOpen: () => void;
  /**
   * Unfold every card at once.  The board never sets this; it exists so the
   * rules-level tests can assert on the buttons without driving a click through
   * a static render, and so an embedder can show a fully expanded hand.
   */
  expandAll?: boolean;
  /** Mobile third drawer position: peek (closed), half (open), full (expanded). */
  expanded?: boolean;
  onToggleExpanded?: () => void;
}

interface CardAvailability {
  cpAllowed: boolean;
  cpModeOk: boolean;
  eventAllowed: boolean;
  eventModeOk: boolean;
  eventBlockReason: string | undefined;
  eventBlockKey: string | undefined;
  responseOk: boolean;
  showResponse: boolean;
  industOk: boolean;
  chainOk: boolean;
  saveOk: boolean;
  saved: boolean;
  homeOk: boolean;
  isMandatory: boolean;
  reasons: string[];
}

const translated = (card: CardDef | GoalDef, locale: "en" | "zh_CN") => ({
  title: locale === "zh_CN" ? card.titleZh : card.title,
  otherTitle: locale === "zh_CN" ? card.title : card.titleZh,
  text: locale === "zh_CN" ? card.text : card.textZh,
  lang: locale === "zh_CN" ? "en" : "zh-CN",
});

const CardTranslation = ({card, locale}: {card: CardDef | GoalDef; locale: "en" | "zh_CN"}) => {
  const text = translated(card, locale);
  return (
    <details className="ie-card-translation">
      <summary>{locale === "zh_CN" ? "English text" : "中文译文"}</summary>
      <div lang={text.lang} className={locale === "en" ? "ie-card-zh" : undefined}>
        <strong>{text.otherTitle}</strong>
        <p>{text.text}</p>
      </div>
    </details>
  );
};

/**
 * The bottom hand tray.
 *
 * It shows only what can be done now: two primary actions per card and a
 * native `⋯` disclosure with the rest.  The full card, every operation and the
 * aggregated "why not" reasons live in the CardInspector, which opens from the
 * face.  The tray keeps the established `.ie-hand .ie-card`, card ids and
 * `.ie-card-actions` so the rules-level selectors stay stable.
 */
export const HandTray = (props: HandTrayProps) => {
  const {
    G, viewer, me, locale, t, phase, isActive, eliminated, pending, canActionCard, isBelligerent, war,
    forcedCardIds, hand, saveList, giveCards, giveCardId, setGiveCardId, giveTarget, setGiveTarget,
    giveCardValue, responseInHand, responseWindow, chainNonEmpty, chainSpendable, chainCap,
    chainReady, chainDisabledReason, cpBudget, doAction, moves, handChoicesHint,
    cardFaceMode, open, onToggleOpen, expandAll = false, expanded = false, onToggleExpanded,
  } = props;
  const [inspector, setInspector] = React.useState<{face: CardChoiceFace; key: string} | null>(null);
  /**
   * Which hand card is unfolded.  The tray shows one row per card (CP value,
   * name, type) and only the unfolded card carries its face and its buttons:
   * sixteen stacked card faces with two buttons each was unreadable on a phone.
   *
   * A card that forbids passing opens itself, because the player has to act on
   * it: hiding the only legal move behind a tap would be a trap.
   */
  const [expandedId, setExpandedId] = React.useState<string | null>(() => forcedCardIds[0] ?? null);

  if (!viewer || !me) return null;

  const homeCardTitle = (id: string): string => {
    const card = cardById(id);
    return card ? (locale === "zh_CN" ? card.titleZh : card.title) : id;
  };

  const availability = (id: string): CardAvailability => {
    const card = cardById(id);
    const isMandatory = card.type === "mandatory" || card.type === "mandatoryResponse";
    const saved = saveList.includes(id);
    const cpAllowed = !isMandatory && card.type !== "response" && card.type !== "combat";
    const eventAllowed = (card.type !== "response" && card.type !== "combat") || card.id === "IE-A041";
    const homeOk = card.kind !== "home" || me.selectedHomeCard === card.id;
    const rescueOk = forcedCardIds.includes(id) && cpAllowed;
    const cpModeOk = canActionCard && cpAllowed && (G.cpRemaining === 0 || rescueOk) && homeOk;
    const eventGate = eventAllowed ? eventPlayability(G, viewer, id) : null;
    const eventBlockKey = eventGate !== null && !eventGate.ok ? eventGate.reason : undefined;
    const eventBlockReason = eventBlockKey !== undefined ? t.playBlock[eventBlockKey] : undefined;
    const eventModeOk = canActionCard && eventAllowed && G.cpRemaining === 0 && (eventGate === null || eventGate.ok);
    const responseEligible = card.type === "response" ? responseCardEligibility(G, viewer, id) : null;
    const responseOk = responseEligible?.ok === true;
    const showResponse = card.type === "response" && (
      phase === "action" ? isActive
        : phase === "wartime" ? isBelligerent && (isActive || war?.status === "alliance")
          : phase === "gwManeuver" ? isActive
            : false
    );
    const industOk = canActionCard && me.industryCard === null && card.kind !== "home" && !isMandatory;
    const chainOk = canActionCard && me.cpChain.length < 2;
    const saveOk = (phase === "action" || phase === "end") && card.kind !== "home" && !isMandatory;

    const reasons: string[] = [];
    if (!cpModeOk) {
      if (!cpAllowed) reasons.push(bi(locale, "Cannot be played for CP (mandatory/response/combat card)", "不能作为 CP 打出（强制/响应/战斗牌）"));
      else if (!homeOk) reasons.push(bi(locale, "Set it as your home card during Diplomacy first", "需先在外交阶段选为本国牌"));
      else if (!canActionCard) reasons.push(bi(locale, "Only during your Action-phase impulse", "仅限你的行动阶段行动轮"));
      else if (G.cpRemaining > 0) reasons.push(bi(locale, "Finish the current impulse first", "请先结束本次行动"));
    }
    if (!eventModeOk) {
      if (!eventAllowed) reasons.push(bi(locale, "This card has no printed event", "此牌没有可打出的事件"));
      else if (eventBlockReason) reasons.push(eventBlockReason);
      else if (!canActionCard) reasons.push(bi(locale, "Events are played at the start of an Action impulse", "事件需在行动轮开始时打出"));
      else if (G.cpRemaining > 0) reasons.push(bi(locale, "Events are played before spending CP", "事件需在花费 CP 前打出"));
    }
    if (card.type === "response" && !responseOk) {
      reasons.push(responseEligible && !responseEligible.ok ? responseReasonText(locale, responseEligible.reason) : bi(locale, "No response window now", "当前没有响应窗口"));
    }
    if (!industOk && card.kind !== "home" && !isMandatory) {
      reasons.push(me.industryCard !== null
        ? bi(locale, "A card is already industrializing", "已有牌在工业化")
        : bi(locale, "Industrialize only during your Action impulse", "工业化仅限你的行动阶段行动轮"));
    }
    if (!chainOk && me.cpChain.length >= 2) reasons.push(bi(locale, "CP chain is full", "CP 链已满"));
    if (!saveOk) reasons.push(bi(locale, "Save only in the Action or End phase", "仅可在行动或结束阶段保留"));
    return {
      cpAllowed, cpModeOk, eventAllowed, eventModeOk, eventBlockReason, eventBlockKey,
      responseOk, showResponse, industOk, chainOk, saveOk, saved, homeOk, isMandatory,
      reasons: [...new Set(reasons)],
    };
  };

  /**
   * Whether the unfolded card has any operation to offer at all, legal right
   * now or merely blocked.  A disabled button carrying its reason is how a
   * player learns why a card is stuck, so it is still worth drawing; only a card
   * with no such dimension (a combat card outside a battle) has nothing to say.
   */
  const hasOperation = (id: string): boolean => {
    const a = availability(id);
    return a.cpAllowed || a.eventAllowed || a.showResponse;
  };

  const actionButtons = (id: string, where: "expanded" | "inspector"): React.ReactNode => {
    const a = availability(id);
    const mandatoryTitle = a.isMandatory ? bi(locale, "Mandatory card: play its event", "强制牌：需打出其事件") : undefined;
    const cpDisabled = !a.cpModeOk;
    return (
      <>
        {(where === "inspector" || a.cpAllowed) && (
          <button
            key="cp"
            className="ie-card-primary"
            data-testid={`ie-play-cp-${id}`}
            disabled={cpDisabled}
            title={cpDisabled ? a.reasons[0] ?? mandatoryTitle : undefined}
            onClick={() => doAction(() => moves.playCard(id, "cp"))}
          >
            {t.cpMode}
          </button>
        )}
        {(where === "inspector" || a.eventAllowed) && (
          <button
            key="event"
            className="ie-card-primary"
            data-testid={`ie-play-event-${id}`}
            disabled={!a.eventModeOk}
            data-blocked={a.eventBlockKey}
            title={!a.eventModeOk ? a.eventBlockReason : undefined}
            onClick={() => doAction(() => moves.playCard(id, "event"))}
          >
            {t.eventMode}
          </button>
        )}
        {a.showResponse && (
          <button
            key="response"
            data-testid={`ie-response-${id}`}
            disabled={!a.responseOk}
            title={!a.responseOk ? a.reasons.join(" · ") : undefined}
            onClick={() => doAction(() => moves.playResponseCard(id))}
          >
            {t.playResponse}
          </button>
        )}
        {where === "inspector" && <button key="industry" data-testid={`ie-industrialize-${id}`} disabled={!a.industOk} onClick={() => doAction(() => moves.industrialize(id))}>{t.industrialize}</button>}
        {where === "inspector" && <button key="chain" data-testid={`ie-cp-chain-add-${id}`} disabled={!a.chainOk} onClick={() => doAction(() => moves.cpChain(id))}>{t.cpChain}</button>}
        {where === "inspector" && <button key="save" data-testid={`ie-save-${id}`} aria-pressed={a.saved} disabled={!a.saveOk} onClick={() => doAction(() => moves.saveCard(id))}>{a.saved ? t.unsave : t.saveCard}</button>}
      </>
    );
  };

  const cardFace = (card: CardDef) => {
    const src = cardImageSrc(card.image);
    if (cardFaceMode === "print" && src) {
      return <img className="ie-card-face ie-card-print" src={src} alt={locale === "zh_CN" ? card.titleZh : card.title} data-card-id={card.id} loading="lazy"/>;
    }
    return <CardFace card={card} locale={locale} showTranslation={false}/>;
  };

  const openInspector = (face: CardChoiceFace, key: string) => setInspector({face, key});
  const inspectorCard = inspector?.face.card;

  return (
    <section className="ie-hand-tray" data-testid="ie-hand-tray" data-open={open ? "true" : "false"} data-expanded={expanded ? "true" : "false"}>
      <header className="ie-tray-head">
        <button
          type="button"
          className="ie-tray-toggle"
          data-testid="ie-tray-toggle"
          aria-expanded={open ? "true" : "false"}
          aria-controls="ie-tray-body"
          title={open ? bi(locale, "Collapse hand", "收起手牌") : bi(locale, "Expand hand", "展开手牌")}
          onClick={onToggleOpen}
        >
          <span aria-hidden="true">{open ? "▾" : "▸"}</span>
        </button>
        <h3 className="ie-tray-title">{t.hand}{viewer ? ` · ${t.seats[viewer]}` : ""}</h3>
        {open && onToggleExpanded !== undefined && (
          <button
            type="button"
            className="ie-tray-expand"
            data-testid="ie-tray-expand"
            aria-pressed={expanded ? "true" : "false"}
            title={expanded ? bi(locale, "Half-height hand", "半屏手牌") : bi(locale, "Full-height hand", "全屏手牌")}
            onClick={onToggleExpanded}
          >
            <span aria-hidden="true">{expanded ? "▾" : "▴"}</span>
          </button>
        )}
        <span className="ie-tray-count" data-testid="ie-hand-count">{hand.length} {t.cards}</span>
        <div className="ie-hand-meta">
          <IEChip>{t.cpChain}: {me.cpChain.length}/2</IEChip>
          {saveList.length > 0 && <IEChip>{t.savedCards}: {saveList.map(homeCardTitle).join(", ")}</IEChip>}
          {responseInHand && <IEChip>{t.responseCard}: {hand.filter((id) => cardById(id).type === "response").length}</IEChip>}
          {/* The tray folds by default, so the two things that must not be
              missed while it is closed get a flag on the bar itself: an open
              response window, and a hand that forbids passing. */}
          {!open && responseWindow && (
            <IEChip><span className="ie-tray-flag" data-testid="ie-tray-response-flag" aria-hidden="true">⚑</span>
              {bi(locale, "Response window", "响应窗口")}</IEChip>
          )}
          {!open && forcedCardIds.length > 0 && (
            <IEChip><span className="ie-tray-flag" data-testid="ie-tray-forced-flag" aria-hidden="true">!</span>
              {bi(locale, "Must play a card first", "须先打出卡牌")}</IEChip>
          )}
          {me.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(me.industryCard)}</IEChip>}
        </div>
        {handChoicesHint !== null && (
          <span className="ie-hand-hint" data-testid="ie-hand-choices-hint">{handChoicesHint}</span>
        )}
      </header>

      {open && (
        <div className="ie-tray-body" id="ie-tray-body">
          <div className="ie-tray-scroll">
            <div className="ie-cp-chain" data-testid="ie-cp-chain">
              <span className="ie-tray-chain-title">{t.cpChain}</span>
              <span className="ie-cp-chain-total" data-testid="ie-cp-chain-total">{chainSpendable}/{chainCap}</span>
              <span className="ie-tray-chain-cards">
                {chainNonEmpty
                  ? me.cpChain.map((id) => <IEChip key={id}>{homeCardTitle(id)}</IEChip>)
                  : <span className="ie-muted">{bi(locale, "No chained cards.", "CP 链中没有牌。")}</span>}
              </span>
              <button className="ie-btn secondary ie-btn-xs" data-testid="ie-use-cp-chain" disabled={!chainReady} title={chainDisabledReason} onClick={() => doAction(() => moves.useCpChain())}>
                {bi(locale, "Use CP chain", "使用 CP 链")}
              </button>
              {!chainReady && chainDisabledReason && <span className="ie-muted ie-tray-chain-reason" data-testid="ie-cp-chain-reason">{chainDisabledReason}</span>}
            </div>

            <div className="ie-hand">
              {hand.map((id) => {
                const card = cardById(id);
                const a = availability(id);
                const expandedCard = expandAll || expandedId === id;
                return (
                  <article
                    key={id}
                    className={`ie-card${expandedCard ? " expanded" : ""}`}
                    data-testid={`ie-card-${id}`}
                    data-card-kind={card.kind}
                    data-expanded={expandedCard ? "true" : "false"}
                  >
                    {/* The folded row: the three things a player picks a card
                        by — its name, its CP value and its type.  Everything
                        else lives behind the tap. */}
                    <button
                      type="button"
                      className="ie-card-open"
                      data-testid={`ie-open-card-${id}`}
                      aria-expanded={expandedCard ? "true" : "false"}
                      aria-controls={`ie-card-body-${id}`}
                      aria-label={`${bi(locale, "Card", "卡牌")}: ${locale === "zh_CN" ? card.titleZh : card.title}`}
                      onClick={() => { if (!expandAll) setExpandedId(expandedCard ? null : id); }}
                    >
                      <span className="ie-card-cp" data-testid={`ie-card-cp-${id}`}>{card.cp}</span>
                      <span className="ie-card-name">{locale === "zh_CN" ? card.titleZh : card.title}</span>
                      <span className="ie-card-type" data-testid={`ie-card-type-${id}`}>{t.cardType[card.type]}</span>
                      <span className="ie-card-caret" aria-hidden="true">{expandedCard ? "▾" : "▸"}</span>
                    </button>
                    {expandedCard && (
                      <div className="ie-card-body" id={`ie-card-body-${id}`}>
                        <button
                          type="button"
                          className="ie-card-face-button"
                          data-testid={`ie-card-face-${id}`}
                          title={bi(locale, "Open the full card", "查看完整卡牌")}
                          onClick={() => openInspector({card}, id)}
                        >
                          {cardFace(card)}
                        </button>
                        <div className="ie-card-body-actions">
        {hasOperation(id) ? (
                            <div className="ie-card-actions">{actionButtons(id, "expanded")}</div>
                          ) : (
                            <div className="ie-card-why" data-testid={`ie-card-why-${id}`}>
                              <span>{bi(locale, "No operation available right now.", "当前没有可执行的操作。")}</span>
                              {availability(id).reasons.slice(0, 2).map((reason) => (
                                <span key={reason} className="ie-card-why-line">{reason}</span>
                              ))}
                            </div>
                          )}
                          <CardTranslation card={card} locale={locale}/>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              {hand.length === 0 && <div className="ie-muted">{t.hand}: 0 {t.cards}</div>}
            </div>

            <div className="ie-tray-extras">
              {responseWindow && <div className="ie-hint ie-response-hint">{bi(locale, "Response window: you may play a response card instead of an impulse.", "响应窗口：你可以打出响应牌代替本次行动。")}</div>}

              {G.gw?.active && me.gwCard && (phase === "gwPlanning" || phase === "gwManeuver") && (() => {
                const gwId = me.gwCard!;
                const gwCard = cardById(gwId);
                const cpProblem = gwCardProblem(G, viewer, "cp");
                const eventProblem = gwCardProblem(G, viewer, "event");
                const canGwCard = !eliminated && isActive && pending === null;
                return (
                  <div className="ie-tray-gw" data-testid={`ie-gw-card-${gwId}`}>
                    <div className="ie-section-title">{bi(locale, "Great War card", "大战卡")} · {t.cp}: {me.gwBudget ?? 0}</div>
                    <article className="ie-card ie-card-standalone">
                      <button type="button" className="ie-card-open" onClick={() => openInspector({card: gwCard}, gwId)}>
                        {cardFace(gwCard)}
                      </button>
                      <div className="ie-card-actions">
                        <button disabled={!canGwCard || cpProblem !== null} title={gwImpulseReasonText(locale, cpProblem)} onClick={() => doAction(() => moves.playGwCardMove("cp"))}>{bi(locale, "Bonus action", "奖励行动")}</button>
                        <button disabled={!canGwCard || eventProblem !== null} title={gwImpulseReasonText(locale, eventProblem) ?? undefined} onClick={() => doAction(() => moves.playGwCardMove("event"))}>{t.eventMode}</button>
                      </div>
                    </article>
                  </div>
                );
              })()}

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

              {phase === "diplomacy" && giveCards.length > 0 && (
                <div className="ie-tray-give" data-testid="ie-give-card">
                  <div className="ie-section-title">
                    {bi(locale, "Give a card (diplomacy)", "转交卡牌（外交阶段）")}
                    <span className="ie-choice-tag" data-testid="ie-give-card-optional">{bi(locale, "Optional", "可选")}</span>
                  </div>
                  <div className="ie-inline">
                    <select className="ie-select" value={giveTarget} onChange={(e) => setGiveTarget(e.target.value as Power)}>
                      {(["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]).filter((p) => p !== viewer).map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                    </select>
                    <select className="ie-select" value={giveCardValue} onChange={(e) => setGiveCardId(e.target.value)}>
                      {giveCards.map((id) => <option key={id} value={id}>{homeCardTitle(id)}</option>)}
                    </select>
                    <button className="ie-btn" disabled={giveTarget === viewer || !giveCardValue} onClick={() => doAction(() => moves.giveCard(giveTarget, giveCardValue))}>{bi(locale, "Give", "转交")}</button>
                  </div>
                  {giveCardValue && (
                    <div className="ie-choice-grid ie-give-preview">
                      <article className="ie-card ie-choice-card" data-testid="ie-give-card-preview" data-card-id={giveCardValue}>
                        <CardFace card={cardById(giveCardValue)} locale={locale}/>
                      </article>
                    </div>
                  )}
                  <div className="ie-hint" data-testid="ie-give-card-hint">
                    {bi(locale, "Optional: giving a card is never required — skip it and carry on with diplomacy.", "可选：转交卡牌并非必须——不做也可以继续外交阶段。")}
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
          actions={inspectorCard ? actionButtons(inspectorCard.id, "inspector") : null}
          unavailable={inspectorCard
            ? availability(inspectorCard.id).reasons
            : [bi(locale, "National Goals have no card operation - they score at game end.", "国家目标没有卡牌操作——在游戏结束时计分。")]}
        />
      )}
    </section>
  );
};
