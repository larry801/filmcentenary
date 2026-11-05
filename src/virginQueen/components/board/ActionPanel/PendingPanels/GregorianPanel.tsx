import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import {POWER_NAMES, powerName, Power, POWERS} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";

export const PendingGregorianPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID, gregorianTarget, setGregorianTarget} = props;
    const e = i18n.chain.vq.gregorian;
    return (
        <Stack spacing={1}>
            <Typography>{e.title} · {powerName(G.gregorianResponse.after, vqLocale)} {e.ended}，{e.waiting} {powerName(G.gregorianResponse.responder, vqLocale)} {e.decide}。</Typography>
            {ownerOf(G, G.gregorianResponse.responder) === playerID && <>
                <Typography variant="body2">{e.chooseNext}</Typography>
                <Select size="small" value={gregorianTarget} onChange={(ev) => setGregorianTarget(ev.target.value)}>
                    {POWERS.map((power) => <MenuItem key={power} value={power}>{powerName(power, vqLocale)}</MenuItem>)}
                </Select>
                <Stack direction="row" spacing={0.5}>
                    <Button variant="contained" onClick={() => moves.playCard({cardId: "vq-101", asEvent: true, target: gregorianTarget})}>
                        {e.play}
                    </Button>
                    <Button variant="outlined" onClick={() => moves.declineGregorianCalendar()}>{e.decline}</Button>
                </Stack>
            </>}
        </Stack>
    );
};
