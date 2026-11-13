import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {spaceName} from "../../../mapData";
import {ownerOf} from "../../../ownership";
import {mutinyDiscardOptions} from "../../../moves";
import {PendingPanelProps} from "./types";

/** Army Mutiny (#17): the struck power discards a card to keep some regulars. */
export const PendingMutinyPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingMutiny === undefined) return null;
    const pending = G.pendingMutiny;
    const t = i18n.chain.vq.mutiny;
    const canChoose = ownerOf(G, pending.owner) === playerID;
    return <Stack spacing={1}>
        <Typography>{t.title} · {t.waiting} {powerName(pending.owner, vqLocale)}</Typography>
        <Typography variant="body2">{spaceName(pending.space, vqLocale)}</Typography>
        {canChoose && <>
            <Typography variant="caption" color="text.secondary">{t.choose}</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {mutinyDiscardOptions(G).map((option) => <Button key={option.card} variant="outlined"
                    onClick={() => moves.chooseMutinyDiscard({card: option.card})}>{option.label}</Button>)}
            </Stack>
        </>}
    </Stack>;
};
