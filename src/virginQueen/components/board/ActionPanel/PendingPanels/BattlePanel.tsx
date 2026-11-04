import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {battleOptions} from "../../../../combat";
import {SPACE_BY_ID} from "../../../../mapData";
import {virginQueenCombatRetrieveOptions} from "../../board";

export const PendingBattlePanel = (props: any) => {
    const {G, moves, playerID} = props;
    const vqCombatRetrieve = virginQueenCombatRetrieveOptions(G, playerID);
    
    return (
        <Stack spacing={1}>
            <Typography>战斗：{SPACE_BY_ID[G.pendingBattle.location]?.name ?? G.pendingBattle.location} · 等待 {POWER_NAMES[G.pendingBattle.responding].zh} 选择。</Typography>
            {ownerOf(G, G.pendingBattle.responding) === playerID && battleOptions(G).map((option: any) =>
                <Button key={option.id} onClick={() => moves.chooseBattle({choice: option.id})}>{option.label}</Button>
            )}
            {vqCombatRetrieve.length > 0 && <Stack spacing={0.5}>
                <Typography variant="body2">童贞女王（#36）：取回弃牌堆中的战斗牌并立即打出</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {vqCombatRetrieve.map((option: any) =>
                        <Button key={option.cardId} size="small" variant="outlined"
                                onClick={() => moves.playVirginQueenCombat({target: option.target})}>{option.label}</Button>
                    )}
                </Stack>
            </Stack>}
        </Stack>
    );
};
