import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {POWERS, powerName} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {PendingPanelProps} from "./types";

/** Major-power activation (war on the Papacy, join a defence, ...). */
export const PendingActivationPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingActivation === undefined) return null;
    const pending = G.pendingActivation;
    const canRespond = ownerOf(G, pending.ally) === playerID;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.activation.waiting} {powerName(pending.ally, vqLocale)} {i18n.chain.vq.activation.activate} {powerName(pending.power, vqLocale)}{i18n.chain.vq.punct.period}</Typography>
        {canRespond && <>
            <Button variant="outlined" onClick={() => moves.chooseMajorActivation({})}>{i18n.chain.vq.activation.activateNoWar}</Button>
            {pending.aggressor && <Button variant="outlined" onClick={() => moves.chooseMajorActivation({joinDefense: true})}>{i18n.chain.vq.activation.joinDefense}</Button>}
            {POWERS.filter((power) => power !== pending.power && ownerOf(G, power) !== playerID && ownerOf(G, power) !== undefined)
                .map((power) => <Button key={power} variant="outlined" onClick={() => moves.chooseMajorActivation({war: power})}>{i18n.chain.vq.activation.activateWar} {powerName(power, vqLocale)}</Button>)}
        </>}
    </Stack>;
};
