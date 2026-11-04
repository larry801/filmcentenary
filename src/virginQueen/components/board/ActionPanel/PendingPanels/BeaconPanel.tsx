import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingBeaconPanel = (props: any) => {
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>烽火 · {POWER_NAMES[G.pendingBeacon.defender].zh} 正在从 {SPACE_BY_ID[G.pendingBeacon.from]?.name ?? G.pendingBeacon.from} 拦截，可在此次拦截判定前打出 #14。</Typography>
            {ownerOf(G, G.pendingBeacon.defender) === playerID && <>
                <Typography variant="body2">本次拦截自动成功，拦截方在随后海战中额外掷 2 个骰子。</Typography>
                <Stack direction="row" spacing={0.5}>
                    <Button variant="contained" disabled={!G.powers[G.pendingBeacon.defender].cards.includes("vq-014")}
                        onClick={() => moves.respondBeaconFires({choice: "play"})}>打出烽火</Button>
                    <Button variant="outlined" onClick={() => moves.respondBeaconFires({choice: "decline"})}>不打出</Button>
                </Stack>
            </>}
        </Stack>
    );
};
