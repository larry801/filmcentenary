import React from "react";
import i18n from "../../constant/i18n";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {SCENARIO_OPTIONS, scenarioOptionLabel, seatLabels} from "../configuration";
import {VirginQueenGameDef} from "../game";
import {VirginQueenBoard} from "./board";
import {setupGame} from "../util";
import {ScenarioID} from "../constant/general";
import {VQSurface} from "./theme";

/**
 * Board clients are created once so switching seats or locales never remounts
 * a game.  Labels and seat names are resolved per render from these defs.
 */
const configurationDefs = SCENARIO_OPTIONS.flatMap((scenario) => scenario.players.map((numPlayers) => ({
    id: `${scenario.id}-${numPlayers}`,
    scenarioId: scenario.id,
    numPlayers,
    BoardClient: Client({
        numPlayers,
        game: {...VirginQueenGameDef, setup: (ctx) => setupGame(ctx, {scenario: scenario.id})},
        board: VirginQueenBoard,
        multiplayer: Local(),
        debug: false,
    }),
})));

const MATCH_ID = "local_virgin_queen";

const LocalVirginQueen = ({initialScenario = "campaign"}: {initialScenario?: ScenarioID}) => {
    i18n.use();
    const e = i18n.chain.vq.local;
    const [tab, setTab] = React.useState(0);
    const toolbarRef = React.useRef<HTMLDivElement>(null);
    // The toolbar wraps to two or three rows on narrow screens; measuring it is
    // more reliable than the fixed 112px/152px heights in the stylesheet.
    React.useEffect(() => {
        const node = toolbarRef.current;
        const root = node?.parentElement ?? null;
        if (node === null || root === null || typeof ResizeObserver === "undefined") return undefined;
        const apply = (): void => {
            const height = Math.ceil(node.getBoundingClientRect().height);
            if (height > 0) root.style.setProperty("--vq-shell-height", `${height}px`);
        };
        const observer = new ResizeObserver(apply);
        observer.observe(node);
        apply();
        return () => observer.disconnect();
    }, []);
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const configurations = React.useMemo(() => configurationDefs.map((entry) => ({
        ...entry,
        label: `${scenarioOptionLabel(entry.scenarioId, vqLocale)} · ${entry.numPlayers} ${e.players}`,
        seats: seatLabels(entry.scenarioId, entry.numPlayers, vqLocale),
    })), [vqLocale, e.players]);
    const initialConfigurationID = `${initialScenario}-${initialScenario === "tutorial" ? 2 : 6}`;
    const [configurationID, setConfigurationID] = React.useState(initialConfigurationID);
    React.useEffect(() => {
        setConfigurationID(initialConfigurationID);
        setTab(0);
    }, [initialConfigurationID]);
    const configuration = configurations.find((entry) => entry.id === configurationID)!;
    const BoardClient = configuration.BoardClient;
    const seatCount = configuration.seats.length;
    const tabRefs = React.useRef<(HTMLElement | null)[]>([]);
    React.useEffect(() => {
        const switchSeat = (event: KeyboardEvent) => {
            if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
            if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.closest(
                "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='combobox'], [role='listbox'], [role='menu'], [role='dialog']",
            ))) return;
            let nextTab: number;
            if (/^[1-6]$/.test(event.key)) nextTab = Number(event.key) - 1;
            else if (event.key === "[") nextTab = (tab + seatCount - 1) % seatCount;
            else if (event.key === "]") nextTab = (tab + 1) % seatCount;
            else return;
            if (nextTab >= seatCount) return;
            event.preventDefault();
            setTab(nextTab);
            tabRefs.current[nextTab]?.focus();
        };
        window.addEventListener("keydown", switchSeat);
        return () => window.removeEventListener("keydown", switchSeat);
    }, [tab, seatCount]);
    return <VQSurface className="vq-local">
        <div className="vq-local-toolbar" ref={toolbarRef}>
            <FormControl size="small" sx={{width: {xs: 220, sm: 240}, maxWidth: "100%", flexShrink: 0}}>
                <InputLabel id="local-vq-scenario">{e.hotseatScenario}</InputLabel>
                <Select labelId="local-vq-scenario" label={e.hotseatScenario} value={configurationID}
                        onChange={(ev) => {setConfigurationID(ev.target.value); setTab(0);}}>
                    {configurations.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.label}</MenuItem>)}
                </Select>
            </FormControl>
            <Tabs className="vq-seat-tabs" value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                  aria-label={e.seatPanel}>
                {configuration.seats.map((label, index) => <Tab key={index} label={`P${index + 1} ${label}`} value={index}
                    aria-keyshortcuts={String(index + 1)} title={`${e.shortcut}: ${index + 1}`}
                    ref={(element) => {tabRefs.current[index] = element;}}/>)}
            </Tabs>
            <details className="vq-local-help"><summary>{e.hotseatHelp}</summary><div>
                <Typography variant="subtitle2">{e.vqHotseat}</Typography>
                {configurationID === "tutorial-2" && <Typography variant="body2" sx={{my: 1}}>
                    {e.tutorial2p}
                </Typography>}
                <Typography variant="body2">{e.shortcuts} 1–{seatCount} {e.switchSeat}; [ {e.prev}, ] {e.next} ({e.cycle}). {e.noTrigger}</Typography>
                {configurationID !== "tutorial-2" && <Button variant="outlined" sx={{mt: 1}}
                    onClick={() => {setConfigurationID("tutorial-2"); setTab(0);}}>{e.enterTutorial}</Button>}
            </div></details>
        </div>
        {configuration.seats.map((label, index) => <Box key={`${configuration.id}-${index}`} sx={{display: tab === index ? "block" : "none"}}>
            <BoardClient matchID={`${MATCH_ID}-${configuration.id}`} playerID={String(index)} debug={false}/>
        </Box>)}
    </VQSurface>;
};

export default LocalVirginQueen;
