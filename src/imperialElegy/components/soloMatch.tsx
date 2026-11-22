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
 *   • no seat strip and no seat switching — the only way out is a restart;
 *   • restart is guarded by a confirmation dialog so a stray tap cannot wipe a
 *     running game.
 *
 * The match id is unique per page session (and per restart), so a restart
 * always deals a fresh match instead of resuming the abandoned one.
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
import {setupImperialElegy} from "../engine/setup";
import {Modal} from "./Modal";
import {SoloBotSeat} from "./soloBots";
import {
  loadNoGw,
  loadScenario,
  loadSoloPower,
  scenarioSummary,
  soloBotSeats,
} from "./localSetup";

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
const soloGameFor = (scenario: ScenarioId, noGw: boolean): typeof ImperialElegyGameDef => {
  const key = `${scenario}:${noGw ? "noGw" : "normal"}`;
  const cached = soloGames.get(key);
  if (cached !== undefined) return cached;
  const game = {
    ...ImperialElegyGameDef,
    setup: (ctx: Parameters<typeof setupImperialElegy>[0]) =>
      setupImperialElegy(ctx, {scenario, ...(noGw ? {noGw: true} : {})}),
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
const soloClientFor = (scenario: ScenarioId, noGw: boolean): SoloClients => {
  const key = `${scenario}:${noGw ? "noGw" : "normal"}`;
  const cached = soloClients.get(key);
  if (cached !== undefined) return cached;
  const game = soloGameFor(scenario, noGw);
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
  const [session, setSession] = React.useState<number>(() => Date.now());
  const [confirmRestart, setConfirmRestart] = React.useState(false);

  if (power === null) {
    // A direct visit (or a cleared storage) has no solo setup to play.
    return <Navigate replace to="/localIE/solo"/>;
  }

  const bots = soloBotSeats(power);
  const index = POWERS.indexOf(power);
  const matchID = `ie_solo_${power}_${session}`;
  const {Player, Bot} = soloClientFor(scenario, noGw);
  const summary = scenarioSummary(scenario, noGw, locale, t);

  const restart = () => {
    setConfirmRestart(false);
    // A new match id abandons the old local master state.  `Date.now()` is
    // monotonic enough per click, and `Math.max` keeps a rapid double restart
    // from reusing the id of the match it just replaced.
    setSession((previous) => Math.max(Date.now(), previous + 1));
    navigate("/localIE/solo/play", {replace: true});
  };

  return (
    <IESurface className="ie-local ie-solo-match">
      <div className="ie-local-top ie-solo-match-top">
        <h1 className="ie-local-title">{t.soloTitle}</h1>
        <span className="ie-muted ie-solo-match-power" data-testid="ie-solo-match-power">
          {`${t.soloYouPlay} ${t.seats[power]}`}
        </span>
        <span className="ie-muted ie-solo-match-scenario" data-testid="ie-solo-match-scenario">
          {summary}
        </span>
        <button
          type="button"
          className="ie-btn secondary ie-btn-xs"
          data-testid="ie-solo-restart"
          onClick={() => setConfirmRestart(true)}
        >
          {t.restartMatch}
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
        open={confirmRestart}
        dismissible
        locale={locale}
        title={t.soloRestartTitle}
        onClose={() => setConfirmRestart(false)}
        testId="ie-solo-restart-dialog"
        backdropTestId="ie-solo-restart-backdrop"
        closeTestId="ie-solo-restart-close"
      >
        <p className="ie-muted" data-testid="ie-solo-restart-body">{t.soloRestartBody}</p>
        <div className="ie-solo-restart-actions">
          <button
            type="button"
            className="ie-btn secondary"
            data-testid="ie-solo-restart-cancel"
            onClick={() => setConfirmRestart(false)}
          >
            {t.soloRestartCancel}
          </button>
          <button
            type="button"
            className="ie-btn primary"
            data-testid="ie-solo-restart-confirm"
            onClick={restart}
          >
            {t.soloRestartConfirm}
          </button>
        </div>
      </Modal>
    </IESurface>
  );
};

export default LocalImperialElegySoloMatch;
