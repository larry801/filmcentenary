import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {interceptionOrderOptions} from "../../../../navalCombat";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingInterceptionOrderPanel = (props: any) => {
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>海军拦截顺序 · 等待 {POWER_NAMES[G.pendingInterceptionOrder.defender].zh} 选择先由哪支舰队拦截前往 {SPACE_BY_ID[G.pendingInterceptionOrder.to]?.name ?? G.pendingInterceptionOrder.to} 的移动。</Typography>
            {ownerOf(G, G.pendingInterceptionOrder.defender) === playerID && <>
                {interceptionOrderOptions(G).map((entry: any) =>
                    <Button key={entry.id} onClick={() => moves.chooseInterceptionOrder({from: entry.id})}>{entry.label}</Button>
                )}
                <Button variant="text" onClick={() => moves.autoInterceptionOrder({})}>按引擎顺序自动拦截</Button>
            </>}
        </Stack>
    );
};
