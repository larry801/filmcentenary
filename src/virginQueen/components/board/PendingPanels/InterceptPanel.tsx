import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName, VQGame} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {interceptionOptions} from "../../../interception";

export interface PendingPanelProps {
    G: VQGame;
    moves: any;
    playerID: string | null;
}

/** Naval interception choice for the defender. */
export const PendingInterceptPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingIntercept === undefined) return null;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.intercept.title} · {i18n.chain.vq.intercept.waiting} {powerName(G.pendingIntercept.defender, vqLocale)}{i18n.chain.vq.punct.period}</Typography>
        {ownerOf(G, G.pendingIntercept.defender) === playerID && interceptionOptions(G).map((entry: {id: string; label: string}) =>
            <Button key={entry.id} onClick={() => moves.chooseInterception({choice: entry.id})}>{entry.label}</Button>)}
    </Stack>;
};
