/**
 * The dedicated solo match page.
 *
 * Solo play used to hand over to `/localIE`, the six-board hotseat shell, with
 * five bot seats.  That leaked the hotseat interface into single-player: a seat
 * strip let the player switch into a bot's board (and read its private hand),
 * and "change bot seats" could silently deal a different match.  This page is
 * the whole match on its own:
 *
 *   • one visible board, the power the player chose;
 *   • five headless bot clients (`SoloBotSeat`) that never render a seat UI;
 *   • no seat strip and no seat switching;
 *   • "New game" is guarded by a confirmation dialog and then returns to the
 *     solo setup page, where the power and the scenario are chosen again.
 *
 * The match id is unique per page session, so a visit always deals a fresh
 * match instead of resuming the abandoned one.
 */
import React from "react";
import {Navigate, useNavigate} from "react-router-dom";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {IESurface} from "./theme";
import {ieT} from "./i18n";
import i18n from "../../constant/i18n";
import {ImperialElegyGameDef} from "../game";
import {ImperialElegyBoard} from "./board";
import {POWERS, Power} from "../types";
import {ScenarioId} from "../constant/scenarios";
import {BotDifficulty} from "../configuration";
import {setupImperialElegy} from "../engine/setup";
import {Modal} from "./Modal";
import {SoloBotSeat} from "./soloBots";
import {
  botDifficultyLabel,
  loadBotDifficulty,
  loadNoGw,
  loadScenario,
  loadSoloPower,
  scenarioSummary,
  soloBotSeats,
} from "./localSetup";
import {auFormedForScenario, seatPowerName} from "./seatNames";

/** The player's board: no hotseat seat switching, no Rule 34 hand-over. */
const SoloPlayerBoard = (props: React.ComponentProps<typeof ImperialElegyBoard>) =>
  <ImperialElegyBoard {...props} allowSeatHandover={false}/>;

/**
 * One game definition per (scenario, No-GW) pair.
 *
 * boardgame.io's `Local()` master is keyed by the game definition object, and
 * the player and the five bot clients must share that one master.  Rebuilding
 * the definition on every render would give each client a separate match, so
 * the definitions are cached by their setup.
 */
const soloGames = new Map<string, typeof ImperialElegyGameDef>();
const soloGameFor = (
  scenario: ScenarioId,
  noGw: boolean,
  botDifficulty: BotDifficulty,
): typeof ImperialElegyGameDef => {
  const key = `${scenario}:${noGw ? "noGw" : "normal"}:${botDifficulty}`;
  const cached = soloGames.get(key);
  if (cached !== undefined) return cached;
  const game = {
    ...ImperialElegyGameDef,
    setup: (ctx: Parameters<typeof setupImperialElegy>[0]) =>
      // 34.1: the setup page's one difficulty level for every bot seat.
      setupImperialElegy(ctx, {scenario, ...(noGw ? {noGw: true} : {}), botDifficulty}),
  };
  soloGames.set(key, game);
  return game;
};

interface SoloClients {
  Player: ReturnType<typeof Client>;
  Bot: ReturnType<typeof Client>;
}

/** The player client and the headless bot client, both on the same master. */
const soloClients = new Map<string, SoloClients>();
const soloClientFor = (
  scenario: ScenarioId,
  noGw: boolean,
  botDifficulty: BotDifficulty,
): SoloClients => {
  const key = `${scenario}:${noGw ? "noGw" : "normal"}:${botDifficulty}`;
  const cached = soloClients.get(key);
  if (cached !== undefined) return cached;
  const game = soloGameFor(scenario, noGw, botDifficulty);
  const created: SoloClients = {
    Player: Client({
      numPlayers: POWERS.length,
      game,
      board: SoloPlayerBoard,
      multiplayer: Local(),
      debug: false,
    }),
    Bot: Client({
      numPlayers: POWERS.length,
      game,
      board: SoloBotSeat as React.ComponentType<any>,
      multiplayer: Local(),
      debug: false,
    }),
  };
  soloClients.set(key, created);
  return created;
};

const LocalImperialElegySoloMatch = () => {
  i18n.use();
  const t = ieT();
  const locale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  const navigate = useNavigate();
  // Language switches must re-render: the i18n object is mutable state that
  // React cannot observe.
  const [, setLocaleTick] = React.useState(0);
  React.useEffect(() => i18n.listen(() => setLocaleTick((n) => n + 1)), []);

  // Read once: the setup page wrote these together, and a match must not
  // change its power or scenario halfway through.
  const [power] = React.useState<Power | null>(loadSoloPower);
  const [scenario] = React.useState<ScenarioId>(loadScenario);
  const [noGw] = React.useState<boolean>(loadNoGw);
  const [botDifficulty] = React.useState<BotDifficulty>(loadBotDifficulty);
  const [session] = React.useState<number>(() => Date.now());
  const [confirmNewGame, setConfirmNewGame] = React.useState(false);

  if (power === null) {
    // A direct visit (or a cleared storage) has no solo setup to play.
    return <Navigate replace to="/localIE/solo"/>;
  }

  const bots = soloBotSeats(power);
  const index = POWERS.indexOf(power);
  const matchID = `ie_solo_${power}_${session}`;
  const {Player, Bot} = soloClientFor(scenario, noGw, botDifficulty);
  const summary = scenarioSummary(scenario, noGw, locale, t);

  // "New game" does not silently deal the same setup again: it goes back to the
  // solo setup page, where the power and the scenario are chosen again.  The
  // setup page then writes a new setup and the match page mounts with a new
  // session id, so the abandoned match cannot be resumed.
  const startNewGame = () => {
    setConfirmNewGame(false);
    navigate("/localIE/solo");
  };

  return (
    <IESurface className="ie-local ie-solo-match">
      <div className="ie-local-top ie-solo-match-top">
        <h1 className="ie-local-title">{t.soloTitle}</h1>
        <span className="ie-muted ie-solo-match-power" data-testid="ie-solo-match-power">
          {`${t.soloYouPlay} ${seatPowerName(t, power, locale, auFormedForScenario(scenario))}`}
        </span>
        <span className="ie-muted ie-solo-match-scenario" data-testid="ie-solo-match-scenario">
          {summary}
        </span>
        <span className="ie-muted ie-solo-match-difficulty" data-testid="ie-solo-match-difficulty">
          {t.botDifficultyLabel}: {botDifficultyLabel(botDifficulty, locale)}
        </span>
        <button
          type="button"
          className="ie-btn secondary ie-btn-xs"
          data-testid="ie-solo-new-game"
          onClick={() => setConfirmNewGame(true)}
        >
          {t.newGame}
        </button>
      </div>
      <div className="ie-local-boards ie-solo-boards">
        <section className="ie-seat" data-active="true" data-match-id={matchID} data-testid={`ie-seat-${power}`}>
          <Player key={matchID} matchID={matchID} playerID={String(index)} debug={false}/>
        </section>
      </div>
      {/* One headless client per bot seat.  The board renders nothing; the
          client exists to give the bot its own credentials and moves. */}
      <div className="ie-solo-bot-drivers" hidden aria-hidden="true">
        {[...bots].map((bot) => (
          <Bot
            key={`${matchID}-${bot}`}
            matchID={matchID}
            playerID={String(POWERS.indexOf(bot))}
            debug={false}
          />
        ))}
      </div>
      <Modal
        open={confirmNewGame}
        dismissible
        locale={locale}
        title={t.soloNewGameTitle}
        onClose={() => setConfirmNewGame(false)}
        testId="ie-solo-new-game-dialog"
        backdropTestId="ie-solo-new-game-backdrop"
        closeTestId="ie-solo-new-game-close"
      >
        <p className="ie-muted" data-testid="ie-solo-new-game-body">{t.soloNewGameBody}</p>
        <div className="ie-dialog-actions">
          <button
            type="button"
            className="ie-btn secondary"
            data-testid="ie-solo-new-game-cancel"
            onClick={() => setConfirmNewGame(false)}
          >
            {t.newGameCancel}
          </button>
          <button
            type="button"
            className="ie-btn primary"
            data-testid="ie-solo-new-game-confirm"
            onClick={startNewGame}
          >
            {t.soloNewGameConfirm}
          </button>
        </div>
      </Modal>
    </IESurface>
  );
};

export default LocalImperialElegySoloMatch;
