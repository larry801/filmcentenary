import React from "react";
import {IG} from "../types/setup";
import {Accordion, AccordionDetails, AccordionSummary, Button, Typography} from "@material-ui/core";
import {Ctx} from "boardgame.io";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";

export const PlayerHand = ({G, ctx, moves, playerID}: { moves: Record<string, (...args: any[]) => void>, G: IG, ctx: Ctx, playerID: string }) => {

    useI18n(i18n);
    const p = G.pub[parseInt(playerID)];
    const hand = G.player[parseInt(playerID)].hand;
    const [expanded, setExpanded] = React.useState(hand.length);
    const res = p.resource >= 2 ? 2 : p.resource;
    const deposit = 2 - res;
    return <div>
        <Typography>{i18n.hand.title}</Typography>
        {hand.map((c, idx) =>
                <Accordion
                    expanded={expanded === idx}
                    onChange={() => setExpanded(idx)}
                    key={idx}>
                    <AccordionSummary key={idx}>{
                        // @ts-ignore
                        i18n.card[c.cardId]
                    }</AccordionSummary>
                    <AccordionDetails key={idx}>
                        <Button
                            onClick={() => {
                                setExpanded(hand.length);
                                moves.playCard({
                                card: c,
                                idx: idx,
                                playerID: playerID,
                                res: 0,
                            })}}
                            disabled={playerID!==ctx.currentPlayer}
                        >{i18n.action.play}</Button>
                        <Button
                            onClick={() => {
                                setExpanded(hand.length);
                                moves.breakthrough({
                                    card: c,
                                    idx: idx,
                                    playerID: playerID,
                                    res: res,
                                })
                            }}
                            disabled={playerID!==ctx.currentPlayer||p.action < 1 || p.deposit < deposit}
                        >{i18n.action.breakthrough}</Button>
                    </AccordionDetails>
                </Accordion>
        ) }
    </div>
}
