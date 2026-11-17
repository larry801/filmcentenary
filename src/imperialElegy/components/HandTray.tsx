import React from "react";
import {ImperialElegyState, Power} from "../types";
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
import {CardChoiceFace} from "./CardChoice";
import {CardFaceMode, cardImageSrc, readConfirmActions} from "./preferences";
import {RuleLink} from "./RuleRef";
import {ConfirmButton} from "./ConfirmButton";
import {CARD_TYPE_GLYPH, cardAvailability, cardTypeIcon, sortCards, type CardAvailability, type CardFilter, type CardSort} from "./cardAvailability";

export interface HandTrayProps {
  /** Live `confirmActions` preference (the Display menu writes it). */
  confirmActions?: boolean;
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
  giveTarget: Power;
  setGiveTarget: (p: Power) => void;
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
   * A decision is owed on screen (phone redesign): the sheet shows a compact
   * peek line instead of the hand, so the map target it asks about stays
   * visible.  The controls stay in the DOM; tapping the toggle still opens it.
   */
  decisionPeek?: boolean;
  /**
   * Unfold every card at once.  The board never sets this; it exists for embeds
   * and for the rules-level suites, which assert on a card's buttons without
   * driving a click through a static render.
   */
  expandAll?: boolean;
  /** Mobile third drawer position: peek (closed), half (open), full (expanded). */
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onOpenReference?: (anchor: string) => void;
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
    forcedCardIds, hand, saveList, giveCards, giveTarget, setGiveTarget,
    responseInHand, responseWindow, chainNonEmpty, chainSpendable, chainCap,
    chainReady, chainDisabledReason, cpBudget, doAction, moves, handChoicesHint,
    cardFaceMode, open, onToggleOpen, expanded = false, onToggleExpanded, decisionPeek = false,
    onOpenReference, expandAll = false,
  } = props;
  const [inspector, setInspector] = React.useState<{face: CardChoiceFace; key: string} | null>(null);
  /**
   * Which hand card is unfolded.  The tray lists one row per card — CP value,
   * name, type — and only the unfolded row carries its face and its buttons.
   * Sixteen stacked card faces with two buttons each was unreadable, and a
   * horizontal strip hid the fourth card off-screen.
   *
   * A card that forbids passing opens itself: hiding the only legal move behind
   * a tap would be a trap.  `expandAll` (tests, embeds) opens every row.
   */
  const [expandedId, setExpandedId] = React.useState<string | null>(() => forcedCardIds[0] ?? null);
  // Reads the saved preference when the tray mounts; `Preferences` in the
  // command menu writes it, and the tray picks the new value up on remount.
  // The board passes the live preference so the Display menu can flip it; a
  // caller that renders the tray alone still gets the stored value.
  const storedConfirm = React.useMemo(() => readConfirmActions(), []);
  const confirmActions = props.confirmActions ?? storedConfirm;
  const [filter, setFilter] = React.useState<CardFilter>("all");
  const [sort, setSort] = React.useState<CardSort>("printed");

  if (!viewer || !me) return null;

  const homeCardTitle = (id: string): string => {
    const card = cardById(id);
    return card ? (locale === "zh_CN" ? card.titleZh : card.title) : id;
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

  // Filter and order the face rows in the tray only; the chain, the Great War
  // card and the Goals panel keep their own order.
  const visibleHand = sortCards(hand, {filter, sort, availability: (id) => availability(id), viewer});

  /**
   * Whether the unfolded card has any operation to offer at all — legal right
   * now, or merely blocked.  A disabled button carrying its reason is how a
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
          // Playing a card for CP commits the impulse's CP: a second click
          // confirms it, unless the player has turned confirmations off.
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
                `Play ${cardById(id).title} for ${cardById(id).cp} CP`,
                `打出 ${cardById(id).titleZh}：${cardById(id).cp} CP`),
              reason: cpDisabled ? a.reasons[0] ?? mandatoryTitle : undefined,
            })}
          >
            {t.cpMode}
          </ConfirmButton>
        )}
        {(where === "inspector" || a.eventAllowed) && (
          <ConfirmButton
            key="event"
            className="ie-card-primary"
            data-testid={`ie-play-event-${id}`}
            disabled={!a.eventModeOk}
            data-blocked={a.eventBlockKey}
            title={!a.eventModeOk ? a.eventBlockReason : undefined}
            confirm={confirmActions}
            confirmLabel={bi(locale, "Confirm: play the event", "确认：打出事件")}
            onConfirm={() => doAction(() => moves.playCard(id, "event"), {
              label: bi(locale, `Play ${cardById(id).title}'s event`, `打出 ${cardById(id).titleZh} 事件`),
              reason: !a.eventModeOk ? a.eventBlockReason : undefined,
            })}
          >
            {t.eventMode}
          </ConfirmButton>
        )}
        {(where === "inspector" || a.showResponse) && a.showResponse && (
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
        {where === "inspector" && <button key="industry" data-testid={`ie-industrialize-${id}`} disabled={!a.industOk} onClick={() => doAction(() => moves.industrialize(id), {label: t.industrialize, reason: a.firstReason})}>{t.industrialize}</button>}
        {where === "inspector" && <button key="chain" data-testid={`ie-cp-chain-add-${id}`} disabled={!a.chainOk} onClick={() => doAction(() => moves.cpChain(id), {label: t.cpChain, reason: a.firstReason})}>{t.cpChain}</button>}
        {where === "inspector" && <button key="save" data-testid={`ie-save-${id}`} aria-pressed={a.saved} disabled={!a.saveOk} onClick={() => doAction(() => moves.saveCard(id), {label: a.saved ? t.unsave : t.saveCard, reason: a.firstReason})}>{a.saved ? t.unsave : t.saveCard}</button>}
      </>
    );
  };

  const cardFace = (card: CardDef) => {
    const src = cardImageSrc(card.image);
    if (cardFaceMode === "print" && src) {
      return <img className="ie-card-face ie-card-print" src={src} alt={locale === "zh_CN" ? card.titleZh : card.title} data-card-id={card.id} loading="lazy"/>;
    }
    return <CardFace card={card} locale={locale} showTranslation={false} t={t}/>;
  };

  const openInspector = (face: CardChoiceFace, key: string) => setInspector({face, key});
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
          <span aria-hidden="true">{shownOpen ? "▾" : "▸"}</span>
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
            <span aria-hidden="true">{expanded ? "▾" : "▴"}</span>
          </button>
        )}
        <span className="ie-tray-count" data-testid="ie-hand-count">{hand.length} {t.cards}</span>
        <div className="ie-hand-meta">
          <IEChip>{t.cpChain}: {me.cpChain.length}/2</IEChip>
          {saveList.length > 0 && <IEChip>{t.savedCards}: {saveList.map(homeCardTitle).join(", ")}</IEChip>}
          {responseInHand && <IEChip>{t.responseCard}: {hand.filter((id) => cardById(id).type === "response").length}</IEChip>}
          {me.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(me.industryCard)}</IEChip>}
        </div>
        <div className="ie-hand-tools" data-testid="ie-hand-tools">
          <label className="ie-hand-tool">
            <span>{bi(locale, "Filter", "筛选")}</span>
            <select className="ie-select" data-testid="ie-hand-filter" value={filter} onChange={(event) => setFilter(event.target.value as CardFilter)}>
              <option value="all">{bi(locale, "All", "全部")}</option>
              <option value="playable">{bi(locale, "Playable now", "现在可打")}</option>
              <option value="event">{t.cardType.event}</option>
              <option value="response">{t.cardType.response}</option>
              <option value="combat">{t.cardType.combat}</option>
              <option value="mandatory">{t.cardType.mandatory}</option>
            </select>
          </label>
          <label className="ie-hand-tool">
            <span>{bi(locale, "Sort", "排序")}</span>
            <select className="ie-select" data-testid="ie-hand-sort" value={sort} onChange={(event) => setSort(event.target.value as CardSort)}>
              <option value="printed">{bi(locale, "Printed order", "卡面顺序")}</option>
              <option value="cp">{bi(locale, "CP", "CP 值")}</option>
              <option value="type">{bi(locale, "Type", "类型")}</option>
              <option value="decade">{bi(locale, "Decade", "年代")}</option>
            </select>
          </label>
        </div>
        {decisionPeek && (
          <span className="ie-tray-decision-line" data-testid="ie-tray-decision-peek" role="status">
            {bi(locale, "A decision is waiting — answer it in the panel", "有决策待处理——请在面板中作答")}
          </span>
        )}
        {handChoicesHint !== null && (
          <span className="ie-hand-hint" data-testid="ie-hand-choices-hint">{handChoicesHint}</span>
        )}
      </header>

      {shownOpen && (
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
              <button className="ie-btn secondary ie-btn-xs" data-testid="ie-use-cp-chain" disabled={!chainReady} title={chainDisabledReason} onClick={() => doAction(() => moves.useCpChain(), {label: bi(locale, "Use the CP chain", "使用 CP 链"), reason: chainDisabledReason})}>
                {bi(locale, "Use CP chain", "使用 CP 链")}
              </button>
              {!chainReady && chainDisabledReason && <span className="ie-muted ie-tray-chain-reason" data-testid="ie-cp-chain-reason">{chainDisabledReason}</span>}
            </div>

            <div className="ie-hand">
              {visibleHand.map((id) => {
                const card = cardById(id);
                const a = availability(id);
                const playable = a.cpModeOk || a.eventModeOk || a.responseOk;
                const rowOpen = expandAll || expandedId === id;
                return (
                  <article
                    key={id}
                    className={`ie-card${playable ? " playable" : ""}${a.saved ? " saved" : ""}${rowOpen ? " expanded" : ""}`}
                    data-expanded={rowOpen ? "true" : "false"}
                    data-testid={`ie-card-${id}`}
                    data-card-kind={card.kind}
                    data-playable={playable ? "true" : "false"}
                    data-card-type={cardTypeIcon(card.kind, card.type)}
                  >
                    <span className={`ie-card-type ie-card-type-${cardTypeIcon(card.kind, card.type)}`} aria-hidden="true" title={t.cardType[card.type as keyof typeof t.cardType] ?? card.kind}>
                      {CARD_TYPE_GLYPH[cardTypeIcon(card.kind, card.type)]}
                    </span>
                    {/* The folded row: the four things a player picks a card by
                        — its type glyph, CP value, name and whether it is
                        playable right now.  Everything else is behind the tap. */}
                    <button
                      type="button"
                      className="ie-card-open"
                      data-testid={`ie-open-card-${id}`}
                      aria-expanded={rowOpen ? "true" : "false"}
                      aria-controls={`ie-card-body-${id}`}
                      aria-label={`${bi(locale, "Card", "卡牌")}: ${locale === "zh_CN" ? card.titleZh : card.title}`}
                      onClick={() => { if (!expandAll) setExpandedId(rowOpen ? null : id); }}
                    >
                      <span className="ie-card-cp" data-testid={`ie-card-cp-${id}`}>{card.cp}</span>
                      <span className="ie-card-name">{locale === "zh_CN" ? card.titleZh : card.title}</span>
                      <span className="ie-card-status" data-testid={`ie-card-status-${id}`} data-playable={playable ? "true" : "false"}>
                        {playable
                          ? (a.cpModeOk ? bi(locale, "For CP", "可作 CP") : a.eventModeOk ? bi(locale, "Event", "事件") : bi(locale, "Response", "响应"))
                          : a.firstReason ?? ""}
                      </span>
                      <span className="ie-card-caret" aria-hidden="true">{rowOpen ? "▾" : "▸"}</span>
                    </button>
                    {rowOpen && (
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
                              {a.reasons.slice(0, 2).map((reason) => (
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
              {hand.length > 0 && visibleHand.length === 0 && (
                <div className="ie-muted" data-testid="ie-hand-empty-filter">{bi(locale, "No card matches this filter.", "没有符合筛选条件的卡牌。")}</div>
              )}
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
                        <button disabled={!canGwCard || cpProblem !== null} title={gwImpulseReasonText(locale, cpProblem)} onClick={() => doAction(() => moves.playGwCardMove("cp"), {label: bi(locale, "Bonus action", "奖励行动"), reason: gwImpulseReasonText(locale, cpProblem) ?? undefined})}>{bi(locale, "Bonus action", "奖励行动")}</button>
                        <button disabled={!canGwCard || eventProblem !== null} title={gwImpulseReasonText(locale, eventProblem) ?? undefined} onClick={() => doAction(() => moves.playGwCardMove("event"), {label: t.eventMode, reason: gwImpulseReasonText(locale, eventProblem) ?? undefined})}>{t.eventMode}</button>
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
                  {/* A visible control now: the old CSS hid it until focus, which
                      made "give a card" undiscoverable for mouse users. */}
                  <div className="ie-section-title">
                    {bi(locale, "Give a random card (diplomacy)", "随机转交卡牌（外交阶段）")}
                    <span className="ie-choice-tag" data-testid="ie-give-card-optional">{bi(locale, "Optional", "可选")}</span>
                  </div>
                  <div className="ie-inline">
                    <select className="ie-select" value={giveTarget} onChange={(e) => setGiveTarget(e.target.value as Power)}>
                      {(["GE", "UK", "FR", "AU", "RU", "OT"] as Power[]).filter((p) => p !== viewer).map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                    </select>
                    <button className="ie-btn" disabled={giveTarget === viewer} onClick={() => doAction(() => moves.giveCard(giveTarget), {label: bi(locale, `Give a random card to ${t.seats[giveTarget]}`, `随机转交 1 张牌给${t.seats[giveTarget]}`)})}>{bi(locale, "Give", "转交")}</button>
                  </div>
                  <div className="ie-hint" data-testid="ie-give-card-hint">
                    {bi(locale, "Optional: the card is drawn at random from your hand, so its identity stays unknown until it is handed over. Giving is never required — skip it and carry on with diplomacy.", "可选：从你的手牌中随机抽出 1 张转交，交出前连你也无法指定是哪张。转交并非必须——不做也可以继续外交阶段。")}
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
