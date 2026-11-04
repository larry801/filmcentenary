import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, isPower} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {cityRebelsLossOptions} from "../../../../moves";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingCityRebelsPanel = (props: any) => {
    const {G, moves, playerID} = props;
    const pending = G.pendingCityRebels;
    const canChoose = isPower(pending.controller) && ownerOf(G, pending.controller) === playerID;
    
    return (
        <Stack spacing={1}>
            <Typography>城邦起义（#18） · 等待 {isPower(pending.controller) ? POWER_NAMES[pending.controller].zh : pending.controller} 分配损失。</Typography>
            {canChoose && <>
                <Typography variant="body2">
                    {SPACE_BY_ID[pending.space]?.name ?? pending.space}：还需选择 {pending.remaining} 个损失单位，每次一个陆军或海军单位。
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {cityRebelsLossOptions(G).map((entry: any) => 
                        <Button key={entry.kind} size="small" variant="outlined"
                            onClick={() => moves.chooseCityRebelsLoss({kind: entry.kind})}>
                            {entry.label}
                        </Button>
                    )}
                    <Button size="small" variant="text" onClick={() => moves.chooseCityRebelsLoss({kind: "auto"})}>
                        自动分配剩余
                    </Button>
                </Stack>
            </>}
        </Stack>
    );
};
