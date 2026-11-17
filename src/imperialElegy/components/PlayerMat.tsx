/**
 * The player mat: a compact table of the printed display.
 *
 * The printed display (published as a reference chart) prints one power's
 * stability, manpower, industry, keys, reserve armies, Industry Card and CP
 * chain.  The mat reproduces those numbers and slots at table size; the
 * printed image itself opens from the reference drawer, so the mat stays a
 * dashboard and never pretends to be the artwork.
 *
 * Below 1100 px the mat collapses to a chip row (`data-collapsed`) whose
 * popover shows the same figures.
 */
import React from "react";
import {ImperialElegyState, Power} from "../types";
import {GOALS_BY_ID} from "../constant/goals";
import {CARD_BY_ID} from "../engine/deck";
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

export const PlayerMat = ({G, viewer, me, active, locale, t, onOpenReference, forceOpen = false}: PlayerMatProps) => {
  // Phones collapse the mat to its chip row; desktop shows the numbers.
  const [open, setOpen] = React.useState(() => typeof window === "undefined" || window.innerWidth >= 768);
  if (!viewer || !me) return null;

  // The phone dock treats the mat as an always-open tab body; the toggle still
  // writes the state the desktop layout reads.
  const shownOpen = forceOpen || open;

  const reserves = me.reserves.length;
  const reserveCap = me.industry;
  const goals = me.goals;

  const figures: Figure[] = [
    {key: "stability", label: t.stability, value: me.stability, title: bi(locale, "33.x: stability track", "33.x：稳定轨")},
    {
      key: "manpower",
      label: t.manpower,
      value: `${me.manpower}${me.secondaryManpower !== undefined ? `/${me.secondaryManpower}` : ""}`,
      title: me.secondaryManpower !== undefined
        ? bi(locale, "Armies on map / secondary (colonial or Arab) manpower", "场上军团 / 次级（殖民地或阿拉伯）人力")
        : bi(locale, "Manpower: armies that may be built", "人力：可建造的军团数"),
    },
    {key: "industry", label: t.industry, value: me.industry, title: bi(locale, "Industry: reserve-army and industrialization limit", "工业：预备军与工业化上限")},
    {key: "keys", label: t.territorialKeys, value: me.territorialKeys, title: bi(locale, "Territorial keys controlled", "控制的领土关键区")},
    {key: "colonial", label: t.colonialKeys, value: me.colonialKeys, title: bi(locale, "Colonial keys controlled", "控制的殖民地关键区")},
    ...(me.arabKeys !== undefined ? [{key: "arab", label: t.arabKeys, value: me.arabKeys}] : []),
    {key: "vp", label: t.vp, value: me.vp, title: bi(locale, "Victory points", "胜利点")},
  ];

  return (
    <section
      className="ie-mat"
      data-testid="ie-mat"
      data-collapsed={shownOpen ? "false" : "true"}
      data-power={viewer}
      data-active={viewer === active ? "true" : "false"}
      data-chips={`${t.stability} ${me.stability} · ${t.manpower} ${me.manpower}${me.secondaryManpower !== undefined ? `/${me.secondaryManpower}` : ""} · ${t.industry} ${me.industry} · ${t.territorialKeys} ${me.territorialKeys} · ${t.colonialKeys} ${me.colonialKeys} · ${t.reserves} ${reserves}/${reserveCap}`}
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
          <span aria-hidden="true">{shownOpen ? "▾" : "▸"}</span>
        </button>
      </header>

      {/* 900-1099 px: the figures collapse to this one chip row. */}
      <div className="ie-mat-chips" data-testid="ie-mat-chips">
        {figures.map((figure) => (
          <span key={figure.key} className="ie-chip">{figure.label} <b>{figure.value}</b></span>
        ))}
      </div>

      <div className="ie-mat-grid" data-testid="ie-mat-figures">
        {figures.map((figure) => (
          <div key={figure.key} className="ie-mat-figure" data-testid={`ie-mat-${figure.key}`} title={figure.title}>
            <span className="ie-mat-figure-label">{figure.label}</span>
            <b className="ie-mat-figure-value">{figure.value}</b>
          </div>
        ))}
        <button
          type="button"
          className="ie-mat-figure ie-mat-link"
          data-testid="ie-mat-reserves"
          onClick={() => onOpenReference?.("chart:counter-count")}
          title={bi(locale, "Reserve armies held off map", "场外的预备军")}
        >
          <span className="ie-mat-figure-label">{t.reserves}</span>
          <b className="ie-mat-figure-value">{reserves}<small>/{reserveCap}</small></b>
        </button>
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
        {goals.length > 0 && (
          <div className="ie-mat-slot" data-testid="ie-mat-goals">
            <span className="ie-mat-slot-label">{t.goals} · {goals.length}</span>
            <span className="ie-mat-slot-value">
              {goals.slice(0, 2).map((id) => {
                const goal = GOALS_BY_ID[id];
                return <span key={id} className="ie-mat-goal">{goal ? (locale === "zh_CN" ? goal.titleZh : goal.title) : id}</span>;
              })}
              {goals.length > 2 && <small>+{goals.length - 2}</small>}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        className="ie-mat-display"
        data-testid="ie-mat-display"
        onClick={() => onOpenReference?.("chart:influence-track")}
        title={bi(locale, "Open the printed player display", "打开印刷版玩家面板")}
      >
        {bi(locale, "Printed display ▸", "印刷面板 ▸")}
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
