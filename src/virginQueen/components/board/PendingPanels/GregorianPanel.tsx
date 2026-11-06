import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import i18n from "../../../../constant/i18n";
import {POWERS, powerName, Power} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {PendingPanelProps} from "./types";

export interface PendingGregorianPanelProps extends PendingPanelProps {
    target: Power;
    onTargetChange: (power: Power) => void;
}

/** Gregorian Calendar (#101) response; the responder picks the next power. */
export const PendingGregorianPanel = ({G, moves, playerID, target, onTargetChange}: PendingGregorianPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.gregorianResponse === undefined) return null;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.gregorian.title} · {powerName(G.gregorianResponse.after, vqLocale)} {i18n.chain.vq.gregorian.ended}{i18n.chain.vq.punct.comma}{i18n.chain.vq.gregorian.waiting} {powerName(G.gregorianResponse.responder, vqLocale)} {i18n.chain.vq.gregorian.decide}</Typography>
        {ownerOf(G, G.gregorianResponse.responder) === playerID && <>
            <Typography variant="body2">{i18n.chain.vq.gregorian.chooseNext}</Typography>
            <Select size="small" value={target} onChange={(event) => onTargetChange(event.target.value as Power)}>
                {POWERS.map((power) => <MenuItem key={power} value={power}>{powerName(power, vqLocale)}</MenuItem>)}
            </Select>
            <Stack direction="row" spacing={0.5}>
                <Button variant="contained" onClick={() => moves.playCard({cardId: "vq-101", asEvent: true, target})}>
                    {i18n.chain.vq.gregorian.play}
                </Button>
                <Button variant="outlined" onClick={() => moves.declineGregorianCalendar()}>{i18n.chain.vq.gregorian.decline}</Button>
            </Stack>
        </>}
    </Stack>;
};
