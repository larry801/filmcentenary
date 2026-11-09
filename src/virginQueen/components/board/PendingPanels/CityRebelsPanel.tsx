import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {isPower, powerName} from "../../../constant/general";
import {spaceName} from "../../../mapData";
import {ownerOf} from "../../../ownership";
import {cityRebelsLossOptions} from "../../../moves";
import {PendingPanelProps} from "./types";

/** City rebels (#18) loss allocation. */
export const PendingCityRebelsPanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingCityRebels === undefined) return null;
    const pending = G.pendingCityRebels;
    const canChoose = isPower(pending.controller) && ownerOf(G, pending.controller) === playerID;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.cityRebels.title} · {i18n.chain.vq.cityRebels.waiting} {isPower(pending.controller) ? powerName(pending.controller, vqLocale) : pending.controller} {i18n.chain.vq.cityRebels.allocate}{i18n.chain.vq.punct.period}</Typography>
        {canChoose && <>
            <Typography variant="body2">
                {spaceName(pending.space, vqLocale)}{i18n.chain.vq.punct.colon}{i18n.chain.vq.cityRebels.remaining} {pending.remaining} {i18n.chain.vq.cityRebels.units}{i18n.chain.vq.punct.period}
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {cityRebelsLossOptions(G).map((entry) => <Button key={entry.kind} size="small" variant="outlined"
                    onClick={() => moves.chooseCityRebelsLoss({kind: entry.kind})}>
                    {entry.label}
                </Button>)}
                <Button size="small" variant="text" onClick={() => moves.chooseCityRebelsLoss({kind: "auto"})}>
                    {i18n.chain.vq.cityRebels.auto}
                </Button>
            </Stack>
        </>}
    </Stack>;
};
