import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {cardName} from "../../../constant/cards";
import {spaceName} from "../../../mapData";
import {ownerOf} from "../../../ownership";
import {tutorialEventOptions} from "../../../tutorialEvents";
import {PendingPanelProps} from "./types";

/** Scripted tutorial event response. */
export const PendingTutorialEventPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingTutorialEvent === undefined) return null;
    const pending = G.pendingTutorialEvent;
    return <Stack spacing={1}>
        <Typography>{cardName(pending.cardId, vqLocale)} · {i18n.chain.vq.tutorialEvent.waiting} {powerName(pending.responding, vqLocale)} {i18n.chain.vq.tutorialEvent.choose}{i18n.chain.vq.punct.period}</Typography>
        {pending.step === "roadFormation" && <Typography variant="body2">
            {i18n.chain.vq.tutorialEvent.roadFormation}
        </Typography>}
        {pending.step === "rebelLosses" && <Typography variant="body2">
            {spaceName(pending.space!, vqLocale)}{i18n.chain.vq.punct.colon}{i18n.chain.vq.tutorialEvent.remaining} {pending.remaining} {i18n.chain.vq.tutorialEvent.losses}{i18n.chain.vq.punct.period}
        </Typography>}
        {ownerOf(G, pending.responding) === playerID && tutorialEventOptions(G).map((entry) =>
            <Button key={entry.id} onClick={() => moves.chooseTutorialEvent({choice: entry.id})}>{entry.label}</Button>)}
    </Stack>;
};
