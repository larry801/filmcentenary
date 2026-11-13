import React from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "../game";
import {ImperialElegyBoard} from "./board";
import {IESurface} from "./theme";
import {ieT} from "./i18n";
import i18n from "../../constant/i18n";
import {POWERS, Power} from "../types";
import {BotSeatsContext} from "./botContext";

const HotseatBoard = (props: React.ComponentProps<typeof ImperialElegyBoard>) =>
  <ImperialElegyBoard {...props} hotseat/>;

const BoardClient = Client({
  numPlayers: 6,
  game: ImperialElegyGameDef,
  board: HotseatBoard,
  multiplayer: Local(),
  debug: false,
});

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

const saveBotSeats = (seats: Set<Power>): void => {
  try {
    localStorage.setItem(BOT_SEATS_KEY, JSON.stringify([...seats]));
  } catch {/* ignore */}
};

const LocalImperialElegy = () => {
  i18n.use();
  const t = ieT();
  const [tab, setTab] = React.useState(0);
  const tabRefs = React.useRef<(HTMLElement | null)[]>([]);
  const seatCount = POWERS.length;
  const [botSeats, setBotSeats] = React.useState<Set<Power>>(loadBotSeatsMaybeSolo);
  const [started, setStarted] = React.useState(false);

  React.useEffect(() => {
    const switchSeat = (event: KeyboardEvent) => {
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
      setTab(next);
      tabRefs.current[next]?.focus();
    };
    window.addEventListener("keydown", switchSeat);
    return () => window.removeEventListener("keydown", switchSeat);
  }, [tab, seatCount]);

  const toggleBot = (power: Power) => {
    setBotSeats((prev) => {
      const next = new Set(prev);
      if (next.has(power)) next.delete(power); else next.add(power);
      saveBotSeats(next);
      return next;
    });
  };

  if (!started) {
    return (
      <IESurface className="ie-local">
        <div className="ie-local-head">
          <Typography variant="h6" sx={{color: "#e6c987", letterSpacing: ".08em"}}>{t.localTitle}</Typography>
        </div>
        <Box sx={{p: 2}}>
          <Typography variant="subtitle1" sx={{mb: 1}}>
            Bot seats (Rule 34)
          </Typography>
          <Box sx={{display: "flex", flexWrap: "wrap", gap: 1, mb: 2}}>
            {POWERS.map((p, index) => (
              <FormControlLabel
                key={p}
                control={
                  <Checkbox
                    checked={botSeats.has(p)}
                    onChange={() => toggleBot(p)}
                    size="small"
                  />
                }
                label={`P${index + 1} ${t.seats[p]}`}
              />
            ))}
          </Box>
          <Box
            component="button"
            onClick={() => setStarted(true)}
            sx={{
              px: 3, py: 1,
              background: "#c8a84b",
              color: "#1a1510",
              border: "none",
              borderRadius: 1,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            Start match
          </Box>
        </Box>
      </IESurface>
    );
  }

  return (
    <IESurface className="ie-local">
      <div className="ie-local-head">
        <Typography variant="h6" sx={{color: "#e6c987", letterSpacing: ".08em"}}>{t.localTitle}</Typography>
        <details><summary className="ie-muted">{t.localHelp}</summary><div className="ie-muted">{t.localHelp}</div></details>
      </div>
      <Tabs className="ie-local-tabs" value={tab} onChange={(_e, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label={t.seatTab}>
        {POWERS.map((p, index) => (
          <Tab
            key={p}
            label={`P${index + 1} ${t.seats[p]}${botSeats.has(p) ? " 🤖" : ""}`}
            value={index}
            aria-keyshortcuts={String(index + 1)}
            ref={(element) => { tabRefs.current[index] = element; }}
          />
        ))}
      </Tabs>
      <BotSeatsContext.Provider value={botSeats}>
        {POWERS.map((p, index) => (
          <Box key={p} sx={{display: tab === index ? "block" : "none"}} data-testid={`ie-seat-${p}`}>
            <BoardClient
              matchID={MATCH_ID}
              playerID={String(index)}
              debug={false}
            />
          </Box>
        ))}
      </BotSeatsContext.Provider>
    </IESurface>
  );
};

export default LocalImperialElegy;
