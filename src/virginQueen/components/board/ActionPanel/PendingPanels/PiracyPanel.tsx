import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {piracyOptions} from "../../../../piracy";

export const PendingPiracyPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID, piracyResponder} = props;
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.piracy.title} · {i18n.chain.vq.intercept.waiting} {powerName(piracyResponder! as Power, vqLocale)} {i18n.chain.vq.piracy.choose}。</Typography>
            {ownerOf(G, piracyResponder!) === playerID && piracyOptions(G).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.choosePiracy({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
