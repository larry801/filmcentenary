import React from "react";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import i18n from "../../../../constant/i18n";
import {powerName} from "../../../constant/general";
import {ownerOf} from "../../../ownership";
import {scienceBonusName} from "../../../scenario";
import {eligibleScienceBonuses} from "../../../util";
import {vqLocaleNow} from "../helpers";
import {PendingPanelProps} from "./types";

/** Rule 11: a Science Bonus treasure immediately claims an unclaimed bonus. */
export const PendingScienceTreasurePanel = ({G, moves, playerID}: PendingPanelProps) => {
    i18n.use();
    const locale = vqLocaleNow();
    const pending = G.pendingScienceTreasure;
    if (pending === undefined) return null;
    const t = i18n.chain.vq.turn.scienceTreasure;
    const canChoose = ownerOf(G, pending.power) === playerID;
    const bonuses = eligibleScienceBonuses(G, pending.power);
    return <Stack spacing={1}>
        <Typography>{t.title} · {powerName(pending.power, locale)}</Typography>
        {canChoose ? <>
            <Typography variant="body2">{t.hint}</Typography>
            <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                {bonuses.map((bonus) => <Button key={bonus.id} variant="outlined"
                    onClick={() => moves.chooseScienceTreasureBonus({bonus: bonus.id})}>
                    {scienceBonusName(bonus, locale)}
                </Button>)}
            </Stack>
        </> : <Typography variant="body2">{t.waiting}</Typography>}
    </Stack>;
};
