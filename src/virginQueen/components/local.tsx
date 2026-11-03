import React from "react";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import {Client} from "boardgame.io/react";
import {Local} from "boardgame.io/multiplayer";
import {POWERS, POWER_NAMES} from "../constant/general";
import {VirginQueenGameDef} from "../game";
import {VirginQueenBoard} from "./board";

const VQClient = Client({
    numPlayers: 6,
    game: VirginQueenGameDef,
    board: VirginQueenBoard,
    multiplayer: Local(),
    debug: false,
});

const MATCH_ID = "local_virgin_queen";

const LocalVirginQueen = () => {
    const [tab, setTab] = React.useState(0);
    return <Box sx={{p: 1}}>
        <Typography variant="h5" gutterBottom>Virgin Queen · 本地六人热座</Typography>
        <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
              sx={{mb: 1}}>
            {POWERS.map((p, i) => <Tab key={p} label={POWER_NAMES[p].zh} value={i}/>) }
        </Tabs>
        {POWERS.map((p, i) => <Box key={p} sx={{display: tab === i ? "block" : "none"}}>
            <VQClient matchID={MATCH_ID} playerID={String(i)} credentials={`local-${i}`} debug={false}/>
        </Box>)}
    </Box>;
};

export default LocalVirginQueen;
