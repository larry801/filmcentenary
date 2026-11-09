import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName, Power} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {piracyOptions} from "../../../piracy";
import {PendingPanelProps} from "./types";

export interface PendingPiracyPanelProps extends PendingPanelProps {
    responder: Power;
}

/** Piracy resolution choice for the responding power. */
export const PendingPiracyPanel = ({G, moves, playerID, responder}: PendingPiracyPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingPiracy === undefined) return null;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.piracy.title} · {i18n.chain.vq.intercept.waiting} {powerName(responder, vqLocale)} {i18n.chain.vq.piracy.choose}{i18n.chain.vq.punct.period}</Typography>
        {ownerOf(G, responder) === playerID && piracyOptions(G).map((entry) =>
            <Button key={entry.id} variant="outlined" onClick={() => moves.choosePiracy({choice: entry.id})}>{entry.label}</Button>)}
    </Stack>;
};
