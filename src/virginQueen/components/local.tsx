import React from "react";
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
import {SCENARIO_OPTIONS, seatLabels} from "../configuration";
import {VirginQueenGameDef} from "../game";
import {VirginQueenBoard} from "./board";
import {setupGame} from "../util";
import {ScenarioID} from "../constant/general";
import {VQSurface} from "./theme";

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

const LocalVirginQueen = ({initialScenario = "campaign"}: {initialScenario?: ScenarioID}) => {
    const [tab, setTab] = React.useState(0);
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
        <div className="vq-local-toolbar">
            <FormControl size="small" sx={{width: {xs: 220, sm: 240}, maxWidth: "100%", flexShrink: 0}}>
                <InputLabel id="local-vq-scenario">本地热座 · 场景</InputLabel>
                <Select labelId="local-vq-scenario" label="本地热座 · 场景" value={configurationID}
                        onChange={(e) => {setConfigurationID(e.target.value); setTab(0);}}>
                    {configurations.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.label}</MenuItem>)}
                </Select>
            </FormControl>
            <Tabs className="vq-seat-tabs" value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
                  aria-label="本地玩家面板">
                {configuration.seats.map((label, index) => <Tab key={index} label={`P${index + 1} ${label}`} value={index}
                    aria-keyshortcuts={String(index + 1)} title={`快捷键：${index + 1}`}
                    ref={(element) => {tabRefs.current[index] = element;}}/>)}
            </Tabs>
            <details className="vq-local-help"><summary>热座帮助</summary><div>
                <Typography variant="subtitle2">Virgin Queen · 本地热座</Typography>
                {configurationID === "tutorial-2" && <Typography variant="body2" sx={{my: 1}}>
                    双人教学：P1 奥斯曼帝国 / P2 西班牙。请按教学提示切换玩家标签页；每个标签页仅显示该玩家的手牌。
                </Typography>}
                <Typography variant="body2">快捷键：1–{seatCount} 切换对应玩家面板；[ 上一个，] 下一个（循环切换）。输入或选择菜单时不触发。</Typography>
                {configurationID !== "tutorial-2" && <Button variant="outlined" sx={{mt: 1}}
                    onClick={() => {setConfigurationID("tutorial-2"); setTab(0);}}>进入双人教学模式</Button>}
            </div></details>
        </div>
        {configuration.seats.map((label, index) => <Box key={`${configuration.id}-${index}`} sx={{display: tab === index ? "block" : "none"}}>
            <BoardClient matchID={`${MATCH_ID}-${configuration.id}`} playerID={String(index)} debug={false}/>
        </Box>)}
    </VQSurface>;
};

export default LocalVirginQueen;
