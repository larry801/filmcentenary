import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {cardById} from "../../../../constant/cards";
import {tutorialEventOptions} from "../../../../tutorialEvents";
import {SPACE_BY_ID} from "../../../../mapData";

export const PendingTutorialEventPanel = (props: any) => {
    const {G, moves, playerID} = props;
    return (
        <Stack spacing={1}>
            <Typography>{cardById(G.pendingTutorialEvent.cardId).name} · 等待 {POWER_NAMES[G.pendingTutorialEvent.responding].zh} 选择。</Typography>
            {G.pendingTutorialEvent.step === "roadFormation" && 
                <Typography variant="body2">
                    先选择米兰的部队与随军将领，再选择部署目的地；最多跨越一个山口，不能渡海。也可不部署。
                </Typography>
            }
            {G.pendingTutorialEvent.step === "rebelLosses" && 
                <Typography variant="body2">
                    {SPACE_BY_ID[G.pendingTutorialEvent.space!]?.name}：还需分配 {G.pendingTutorialEvent.remaining} 次损失，可选择陆军或舰队。
                </Typography>
            }
            {ownerOf(G, G.pendingTutorialEvent.responding) === playerID && tutorialEventOptions(G).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.chooseTutorialEvent({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
