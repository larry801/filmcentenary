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
import {BotDifficulty, IE_NO_GW_LABEL, IE_SCENARIOS} from "../configuration";
import {ScenarioId} from "../constant/scenarios";
import {setupImperialElegy} from "../engine/setup";
import {Modal} from "./Modal";
import {
  botDifficultyLabel,
  readLocalSetup,
  saveBotSeats,
  saveMatchSetup,
  scenarioAllowsNoGw,
  scenarioSummary,
} from "./localSetup";
import {auFormedForScenario, auFormedForState, seatPowerName} from "./seatNames";

const HotseatBoard = (props: React.ComponentProps<typeof ImperialElegyBoard>) =>
  <ImperialElegyBoard {...props} hotseat/>;

/**
 * The hotseat game definition for one scenario.
 *
 * boardgame.io's `Local()` multiplayer creates the match on demand with
 * `setupData: undefined` (the React client has no setup-data prop), so a
 * hotseat match cannot pass its scenario through `setupData` the way an online
 * lobby does.  Handing the client a game definition whose `setup` already
 * carries the scenario is the equivalent, and it keeps `setupImperialElegy`
 * the single setup path for both entrances.
 */
const hotseatGame = (scenario: ScenarioId, noGw: boolean, botDifficulty: BotDifficulty) => ({
  ...ImperialElegyGameDef,
  setup: (ctx: Parameters<typeof setupImperialElegy>[0]) =>
    setupImperialElegy(ctx, {scenario, ...(noGw ? {noGw: true} : {}), botDifficulty}),
});

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

/** Cache one client per (scenario, No-GW) pair so React keeps the same component. */
const clients = new Map<string, typeof BoardClient>();
const boardClientFor = (scenario: ScenarioId, noGw: boolean, botDifficulty: BotDifficulty): typeof BoardClient => {
  const key = `${scenario}:${noGw ? "noGw" : "normal"}:${botDifficulty}`;
  const cached = clients.get(key);
  if (cached !== undefined) return cached;
  const created = Client({
    numPlayers: 6,
    game: hotseatGame(scenario, noGw, botDifficulty),
    board: HotseatBoard,
    multiplayer: Local(),
    debug: false,
  });
  clients.set(key, created);
  return created;
};

const MATCH_ID = "local_imperial_elegy";

const stateKey = (G: ImperialElegyState | null): string => {
  if (G === null) return "";
  return [G.turn, G.phase, G.activePower, G.log.length, G.pending?.id ?? "-", G.pending?.power ?? "-"]
    .join("|");
};

const LocalImperialElegy = () => {
  i18n.use();
  const t = ieT();
  const locale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  // One read of the saved setup: a `?fresh=<stamp>` link and the multi-seat
  // seat setup both land here, and the initial state must describe one
  // coherent configuration.
  const [initial] = React.useState(() => readLocalSetup(window.location.search));
  const [tab, setTab] = React.useState(initial.tabIndex);
  const seatCount = POWERS.length;
  // The bot seats of the *running* match.  The setup screen edits a pending copy
  // below, so backing out of it cannot hand a live seat to a bot without the
  // engine's own `G.bots` saying so.
  const [botSeats, setBotSeats] = React.useState<Set<Power>>(initial.botSeats);
  const [setupBotSeats, setSetupBotSeats] = React.useState<Set<Power>>(initial.botSeats);
  // Plain `/localIE` keeps the historical behaviour: the board is live
  // immediately.  Only the explicit `?solo=1` seat-setup entrance opens the
  // setup screen first.
  const [showSetup, setShowSetup] = React.useState(initial.showSetup);
  // Whether a match has already been dealt on this page.  The seat-setup screen
  // is reachable mid-match through "New game", and there it must be closable:
  // leaving it without pressing Start match returns to the running game.
  const [matchStarted, setMatchStarted] = React.useState(!initial.showSetup);
  // "New game" is confirmed before the setup screen opens, so a stray click on
  // the header button cannot hide the running board.
  const [confirmNewGame, setConfirmNewGame] = React.useState(false);
  // The printed scenario the hotseat match plays, and Scenario 4's "No GW"
  // victory-condition modifier.  Both are setup data, so changing either deals
  // a new match (the nonce below).
  const [scenario, setScenario] = React.useState<ScenarioId>(initial.scenario);
  const [noGw, setNoGw] = React.useState<boolean>(initial.noGw);
  // 34.1: the single difficulty saved by the solo page (the hotseat default is
  // normal).  It travels in the game definition like the scenario does.
  const [botDifficulty] = React.useState<BotDifficulty>(initial.botDifficulty);
  const [setupScenario, setSetupScenario] = React.useState<ScenarioId>(initial.scenario);
  const [setupNoGw, setSetupNoGw] = React.useState<boolean>(initial.noGw);
  // Bumping the match id discards the running match and deals a new one.  An
  // explicit `?fresh=<stamp>` link carries its own stamp, so the new match is
  // dealt on mount.
  const [matchNonce, setMatchNonce] = React.useState(initial.fresh);
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
      // The setup screen is not a seat: its number keys belong to the form (and
      // switching seats behind it would surprise the reader who comes back).
      if (showSetup) return;
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
  }, [tab, seatCount, switchSeat, showSetup]);

  const toggleBot = (power: Power) => {
    // Pending choice of the setup screen only: it is written to storage by
    // Start match, never by a checkbox, so Cancel/Back leaves it untouched.
    setSetupBotSeats((prev) => {
      const next = new Set(prev);
      if (next.has(power)) next.delete(power); else next.add(power);
      return next;
    });
  };

  // Rule 34 handover while the match runs.  The board sends the engine move
  // (`setSeatBot`), which is what every client and the server driver read; this
  // callback mirrors the choice into the saved seat setup so a reload or a new
  // match remembers it.  The engine is the source of truth, so this only
  // records the same `bot` value the board just sent.
  const setSeatBot = React.useCallback((power: Power, bot: boolean) => {
    setBotSeats((prev) => {
      if (prev.has(power) === bot) return prev;
      const next = new Set(prev);
      if (bot) next.add(power); else next.delete(power);
      saveBotSeats(next);
      return next;
    });
  }, []);

  // `Local()` never forwards setupData, so the scenario travels in the game
  // definition the client was built with (see `hotseatGame` above).
  const SeatBoard = React.useMemo(() => boardClientFor(scenario, noGw, botDifficulty), [scenario, noGw, botDifficulty]);

  // A one-line summary of the chosen scenario for the setup screen.
  const scenarioText = React.useMemo(
    () => scenarioSummary(setupScenario, setupNoGw, locale, t),
    [setupScenario, setupNoGw, locale, t],
  );

  const botContext = React.useMemo(() => ({seats: botSeats, setSeatBot}), [botSeats, setSeatBot]);

  const seatUi = React.useMemo(() => ({currentSeat, onSwitchSeat: switchSeat, onGameState}), [currentSeat, switchSeat, onGameState]);
  if (showSetup) {
    return (
      <IESurface className="ie-local ie-local-setup">
        <header className="ie-local-head">
          <h1 className="ie-local-title">{t.localTitle}</h1>
          {matchStarted && (
            <button
              type="button"
              className="ie-btn secondary"
              data-testid="ie-back-to-match"
              onClick={() => {
                // Leaving the setup screen without pressing Start match keeps
                // the running match untouched: nothing below was saved yet.
                setSetupBotSeats(botSeats);
                setSetupScenario(scenario);
                setSetupNoGw(noGw);
                setShowSetup(false);
              }}
            >
              {t.newGameBack}
            </button>
          )}
        </header>
        <div className="ie-local-setup-body">
          <h2 className="ie-local-subtitle">{t.botSeatsTitle}</h2>
          <p className="ie-muted">{t.seatSetupIntro}</p>
          <div className="ie-local-bot-seats" data-testid="ie-local-bot-seats">
            {POWERS.map((p, index) => (
              <label key={p} className="ie-local-bot-seat" data-bot={setupBotSeats.has(p) ? "true" : "false"}>
                <input
                  type="checkbox"
                  data-testid={`ie-local-bot-${p}`}
                  checked={setupBotSeats.has(p)}
                  onChange={() => toggleBot(p)}
                />
                <span>P{index + 1} {seatPowerName(t, p, locale, auFormedForScenario(setupScenario))}</span>
                <em className="ie-local-bot-seat-role">
                  {setupBotSeats.has(p) ? t.seatSetupBot : t.seatSetupHuman}
                </em>
              </label>
            ))}
          </div>
          <p className="ie-muted" data-testid="ie-local-bot-difficulty">
            {t.botDifficultyLabel}: {botDifficultyLabel(initial.botDifficulty, locale)}
          </p>
          <p className="ie-muted" data-testid="ie-local-seat-summary">
            {setupBotSeats.size === 0 ? t.seatSetupAnyHuman : `${t.seatSetupHuman} ${POWERS.length - setupBotSeats.size} · ${t.seatSetupBot} ${setupBotSeats.size}`}
          </p>
          <h2 className="ie-local-subtitle">{t.scenarioTitle}</h2>
          <p className="ie-muted">{t.scenarioIntro}</p>
          <label className="ie-local-scenario">
            <span>{t.scenarioLabel}</span>
            <select
              data-testid="ie-local-scenario"
              value={setupScenario}
              onChange={(event) => {
                const next = event.target.value as ScenarioId;
                setSetupScenario(next);
                // Scenario 4's modifier is not printed for the tutorials; a
                // stale tick would otherwise travel into a scenario that has no
                // Great War to decide.
                if (!scenarioAllowsNoGw(next)) setSetupNoGw(false);
              }}
            >
              {IE_SCENARIOS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {locale === "en" ? entry.name : entry.nameZh}
                </option>
              ))}
            </select>
          </label>
          <label className="ie-local-no-gw">
            <input
              type="checkbox"
              data-testid="ie-local-no-gw"
              checked={setupNoGw}
              disabled={!scenarioAllowsNoGw(setupScenario)}
              onChange={(event) => setSetupNoGw(event.target.checked)}
            />
            <span>{locale === "en" ? IE_NO_GW_LABEL.en : IE_NO_GW_LABEL.zh_CN}</span>
          </label>
          <p className="ie-muted" data-testid="ie-local-scenario-summary">{scenarioText}</p>
          <button
            type="button"
            className="ie-btn primary ie-local-start"
            data-testid="ie-start-match"
            onClick={() => {
              // A fresh seat or scenario configuration is a fresh match: bump the
              // nonce so the local master cannot resume the abandoned one.
              setScenario(setupScenario);
              setNoGw(setupNoGw);
              setBotSeats(setupBotSeats);
              saveBotSeats(setupBotSeats);
              saveMatchSetup(setupScenario, setupNoGw);
              setMatchNonce((n) => n + 1);
              setMatchStarted(true);
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
  // One match id for every seat of this shell: it is the same `Local()` master,
  // and exposing it on each seat is what lets a test (or the reader) tell a
  // re-dealt match from the running one without reading localStorage.
  const matchID = matchNonce === 0 ? MATCH_ID : `${MATCH_ID}_${matchNonce}`;
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
        <span className="ie-chip" data-testid="ie-local-difficulty">
          {t.botDifficultyLabel} {botDifficultyLabel(botDifficulty, locale)}
        </span>
        <details className="ie-local-help">
          <summary>{t.localHelpLabel}</summary>
          <div className="ie-muted">{t.localHelp}</div>
        </details>
        <button
          type="button"
          className="ie-btn secondary ie-btn-xs"
          data-testid="ie-seat-setup"
          title={t.seatChangeWarning}
          onClick={() => setConfirmNewGame(true)}
        >
          {t.newGame}
        </button>
        <SeatStrip
          seats={seats}
          onSelect={switchSeat}
          locale={locale}
          auFormed={snapshot === null ? auFormedForScenario(scenario) : auFormedForState(snapshot)}
        />
      </div>
      <Modal
        open={confirmNewGame}
        dismissible
        locale={locale}
        title={t.newGameTitle}
        onClose={() => setConfirmNewGame(false)}
        testId="ie-new-game-dialog"
        backdropTestId="ie-new-game-backdrop"
        closeTestId="ie-new-game-close"
      >
        <p className="ie-muted" data-testid="ie-new-game-body">{t.newGameBody}</p>
        <div className="ie-dialog-actions">
          <button
            type="button"
            className="ie-btn secondary"
            data-testid="ie-new-game-cancel"
            onClick={() => setConfirmNewGame(false)}
          >
            {t.newGameCancel}
          </button>
          <button
            type="button"
            className="ie-btn primary"
            data-testid="ie-new-game-confirm"
            onClick={() => {
              // Only the setup screen opens here; the running match is discarded
              // when Start match deals the new one.  The setup screen offers a
              // way back, so this is still reversible.  Its choices start from
              // the running match's seats and scenario.
              setConfirmNewGame(false);
              setSetupBotSeats(botSeats);
              setSetupScenario(scenario);
              setSetupNoGw(noGw);
              setShowSetup(true);
            }}
          >
            {t.newGameConfirm}
          </button>
        </div>
      </Modal>
      <BotSeatsContext.Provider value={botContext}>
        <SeatUiContext.Provider value={seatUi}>
          <div className="ie-local-boards">
            {POWERS.map((p, index) => (
              <section
                key={p}
                className="ie-seat"
                data-active={tab === index ? "true" : "false"}
                data-match-id={matchID}
                data-testid={`ie-seat-${p}`}
              >
                <SeatBoard
                  // A seat-setup or scenario change deals a new match, so the old
                  // one is never silently resumed with a different configuration.
                  matchID={matchID}
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
