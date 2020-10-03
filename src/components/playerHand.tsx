import React from "react";
import {IG} from "../types/setup";
import {Accordion, AccordionDetails, AccordionSummary, Button, Typography} from "@material-ui/core";
import {Ctx} from "boardgame.io";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import Grid from "@material-ui/core/Grid";

export const PlayerHand = ({G, ctx, moves, playerID}: { moves: Record<string, (...args: any[]) => void>, G: IG, ctx: Ctx, playerID: string }) => {

    useI18n(i18n);
    const p = G.pub[parseInt(playerID)];
    const hand = G.player[parseInt(playerID)].hand;
    const [expanded, setExpanded] = React.useState(hand.length);
    return <Grid item xs={12} sm={6}>
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
                                    res: 2,
                                })
                            }}
                            disabled={playerID!==ctx.currentPlayer||p.action < 1 || p.resource < 2}
                        >{i18n.action.breakthrough2Res}</Button>
                        <Button
                            onClick={() => {
                                setExpanded(hand.length);
                                moves.breakthrough({
                                    card: c,
                                    idx: idx,
                                    playerID: playerID,
                                    res: 1,
                                })
                            }}
                            disabled={playerID!==ctx.currentPlayer||p.action < 1 || p.resource < 1 || p.deposit <1}
                        >{i18n.action.breakthrough1Res}</Button>
                        <Button
                            onClick={() => {
                                setExpanded(hand.length);
                                moves.breakthrough({
                                    card: c,
                                    idx: idx,
                                    playerID: playerID,
                                    res: 0,
                                })
                            }}
                            disabled={playerID!==ctx.currentPlayer||p.action < 1 || p.deposit < 2}
                        >{i18n.action.breakthrough0Res}</Button>
                    </AccordionDetails>
                </Accordion>
        ) }
    </Grid>
}
