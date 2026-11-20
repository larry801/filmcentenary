import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {vqLocaleNow} from "../helpers";
import {PendingPanelProps} from "./types";

/**
 * Rule 18.5 step 4: after the conversion dice are rolled the power may cancel
 * one Unrest marker by reducing a "6" to a "5".  The downgrade is chosen here
 * because it turns that die into a minor conversion.
 */
export const PendingConversionPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const locale = vqLocaleNow();
    const pending = G.pendingConversion;
    if (pending === undefined) return null;
    const t = i18n.chain.vq.turn.conversion;
    const canChoose = ownerOf(G, pending.power) === playerID;
    const sixes = pending.dice.map((die, index) => ({die, index})).filter((entry) => entry.die === 6);
    return <Stack spacing={1}>
        <Typography>{t.title} · {powerName(pending.power, locale)}</Typography>
        <Typography variant="body2">{t.rolls}: [{pending.dice.join(", ")}]</Typography>
        {canChoose ? <>
            <Typography variant="body2">{t.hint}</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                <Button variant="outlined" onClick={() => moves.chooseConversionNullify({downgrade: "none"})}>
                    {t.keep}
                </Button>
                {sixes.map((entry) => <Button key={entry.index} variant="contained"
                    onClick={() => moves.chooseConversionNullify({downgrade: entry.index})}>
                    {t.downgrade} #{entry.index + 1}
                </Button>)}
            </Stack>
        </> : <Typography variant="body2">{t.waiting}</Typography>}
    </Stack>;
};
