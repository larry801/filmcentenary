import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {tributeOptions} from "../../../moves";
import {PendingPanelProps} from "./types";

/** Ottoman Tribute (#2) response window: the target pays or refuses. */
export const PendingTributePanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingTribute === undefined) return null;
    const pending = G.pendingTribute;
    const t = i18n.chain.vq.tribute;
    const canChoose = ownerOf(G, pending.target) === playerID;
    return <Stack spacing={1}>
        <Typography>{t.title} · {t.waiting} {powerName(pending.target, vqLocale)}</Typography>
        {canChoose && <>
            <Typography variant="body2">{t.choose}</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {tributeOptions(G).map((option) => <Button key={option.id} variant="outlined"
                    onClick={() => moves.chooseTribute({choice: option.id})}>{option.label}</Button>)}
            </Stack>
        </>}
    </Stack>;
};
