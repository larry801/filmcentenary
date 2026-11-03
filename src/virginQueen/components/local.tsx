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
import {POWERS, POWER_NAMES} from "../constant/general";
import {VirginQueenGameDef} from "../game";
import {VirginQueenBoard} from "./board";
import {setupGame} from "../util";

const campaignGame = {...VirginQueenGameDef, setup: (ctx: any) => setupGame(ctx, {scenario: "campaign" as const})};
const tournamentGame = {...VirginQueenGameDef, setup: (ctx: any) => setupGame(ctx, {scenario: "tournament" as const})};
const CampaignClient = Client({
    numPlayers: 6,
    game: campaignGame,
    board: VirginQueenBoard,
    multiplayer: Local(),
    debug: false,
});
const TournamentClient = Client({
    numPlayers: 6,
    game: tournamentGame,
    board: VirginQueenBoard,
    multiplayer: Local(),
    debug: false,
});

const MATCH_ID = "local_virgin_queen";

const LocalVirginQueen = () => {
    const [tab, setTab] = React.useState(0);
    const [scenario, setScenario] = React.useState<"campaign" | "tournament">("campaign");
    return <Box sx={{p: 1}}>
        <Typography variant="h5" gutterBottom>Virgin Queen · 本地六人热座</Typography>
        <FormControl size="small" sx={{mb: 1, minWidth: 300}}>
            <InputLabel id="local-vq-scenario">场景</InputLabel>
            <Select labelId="local-vq-scenario" label="场景" value={scenario}
                    onChange={(e) => setScenario(e.target.value as "campaign" | "tournament")}>
                <MenuItem value="campaign">Campaign · 拉罗谢尔之围</MenuItem>
                <MenuItem value="tournament">Tournament · 荷兰起义开始</MenuItem>
            </Select>
        </FormControl>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
              sx={{mb: 1}}>
            {POWERS.map((p, i) => <Tab key={p} label={POWER_NAMES[p].zh} value={i}/>) }
        </Tabs>
        {POWERS.map((p, i) => <Box key={p} sx={{display: tab === i ? "block" : "none"}}>
            {scenario === "campaign"
                ? <CampaignClient key={`${MATCH_ID}-campaign-${i}`} matchID={`${MATCH_ID}-campaign`} playerID={String(i)} credentials={`local-campaign-${i}`} debug={false}/>
                : <TournamentClient key={`${MATCH_ID}-tournament-${i}`} matchID={`${MATCH_ID}-tournament`} playerID={String(i)} credentials={`local-tournament-${i}`} debug={false}/>}
        </Box>)}
    </Box>;
};

export default LocalVirginQueen;
