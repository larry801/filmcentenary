import React from "react";
import {ImperialElegyState, Power} from "../types";
import {cardById} from "../engine/deck";
import {GOALS_BY_ID} from "../constant/goals";
import {gwEventHint} from "../engine/playability";
import Button from "@mui/material/Button";
import {IEBadge, IEChip, IEPanel} from "./theme";
import {ieT} from "./i18n";
import {POWER_KEYS, bi, cardArt} from "./boardHelpers";

export interface HandPanelProps {
  G: ImperialElegyState;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  phase: string;
  isActive: boolean;
  eliminated: boolean;
  pending: ImperialElegyState["pending"];
  canPhaseAct: boolean;
  hasPhaseButtons: boolean;
  forcedPass: boolean;
  forcedPassTitle: string;
  hand: string[];
  handCounts: Partial<Record<Power, number>>;
  renderCard: (id: string) => React.ReactElement;
  homeCardTitle: (id: string) => string;
  saveList: string[];
  ngChoices: string[];
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
}

export const HandPanel = (props: HandPanelProps) => {
  const {
    G, viewer, me, locale, t, phase, isActive, eliminated, pending, canPhaseAct, hasPhaseButtons,
    forcedPass, forcedPassTitle, hand, renderCard, homeCardTitle, saveList, ngChoices,
    giveCards, giveCardId, setGiveCardId, giveTarget, setGiveTarget, giveCardValue,
    responseInHand, responseWindow, chainNonEmpty, chainSpendable, chainCap,
    chainReady, chainDisabledReason, doAction, moves,
  } = props;

  const giveTargets = POWER_KEYS.filter((p) => p !== viewer);

  return (
    <IEPanel
      title={`${t.hand}${viewer ? ` · ${t.seats[viewer]}` : ""}`}
      actions={hasPhaseButtons ? (
        <div className="ie-inline" data-testid="ie-impulse-actions">
          {phase === "prep" && canPhaseAct && !me?.flags.prepDone && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.finishPrep())}>{t.finishPrep}</Button>}
          {phase === "diplomacy" && canPhaseAct && me && me.homeCards.length > 0 && !me.selectedHomeCard && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.chooseHomeCard(me.homeCards.find((id) => id !== me.selectedHomeCard) ?? me.homeCards[0]))}>{t.chooseHome}</Button>}
          {phase === "diplomacy" && canPhaseAct && me?.selectedHomeCard && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.endDiplomacy())}>{t.endDiplomacy}</Button>}
          {phase === "action" && isActive && !eliminated && <Button size="small" variant="outlined" disabled={forcedPass} title={forcedPass ? forcedPassTitle : undefined} onClick={() => doAction(() => moves.pass())}>{t.pass}</Button>}
          {phase === "action" && isActive && !eliminated && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.endImpulse())}>{t.endImpulse}</Button>}
          {phase === "end" && canPhaseAct && <Button size="small" variant="outlined" onClick={() => doAction(() => moves.endPhaseTurn())}>{t.continue}</Button>}
        </div>
      ) : undefined}
    >
      {!viewer || !me ? <div className="ie-muted">{t.privateInfo}: {t.hidden}. {t.spectators}.</div> : (
        <>
          <div className="ie-hand-meta">
            <IEChip>{t.cp}: {G.cpRemaining}</IEChip>
            <IEChip>{t.hand}: {hand.length} {t.cards}</IEChip>
            <IEChip>{t.cpChain}: {me.cpChain.length}/2</IEChip>
            {responseInHand && <IEChip>{t.responseCard}: {hand.filter((id) => cardById(id).type === "response").length}</IEChip>}
            {me.industryCard && <IEChip>{t.industryCard}: {homeCardTitle(me.industryCard)}</IEChip>}
            {saveList.length > 0 && <IEChip>{t.savedCards}: {saveList.map(homeCardTitle).join(", ")}</IEChip>}
          </div>
          <div className="ie-cp-chain" data-testid="ie-cp-chain">
            <div className="ie-section-title">
              <span>{t.cpChain} · {bi(locale, "spendable CP", "可用 CP")}</span>
              <span className="ie-cp-chain-total" data-testid="ie-cp-chain-total">{chainSpendable}/{chainCap}</span>
            </div>
            <div className="ie-inline ie-cp-chain-cards">
              {chainNonEmpty
                ? me.cpChain.map((id) => <IEChip key={id}>{homeCardTitle(id)}</IEChip>)
                : <span className="ie-muted">{bi(locale, "No chained cards.", "CP 链中没有牌。")}</span>}
            </div>
            <div className="ie-inline">
              <button className="ie-btn" data-testid="ie-use-cp-chain" disabled={!chainReady} title={chainDisabledReason} onClick={() => doAction(() => moves.useCpChain())}>
                {bi(locale, "Use CP chain", "使用 CP 链")}
              </button>
              {!chainReady && chainDisabledReason && <span className="ie-muted" data-testid="ie-cp-chain-reason">{chainDisabledReason}</span>}
            </div>
          </div>
          {responseWindow && <div className="ie-hint ie-response-hint">{bi(locale, "Response window: you may play a response card instead of an impulse.", "响应窗口：你可以打出响应牌代替本次行动。")}</div>}
          <div className="ie-hand">{hand.map(renderCard)}</div>
          {hand.length === 0 && <div className="ie-muted">{t.hand}: 0 {t.cards}</div>}

          {G.gw?.active && me.gwCard && (phase === "gwPlanning" || phase === "gwManeuver") && (
            <div className="ie-hand-section">
              <div className="ie-section-title">{bi(locale, "Great War card", "大战卡")} · {t.cp}: {me.gwBudget ?? 0}</div>
              {(() => {
                const gwId = me.gwCard!;
                const gwCard = cardById(gwId);
                const canGwCard = viewer !== null && !eliminated && pending === null && (phase === "gwPlanning" || (phase === "gwManeuver" && isActive));
                const gwHint = gwEventHint(G, gwId);
                const gwEventTitle = gwHint === "gw-turn-0"
                  ? bi(locale, "Exhaustion: neither event triggers on GW turn 0.", "精疲力竭：首轮大战不触发任一效果。")
                  : undefined;
                return (
                  <article className="ie-card" data-testid={`ie-gw-card-${gwId}`}>
                    <div className="ie-card-cp">{gwCard.cp}</div>
                    {cardArt(gwCard.image) ? <img src={cardArt(gwCard.image)} alt={gwCard.title}/> : null}
                    <div className="ie-card-body"><div className="ie-card-title">{locale === "zh_CN" ? gwCard.titleZh : gwCard.title}</div><div>{gwCard.text}</div><div className="ie-card-zh">{gwCard.textZh}</div></div>
                    <div className="ie-card-actions">
                      <button disabled={!canGwCard} onClick={() => doAction(() => moves.playGwCardMove("cp"))}>{t.cpMode}</button>
                      <button disabled={!canGwCard} title={gwEventTitle} onClick={() => doAction(() => moves.playGwCardMove("event"))}>{t.eventMode}</button>
                    </div>
                  </article>
                );
              })()}
            </div>
          )}

          {phase === "diplomacy" && me.homeCards.length > 0 && (
            <div className="ie-hand-section">
              <div className="ie-section-title">{t.chooseHome}:</div>
              <div className="ie-inline">
                {me.homeCards.map((id) => {
                  const chosen = me.selectedHomeCard === id;
                  return <button key={id} className={`ie-btn secondary${chosen ? " selected" : ""}`} aria-pressed={chosen} disabled={!canPhaseAct || me.selectedHomeCard !== null} onClick={() => doAction(() => moves.chooseHomeCard(id))}>{chosen ? "✓ " : ""}{homeCardTitle(id)}</button>;
                })}
              </div>
            </div>
          )}

          {me.goals.length > 0 && (
            <div className="ie-hand-section">
              <div className="ie-section-title">{t.goals}:</div>
              <div className="ie-inline">
                {me.goals.map((id) => {
                  const goal = GOALS_BY_ID[id];
                  const image = goal ? `/imperial-elegy/cards/goal-${goal.power}-${String(goal.number).padStart(2, "0")}.png` : undefined;
                  return <div key={id} className="ie-card" style={{width: 130}} data-testid={`ie-goal-${id}`}>
                    {image && <img src={image} alt={goal?.title}/>}
                    <div className="ie-card-body"><div className="ie-card-title">{locale === "zh_CN" ? goal?.titleZh : goal?.title}</div><div>{locale === "zh_CN" ? goal?.textZh : goal?.text}</div></div>
                  </div>;
                })}
              </div>
            </div>
          )}

          {phase === "end" && ngChoices.length > 0 && (
            <div className="ie-hand-section ie-goal-choice" data-testid="ie-goal-choice">
              <div className="ie-section-title">{bi(locale, "Draw three National Goals and keep one", "抽三张国家目标并保留一张")}</div>
              <div className="ie-inline">
                {ngChoices.map((id) => (
                  <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.chooseGoal(id))}>{locale === "zh_CN" ? GOALS_BY_ID[id]?.titleZh : GOALS_BY_ID[id]?.title}</button>
                ))}
              </div>
              <div className="ie-hint">{bi(locale, "Continuing without a choice keeps the first Goal.", "未选择即继续时自动保留第一张目标。")}</div>
            </div>
          )}

          {phase === "prep" && canPhaseAct && !me.flags.prepStability && (
            <div className="ie-hand-section">
              <div className="ie-section-title">{t.discardForStability}:</div>
              <div className="ie-inline">
                {hand.filter((id) => cardById(id).type !== "mandatory" && cardById(id).kind !== "home").map((id) => (
                  <button key={id} className="ie-btn secondary" onClick={() => doAction(() => moves.discardForStability(id))}>{homeCardTitle(id)}</button>
                ))}
              </div>
            </div>
          )}

          {phase === "diplomacy" && giveCards.length > 0 && (
            <div className="ie-hand-section" data-testid="ie-give-card">
              <div className="ie-section-title">{bi(locale, "Give a card (diplomacy)", "转交卡牌（外交阶段）")}</div>
              <div className="ie-inline">
                <select className="ie-select" value={giveTarget} onChange={(e) => setGiveTarget(e.target.value as Power)}>
                  {giveTargets.map((p) => <option key={p} value={p}>{t.seats[p]}</option>)}
                </select>
                <select className="ie-select" value={giveCardValue} onChange={(e) => setGiveCardId(e.target.value)}>
                  {giveCards.map((id) => <option key={id} value={id}>{homeCardTitle(id)}</option>)}
                </select>
                <button className="ie-btn" disabled={giveTarget === viewer || !giveCardValue} onClick={() => doAction(() => moves.giveCard(giveTarget, giveCardValue))}>{bi(locale, "Give", "转交")}</button>
              </div>
            </div>
          )}
        </>
      )}
    </IEPanel>
  );
};
