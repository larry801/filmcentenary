/**
 * The 52 px track strip: the row above the table.
 *
 * Left to right it reads like the printed display: the decade, the sequence of
 * play (each step opens the reference at that step), World Tension with the
 * "3: no war" warning, the six alliance markers, the Great War turn, and then
 * the two round controls — the reference "?" and the menu.
 *
 * It replaces the old command bar, so it also carries the single CP readout
 * (`ie-command-cp`) and the phase buttons (ready / pass / continue).  It is
 * presentation only: every value and every action comes from the board model.
 */
import React from "react";
import {ImperialElegyState, Power, POWERS} from "../types";
import {IEBadge} from "./theme";
import {ieT} from "./i18n";
import {bi, controlLabel, PHASE_LABEL} from "./boardHelpers";
import {phaseSteps, type PhaseStep} from "./phaseSteps";
import type {PhaseAction} from "./PhaseActions";

export interface TrackStripProps {
  G: ImperialElegyState;
  viewer: Power | null;
  active: Power;
  phase: string;
  war: ImperialElegyState["war"] | null;
  gw: ImperialElegyState["gw"] | null;
  /** CP left for the acting seat; a spectator sees the public wallet. */
  cp: number;
  cpBudget: () => number;
  locale: "en" | "zh_CN";
  t: ReturnType<typeof ieT>;
  menu?: React.ReactNode;
  status?: React.ReactNode;
  /** A decision waiting on another seat (hotseat). */
  notice?: React.ReactNode;
  /** The hotseat's seat tabs, rendered inline so the board has one top row. */
  seats?: React.ReactNode;
  /** The viewer's four printed figures (VP, stability, manpower, industry). */
  stats?: React.ReactNode;
  /** The instruction drawer's toggle (desktop). */
  panel?: {open: boolean; onToggle: () => void; label: string; badge?: boolean};
  /** Opens the reference drawer at an anchor. */
  onOpenReference?: (anchor: string) => void;
}

const DECADE_LABEL: Record<string, {en: string; zh: string}> = {
  "1850s": {en: "1850s", zh: "1850年代"},
  "1860s": {en: "1860s", zh: "1860年代"},
  "1870s": {en: "1870s", zh: "1870年代"},
  "1880s": {en: "1880s", zh: "1880年代"},
  "1890s": {en: "1890s", zh: "1890年代"},
  "1900s": {en: "1900s", zh: "1900年代"},
  "1910s": {en: "1910s", zh: "1910年代"},
};

/** The alliance box an MPIT marker sits in, as the printed track names them. */
const ALLIANCE_MARKERS: readonly {box: string; short: string; title: string; titleZh: string}[] = [
  {box: "teCommitted", short: "cTA", title: "TE committed", titleZh: "协约承诺"},
  {box: "teAligned", short: "aTA", title: "TE aligned", titleZh: "协约倾向"},
  {box: "neutral", short: "N", title: "Neutral", titleZh: "中立"},
  {box: "taAligned", short: "aTE", title: "TA aligned", titleZh: "同盟倾向"},
  {box: "taCommitted", short: "cTE", title: "TA committed", titleZh: "同盟承诺"},
];

export const TrackStrip = ({
  G, viewer, active, phase, war, gw, cp, cpBudget, locale, t,
  menu, status, notice, seats, stats, panel, onOpenReference,
}: TrackStripProps) => {
  const [menuOpen, setMenuOpen] = React.useState(false);
  // 27.0: once the Great War runs the campaign clock is frozen and the Alliance
  // Track has been resolved into the GW rosters; the war's own turn is the
  // only clock left, so the left cluster follows it and the peacetime tracks
  // (World Tension, the five alliance boxes) are gone until the game ends.
  const gwActive = gw !== null && gw.active;
  const steps = React.useMemo(() => phaseSteps({
    phase: phase as ImperialElegyState["phase"],
    war,
    gw,
    endPhase: G.endPhase,
  }), [phase, war, gw, G.endPhase]);
  const currentStep = steps.find((step) => step.current);

  const openRef = (anchor: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    onOpenReference?.(anchor);
  };

  const decade = DECADE_LABEL[G.decade ?? ""] ?? {en: G.decade ?? "", zh: G.decade ?? ""};
  const stepLabel = (step: PhaseStep): string => (locale === "zh_CN" ? step.titleZh : step.title);

  return (
    <header className="ie-track-strip" data-testid="ie-track-strip">
      <div
        className="ie-track-decade"
        data-testid="ie-track-decade"
        title={gwActive
          ? bi(locale, "Great War turn and decade", "大战回合与年代")
          : bi(locale, "Campaign turn and decade", "战役回合与年代")}
      >
        <span className="ie-track-decade-turn" data-testid="ie-track-turn">
          {gwActive && gw !== null ? `GW ${gw.turn}` : `T${G.turn}`}
        </span>
        {/* The same `ie-sub` line the header carried: turn, decade and the
            game's subtitle, localized by `decadeLabel`.  In the Great War the
            campaign turn is frozen, so the subline drops it and the token
            above carries the war's own turn. */}
        <span className="ie-track-decade-label ie-sub">
          {gwActive
            ? `${t.subtitle} · ${locale === "zh_CN" ? decade.zh : decade.en}`
            : `${t.subtitle} · ${t.turn} ${G.turn} · ${locale === "zh_CN" ? decade.zh : decade.en}`}
        </span>
      </div>

      {seats !== undefined && <div className="ie-statusline-seats">{seats}</div>}

      {/*
        The step chip names the current step and the acting power, and opens
        that step's reference.  It replaced the four-button stepper: the
        sequence of play is reference material, not a permanent control. (the stylesheet
        hides it below 768 px), which left the folded screen with a bare turn
        number and no way to tell whose turn it was or which step of the season
        was running.  This one chip names the current step and the acting power
        in the band the stepper would occupy, and opens that step's reference
        exactly as a stepper button does.  It is hidden from 768 px up, where
        the stepper is the better control.
      */}
      <button
        type="button"
        className="ie-track-step"
        data-testid="ie-track-step"
        title={bi(locale, "Current step — open its rules reference", "当前步骤 —— 打开该步规则参考")}
        onClick={() => onOpenReference?.(currentStep?.anchor ?? "chart:sequence-of-play")}
      >
        <span className="ie-track-step-name">
          {currentStep !== undefined ? stepLabel(currentStep) : PHASE_LABEL(t, phase)}
        </span>
        <span className="ie-track-step-power">
          <i className={`ie-power-pip ie-power-pip-${active.toLowerCase()}`} aria-hidden="true"/>
          {active}
        </span>
      </button>

      <div className="ie-track-status">
        {/* 3.7 / 13.0 and the 8.0 Alliance Track: both are settled by the
            outbreak (`G.wtt` pins at 5, `formAlliances` writes the rosters the
            Great War panel prints), so neither is shown once the war runs. */}
        {!gwActive && (
          <>
            <span
              className={`ie-track-wtt${G.wtt >= 3 ? " warn" : ""}`}
              data-testid="ie-track-wtt"
              title={G.wtt >= 3 ? bi(locale, "World Tension 3+: no new wars may be declared", "世界紧张 3+：不能发动新的战争") : bi(locale, "World Tension: 3 or more forbids new wars", "世界紧张：达到 3 或以上禁止新的战争")}
            >
              <span className="ie-track-wtt-label">{t.wtt}</span>
              <span className="ie-track-wtt-pips" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} className={n <= G.wtt ? (n === 3 ? "on at3" : "on") : ""}/>
                ))}
              </span>
              <b>{G.wtt}</b>
              <span className="ie-track-wtt-note">{bi(locale, "3: no war", "3：禁战")}</span>
            </span>

            <span className="ie-track-alliance" data-testid="ie-track-alliance" title={bi(locale, "Alliance track markers by power", "各国同盟轨标记")}>
              {ALLIANCE_MARKERS.map((marker) => {
                const holders = POWERS.filter((power) => G.powers[power]?.alliance === marker.box && G.powers[power]?.eliminated !== true);
                return (
                  <span
                    key={marker.box}
                    className={`ie-track-box${marker.box === "neutral" ? " neutral" : ""}${holders.length > 0 ? " held" : ""}`}
                    data-testid={`ie-track-box-${marker.box}`}
                    title={`${locale === "zh_CN" ? marker.titleZh : marker.title}: ${holders.length === 0 ? "—" : holders.map((p) => t.seats[p]).join(", ")}`}
                  >
                    <span className="ie-track-box-name" aria-hidden="true">{marker.short}</span>
                    <span className="ie-track-box-pips">
                      {holders.length === 0
                        ? <span className="ie-track-box-empty" aria-hidden="true">·</span>
                        : holders.map((power) => (
                          <i key={power} className={`ie-power-pip ie-power-pip-${power.toLowerCase()}`} title={t.seats[power]}/>
                        ))}
                    </span>
                  </span>
                );
              })}
            </span>
          </>
        )}

        {war !== null && !gwActive && (
          <span className="ie-track-war" data-testid="ie-track-war">
            <IEBadge tone="warn">{controlLabel(t, war.attacker, locale)} — {controlLabel(t, war.defender, locale)}</IEBadge>
          </span>
        )}
      </div>

      {stats !== undefined && <div className="ie-track-stats">{stats}</div>}

      <div className="ie-track-cp" data-testid="ie-command-cp" title={bi(locale, "CP left this impulse", "本行动轮剩余 CP")}>
        <span className="ie-track-cp-label">{t.cp.replace(/\s*CP\s*$/, "")}</span>
        <b>{cp}</b>
      </div>

      {status !== undefined && <div className="ie-track-badges">{status}</div>}

      {panel !== undefined && (
        <button
          type="button"
          className="ie-panel-toggle"
          data-testid="ie-panel-toggle"
          data-open={panel.open ? "true" : "false"}
          aria-expanded={panel.open}
          title={panel.label}
          onClick={panel.onToggle}
        >
          {panel.label}
          {panel.badge === true && <i className="ie-panel-pip" aria-hidden="true"/>}
        </button>
      )}

      <div className="ie-track-round">
        <button
          type="button"
          className="ie-round-btn"
          data-testid="ie-open-reference"
          aria-label={bi(locale, "Open the rules reference for this step", "打开本阶段规则参考")}
          title={bi(locale, "Reference (?)", "规则参考（?）")}
          onClick={openRef(currentStep?.anchor ?? "chart:sequence-of-play")}
        >
          ?
        </button>
        <div className="ie-track-menu-wrap">
          <button
            type="button"
            className="ie-round-btn"
            data-testid="ie-menu-toggle"
            aria-haspopup="true"
            aria-expanded={menuOpen ? "true" : "false"}
            aria-label={bi(locale, "Menu", "菜单")}
            title={bi(locale, "Menu", "菜单")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            ☰
          </button>
          {menuOpen && menu !== undefined && (
            <div className="ie-track-menu" data-testid="ie-menu" role="menu">
              {menu}
            </div>
          )}
        </div>
      </div>

      {notice !== undefined && <div className="ie-command-notice">{notice}</div>}
      <span className="ie-sr-only" data-testid="ie-command-phase">{PHASE_LABEL(t, phase)}</span>
      <span className="ie-sr-only" data-testid="ie-command-active">{t.active}: {t.seats[active]}</span>
      {viewer === null && <span className="ie-sr-only">{t.spectators}</span>}
    </header>
  );
};
