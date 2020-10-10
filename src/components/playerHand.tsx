import React from "react";
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import Grid from "@material-ui/core/Grid";
import {cardEffectText, getCardName} from "../game/util";
import Typography from "@material-ui/core/Typography";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Button from "@material-ui/core/Button";
import shortid from "shortid";

export const PlayerHand = ({G, ctx, moves, playerID}: { moves: Record<string, (...args: any[]) => void>, G: IG, ctx: Ctx, playerID: string }) => {

    useI18n(i18n);
    const p = G.pub[parseInt(playerID)];
    const hand = G.player[parseInt(playerID)].hand;
    const [expanded, setExpanded] = React.useState(hand.length);
    return <Grid item xs={12} sm={6}>
        <Typography>{i18n.hand.title}</Typography>
        {hand.map((c, idx) =>
            <Accordion
                expanded={true}
                key={shortid.generate()}>
                <AccordionSummary key={idx}>
                    {getCardName(c.cardId)}
                    {"  "}
                    {
                        // @ts-ignore
                        c.industry > 0 ? i18n.pub.industryMarker + c.industry.toString() : ""
                    }
                    {
                        // @ts-ignore
                        c.aesthetics > 0 ? i18n.pub.aestheticsMarker + c.aesthetics.toString() : ""
                    }
                    {
                        // @ts-ignore
                        cardEffectText(c.cardId)
                    }
                </AccordionSummary>
                <AccordionDetails key={idx}>
                    <Grid container>
                        <Grid item xs={12}>
                            <Button
                                onClick={() => moves.playCard({
                                    card: c.cardId,
                                    idx: idx,
                                    playerID: playerID,
                                    res: 0,
                                })}
                                disabled={playerID !== ctx.currentPlayer}
                            >{i18n.action.play}</Button>

                            <Button
                                onClick={() => moves.breakthrough({
                                    card: c.cardId,
                                    idx: idx,
                                    playerID: playerID,
                                    res: 2,
                                })}
                                disabled={playerID !== ctx.currentPlayer || p.action < 1 || p.resource < 2}
                            >{i18n.action.breakthrough2Res}</Button>
                            <Button
                                onClick={() => moves.breakthrough({
                                    card: c.cardId,
                                    idx: idx,
                                    playerID: playerID,
                                    res: 1,
                                })}
                                disabled={playerID !== ctx.currentPlayer || p.action < 1 || p.resource < 1 || p.deposit < 1}
                            >{i18n.action.breakthrough1Res}</Button>
                            <Button
                                onClick={() => {
                                    setExpanded(hand.length);
                                    moves.breakthrough({
                                        card: c.cardId,
                                        idx: idx,
                                        playerID: playerID,
                                        res: 0,
                                    })
                                }}
                                disabled={playerID !== ctx.currentPlayer || p.action < 1 || p.deposit < 2}
                            >{i18n.action.breakthrough0Res}</Button>
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>
        )}
    </Grid>
}
