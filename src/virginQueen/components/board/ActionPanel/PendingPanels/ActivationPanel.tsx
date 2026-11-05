import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power, POWERS} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";

export const PendingActivationPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    const pending = G.pendingActivation;
    const canRespond = ownerOf(G, pending.ally) === playerID;
    
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.activation.waiting} {powerName(pending.ally, vqLocale)} {i18n.chain.vq.activation.activate} {powerName(pending.power, vqLocale)}。</Typography>
            {canRespond && <>
                <Button onClick={() => moves.chooseMajorActivation({})}>{i18n.chain.vq.activation.activateNoWar}</Button>
                {pending.aggressor && <Button onClick={() => moves.chooseMajorActivation({joinDefense: true})}>{i18n.chain.vq.activation.joinDefense}</Button>}
                {POWERS.filter((power: string) => power !== pending.power && ownerOf(G, power) !== playerID && ownerOf(G, power) !== undefined)
                    .map((power: string) => 
                        <Button key={power} onClick={() => moves.chooseMajorActivation({war: power})}>{i18n.chain.vq.activation.activateWar} {powerName(power as Power, vqLocale)}</Button>
                    )}
            </>}
        </Stack>
    );
};
