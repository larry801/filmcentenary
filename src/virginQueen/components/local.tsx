import React from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {SCENARIO_OPTIONS, seatLabels} from "../configuration";
import {VirginQueenGameDef} from "../game";
import {VirginQueenBoard} from "./board";
import {setupGame} from "../util";

const configurations = SCENARIO_OPTIONS.flatMap((scenario) => scenario.players.map((numPlayers) => ({
    id: `${scenario.id}-${numPlayers}`,
    label: `${scenario.label} · ${numPlayers} 人`,
    seats: seatLabels(scenario.id, numPlayers),
    BoardClient: Client({
        numPlayers,
        game: {...VirginQueenGameDef, setup: (ctx) => setupGame(ctx, {scenario: scenario.id})},
        board: VirginQueenBoard,
        multiplayer: Local(),
        debug: false,
    }),
})));

const MATCH_ID = "local_virgin_queen";

const LocalVirginQueen = () => {
    const [tab, setTab] = React.useState(0);
    const [configurationID, setConfigurationID] = React.useState("campaign-6");
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
    return <Box sx={{p: 1}}>
        <Typography variant="h5" gutterBottom>Virgin Queen · 本地热座</Typography>
        <FormControl size="small" sx={{mb: 1, minWidth: 300}}>
            <InputLabel id="local-vq-scenario">场景</InputLabel>
            <Select labelId="local-vq-scenario" label="场景" value={configurationID}
                    onChange={(e) => {setConfigurationID(e.target.value); setTab(0);}}>
                {configurations.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.label}</MenuItem>)}
            </Select>
        </FormControl>
        <Typography variant="body2" color="text.secondary" sx={{mb: 1}}>
            快捷键：1–{seatCount} 切换对应玩家面板；[ 上一个，] 下一个（循环切换）。输入或选择菜单时不触发。
        </Typography>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
              aria-label="本地玩家面板" sx={{mb: 1}}>
            {configuration.seats.map((label, index) => <Tab key={index} label={`P${index + 1} ${label}`} value={index}
                aria-keyshortcuts={String(index + 1)} title={`快捷键：${index + 1}`}
                ref={(element) => {tabRefs.current[index] = element;}}/>)}
        </Tabs>
        {configuration.seats.map((label, index) => <Box key={`${configuration.id}-${index}`} sx={{display: tab === index ? "block" : "none"}}>
            <BoardClient matchID={`${MATCH_ID}-${configuration.id}`} playerID={String(index)} debug={false}/>
        </Box>)}
    </Box>;
};

export default LocalVirginQueen;
