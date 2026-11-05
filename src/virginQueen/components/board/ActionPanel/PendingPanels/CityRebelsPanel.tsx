import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power, isPower} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {cityRebelsLossOptions} from "../../../../moves";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingCityRebelsPanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    const pending = G.pendingCityRebels;
    const canChoose = isPower(pending.controller) && ownerOf(G, pending.controller) === playerID;
    
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.cityRebels.title} · {i18n.chain.vq.cityRebels.waiting} {isPower(pending.controller) ? powerName(pending.controller as Power, vqLocale) : pending.controller} {i18n.chain.vq.cityRebels.allocate}。</Typography>
            {canChoose && <>
                <Typography variant="body2">
                    {SPACE_BY_ID[pending.space]?.name ?? pending.space}：{i18n.chain.vq.cityRebels.remaining} {pending.remaining} {i18n.chain.vq.cityRebels.units}。
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {cityRebelsLossOptions(G).map((entry: any) => 
                        <Button key={entry.kind} size="small" variant="outlined"
                            onClick={() => moves.chooseCityRebelsLoss({kind: entry.kind})}>
                            {entry.label}
                        </Button>
                    )}
                    <Button size="small" variant="text" onClick={() => moves.chooseCityRebelsLoss({kind: "auto"})}>
                        {i18n.chain.vq.cityRebels.auto}
                    </Button>
                </Stack>
            </>}
        </Stack>
    );
};
