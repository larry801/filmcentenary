import React from "react";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "../game";
import {ImperialElegyBoard} from "./board";
import {IESurface} from "./theme";
import {ieT} from "./i18n";
import i18n from "../../constant/i18n";
import {ImperialElegyState, POWERS, Power} from "../types";
import {BotSeatsContext} from "./botContext";
import {SeatStrip, deriveSeatStatuses} from "./SeatStrip";
import {SeatUiContext} from "./seatUiContext";

const HotseatBoard = (props: React.ComponentProps<typeof ImperialElegyBoard>) =>
  <ImperialElegyBoard {...props} hotseat/>;

const BoardClient = Client({
  numPlayers: 6,
  game: ImperialElegyGameDef,
  board: HotseatBoard,
  multiplayer: Local(),
  debug: false,
});

// The shell re-renders when a seat reports its state (for the strip).  Memoising
// the clients, and the context value below, keeps that shell update from
// re-rendering all six boards and resetting a bot's 500 ms auto-submit timer.
const MemoBoardClient = React.memo(BoardClient);

const MATCH_ID = "local_imperial_elegy";

/** Storage key for the bot-seat configuration. */
const BOT_SEATS_KEY = "ie_local_bot_seats";

const loadBotSeats = (): Set<Power> => {
  try {
    const raw = localStorage.getItem(BOT_SEATS_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as string[];
      return new Set(arr.filter((p): p is Power => (POWERS as readonly string[]).includes(p)));
    }
  } catch {/* ignore */}
  return new Set();
};

const loadBotSeatsMaybeSolo = (): Set<Power> => {
  const saved = loadBotSeats();
  if (saved.size > 0) return saved;
  const params = new URLSearchParams(window.location.search);
  if (params.get("solo") === "1") {
    // Pre-select P2–P6 as bots; leave P1 (index 0) for the human player.
    return new Set(POWERS.slice(1));
  }
  return new Set();
};

/** `?solo=1` opens the seat-setup screen first; plain `/localIE` starts at once. */
const wantsSeatSetup = (): boolean =>
  new URLSearchParams(window.location.search).get("solo") === "1";

const saveBotSeats = (seats: Set<Power>): void => {
  try {
    localStorage.setItem(BOT_SEATS_KEY, JSON.stringify([...seats]));
  } catch {/* ignore */}
};

const stateKey = (G: ImperialElegyState | null): string => {
  if (G === null) return "";
  return [G.turn, G.phase, G.activePower, G.log.length, G.pending?.id ?? "-", G.pending?.power ?? "-"]
    .join("|");
};

const LocalImperialElegy = () => {
  i18n.use();
  const t = ieT();
  const locale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  const [tab, setTab] = React.useState(0);
  const seatCount = POWERS.length;
  const [botSeats, setBotSeats] = React.useState<Set<Power>>(loadBotSeatsMaybeSolo);
  // Plain `/localIE` keeps the historical behaviour: the board is live
  // immediately.  Only the explicit solo entrance opens the seat setup.
  const [showSetup, setShowSetup] = React.useState(wantsSeatSetup);
  // Bumping the match id discards the running match and deals a new one.
  const [matchNonce, setMatchNonce] = React.useState(0);
  // Language switches must re-render: the i18n object is mutable state that
  // React cannot observe.
  const [, setLocaleTick] = React.useState(0);
  React.useEffect(() => i18n.listen(() => setLocaleTick((n) => n + 1)), []);

  // The seat strip lives above the six mounted boards, so one of the boards
  // reports the shared public view here.  Only the seat-relevant fields drive
  // the strip; the snapshot is deliberately not fed back into the boards.
  const [snapshot, setSnapshot] = React.useState<ImperialElegyState | null>(null);
  const snapshotKey = React.useRef("");
  const onGameState = React.useCallback((G: ImperialElegyState) => {
    const key = stateKey(G);
    if (key === snapshotKey.current) return;
    snapshotKey.current = key;
    setSnapshot(G);
  }, []);

  const currentSeat = POWERS[tab];
  const switchSeat = React.useCallback((power: Power) => {
    const index = POWERS.indexOf(power);
    if (index < 0) return;
    setTab(index);
    window.setTimeout(() => {
      document.querySelector<HTMLElement>(`[data-testid="ie-seat-status-${power}"]`)?.focus();
    }, 0);
  }, []);

  React.useEffect(() => {
    const switchByKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest(
        "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='combobox'], [role='listbox'], [role='menu'], [role='dialog']",
      ))) return;
      let next: number;
      if (/^[1-6]$/.test(event.key)) next = Number(event.key) - 1;
      else if (event.key === "[") next = (tab + seatCount - 1) % seatCount;
      else if (event.key === "]") next = (tab + 1) % seatCount;
      else return;
      event.preventDefault();
      switchSeat(POWERS[next]);
    };
    window.addEventListener("keydown", switchByKey);
    return () => window.removeEventListener("keydown", switchByKey);
  }, [tab, seatCount, switchSeat]);

  const toggleBot = (power: Power) => {
    setBotSeats((prev) => {
      const next = new Set(prev);
      if (next.has(power)) next.delete(power); else next.add(power);
      saveBotSeats(next);
      return next;
    });
  };

  const seatUi = React.useMemo(() => ({currentSeat, onSwitchSeat: switchSeat, onGameState}), [currentSeat, switchSeat, onGameState]);
  if (showSetup) {
    return (
      <IESurface className="ie-local ie-local-setup">
        <header className="ie-local-head">
          <h1 className="ie-local-title">{t.localTitle}</h1>
        </header>
        <div className="ie-local-setup-body">
          <h2 className="ie-local-subtitle">{t.botSeatsTitle}</h2>
          <p className="ie-muted">{t.botSeatsHelp}</p>
          <div className="ie-local-bot-seats">
            {POWERS.map((p, index) => (
              <label key={p} className="ie-local-bot-seat">
                <input type="checkbox" checked={botSeats.has(p)} onChange={() => toggleBot(p)}/>
                <span>P{index + 1} {t.seats[p]}</span>
              </label>
            ))}
          </div>
          <button
            type="button"
            className="ie-btn primary ie-local-start"
            data-testid="ie-start-match"
            onClick={() => {
              // A fresh seat configuration is a fresh match: bump the nonce so
              // the local master cannot resume the abandoned one.
              setMatchNonce((n) => n + 1);
              setShowSetup(false);
            }}
          >
            {t.startMatch}
          </button>
        </div>
      </IESurface>
    );
  }

  const eliminated = new Set<Power>(
    snapshot === null ? [] : POWERS.filter((power) => snapshot.powers[power]?.eliminated === true),
  );
  const seats = deriveSeatStatuses({
    pendingPower: snapshot?.pending?.power ?? null,
    activePower: snapshot?.activePower ?? "GE",
    botSeats,
    eliminated,
    viewer: currentSeat,
    locale,
  });

  return (
    <IESurface className="ie-local">
      <div className="ie-local-top">
        <h1 className="ie-local-title">{t.localTitle}</h1>
        <details className="ie-local-help">
          <summary>{t.localHelpLabel}</summary>
          <div className="ie-muted">{t.localHelp}</div>
        </details>
        <button
          type="button"
          className="ie-btn secondary ie-btn-xs"
          data-testid="ie-seat-setup"
          title={t.seatChangeWarning}
          onClick={() => setShowSetup(true)}
        >
          {t.settleSeats}
        </button>
        <SeatStrip seats={seats} onSelect={switchSeat} locale={locale}/>
      </div>
      <BotSeatsContext.Provider value={botSeats}>
        <SeatUiContext.Provider value={seatUi}>
          <div className="ie-local-boards">
            {POWERS.map((p, index) => (
              <section
                key={p}
                className="ie-seat"
                data-active={tab === index ? "true" : "false"}
                data-testid={`ie-seat-${p}`}
              >
                <MemoBoardClient
                  // A seat-setup change deals a new match, so the old one is never
                  // silently resumed with a different bot configuration.
                  matchID={matchNonce === 0 ? MATCH_ID : `${MATCH_ID}_${matchNonce}`}
                  playerID={String(index)}
                  debug={false}
                />
              </section>
            ))}
          </div>
        </SeatUiContext.Provider>
      </BotSeatsContext.Provider>
    </IESurface>
  );
};

export default LocalImperialElegy;
