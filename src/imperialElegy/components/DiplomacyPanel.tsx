/**
 * Rules 11.0 / 11.1 — the diplomacy phase's negotiation table.
 *
 * 11.0 makes the diplomacy phase a conversation: players may show each other
 * their action cards, and every deal is non-binding.  11.1 is the one binding
 * clause, and it is narrow: a **formal agreement between both players** to
 * exchange a **number** of randomly drawn action cards, settled at the **end of
 * the diplomacy phase**, announced "in full view of all players".
 *
 * This panel is that table, in four blocks:
 *
 *   Shown      what this seat has shown (and what was shown to it)
 *   Offer      build a deal: target, how many cards each way, non-binding promises
 *   Inbox      the offers addressed to this seat: accept / refuse / counter
 *   Settled    this turn's draws — public by rule
 *
 * Every count is a count.  A card is never named: 11.1 forbids it, and the
 * engine draws from `ctx.random` at settlement, so the panel cannot leak a
 * hand.  The engine owns legality (`engine/negotiation.ts#dealProblem`); the
 * panel only mirrors it into a disabled state and a reason line.
 */
import React from "react";
import {DealOffer, Power, POWERS} from "../types";
import {cardById} from "../engine/deck";
import {dealProblem, dealTermsText, MAX_PROMISE_LENGTH, MAX_PROMISES, readPromises} from "../engine/negotiation";
import {cardDisplayName} from "./cardDisplay";
import {bi} from "./boardHelpers";
import {RuleLink} from "./RuleRef";
import type {OrdersSlice} from "./boardSlices";

export interface DiplomacyPanelProps extends Pick<
  OrdersSlice,
  "G" | "locale" | "viewer" | "me" | "phase" | "eliminated" | "doAction" | "moves" |
  "deals" | "pendingDeals" | "myDealOffers" | "dealTarget" | "setDealTarget" |
  "dealGive" | "setDealGive" | "dealTake" | "setDealTake" | "dealPromises" | "setDealPromises" |
  "homeChoice"
> {
  /**
   * 6.0/9.1: open the home-card choice.  The negotiation segment comes first,
   * so the choice is a dialog the seat opens when it is done talking rather
   * than a pop-up that covers this table.
   */
  onOpenHomeChoice?: () => void;
}

const powerName = (locale: "en" | "zh_CN"): ((power: Power) => string) => {
  const t = locale === "zh_CN"
    ? {GE: "德国", UK: "英国", FR: "法国", AU: "奥匈", RU: "俄国", OT: "奥斯曼"}
    : {GE: "Germany", UK: "United Kingdom", FR: "France", AU: "Austria-Hungary", RU: "Russia", OT: "Ottoman Empire"};
  return (power) => t[power];
};

/** A count, clamped into what one side can actually hold. */
const clampCount = (value: number, max: number): number =>
  Math.max(0, Math.min(Number.isFinite(value) ? Math.trunc(value) : 0, Math.max(0, max)));

export const DiplomacyPanel = (props: DiplomacyPanelProps) => {
  const {
    G, locale, viewer, me, phase, eliminated, doAction, moves,
    deals, pendingDeals, myDealOffers,
    dealTarget, setDealTarget, dealGive, setDealGive, dealTake, setDealTake, dealPromises, setDealPromises,
    homeChoice, onOpenHomeChoice,
  } = props;
  const name = powerName(locale);

  if (viewer === null) return null;
  const eligible = (power: Power): number =>
    (G.powers[power]?.hand ?? []).filter((id) => cardById(id).kind !== "home").length;
  const targets = POWERS.filter((power) => power !== viewer && G.powers[power]?.eliminated !== true);
  const target = targets.includes(dealTarget) ? dealTarget : targets[0];
  const problem = dealProblem(G, viewer, target, clampCount(dealGive, eligible(viewer)), clampCount(dealTake, eligible(target)));
  const canDeal = phase === "diplomacy" && !eliminated && target !== undefined && problem === null;

  const reasonText = (code: string | null): string | undefined => {
    if (code === null) return undefined;
    switch (code) {
      case "not-diplomacy": return bi(locale, "Deals may only be made in the diplomacy phase.", "交易只能在外交阶段提出。");
      case "same-power": return bi(locale, "A power cannot deal with itself.", "不能与自己交易。");
      case "no-target": return bi(locale, "Choose another power.", "请选择另一个强国。");
      case "eliminated": return bi(locale, "That power is out of the game.", "该强国已被淘汰。");
      case "nothing-moved": return bi(locale, "A deal must move at least one card.", "交易至少要转交 1 张牌。");
      case "too-many-cards": return bi(locale, "One side does not hold that many cards.", "有一方手牌不足该数量。");
      default: return code;
    }
  };

  /** The offer the reader is currently countering, if the form is in that mode. */
  const [counterOf, setCounterOf] = React.useState<string | null>(null);
  const countering = counterOf === null ? undefined : pendingDeals.find((offer) => offer.id === counterOf);
  React.useEffect(() => {
    if (counterOf !== null && pendingDeals.every((offer) => offer.id !== counterOf)) setCounterOf(null);
  }, [counterOf, pendingDeals]);

  /** Mirror an offer into the form so a counter starts from the same terms. */
  const startCounter = (offer: DealOffer): void => {
    setCounterOf(offer.id);
    setDealTarget(offer.from);
    setDealGive(offer.take);
    setDealTake(offer.give);
    setDealPromises(offer.promises.map((promise) => promise.text).join("\n"));
  };

  const send = (): void => {
    const promises = readPromises(dealPromises.split("\n").map((text) => ({text})), viewer);
    if (countering !== undefined) {
      // 11.1 counter-offer: the form's counts are the countering side's own, so
      // the directions flip and the previous offer leaves the table.
      doAction(
        () => moves.counterDeal(countering.id, clampCount(dealGive, eligible(viewer)), clampCount(dealTake, eligible(countering.from)), promises),
        {label: bi(locale, "Counter the deal", "提出还价"), reason: reasonText(problem)},
      );
      setCounterOf(null);
      return;
    }
    doAction(
      () => moves.proposeDeal(target, clampCount(dealGive, eligible(viewer)), clampCount(dealTake, eligible(target)), promises),
      {label: bi(locale, "Propose the deal", "提出交易"), reason: reasonText(problem)},
    );
  };

  /** The offers this seat offered, so it can withdraw them. */
  const mine = myDealOffers.filter((offer) => offer.status === "proposed" && offer.from === viewer);
  const settled = deals.history.filter((record) => record.turn === G.turn);

  return (
    <div className="ie-deals" data-testid="ie-deals">
      <div className="ie-deals-intro">
        <div className="ie-section-title">
          {bi(locale, "Negotiation table", "谈判桌")} <RuleLink anchor="rules:diplomacy" label="11.0" locale={locale}/>
        </div>
        <p className="ie-hint">
          {bi(locale,
            "Deals are non-binding talk: show cards, promise whatever you like. The only binding clause is 11.1 — a formal agreement to hand over randomly drawn action cards, settled when the diplomacy phase ends.",
            "协议本身不具约束力：可以出示手牌、随口许诺。唯一有约束力的是 11.1——双方正式同意随机转交行动牌，并在外交阶段结束时结算。")}
        </p>
      </div>

      {/* 6.0 / 9.1: the negotiation segment comes first, and the home-card
          choice is the seat's own next step.  It used to be raised over the
          board the instant diplomacy opened, which covered this table; the
          button keeps the printed order ("negotiate, then choose"). */}
      {homeChoice && onOpenHomeChoice !== undefined && (
        <div className="ie-deals-block" data-testid="ie-deals-home-step">
          <div className="ie-section-title">{bi(locale, "Next: choose your home card", "下一步：选择本土牌")}</div>
          <p className="ie-hint">
            {bi(locale,
              "When you are done negotiating, choose the Home card you keep for this turn. The choice opens in a dialog and can be closed again without answering.",
              "谈判结束后，选择本回合保留的本土牌。选择会在对话框中打开，也可关闭后稍再返回。")}
          </p>
          <div className="ie-inline">
            <button
              type="button"
              className="ie-btn primary"
              data-testid="ie-open-home-card-from-deals"
              onClick={onOpenHomeChoice}
            >
              {bi(locale, "Choose home card", "选择本土牌")}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ 11.0 shown */}
      {(deals.shown.length > 0) && (
        <div className="ie-deals-block" data-testid="ie-deals-shown">
          <div className="ie-section-title">{bi(locale, "Cards on the table", "桌面上的明牌")}</div>
          <ul className="ie-deals-list">
            {deals.shown.map((entry) => (
              <li key={`${entry.from}-${entry.to ?? "table"}-${entry.card}`} data-testid={`ie-deals-shown-${entry.card}`}>
                {entry.to === null
                  ? bi(locale, `${name(entry.from)} showed ${cardDisplayName(cardById(entry.card), locale)} to the table.`,
                    `${name(entry.from)}向全桌展示了${cardDisplayName(cardById(entry.card), locale)}。`)
                  : bi(locale,
                    `${name(entry.from)} showed ${cardDisplayName(cardById(entry.card), locale)} to ${name(entry.to)} privately.`,
                    `${name(entry.from)}私下向${name(entry.to)}展示了${cardDisplayName(cardById(entry.card), locale)}。`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* -------------------------------------------------------- 11.1 the form */}
      <div className="ie-deals-block" data-testid="ie-deals-form">
        <div className="ie-section-title">
          {countering === undefined
            ? bi(locale, "Offer a deal", "提出交易")
            : bi(locale, `Counter ${name(countering.from)}`, `向${name(countering.from)}还价`)}
        </div>
        {countering !== undefined && (
          <p className="ie-hint" data-testid="ie-deals-counter-hint">
            {bi(locale,
              `This counters ${name(countering.from)}'s offer ${countering.id}: the counts below are what you give and receive, and their offer leaves the table.`,
              `这是对${name(countering.from)}的 ${countering.id} 的还价：下面的数字是你交出与收到的张数，对方原提议随之失效。`)}
          </p>
        )}
        <div className="ie-inline">
          <label>
            {bi(locale, "Power", "对象")}
            <select
              className="ie-select"
              data-testid="ie-deals-target"
              value={target ?? ""}
              disabled={countering !== undefined}
              onChange={(event) => setDealTarget(event.target.value as Power)}
            >
              {targets.map((power) => <option key={power} value={power}>{name(power)}</option>)}
            </select>
          </label>
          <label>
            {bi(locale, "You give", "你交出")}
            <input
              className="ie-input"
              data-testid="ie-deals-give"
              type="number"
              min={0}
              max={eligible(viewer)}
              value={clampCount(dealGive, eligible(viewer))}
              onChange={(event) => setDealGive(clampCount(Number(event.target.value), eligible(viewer)))}
            />
          </label>
          <label>
            {bi(locale, "You receive", "你收到")}
            <input
              className="ie-input"
              data-testid="ie-deals-take"
              type="number"
              min={0}
              max={target === undefined ? 0 : eligible(target)}
              value={clampCount(dealTake, target === undefined ? 0 : eligible(target))}
              onChange={(event) => setDealTake(clampCount(Number(event.target.value), target === undefined ? 0 : eligible(target)))}
            />
          </label>
        </div>
        <div className="ie-inline">
          <textarea
            className="ie-input"
            data-testid="ie-deals-promises"
            rows={2}
            maxLength={MAX_PROMISES * (MAX_PROMISE_LENGTH + 1)}
            placeholder={bi(locale, "Promises (one per line, never enforced)", "许诺（每行一条，引擎不强制执行）")}
            value={dealPromises}
            onChange={(event) => setDealPromises(event.target.value)}
          />
        </div>
        <p className="ie-hint" data-testid="ie-deals-terms">
          {bi(locale,
            `Terms: ${dealTermsText({from: viewer, to: target ?? viewer, give: clampCount(dealGive, eligible(viewer)), take: clampCount(dealTake, target === undefined ? 0 : eligible(target))}, "en", name)} Every card is drawn at random; home cards never move. Up to ${MAX_PROMISES} promises are recorded and never enforced.`,
            `条款：${dealTermsText({from: viewer, to: target ?? viewer, give: clampCount(dealGive, eligible(viewer)), take: clampCount(dealTake, target === undefined ? 0 : eligible(target))}, "zh_CN", name)} 所有卡牌随机抽取，本土牌不参与。最多记录 ${MAX_PROMISES} 条许诺，引擎不强制执行。`)}
        </p>
        {problem !== null && (
          <p className="ie-hint ie-warn" data-testid="ie-deals-problem">{reasonText(problem)}</p>
        )}
        <div className="ie-inline">
          <button
            type="button"
            className="ie-btn primary"
            data-testid="ie-deals-send"
            disabled={!canDeal}
            title={reasonText(problem)}
            onClick={send}
          >
            {countering === undefined
              ? bi(locale, "Propose", "提出")
              : bi(locale, "Send counter", "发出还价")}
          </button>
          {countering !== undefined && (
            <button
              type="button"
              className="ie-btn secondary"
              data-testid="ie-deals-cancel-counter"
              onClick={() => setCounterOf(null)}
            >
              {bi(locale, "Cancel counter", "取消还价")}
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ the inbox */}
      <div className="ie-deals-block" data-testid="ie-deals-inbox">
        <div className="ie-section-title">{bi(locale, "On the table", "待确认")}</div>
        {myDealOffers.length === 0 && <p className="ie-hint">{bi(locale, "No deal is open.", "目前没有进行中的交易。")}</p>}
        <ul className="ie-deals-list">
          {myDealOffers.map((offer) => {
            const offeredToMe = offer.to === viewer;
            const terms = dealTermsText(offer, locale, name);
            return (
              <li key={offer.id} data-testid={`ie-deal-${offer.id}`} data-status={offer.status}>
                <div className="ie-deals-terms">
                  <b>{name(offer.from)} → {name(offer.to)}</b>
                  {offer.counterOf !== undefined && <span className="ie-choice-tag">{bi(locale, "counter", "还价")}</span>}
                  {" "}
                  {offer.status === "accepted" && <span className="ie-choice-tag">{bi(locale, "agree · settle at phase end", "已同意 · 阶段末结算")}</span>}
                  <div>{terms}</div>
                  {offer.promises.length > 0 && (
                    <ul className="ie-deals-promises" data-testid={`ie-deal-${offer.id}-promises`}>
                      {offer.promises.map((promise, index) => (
                        <li key={`${offer.id}-${index}`}>
                          <i>{bi(locale, "promise (not enforced)", "许诺（不强制执行）")}</i> {promise.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {offer.status === "proposed" && offeredToMe && (
                  <div className="ie-inline">
                    <button type="button" className="ie-btn primary" data-testid={`ie-deal-${offer.id}-accept`}
                      onClick={() => doAction(() => moves.respondDeal(offer.id, true), {label: bi(locale, "Confirm the deal", "确认交易")})}>
                      {bi(locale, "Confirm", "确认")}
                    </button>
                    <button type="button" data-testid={`ie-deal-${offer.id}-refuse`}
                      onClick={() => doAction(() => moves.respondDeal(offer.id, false), {label: bi(locale, "Refuse the deal", "拒绝交易")})}>
                      {bi(locale, "Refuse", "拒绝")}
                    </button>
                    <button type="button" data-testid={`ie-deal-${offer.id}-counter`} onClick={() => startCounter(offer)}>
                      {bi(locale, "Counter", "还价")}
                    </button>
                  </div>
                )}
                {offer.status === "proposed" && offer.from === viewer && mine.some((entry) => entry.id === offer.id) && (
                  <div className="ie-inline">
                    <button type="button" data-testid={`ie-deal-${offer.id}-withdraw`}
                      onClick={() => doAction(() => moves.withdrawDeal(offer.id), {label: bi(locale, "Withdraw the offer", "撤回提议")})}>
                      {bi(locale, "Withdraw", "撤回")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ------------------------------------------------------------- settled */}
      <div className="ie-deals-block" data-testid="ie-deals-settled">
        <div className="ie-section-title">{bi(locale, "Settled this turn", "本回合已结算")}</div>
        {settled.length === 0 && (
          <p className="ie-hint">
            {bi(locale, "Nothing settled yet — confirmed deals are drawn when the diplomacy phase ends.", "尚未结算——确认的交易会在外交阶段结束时抽牌。")}
          </p>
        )}
        <ul className="ie-deals-list">
          {settled.map((record) => (
            <li key={`${record.id}-${record.turn}`} data-testid={`ie-settled-${record.id}`}>
              <b>{name(record.from)} → {name(record.to)}</b>
              {record.shortfall && <span className="ie-choice-tag">{bi(locale, "short", "人手不足")}</span>}
              <div>
                {record.given.length === 0 && record.taken.length === 0
                  ? bi(locale, "No card moved.", "没有牌完成转交。")
                  : <>
                    {record.given.length > 0 && `${name(record.from)} → ${name(record.to)}: ${record.given.map((id) => cardDisplayName(cardById(id), locale)).join(locale === "zh_CN" ? "、" : ", ")}`}
                    {record.given.length > 0 && record.taken.length > 0 && " · "}
                    {record.taken.length > 0 && `${name(record.to)} → ${name(record.from)}: ${record.taken.map((id) => cardDisplayName(cardById(id), locale)).join(locale === "zh_CN" ? "、" : ", ")}`}
                  </>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* The seat's own card count, so a count is never guessed. */}
      <p className="ie-hint" data-testid="ie-deals-counts">
        {bi(locale,
          `Your hand: ${eligible(viewer)} dealable card(s). Home cards are never drawn (11.1).`,
          `你的手牌：${eligible(viewer)} 张可交易牌。本土牌永不参与转交（11.1）。`)}
        {me === null && ` ${bi(locale, "No seat.", "无席位。")}`}
      </p>
      <p className="ie-hint">
        {bi(
          locale,
          "Only the two sides see an open offer; confirmed deals are settled, and announced, in the open.",
          "未确认的提议只对双方可见；已确认的交易会在阶段结束时公开结算。",
        )}
      </p>
    </div>
  );
};

export default DiplomacyPanel;
