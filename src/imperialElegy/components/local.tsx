import React from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {ImperialElegyGameDef} from "../game";
import {ImperialElegyBoard} from "./board";
import {IESurface} from "./theme";
import {ieT} from "./i18n";
import i18n from "../../constant/i18n";
import {POWERS} from "../types";

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

const LocalImperialElegy = () => {
  i18n.use();
  const t = ieT();
  const [tab, setTab] = React.useState(0);
  const tabRefs = React.useRef<(HTMLElement | null)[]>([]);
  const seatCount = POWERS.length;

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

  return (
    <IESurface className="ie-local">
      <div className="ie-local-head">
        <Typography variant="h6" sx={{color: "#e6c987", letterSpacing: ".08em"}}>{t.localTitle}</Typography>
        <details><summary className="ie-muted">{t.localHelp}</summary><div className="ie-muted">{t.localHelp}</div></details>
      </div>
      <Tabs className="ie-local-tabs" value={tab} onChange={(_e, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label={t.seatTab}>
        {POWERS.map((p, index) => (
          <Tab key={p} label={`P${index + 1} ${t.seats[p]}`} value={index} aria-keyshortcuts={String(index + 1)}
            ref={(element) => { tabRefs.current[index] = element; }}/>
        ))}
      </Tabs>
      {POWERS.map((p, index) => (
        <Box key={p} sx={{display: tab === index ? "block" : "none"}} data-testid={`ie-seat-${p}`}>
          <BoardClient matchID={MATCH_ID} playerID={String(index)} debug={false}/>
        </Box>
      ))}
    </IESurface>
  );
};

export default LocalImperialElegy;
