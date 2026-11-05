import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {cardById} from "../../../../constant/cards";
import {tutorialEventOptions} from "../../../../tutorialEvents";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingTutorialEventPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    const e = i18n.chain.vq.tutorialEvent;
    return (
        <Stack spacing={1}>
            <Typography>{cardById(G.pendingTutorialEvent.cardId).name} · {e.waiting} {powerName(G.pendingTutorialEvent.responding, vqLocale)} {e.choose}。</Typography>
            {G.pendingTutorialEvent.step === "roadFormation" && 
                <Typography variant="body2">{e.roadFormation}</Typography>
            }
            {G.pendingTutorialEvent.step === "rebelLosses" && 
                <Typography variant="body2">
                    {SPACE_BY_ID[G.pendingTutorialEvent.space!]?.name}：{e.remaining} {G.pendingTutorialEvent.remaining} {e.losses}。
                </Typography>
            }
            {ownerOf(G, G.pendingTutorialEvent.responding) === playerID && tutorialEventOptions(G).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.chooseTutorialEvent({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
