import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {spaceName} from "../../../mapData";
import {ownerOf} from "../../../ownership";
import {battleOptions} from "../../../combat";
import {PendingPanelProps} from "./types";

export interface PendingBattlePanelProps extends PendingPanelProps {
    /** Virgin Queen combat-card retrieval options for this player. */
    retrieve: {cardId: string; target?: unknown; label: string}[];
}

/** Battle choice window (field or naval). */
export const PendingBattlePanel = ({G, moves, playerID, retrieve}: PendingBattlePanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingBattle === undefined) return null;
    return <Stack spacing={1}>
        <Typography>{i18n.chain.vq.battle.title}{i18n.chain.vq.punct.colon}{spaceName(G.pendingBattle.location, vqLocale)} · {i18n.chain.vq.battle.waiting} {powerName(G.pendingBattle.responding, vqLocale)} {i18n.chain.vq.battle.choose}{i18n.chain.vq.punct.period}</Typography>
        {ownerOf(G, G.pendingBattle.responding) === playerID && battleOptions(G).map((option) =>
            <Button key={option.id} variant="outlined" onClick={() => moves.chooseBattle({choice: option.id})}>{option.label}</Button>)}
        {retrieve.length > 0 && <Stack spacing={0.5}>
            <Typography variant="body2">{i18n.chain.vq.battle.retrieve}</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {retrieve.map((option) =>
                    <Button key={option.cardId} size="small" variant="outlined"
                            onClick={() => moves.playVirginQueenCombat({target: option.target})}>{option.label}</Button>)}
            </Stack>
        </Stack>}
    </Stack>;
};
