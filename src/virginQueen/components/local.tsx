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
    return <Box sx={{p: 1}}>
        <Typography variant="h5" gutterBottom>Virgin Queen · 本地热座</Typography>
        <FormControl size="small" sx={{mb: 1, minWidth: 300}}>
            <InputLabel id="local-vq-scenario">场景</InputLabel>
            <Select labelId="local-vq-scenario" label="场景" value={configurationID}
                    onChange={(e) => {setConfigurationID(e.target.value); setTab(0);}}>
                {configurations.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.label}</MenuItem>)}
            </Select>
        </FormControl>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
              sx={{mb: 1}}>
            {configuration.seats.map((label, index) => <Tab key={index} label={`P${index + 1} ${label}`} value={index}/>)}
        </Tabs>
        {configuration.seats.map((label, index) => <Box key={`${configuration.id}-${index}`} sx={{display: tab === index ? "block" : "none"}}>
            <BoardClient matchID={`${MATCH_ID}-${configuration.id}`} playerID={String(index)} debug={false}/>
        </Box>)}
    </Box>;
};

export default LocalVirginQueen;
