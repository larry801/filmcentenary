/**
 * The hotseat seat strip: one row, 40px tall, that replaces the MUI Tabs the
 * local screen used to draw.  Every seat gets a `role="tab"` button so the
 * Playwright helpers (`getByRole("tab", {name: /P1/})`) keep working, and the
 * derivation below is a pure function so the board can test the rules without
 * mounting anything.
 *
 * This component owns no game state: the caller decides who is pending,
 * active, a bot or eliminated and passes the resulting `SeatStatus[]` in.
 */
import React from "react";
import {POWERS, type Power} from "../types";
import {ieStringsFor, type IELocale} from "./i18n";
import {useRovingTabs} from "./useRovingTabs";

export type SeatState = "decide" | "pending" | "active" | "bot" | "eliminated" | "waiting";

export interface SeatStatus {
  power: Power;
  index: number; // 0-based
  state: SeatState;
  label: string; // localized state text
  /** True when this seat is the one currently shown to the person at the keyboard. */
  current: boolean;
}

/** Short bilingual state labels — the strip is only 40px tall. */
const LABELS: Record<SeatState, Record<IELocale, string>> = {
  decide: {en: "Your decision", zh_CN: "待你决策"},
  pending: {en: "Decision waiting", zh_CN: "待决"},
  active: {en: "Acting", zh_CN: "行动中"},
  bot: {en: "Bot", zh_CN: "机器人"},
  eliminated: {en: "Eliminated", zh_CN: "已淘汰"},
  waiting: {en: "Waiting", zh_CN: "等待"},
};

/**
 * The dot is a redundant, colour-independent cue next to the label:
 * ● this seat acts / must decide, ○ passive, 🤖 bot, ✕ eliminated.
 */
const DOTS: Record<SeatState, string> = {
  decide: "●",
  pending: "○",
  active: "●",
  bot: "🤖",
  eliminated: "✕",
  waiting: "○",
};

export const seatStateLabel = (state: SeatState, locale: IELocale): string => LABELS[state][locale];

/**
 * Derive one status per power, in rulebook seat order.
 *
 * Priority, highest first — each rule shadows every rule below it:
 *   1. `eliminated`            -> "eliminated"  (a knocked-out power never acts,
 *                                                 even if a stale pending names it)
 *   2. `pendingPower === power` -> "decide" when that power is the viewer,
 *                                 otherwise "pending"
 *   3. `botSeats.has(power)`    -> "bot"        (a bot seat acts by itself; the
 *                                                 viewer cannot take its decision)
 *   4. `power === activePower`  -> "active"
 *   5. otherwise               -> "waiting"
 *
 * `current` is independent of the state: it marks the seat whose panel the
 * person at the keyboard is looking at.
 */
export const deriveSeatStatuses = (input: {
  pendingPower: Power | null;
  activePower: Power;
  botSeats: ReadonlySet<Power>;
  eliminated: ReadonlySet<Power>;
  viewer: Power | null;
  locale: IELocale;
}): SeatStatus[] => {
  const {pendingPower, activePower, botSeats, eliminated, viewer, locale} = input;
  return POWERS.map((power, index) => {
    let state: SeatState;
    if (eliminated.has(power)) state = "eliminated";
    else if (pendingPower === power) state = viewer === power ? "decide" : "pending";
    else if (botSeats.has(power)) state = "bot";
    else if (power === activePower) state = "active";
    else state = "waiting";
    return {power, index, state, label: LABELS[state][locale], current: viewer === power};
  });
};

export interface SeatStripProps {
  seats: SeatStatus[];
  onSelect: (power: Power) => void;
  locale: IELocale;
}

/**
 * The strip itself.  The visible text ("P1 · GE Germany ● Your decision") is
 * also the accessible name, so no `aria-label` is needed.
 *
 * Keyboard: the strip is one tab stop with a roving tabindex.  ArrowRight/Down,
 * ArrowLeft/Up, Home and End move to the next/previous/first/last seat and
 * select it (automatic activation), so `onSelect` fires for the seat that just
 * received focus — a keyboard user never presses Enter to switch seats.
 */
export const SeatStrip: React.FC<SeatStripProps> = ({seats, onSelect, locale}) => {
  const t = ieStringsFor(locale);
  const seatKeys = seats.map((seat) => seat.power);
  // Fall back to the first seat so the strip always has exactly one tab stop,
  // even if the caller passes no `current` seat.
  const currentKey = seats.find((seat) => seat.current)?.power ?? seats[0]?.power ?? "";
  const roving = useRovingTabs(seatKeys, currentKey, (key) => {
    const seat = seats.find((candidate) => candidate.power === key);
    if (seat) onSelect(seat.power);
  });
  return (
    <div
      className="ie-seat-strip"
      data-testid="ie-seat-strip"
      role="tablist"
      aria-label={locale === "en" ? "Seats" : "席位"}
    >
      {seats.map((seat) => (
        <button
          key={seat.power}
          type="button"
          role="tab"
          aria-selected={seat.current}
          data-testid={`ie-seat-status-${seat.power}`}
          data-state={seat.state}
          className={`ie-seat-tab ie-seat-tab-${seat.state}`}
          {...roving(seat.power)}
          onClick={() => onSelect(seat.power)}
        >
          <span className="ie-seat-code">P{seat.index + 1} · {seat.power}</span>{" "}
          <span className="ie-seat-name">{t.seats[seat.power]}</span>{" "}
          <span className="ie-seat-dot" aria-hidden>{DOTS[seat.state]}</span>{" "}
          <span className="ie-seat-state">{seat.label}</span>
        </button>
      ))}
    </div>
  );
};

export interface SeatAlertProps {
  pendingPower: Power;
  pendingKind?: string | null;
  locale: IELocale;
  onGo: () => void;
}

/**
 * Banner for a decision waiting on a seat that is not the one shown.  It names
 * the seat and the kind of decision and offers a jump to that seat.
 */
export const SeatAlert: React.FC<SeatAlertProps> = ({pendingPower, pendingKind, locale, onGo}) => {
  const t = ieStringsFor(locale);
  const seat = t.seats[pendingPower];
  const kind = pendingKind ?? (locale === "en" ? "pending decision" : "待决事项");
  const text = locale === "en" ? `${seat} needs a decision: ${kind}` : `${seat} 需要决策：${kind}`;
  return (
    <div className="ie-seat-alert" role="status" aria-live="polite" data-testid="ie-seat-alert">
      <span className="ie-seat-alert-text">{text}</span>{" "}
      <button type="button" data-testid="ie-seat-alert-go" onClick={onGo}>
        {locale === "en" ? "Go to seat" : "前往"}
      </button>
    </div>
  );
};
