import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName, VQGame} from "../../../constant/general";
import {SPACE_BY_ID} from "../../../mapData";
import {ownerOf} from "../../../ownership";
import {interceptionOrderOptions} from "../../../navalCombat";

export interface PendingPanelProps {
    G: VQGame;
    moves: any;
    playerID: string | null;
}

/** Defending power chooses the order of its naval interceptions. */
export const PendingInterceptionOrderPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingInterceptionOrder === undefined) return null;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.interceptionOrder.title} · {i18n.chain.vq.intercept.waiting} {powerName(G.pendingInterceptionOrder.defender, vqLocale)} {i18n.chain.vq.interceptionOrder.choose} {SPACE_BY_ID[G.pendingInterceptionOrder.to]?.name ?? G.pendingInterceptionOrder.to} {i18n.chain.vq.interceptionOrder.move}{i18n.chain.vq.punct.period}</Typography>
        {ownerOf(G, G.pendingInterceptionOrder.defender) === playerID && <>
            {interceptionOrderOptions(G).map((entry: {id: string; label: string}) =>
                <Button key={entry.id} onClick={() => moves.chooseInterceptionOrder({from: entry.id})}>{entry.label}</Button>)}
            <Button variant="text" onClick={() => moves.autoInterceptionOrder({})}>{i18n.chain.vq.interceptionOrder.auto}</Button>
        </>}
    </Stack>;
};
