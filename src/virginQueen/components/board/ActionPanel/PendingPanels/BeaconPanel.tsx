import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingBeaconPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.beacon.title} · {powerName(G.pendingBeacon.defender, vqLocale)} {i18n.chain.vq.beacon.intercepting} {SPACE_BY_ID[G.pendingBeacon.from]?.name ?? G.pendingBeacon.from}，{i18n.chain.vq.beacon.canPlay}</Typography>
            {ownerOf(G, G.pendingBeacon.defender) === playerID && <>
                <Typography variant="body2">{i18n.chain.vq.beacon.autoSuccess}</Typography>
                <Stack direction="row" spacing={0.5}>
                    <Button variant="contained" disabled={!G.powers[G.pendingBeacon.defender].cards.includes("vq-014")}
                        onClick={() => moves.respondBeaconFires({choice: "play"})}>{i18n.chain.vq.beacon.play}</Button>
                    <Button variant="outlined" onClick={() => moves.respondBeaconFires({choice: "decline"})}>{i18n.chain.vq.beacon.decline}</Button>
                </Stack>
            </>}
        </Stack>
    );
};
