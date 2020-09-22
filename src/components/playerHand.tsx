import React from "react";
import {IG} from "../types/setup";
import {Accordion, AccordionDetails, AccordionSummary, Button, Typography} from "@material-ui/core";
import {Ctx} from "boardgame.io";
import {getCardEffect} from "../constant/effects";

export const PlayerHand = ({G,ctx,  playerID}:{G:IG,ctx:Ctx,playerID:string}) => {

    const [expanded,setExpanded]=React.useState(0);

    return <div>
        <Typography>手牌</Typography>
        {playerID!==null ? G.player[parseInt(playerID)].hand.map((c,idx) =>
            <div key={idx}><Accordion expanded={expanded===idx} onChange={() =>setExpanded(idx)}
                         key={idx}>
                <AccordionSummary key={idx}>{c.name}</AccordionSummary>
                <AccordionDetails key={idx}>
                    <Button
                        disabled={!getCardEffect(c.cardId).canPlay(G,ctx)}
                    >出牌</Button>
                    <Button
                    disabled={!getCardEffect(c.cardId).canArchive(G,ctx)}
                    >突破</Button>
                </AccordionDetails>
            </Accordion>
            </div>
        ):""}
    </div>
}
