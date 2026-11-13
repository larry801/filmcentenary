import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {mapName} from "../../../mapData";
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
    const battle = G.pendingBattle;
    const text = i18n.chain.vq.battle;
    return <Stack spacing={1}>
        <Typography>{text.title}{i18n.chain.vq.punct.colon}{mapName(battle.location, vqLocale)} · {text.waiting} {powerName(battle.responding, vqLocale)} {text.choose}{i18n.chain.vq.punct.period}</Typography>
        <Typography variant="subtitle2">{text.steps[battle.step]}</Typography>
        {battle.rolls && <Stack spacing={0.5} className="vq-battle-results">
            {(["attacker", "defender"] as const).map((side) => <Typography key={side} variant="body2">
                {text[side]} · {powerName(battle[side], vqLocale)}: [{battle.rolls![side].join(", ")}] · {battle.hitCounts?.[side] ?? 0} {text.hits}
                {battle.losses && ` · ${text.losses}: ${battle.losses[side]}`}
            </Typography>)}
        </Stack>}
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
