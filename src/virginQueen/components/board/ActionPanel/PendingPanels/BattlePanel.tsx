import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES, powerName, Power} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {battleOptions} from "../../../../combat";
import {SPACE_BY_ID} from "../../../../mapData";
import {virginQueenCombatRetrieveOptions} from "../../board";

export const PendingBattlePanel = (props: any) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const {G, moves, playerID} = props;
    const vqCombatRetrieve = virginQueenCombatRetrieveOptions(G, playerID);
    
    return (
        <Stack spacing={1}>
            <Typography>{i18n.chain.vq.battle.title}: {SPACE_BY_ID[G.pendingBattle.location]?.name ?? G.pendingBattle.location} · {i18n.chain.vq.battle.waiting} {powerName(G.pendingBattle.responding, vqLocale)} {i18n.chain.vq.battle.choose}。</Typography>
            {ownerOf(G, G.pendingBattle.responding) === playerID && battleOptions(G).map((option: any) =>
                <Button key={option.id} onClick={() => moves.chooseBattle({choice: option.id})}>{option.label}</Button>
            )}
            {vqCombatRetrieve.length > 0 && <Stack spacing={0.5}>
                <Typography variant="body2">{i18n.chain.vq.battle.retrieve}</Typography>
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
