import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {interceptionOptions} from "../../../../interception";

export const PendingInterceptPanel = (props: any) => {
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>拦截 · 等待 {POWER_NAMES[G.pendingIntercept.defender].zh}。</Typography>
            {ownerOf(G, G.pendingIntercept.defender) === playerID && interceptionOptions(G).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.chooseInterception({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
