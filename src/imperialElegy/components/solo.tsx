import React from "react";
import {useNavigate} from "react-router-dom";
import {IESurface} from "./theme";
import {ieT} from "./i18n";
import i18n from "../../constant/i18n";
import {POWERS, Power} from "../types";
import {BotDifficulty, IE_NO_GW_LABEL, IE_SCENARIOS} from "../configuration";
import {ScenarioId} from "../constant/scenarios";
import {
  botDifficultyLabel,
  loadBotDifficulty,
  loadNoGw,
  loadScenario,
  loadSoloPower,
  saveSoloSetup,
  scenarioAllowsNoGw,
  scenarioSummary,
  soloBotSeats,
  soloMatchPath,
} from "./localSetup";
import {auFormedForScenario, seatPowerName} from "./seatNames";

/**
 * The solo entrance: a page of its own where the player picks the one great
 * power they command.
 *
 * A solo match has its own page (`/localIE/solo/play`) and its own client: it
 * does not reuse the six-board hotseat shell.  This setup page only collects
 * the power the player commands (plus the printed scenario), writes the solo
 * setup and hands over to that page.  The five remaining powers are always the
 * bots, and the match page never exposes their boards or a seat switcher.
 */
const LocalImperialElegySolo = () => {
  i18n.use();
  const t = ieT();
  const locale = i18n.getLocaleName() === "en" ? "en" : "zh_CN";
  const navigate = useNavigate();
  // The power is a single choice: keep the last one the player took, and fall
  // back to the first printed seat (GE) so the radio group always has one.
  const [power, setPower] = React.useState<Power>(() => loadSoloPower() ?? POWERS[0]);
  const [scenario, setScenario] = React.useState<ScenarioId>(loadScenario);
  const [noGw, setNoGw] = React.useState<boolean>(loadNoGw);
  // 34.1: one difficulty level for every bot seat.
  const [difficulty, setDifficulty] = React.useState<BotDifficulty>(loadBotDifficulty);

  // Language switches must re-render: the i18n object is mutable state that
  // React cannot observe.
  const [, setLocaleTick] = React.useState(0);
  React.useEffect(() => i18n.listen(() => setLocaleTick((n) => n + 1)), []);

  const summary = React.useMemo(
    () => scenarioSummary(scenario, noGw, locale, t),
    [scenario, noGw, locale, t],
  );
  const bots = soloBotSeats(power);

  return (
    <IESurface className="ie-local ie-local-setup ie-solo">
      <header className="ie-local-head">
        <h1 className="ie-local-title">{t.soloTitle}</h1>
      </header>
      <div className="ie-local-setup-body">
        <h2 className="ie-local-subtitle">{t.soloPowerTitle}</h2>
        <p className="ie-muted">{t.soloPowerIntro}</p>
        <div
          className="ie-solo-powers"
          role="radiogroup"
          aria-label={t.soloPowerTitle}
          data-testid="ie-solo-powers"
        >
          {POWERS.map((p, index) => (
            <label
              key={p}
              className="ie-solo-power"
              data-power={p}
              data-selected={p === power ? "true" : "false"}
            >
              <input
                type="radio"
                name="ie-solo-power"
                value={p}
                data-testid={`ie-solo-power-${p}`}
                checked={p === power}
                onChange={() => setPower(p)}
              />
              <span className={`ie-power-pip ie-power-pip-${p.toLowerCase()}`} aria-hidden="true"/>
              <span className="ie-solo-power-seat">P{index + 1}</span>
              <span className="ie-solo-power-name">{seatPowerName(t, p, locale, auFormedForScenario(scenario))}</span>
            </label>
          ))}
        </div>
        <p className="ie-muted" data-testid="ie-solo-summary">
          {`${t.soloYouPlay} ${seatPowerName(t, power, locale, auFormedForScenario(scenario))} · ${t.soloBotsRest} ${bots.size}`}
        </p>

        <h2 className="ie-local-subtitle">{t.soloDifficultyTitle}</h2>
        <p className="ie-muted">{t.soloDifficultyIntro}</p>
        <div
          className="ie-solo-difficulty"
          role="radiogroup"
          aria-label={t.soloDifficultyTitle}
          data-testid="ie-solo-difficulty"
        >
          {(["easy", "normal", "hard"] as BotDifficulty[]).map((level) => (
            <label
              key={level}
              className="ie-solo-difficulty-level"
              data-level={level}
              data-selected={difficulty === level ? "true" : "false"}
            >
              <input
                type="radio"
                name="ie-solo-difficulty"
                value={level}
                data-testid={`ie-solo-difficulty-${level}`}
                checked={difficulty === level}
                onChange={() => setDifficulty(level)}
              />
              <span>{botDifficultyLabel(level, locale)}</span>
            </label>
          ))}
        </div>

        <h2 className="ie-local-subtitle">{t.scenarioTitle}</h2>
        <p className="ie-muted">{t.scenarioIntro}</p>
        <label className="ie-local-scenario">
          <span>{t.scenarioLabel}</span>
          <select
            data-testid="ie-solo-scenario"
            value={scenario}
            onChange={(event) => {
              const next = event.target.value as ScenarioId;
              setScenario(next);
              if (!scenarioAllowsNoGw(next)) setNoGw(false);
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
            data-testid="ie-solo-no-gw"
            checked={noGw}
            disabled={!scenarioAllowsNoGw(scenario)}
            onChange={(event) => setNoGw(event.target.checked)}
          />
          <span>{locale === "en" ? IE_NO_GW_LABEL.en : IE_NO_GW_LABEL.zh_CN}</span>
        </label>
        <p className="ie-muted" data-testid="ie-solo-scenario-summary">{summary}</p>

        <div className="ie-solo-actions">
          <button
            type="button"
            className="ie-btn primary ie-local-start"
            data-testid="ie-solo-start"
            onClick={() => {
              // Persist the single choice and hand over to the dedicated solo
              // match page, which deals a fresh match on the picked seat.
              saveSoloSetup(power, scenario, noGw, difficulty);
              navigate(soloMatchPath());
            }}
          >
            {t.soloStart}
          </button>
        </div>
      </div>
    </IESurface>
  );
};

export default LocalImperialElegySolo;
