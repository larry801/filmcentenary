import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName, VQGame} from "../../../constant/general";
import {SPACE_BY_ID} from "../../../mapData";
import {ownerOf} from "../../../ownership";

export interface PendingPanelProps {
    G: VQGame;
    moves: any;
    playerID: string | null;
}

/** Beacon Fires (#14) response window. */
export const PendingBeaconPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingBeacon === undefined) return null;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.beacon.title} · {powerName(G.pendingBeacon.defender, vqLocale)} {i18n.chain.vq.beacon.intercepting} {SPACE_BY_ID[G.pendingBeacon.from]?.name ?? G.pendingBeacon.from}{i18n.chain.vq.punct.comma}{i18n.chain.vq.beacon.canPlay}</Typography>
        {ownerOf(G, G.pendingBeacon.defender) === playerID && <>
            <Typography variant="body2">{i18n.chain.vq.beacon.autoSuccess}</Typography>
            <Stack direction="row" spacing={0.5}>
                <Button variant="contained" disabled={!G.powers[G.pendingBeacon.defender].cards.includes("vq-014")}
                    onClick={() => moves.respondBeaconFires({choice: "play"})}>{i18n.chain.vq.beacon.play}</Button>
                <Button variant="outlined" onClick={() => moves.respondBeaconFires({choice: "decline"})}>{i18n.chain.vq.beacon.decline}</Button>
            </Stack>
        </>}
    </Stack>;
};
