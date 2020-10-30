import React from "react";
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import Accordion from "@material-ui/core/Accordion";
import AccordionDetails from "@material-ui/core/AccordionDetails";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import Button from "@material-ui/core/Button";
import shortid from "shortid";
import {CardInfo} from "./card";
import {actualStage} from "../game/util";
import {Stage} from "boardgame.io/core";
import {getCardById, Region, SimpleRuleNumPlayers} from "../types/core";
import {getColor} from "./region";

export const PlayerHand = ({G, ctx, moves, playerID}: { moves: Record<string, (...args: any[]) => void>, G: IG, ctx: Ctx, playerID: string }) => {

    useI18n(i18n);
    const p = G.pub[parseInt(playerID)];
    const hand = G.player[parseInt(playerID)].hand;

    const canPlayOrBreakthrough = ctx.currentPlayer === playerID && ctx.activePlayers === null

    return <Grid item container xs={12}>
        <Typography variant="h5">{i18n.hand.title}</Typography>
        {hand.map((c, idx) => {
                const card = getCardById(c);
                const era2p = card.region !== Region.NONE ? G.twoPlayer.era : null;
                const eraNormal = card.region !== Region.NONE ? G.regions[card.region].era : null;
                const era = ctx.numPlayers > SimpleRuleNumPlayers ? eraNormal : era2p;

                const play = () => moves.playCard({
                    card: c,
                    idx: idx,
                    playerID: playerID,
                    res: 0,
                })
                const archive2res = () => moves.breakthrough({
                    card: c,
                    idx: idx,
                    playerID: playerID,
                    res: 2,
                });
                const archive1res = () => moves.breakthrough({
                    card: c,
                    idx: idx,
                    playerID: playerID,
                    res: 1,
                });
                const archive0res = () => moves.breakthrough({
                    card: c,
                    idx: idx,
                    playerID: playerID,
                    res: 0,
                });
                return <Accordion
                    expanded={true}
                    key={shortid.generate()}>
                    <AccordionSummary key={idx}>
                        <CardInfo cid={c}/>
                        <Typography style={{color: getColor(card.region)}}>{era !== null ? i18n.era[era] : ""}</Typography>
                        <Typography style={{color: getColor(card.region)}}>{`${card.cardId}/${card.vp}`}</Typography>
                    </AccordionSummary>
                    <AccordionDetails key={idx}>
                        <Grid container>
                            <Grid item xs={12}>
                                <Button
                                    autoFocus={idx === 0 && actualStage(G, ctx) === Stage.NULL}
                                    style={{textTransform: 'none'}}
                                    disabled={!canPlayOrBreakthrough}
                                    onClick={play}
                                >{i18n.action.play}</Button>
                                <Button
                                    style={{textTransform: 'none'}}
                                    disabled={!canPlayOrBreakthrough || p.action < 1 || p.resource < 2}
                                    onClick={archive2res}
                                >{i18n.action.breakthrough2Res}</Button>
                                <Button
                                    style={{textTransform: 'none'}}
                                    onClick={archive1res}
                                    disabled={!canPlayOrBreakthrough || p.action < 1 || p.resource < 1 || p.deposit < 1}
                                >{i18n.action.breakthrough1Res}</Button>
                                <Button
                                    style={{textTransform: 'none'}}
                                    onClick={archive0res}
                                    disabled={!canPlayOrBreakthrough || p.action < 1 || p.deposit < 2}
                                >{i18n.action.breakthrough0Res}</Button>
                            </Grid>
                        </Grid>
                    </AccordionDetails>
                </Accordion>
            }
        )}
    </Grid>
}

export default PlayerHand;
