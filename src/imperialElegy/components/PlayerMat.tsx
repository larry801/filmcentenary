/**
 * The player mat: the printed display, at table size.
 *
 * The printed display (published as a reference chart) is the authority for
 * every track and every value printed under a track box, so the mat repeats
 * them rather than inventing its own summary:
 *
 *  - the stability track, with the VP / BM / card effect printed in each box;
 *  - the manpower ladder, with the key box that currently supplies it;
 *  - the industry track, with the cards each level draws ("3 cards", "4 cards");
 *  - the territorial keys track, with the manpower each key count prints
 *    ("MP=1", "MP=2") and the AUTO VICTORY box;
 *  - the colonial (UK) or Arab (OT) keys track with its own MP ladder;
 *  - the reserve-armies holding box and its limit formula;
 *  - the Industry Card and CP Chain slots, and the VP / National Goal box.
 *
 * Everything numeric is read from `POWER_DEFS` and the engine's own helpers
 * (`cardsToDraw`, `reserveAllowance`, `industryTarget`), so the mat can never
 * disagree with the rules: it only prints them.
 *
 * Below 1100 px the mat collapses to a chip row (`data-collapsed`) whose
 * popover shows the same figures.  On a phone it is the dock's Mat tab.
 */
import React from "react";
import {Icon} from "./Icon";
import {ImperialElegyState, Power} from "../types";
import {GOALS_BY_ID} from "../constant/goals";
import {POWER_DEFS, type StabilityEffect} from "../constant/powers";
import {CARD_BY_ID} from "../engine/deck";
import {cardsToDraw} from "../engine/rules";
import {industryTarget, reserveAllowance} from "../engine/economy";
import {displayAnchor} from "./ChartLightbox";
import {ieT} from "./i18n";
import {bi} from "./boardHelpers";

export interface PlayerMatProps {
  G: ImperialElegyState;
  viewer: Power | null;
  me: ImperialElegyState["powers"][Power] | null;
  active: Power;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  /** Opens the reference drawer at the printed display. */
  onOpenReference?: (anchor: string) => void;
  /**
   * The phone dock shows the mat as one of its tabs, so the figures must be in
   * the DOM whether or not the reader ever pressed the chip row's toggle.  On
   * desktop this is unset and the internal `open` state rules.
   */
  forceOpen?: boolean;
}

interface Figure {
  key: string;
  label: string;
  value: React.ReactNode;
  title?: string;
}

/** One printed box of a track: its printed number, the value under it, and whether the marker is here. */
interface TrackBox {
  index: number;
  /** The number printed in the box: "0" … "12", or "6+" on a UK colonial track. */
  label: string;
  /** The value printed under the box ("3 cards", "MP=2", "AUTO VICTORY"). */
  note: string;
  current: boolean;
  title: string;
}

/** A run of consecutive boxes that print the same value ("0–2 = 3 cards"). */
interface TrackRange<T = number> {
  from: number;
  to: number;
  value: T;
}

/**
 * Group a track's printed values into the bands the display implies, so the mat
 * can say "0–2: 3 cards · 3–5: 4 cards" — the question a player actually asks
 * the industry and key tracks — instead of a caption under every box.
 */
export function trackRanges<T>(values: readonly T[]): TrackRange<T>[] {
  const ranges: TrackRange<T>[] = [];
  values.forEach((value, index) => {
    const last = ranges[ranges.length - 1];
    if (last && last.value === value) last.to = index;
    else ranges.push({from: index, to: index, value});
  });
  return ranges;
}

/**
 * The effect a stability box prints, e.g. "-2 VP · -2 BM · 1 card".
 *
 * `formatCards(count, signed)` lets the caller localize the counter word; the
 * `signed` flag prints "+1 card" for a `cardDelta`, which the printed boxes do
 * ("+1 card" in the 6 box of every display).
 */
export const stabilityNote = (effect: StabilityEffect, formatCards: (count: number, signed?: boolean) => string): string => {
  const parts: string[] = [];
  if (effect.vp) parts.push(`${effect.vp} VP`);
  if (effect.bm) parts.push(`${effect.bm} BM`);
  if (effect.abm) parts.push(`${effect.abm} ABM`);
  if (effect.cards !== undefined) parts.push(formatCards(effect.cards));
  if (effect.cardDelta) parts.push(formatCards(effect.cardDelta, true));
  return parts.join(" · ");
};

/** The printed box number: "0", "12", "6+". */
const boxLabel = (index: number, last: number, openEnded: boolean): string =>
  openEnded && index === last ? `${index}+` : String(index);

const rangeLabel = (range: TrackRange<unknown>, last: number, openEnded: boolean): string => {
  if (range.from === range.to) return boxLabel(range.from, last, openEnded);
  return `${range.from}–${openEnded && range.to === last ? `${range.to}+` : range.to}`;
};

export const PlayerMat = ({G, viewer, me, active, locale, t, onOpenReference, forceOpen = false}: PlayerMatProps) => {
  // Phones collapse the mat to its chip row; desktop shows the numbers.
  const [open, setOpen] = React.useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  if (!viewer || !me) return null;

  // The phone dock treats the mat as an always-open tab body; the toggle still
  // writes the state the desktop layout reads.
  const shownOpen = forceOpen || open;

  const def = POWER_DEFS[viewer];
  // Only the UK and OT displays print a secondary (colonial / Arab) manpower
  // ladder; `ensureStateDefaults` fills `secondaryManpower`/`arabKeys` on every
  // power, so the printed tracks — not the state shape — decide what shows.
  const hasSecondaryManpower = def.secondaryKeyManpower !== undefined;
  const arabKeys = viewer === "OT" ? me.arabKeys : undefined;
  const reserves = me.reserves.length;
  // 7.3: the printed holding box prints its own formula, so the limit is the
  // engine's `reserveAllowance`, not a second guess at it.
  const reserveCap = reserveAllowance(G, viewer);
  const goals = me.goals;
  const draw = cardsToDraw(G, viewer);
  // The printed boxes read "3 cards" / "3 张卡"; `t.cards` alone is the bare
  // counter word the hand tray uses ("7 张"), which reads wrong under a box.
  const cardsLabel = (count: number, signed = false): string => {
    const shown = signed && count > 0 ? `+${count}` : String(count);
    return bi(locale, `${shown} ${Math.abs(count) === 1 ? "card" : "cards"}`, `${shown} 张卡`);
  };
  const industryRoll = industryTarget(G, viewer);
  // 29.1: a blockade lowers the printed maximum industry, so the track stops
  // where the current ceiling does — never past the printed boxes.
  const industryMax = Math.min(def.industryCards.length - 1, me.maxIndustry ?? def.industryCards.length - 1);

  // ---------------------------------------------------------------- tracks
  const stabilityEffect = def.stability[Math.max(0, Math.min(def.stability.length - 1, me.stability))] ?? {};
  const noModifier = bi(locale, "no modifier", "无修正");
  const stabilityBoxes: TrackBox[] = def.stability.map((effect, index) => {
    const note = stabilityNote(effect, cardsLabel) || noModifier;
    return {
      index,
      label: String(index),
      note,
      current: me.stability === index,
      title: `${t.stability} ${index}: ${note}`,
    };
  });

  const industryBoxes: TrackBox[] = Array.from({length: industryMax + 1}, (_, index) => {
    const cards = def.industryCards[index] ?? 3;
    return {
      index,
      label: String(index),
      note: cardsLabel(cards),
      current: me.industry === index,
      title: `${t.industry} ${index}: ${cardsLabel(cards)}${bi(locale, " each turn", "／每回合")}`,
    };
  });
  const industryRanges = trackRanges(Array.from({length: industryMax + 1}, (_, index) => def.industryCards[index] ?? 3));

  // The printed key track stops where the display does: the AUTO VICTORY box is
  // printed only when it follows the last manpower box (GE/FR/AU 15, RU 20,
  // OT 14).  The UK's territorial track ends at box 5 and prints no AUTO
  // VICTORY box, so its auto-victory total stays a note.
  const showAutoBox = def.autoVictoryKeys === def.keyManpower.length;
  const keyBoxes: TrackBox[] = def.keyManpower.map((mp, index) => ({
    index,
    label: String(index),
    note: `MP ${mp}`,
    current: me.territorialKeys === index,
    title: `${t.territorialKeys} ${index}: ${bi(locale, `MP ${mp}`, `${mp} 人力`)}`,
  }));
  if (showAutoBox && def.autoVictoryKeys !== undefined) {
    const index = def.autoVictoryKeys;
    keyBoxes.push({
      index,
      label: String(index),
      note: t.autoVictory,
      current: me.territorialKeys >= index,
      title: `${t.territorialKeys} ${index}: ${t.autoVictory}`,
    });
  }
  const keyRanges = trackRanges(def.keyManpower);

  // UK: colonial keys print their own MP ladder.  OT: Arab keys print AMP.
  const secondary = def.secondaryKeyManpower;
  const secondaryLabel = viewer === "OT" ? t.arabKeys : t.colonialKeys;
  const secondaryCurrent = viewer === "OT" ? (me.arabKeys ?? 0) : me.colonialKeys;
  // The UK Colonial Keys track prints "17+": box 17 is the last box and every
  // count from there on uses its value, so the box reads open-ended.
  const secondaryOpenEnded = viewer === "UK";
  const secondaryBoxes: TrackBox[] = (secondary ?? []).map((mp, index) => ({
    index,
    label: boxLabel(index, (secondary?.length ?? 1) - 1, secondaryOpenEnded),
    note: viewer === "OT" ? `AMP ${mp}` : `MP ${mp}`,
    current: secondaryCurrent === index,
    title: `${secondaryLabel} ${boxLabel(index, (secondary?.length ?? 1) - 1, secondaryOpenEnded)}: ${mp}`,
  }));
  const secondaryRanges = secondary ? trackRanges(secondary) : [];

  const reserveFormulaNote =
    def.reserveFormula === "none"
      ? bi(locale, "Professional Army: no reserve armies", "职业陆军：不能持有预备军")
      : def.reserveFormula === "manpowerPlusOne"
        ? bi(locale, "lower of manpower or industry, +1", "人力与工业中较低者 +1")
        : bi(locale, "lower of manpower or industry", "人力与工业中较低者");

  const figures: Figure[] = [
    {key: "stability", label: t.stability, value: me.stability, title: bi(locale, "33.x: stability track", "33.x：稳定轨")},
    {
      key: "manpower",
      label: t.manpower,
      value: `${me.manpower}${hasSecondaryManpower ? `/${me.secondaryManpower ?? 0}` : ""}`,
      title: hasSecondaryManpower
        ? bi(locale, "Armies on map / secondary (colonial or Arab) manpower", "场上军团 / 次级（殖民地或阿拉伯）人力")
        : bi(locale, "Manpower: armies that may be built", "人力：可建造的军团数"),
    },
    {key: "industry", label: t.industry, value: me.industry, title: bi(locale, "Industry: reserve-army and industrialization limit", "工业：预备军与工业化上限")},
    {key: "keys", label: t.territorialKeys, value: me.territorialKeys, title: bi(locale, "Territorial keys controlled", "控制的领土关键区")},
    {key: "colonial", label: t.colonialKeys, value: me.colonialKeys, title: bi(locale, "Colonial keys controlled", "控制的殖民地关键区")},
    ...(arabKeys !== undefined ? [{key: "arab", label: t.arabKeys, value: arabKeys}] : []),
    {key: "vp", label: t.vp, value: me.vp, title: bi(locale, "Victory points", "胜利点")},
    {key: "draw", label: bi(locale, "Draw", "抽牌"), value: cardsLabel(draw), title: bi(locale, "10.2: cards drawn each turn", "10.2：每回合抽牌数")},
  ];

  /**
   * The printed boxes of one track, with the marker's box highlighted.
   *
   * Each box carries the number and, under it, the value the board prints there
   * ("3 cards", "MP=2", "AUTO VICTORY").  The 148 px desktop strip is too narrow
   * for a caption under every box, so the stylesheet drops the caption there and
   * the range line below the boxes states the same values ("0–2: 3 张卡"); the
   * phone's Mat tab is full width and prints the captions the way the display
   * does.  The caption is never removed from the DOM, so both widths print the
   * same text and the box's `title` repeats it.
   */
  const renderBoxes = (boxes: TrackBox[], testId: string) => (
    <div className="ie-mat-track-boxes" data-testid={testId}>
      {boxes.map((box) => (
        <span
          key={box.index}
          className="ie-mat-track-box"
          data-index={box.index}
          data-current={box.current ? "true" : "false"}
          title={box.title}
        >
          <b>{box.label}</b>
          <small>{box.note}</small>
        </span>
      ))}
    </div>
  );

  /** The printed values as bands; the band holding the marker is emphasized. */
  const renderRanges = <T,>(
    ranges: TrackRange<T>[],
    last: number,
    openEnded: boolean,
    current: number,
    format: (value: T) => string,
    testId: string,
  ) => (
    <span className="ie-mat-ranges" data-testid={testId}>
      {ranges.map((range) => (
        <span
          key={range.from}
          className="ie-mat-range"
          data-current={current >= range.from && current <= range.to ? "true" : "false"}
        >
          {rangeLabel(range, last, openEnded)}: {format(range.value)}
        </span>
      ))}
    </span>
  );

  return (
    <section
      className="ie-mat"
      data-testid="ie-mat"
      data-collapsed={shownOpen ? "false" : "true"}
      data-power={viewer}
      data-active={viewer === active ? "true" : "false"}
      data-chips={`${t.stability} ${me.stability} · ${t.manpower} ${me.manpower}${hasSecondaryManpower ? `/${me.secondaryManpower ?? 0}` : ""} · ${t.industry} ${me.industry} · ${t.territorialKeys} ${me.territorialKeys} · ${arabKeys !== undefined ? `${t.arabKeys} ${arabKeys}` : `${t.colonialKeys} ${me.colonialKeys}`} · ${t.reserves} ${reserves}/${reserveCap} · ${bi(locale, "draw", "抽牌")} ${draw}`}
      aria-label={bi(locale, `Player mat: ${t.seats[viewer]}`, `玩家面板：${t.seats[viewer]}`)}
    >
      <header className="ie-mat-head">
        <span className={`ie-power-pip ie-power-pip-${viewer.toLowerCase()}`} aria-hidden="true"/>
        <h3 className="ie-mat-title">{t.seats[viewer]}</h3>
        {me.eliminated && <span className="ie-mat-flag">{t.eliminated}</span>}
        <button
          type="button"
          className="ie-mat-toggle"
          data-testid="ie-mat-toggle"
          aria-expanded={shownOpen ? "true" : "false"}
          onClick={() => setOpen((value) => !value)}
          title={shownOpen ? t.collapse : t.expand}
        >
          <span aria-hidden="true">{shownOpen ? <Icon name="chevron-down" size={14}/> : <Icon name="chevron-right" size={14}/>}</span>
        </button>
      </header>

      {/* 900-1099 px: the figures collapse to this one chip row. */}
      <div className="ie-mat-chips" data-testid="ie-mat-chips">
        {figures.map((figure) => (
          <span key={figure.key} className="ie-chip">{figure.label} <b>{figure.value}</b></span>
        ))}
      </div>

      <div className="ie-mat-grid" data-testid="ie-mat-figures">
        <div className="ie-mat-tracks">
          {/* --- Stability: the printed VP / BM / card effect of each box. */}
          <div className="ie-mat-figure" data-testid="ie-mat-stability" title={bi(locale, "BM applies to land and naval battles", "BM 同时作用于陆战与海战")}>
            <span className="ie-mat-figure-label">{t.stability}</span>
            <b className="ie-mat-figure-value">{me.stability}</b>
            {renderBoxes(stabilityBoxes, "ie-mat-stability-boxes")}
            <span className="ie-mat-hintnote" data-testid="ie-mat-stability-effect">
              {bi(locale, "Now", "当前")} {me.stability}: {stabilityNote(stabilityEffect, cardsLabel) || noModifier}
            </span>
          </div>

          {/* --- Manpower: the key box that supplies it. */}
          <div className="ie-mat-figure" data-testid="ie-mat-manpower">
            <span className="ie-mat-figure-label">{t.manpower}</span>
            <b className="ie-mat-figure-value">
              {me.manpower}{hasSecondaryManpower ? <small>/{me.secondaryManpower ?? 0}</small> : null}
            </b>
            <span className="ie-mat-hintnote" data-testid="ie-mat-manpower-hint">
              {/* The printed display prints the key box each manpower value comes
                  from, and the "Exhausted -1 BM" note beside the ladder. */}
              {bi(locale, "Keys", "关键区")} {me.territorialKeys} → {def.keyManpower[Math.min(def.keyManpower.length - 1, Math.max(0, me.territorialKeys))] ?? me.manpower}
              {secondary && (
                <>
                  {" · "}
                  {secondaryLabel} {secondaryCurrent} → {secondary[Math.min(secondary.length - 1, Math.max(0, secondaryCurrent))] ?? me.secondaryManpower}
                </>
              )}
              {" · "}{bi(locale, "exhausted −1 BM", "耗尽 −1 BM")}
            </span>
          </div>

          {/* --- Industry: the cards printed under each level. */}
          <div className="ie-mat-figure" data-testid="ie-mat-industry">
            <span className="ie-mat-figure-label">{t.industry}</span>
            <b className="ie-mat-figure-value">{me.industry}<small>/{industryMax}</small></b>
            {renderBoxes(industryBoxes, "ie-mat-industry-boxes")}
            {renderRanges(industryRanges, industryMax, false, me.industry, (cards: number) => cardsLabel(cards), "ie-mat-industry-ranges")}
            <span className="ie-mat-hintnote" data-testid="ie-mat-industry-hint">
              {/* The display prints "End Phase: a roll ≥ 5 successfully
                  industrializes"; kept on one line at 148 px. */}
              {bi(locale, `End phase: die + CP ≥ ${industryRoll}`, `结束阶段：骰＋CP≥${industryRoll}`)}
            </span>
          </div>

          {/* --- Territorial keys: the MP printed under each box. */}
          <div className="ie-mat-figure" data-testid="ie-mat-keys">
            <span className="ie-mat-figure-label">{t.territorialKeys}</span>
            <b className="ie-mat-figure-value">{me.territorialKeys}</b>
            {renderBoxes(keyBoxes, "ie-mat-keys-boxes")}
            {renderRanges(keyRanges, def.keyManpower.length - 1, false, me.territorialKeys, (mp) => `MP ${mp}`, "ie-mat-keys-ranges")}
            <span className="ie-mat-hintnote">
              {bi(locale, "MP = manpower", "MP＝人力")}
              {def.autoVictoryKeys !== undefined && <> · {t.autoVictory} {def.autoVictoryKeys}</>}
            </span>
          </div>

          {/* --- Colonial (UK) or Arab (OT) keys: their own printed MP ladder. */}
          {secondary ? (
            <div className="ie-mat-figure" data-testid={viewer === "OT" ? "ie-mat-arab-keys" : "ie-mat-colonial"}>
              <span className="ie-mat-figure-label">{secondaryLabel}</span>
              <b className="ie-mat-figure-value">{secondaryCurrent}</b>
              {renderBoxes(secondaryBoxes, "ie-mat-secondary-boxes")}
              {renderRanges(secondaryRanges, secondary.length - 1, secondaryOpenEnded, secondaryCurrent, (mp) => `${viewer === "OT" ? "AMP" : "MP"} ${mp}`, "ie-mat-secondary-ranges")}
              {viewer === "UK" && def.autoVictoryColonialKeys !== undefined && (
                <span className="ie-mat-hintnote">{t.autoVictory} {def.autoVictoryColonialKeys}</span>
              )}
            </div>
          ) : (
            <div className="ie-mat-figure" data-testid="ie-mat-colonial">
              <span className="ie-mat-figure-label">{t.colonialKeys}</span>
              <b className="ie-mat-figure-value">{me.colonialKeys}</b>
              <span className="ie-mat-hintnote">{bi(locale, "Colonial keys controlled", "控制的殖民地关键区")}</span>
            </div>
          )}

          {/* --- Reserve armies holding box: the printed Box Limit formula. */}
          <button
            type="button"
            className="ie-mat-figure ie-mat-link"
            data-testid="ie-mat-reserves"
            onClick={() => onOpenReference?.("chart:counter-count")}
            title={bi(locale, "Reserve armies held off map", "场外的预备军")}
          >
            <span className="ie-mat-figure-label">{t.reserves}</span>
            <b className="ie-mat-figure-value">{reserves}<small>/{reserveCap}</small></b>
            <span className="ie-mat-hintnote">{reserveFormulaNote}</span>
          </button>

          {/* --- 10.2: the cards this seat draws each turn. */}
          <div className="ie-mat-figure" data-testid="ie-mat-draw">
            <span className="ie-mat-figure-label">{bi(locale, "Draw per turn", "每回合抽牌")}</span>
            <b className="ie-mat-figure-value">{draw}<small> {bi(locale, "cards", "张卡")}</small></b>
            <span className="ie-mat-hintnote">
              {bi(locale, "industry", "工业")} {me.industry} → {def.industryCards[Math.min(def.industryCards.length - 1, Math.max(0, me.industry))] ?? 3}
              {" · "}{bi(locale, "stability", "稳定")} {me.stability}
            </span>
          </div>

          <div className="ie-mat-figure" data-testid="ie-mat-vp" title={bi(locale, "Victory points", "胜利点")}>
            <span className="ie-mat-figure-label">{t.vp}</span>
            <b className="ie-mat-figure-value">{me.vp}</b>
          </div>
        </div>
      </div>

      <div className="ie-mat-slots">
        <div className="ie-mat-slot" data-testid="ie-mat-industry-card">
          <span className="ie-mat-slot-label">{t.industryCard}</span>
          <span className={`ie-mat-slot-value${me.industryCard ? "" : " empty"}`}>
            {me.industryCard ? cardName(me.industryCard, locale) : bi(locale, "empty", "空")}
          </span>
        </div>
        <div className="ie-mat-slot" data-testid="ie-mat-cp-chain">
          <span className="ie-mat-slot-label">{t.cpChain}</span>
          <span className="ie-mat-slot-value">
            {me.cpChain.length === 0
              ? <span className="empty">{bi(locale, "empty", "空")}</span>
              : me.cpChain.map((id) => <span key={id} className="ie-mat-chain-card">{cardName(id, locale)}</span>)}
            <small>{me.cpChain.length}/2</small>
          </span>
        </div>
        <div className="ie-mat-slot" data-testid="ie-mat-goals">
          <span className="ie-mat-slot-label">{t.goals} · {goals.length}</span>
          <span className="ie-mat-slot-value">
            {goals.length === 0
              ? <span className="empty">{bi(locale, "empty", "空")}</span>
              : goals.slice(0, 2).map((id) => {
                const goal = GOALS_BY_ID[id];
                return <span key={id} className="ie-mat-goal">{goal ? (locale === "zh_CN" ? goal.titleZh : goal.title) : id}</span>;
              })}
            {goals.length > 2 && <small>+{goals.length - 2}</small>}
          </span>
        </div>
      </div>

      {/* The printed display prints the national characteristics beside the
          tracks; folded here so the strip stays a dashboard. */}
      <details className="ie-mat-characteristics" data-testid="ie-mat-characteristics">
        <summary>{t.characteristics}</summary>
        <ul>
          {def.characteristics.map((line, index) => (
            <li key={index}>{locale === "zh_CN" ? line.zh : line.en}</li>
          ))}
        </ul>
      </details>

      {/* The display the tracks above are transcribed from — this power's own
          board under `displays/`, not the influence-track chart. */}
      <button
        type="button"
        className="ie-mat-display"
        data-testid="ie-mat-display"
        onClick={() => onOpenReference?.(displayAnchor(viewer))}
        title={bi(locale, "Open the printed player display", "打开印刷版玩家面板")}
      >
        {bi(locale, "Printed display", "印刷面板")} <Icon name="arrow-right" size={14}/>
      </button>

      <div className="ie-mat-popover" data-testid="ie-mat-popover">
        <dl>
          {figures.map((figure) => (
            <React.Fragment key={figure.key}>
              <dt>{figure.label}</dt>
              <dd>{figure.value}</dd>
            </React.Fragment>
          ))}
          <dt>{t.reserves}</dt>
          <dd>{reserves}/{reserveCap}</dd>
          <dt>{t.industryCard}</dt>
          <dd>{me.industryCard ? cardName(me.industryCard, locale) : "—"}</dd>
          <dt>{t.cpChain}</dt>
          <dd>{me.cpChain.length === 0 ? "—" : me.cpChain.map((id) => cardName(id, locale)).join(", ")}</dd>
        </dl>
      </div>
    </section>
  );
};

/** A home/action card's title in the UI language; the id when unknown. */
const cardName = (id: string, locale: "en" | "zh_CN"): string => {
  const card = CARD_BY_ID[id];
  if (card) return locale === "zh_CN" ? card.titleZh : card.title;
  const goal = GOALS_BY_ID[id];
  return goal ? (locale === "zh_CN" ? goal.titleZh : goal.title) : id;
};
