import React from "react";
import i18n from "../../../../constant/i18n";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import {POWER_NAMES} from "../../../../constant/general";
import {ownerOf} from "../../../../ownership";
import {cardById} from "../../../../constant/cards";
import {cardEventOptions} from "../../../../cardEvents";

export const PendingCardEventPanel = (props: any) => {
    i18n.use();
    const e = i18n.chain.vq.board;
    const {G, moves, playerID, ctx} = props;
    return (
        <Stack spacing={1}>
            <Typography>{G.pendingCardEvent.kind === "cancelEvent" ? e.response : e.vizier} · {e.waitingOttoman}.</Typography>
            {G.pendingCardEvent.kind === "cancelEvent" ? 
                <Typography variant="body2">
                    {cardById(G.pendingCardEvent.cardId).name} {e.notResolved}
                </Typography> : 
                G.pendingCardEvent.step === "recruit" ? 
                <Typography variant="body2">
                    {e.canAdd} {G.pendingCardEvent.remaining} {e.units}. {e.regularsHome}
                </Typography> : 
                <Typography variant="body2">
                    {e.chooseRecruit}
                </Typography>
            }
            {G.pendingCardEvent.kind === "grandVizier" && G.pendingCardEvent.step === "effect" && ctx.numPlayers >= 5 &&
                !G.suezDone && 
                <Typography variant="body2">
                    {e.canalRoll}: {G.suezAttempts} {G.powers.ottoman.scienceBonuses.includes("excavation") ? e.excavation : ""}{e.canalSuccess}
                </Typography>
            }
            {ownerOf(G, G.pendingCardEvent.responding) === playerID && cardEventOptions(G, ctx.numPlayers).map((entry: any) =>
                <Button key={entry.id} onClick={() => moves.chooseCardEvent({choice: entry.id})}>{entry.label}</Button>
            )}
        </Stack>
    );
};
