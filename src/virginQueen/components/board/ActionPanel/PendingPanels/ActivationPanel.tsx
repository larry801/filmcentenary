import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, POWERS} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";

export const PendingActivationPanel = (props: any) => {
    const {G, moves, playerID} = props;
    const pending = G.pendingActivation;
    const canRespond = ownerOf(G, pending.ally) === playerID;
    
    return (
        <Stack spacing={1}>
            <Typography>等待 {POWER_NAMES[pending.ally].zh} 激活 {POWER_NAMES[pending.power].zh}。</Typography>
            {canRespond && <>
                <Button onClick={() => moves.chooseMajorActivation({})}>激活，不追加宣战</Button>
                {pending.aggressor && <Button onClick={() => moves.chooseMajorActivation({joinDefense: true})}>协同参战并激活</Button>}
                {POWERS.filter((power: string) => power !== pending.power && ownerOf(G, power) !== playerID && ownerOf(G, power) !== undefined)
                    .map((power: string) => 
                        <Button key={power} onClick={() => moves.chooseMajorActivation({war: power})}>激活并向{POWER_NAMES[power as keyof typeof POWER_NAMES].zh}宣战</Button>
                    )}
            </>}
        </Stack>
    );
};
