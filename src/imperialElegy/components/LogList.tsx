/**
 * The public history, rendered once for both places that show it: the turn
 * panel's Log tab (and the phone dock's) and the reference drawer.
 *
 * A log sentence is produced by `logSegments`, which keeps each visible card as
 * its own segment.  This component draws that segment as a chip carrying the
 * card's printed CP — the number a player actually reasons about when reading
 * "GE played ⟨4⟩ Naval Supremacy for CP" — and opens the same `CardInspector`
 * the hand uses, so a card named in the log can be read in full (face, CP,
 * printed text) without going back to the hand or the module.
 *
 * The inspector is owned here rather than by the board: a log line is a read
 * affordance, not an operation, so it opens a copy of the card with no play
 * buttons and no effect on the board's pending state.
 */
import React from "react";
import type {LogEntry} from "../types";
import {CARD_BY_ID} from "../engine/deck";
import {bi} from "./boardHelpers";
import {CardInspector} from "./CardInspector";
import {logSegments} from "./logText";
import type {CardFaceMode} from "./preferences";

export interface LogListProps {
  /** Newest-first entries, already sliced by the caller. */
  entries: readonly LogEntry[];
  locale: "en" | "zh_CN";
  /** Card face preference; a log view defaults to the vector face. */
  mode?: CardFaceMode;
  /** `data-testid` of the scroll container (the tab and the drawer differ). */
  testId?: string;
  /** Replaces the default `ie-log` class when a container needs its own. */
  className?: string;
}

/** One card named by a log line: its CP and title, as a button. */
const LogCard = ({id, locale, onOpen}: {
  id: string;
  locale: "en" | "zh_CN";
  onOpen: (id: string) => void;
}) => {
  const card = CARD_BY_ID[id];
  // `logSegments` only marks cards it could resolve, so this is a guard rather
  // than a branch that ever renders.
  if (card === undefined) return <>{id}</>;
  const title = locale === "zh_CN" ? card.titleZh : card.title;
  return (
    <button
      type="button"
      className="ie-log-card"
      data-testid={`ie-log-card-${id}`}
      data-card-id={id}
      aria-haspopup="dialog"
      aria-label={bi(locale, `Card: ${title} (${card.cp} CP)`, `卡牌：${title}（${card.cp} CP）`)}
      title={bi(locale, `Open ${title}`, `查看 ${title}`)}
      onClick={() => onOpen(id)}
    >
      <span className="ie-log-card-cp" aria-hidden="true">{card.cp}</span>
      <span className="ie-log-card-name">{title}</span>
    </button>
  );
};

/**
 * One log line.  Memoized on the entry's identity — boardgame.io keeps
 * previous entries by reference, so only the newest line re-renders when the
 * board updates (the old `LogLine` was memoized for the same reason).
 */
const LogLine = React.memo(({entry, locale, onOpen}: {
  entry: LogEntry;
  locale: "en" | "zh_CN";
  onOpen: (id: string) => void;
}) => (
  <div className="ie-log-line" data-testid={`ie-log-entry-${entry.id}`}>
    <span className="t">T{entry.turn}</span>
    {logSegments(entry, locale).map((segment, index) => (
      segment.kind === "card"
        ? <LogCard key={`${segment.id}-${index}`} id={segment.id} locale={locale} onOpen={onOpen}/>
        : <React.Fragment key={index}>{segment.text}</React.Fragment>
    ))}
  </div>
));

export const LogList = ({entries, locale, mode = "svg", testId, className}: LogListProps) => {
  const [inspecting, setInspecting] = React.useState<string | null>(null);
  const card = inspecting === null ? undefined : CARD_BY_ID[inspecting];
  const open = React.useCallback((id: string) => setInspecting(id), []);

  return (
    <>
      <div className={className ?? "ie-log"} data-testid={testId ?? "ie-log"}>
        {entries.map((entry) => <LogLine key={entry.id} entry={entry} locale={locale} onOpen={open}/>)}
      </div>
      {card !== undefined && (
        <CardInspector
          open
          onClose={() => setInspecting(null)}
          locale={locale}
          face={{card}}
          mode={mode}
          actions={
            <p className="ie-muted ie-log-card-note" data-testid="ie-log-card-note">
              {bi(locale,
                "Read-only card from the log. Its operations are in your hand while the card is yours to play.",
                "这是记录中的卡牌，仅供查看。卡牌在你手中时，操作按钮才会出现在手牌里。")}
            </p>
          }
        />
      )}
    </>
  );
};
