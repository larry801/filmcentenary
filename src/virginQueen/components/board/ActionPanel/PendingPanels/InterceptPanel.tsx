import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {interceptionOptions} from "../../../../interception";

export const PendingInterceptPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.intercept.title} · {i18n.chain.vq.intercept.waiting} {powerName(G.pendingIntercept.defender, vqLocale)}。</Typography>
            {ownerOf(G, G.pendingIntercept.defender) === playerID && interceptionOptions(G).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.chooseInterception({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
