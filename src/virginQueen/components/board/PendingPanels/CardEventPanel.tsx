import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {cardName} from "../../../constant/cards";
import {ownerOf} from "../../../ownership";
import {cardEventOptions} from "../../../cardEvents";
import {PendingPanelProps} from "./types";

export interface PendingCardEventPanelProps extends PendingPanelProps {
    numPlayers: number;
}

/** Grand Vizier / cancel-event response window. */
export const PendingCardEventPanel = ({G, moves, playerID, numPlayers}: PendingCardEventPanelProps) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    if (G.pendingCardEvent === undefined) return null;
    const pending = G.pendingCardEvent;
    return <Stack spacing={1}>
        <Typography>{pending.kind === "cancelEvent" ? i18n.chain.vq.board.response : i18n.chain.vq.board.vizier} · {i18n.chain.vq.board.waitingOttoman}</Typography>
        {pending.kind === "cancelEvent" ? <Typography variant="body2">
            {cardName(pending.cardId, vqLocale)} {i18n.chain.vq.board.notResolved}
        </Typography> : pending.step === "recruit" ? <Typography variant="body2">
            {i18n.chain.vq.board.canAdd} {pending.remaining} {i18n.chain.vq.board.units}. {i18n.chain.vq.board.regularsHome}
        </Typography> : <Typography variant="body2">
            {i18n.chain.vq.board.chooseRecruit}
        </Typography>}
        {pending.kind === "grandVizier" && pending.step === "effect" && numPlayers >= 5 &&
            !G.suezDone && <Typography variant="body2">
                {i18n.chain.vq.board.canalRoll}: {G.suezAttempts}{G.powers.ottoman.scienceBonuses.includes("excavation") ? i18n.chain.vq.board.excavation : ""}{i18n.chain.vq.board.canalSuccess}
            </Typography>}
        {ownerOf(G, pending.responding) === playerID && cardEventOptions(G, numPlayers).map((entry) =>
            <Button key={entry.id} variant="outlined" onClick={() => moves.chooseCardEvent({choice: entry.id})}>{entry.label}</Button>)}
    </Stack>;
};
