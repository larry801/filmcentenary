import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {piracyOptions} from "../../../../piracy";

export const PendingPiracyPanel = (props: any) => {
    const {G, moves, playerID, piracyResponder} = props;
    return (
        <Stack spacing={1}>
            <Typography>海盗行动 · 等待 {POWER_NAMES[piracyResponder! as keyof typeof POWER_NAMES].zh} 选择。</Typography>
            {ownerOf(G, piracyResponder!) === playerID && piracyOptions(G).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.choosePiracy({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
