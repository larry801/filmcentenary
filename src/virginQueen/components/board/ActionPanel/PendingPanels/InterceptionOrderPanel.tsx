import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {interceptionOrderOptions} from "../../../../navalCombat";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingInterceptionOrderPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.interceptionOrder.title} · {i18n.chain.vq.intercept.waiting} {powerName(G.pendingInterceptionOrder.defender, vqLocale)} {i18n.chain.vq.interceptionOrder.choose} {SPACE_BY_ID[G.pendingInterceptionOrder.to]?.name ?? G.pendingInterceptionOrder.to} {i18n.chain.vq.interceptionOrder.move}。</Typography>
            {ownerOf(G, G.pendingInterceptionOrder.defender) === playerID && <>
                {interceptionOrderOptions(G).map((entry: any) =>
                    <Button key={entry.id} onClick={() => moves.chooseInterceptionOrder({from: entry.id})}>{entry.label}</Button>
                )}
                <Button variant="text" onClick={() => moves.autoInterceptionOrder({})}>{i18n.chain.vq.interceptionOrder.auto}</Button>
            </>}
        </Stack>
    );
};
