import React from "react";
import {IG} from "../types/setup";
import {Ctx} from "boardgame.io";
import i18n from "../constant/i18n";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import AccordionSummary from "@mui/material/AccordionSummary";
import Button from "@mui/material/Button";
import {nanoid} from "nanoid";
import {CardInfo} from "./card";
import {actualStage} from "../game/util";
import {Stage} from "boardgame.io/core";
import {getCardById, Region, SimpleRuleNumPlayers} from "../types/core";
import DepositIcon from '@mui/icons-material/LocalAtm';
import ResIcon from '@mui/icons-material/MonetizationOn';
import PlayCardIcon from '@mui/icons-material/PlayCircleFilledWhiteOutlined';
import {ChampionIcon, FreeBreakthroughIcon, getColor} from "./icons";
import PrestigeIcon from "@mui/icons-material/EmojiEvents";

// import Backdrop from '@mui/material/Backdrop';
// import CircularProgress from '@mui/material/CircularProgress';
// import { makeStyles, createStyles, Theme } from '@mui/material/styles';
//
// const useStyles = makeStyles((theme: Theme) =>
//     createStyles({
//         backdrop: {
//             zIndex: theme.zIndex.drawer + 1,
//             color: '#fff',
//         },
//     }),
// );

export const PlayerHand = ({
                               G,
                               ctx,
                               moves,
                               playerID
                           }: { moves: Record<string, (...args: any[]) => void>, G: IG, ctx: Ctx, playerID: string }) => {

    i18n.use();

    // const [open, setOpen] = React.useState(false);
    const p = G.pub[parseInt(playerID)];
    const hand = G.player[parseInt(playerID)].hand;
    // const handleClose = () => {
    //     setOpen(false);
    // };
    const canPlayOrBreakthrough = ctx.currentPlayer === playerID && ctx.activePlayers === null

    return <Grid container size={12} sx={{justifyContent: 'flex-start'}}>
        {/*<Backdrop className={classes.backdrop} open={open} onClick={handleClose}>*/}
        {/*    <CircularProgress color="inherit" />*/}
        {/*</Backdrop>*/}
        {
            hand.map((c, idx) => {
                    const card = getCardById(c);
                    const era2p = card.region !== Region.NONE ? G.twoPlayer.era : null;
                    const eraNormal = card.region !== Region.NONE ? G.regions[card.region].era : null;
                    const era = ctx.numPlayers > SimpleRuleNumPlayers ? eraNormal : era2p;
                    const play = () => {
                        moves.playCard({
                            card: c,
                            idx: idx,
                            playerID: playerID,
                            res: 0,
                        });
                        // setOpen(true);
                    }
                    const archive2res = () => {
                        moves.breakthrough({
                            card: c,
                            idx: idx,
                            playerID: playerID,
                            res: 2,
                        });
                        // setOpen(true);
                    }
                    const archive1res = () => {
                        moves.breakthrough({
                            card: c,
                            idx: idx,
                            playerID: playerID,
                            res: 1,
                        });
                        // setOpen(true);
                    }
                    const archive0res = () => {
                        moves.breakthrough({
                            card: c,
                            idx: idx,
                            playerID: playerID,
                            res: 0,
                        });
                        // setOpen(true);
                    }
                    return <Accordion
                        expanded={true}
                        key={nanoid()}>
                        <AccordionSummary key={idx}>
                            <CardInfo cid={c}/>
                            {era !== null ?
                                <Typography aria-label={i18n.chain.era[era]}>
                                    <ChampionIcon champion={{region: card.region, era: era}}/>
                                </Typography> : <></>}
                            <Typography
                                style={{color: getColor(card.region)}}>
                                {card.cardId}
                            </Typography>
                            <Typography
                                style={{
                                    display:'inline-flex',
                                    verticalAlign:'middle'
                                }}>
                                <PrestigeIcon/>{card.vp}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails key={idx}>
                            <Grid container>
                                <Grid size={12}>
                                    <Button
                                        aria-label={i18n.chain.action.play}
                                        autoFocus={idx === 0 && actualStage(G, ctx) === Stage.NULL}
                                        style={{textTransform: 'none'}}
                                        disabled={!canPlayOrBreakthrough}
                                        onClick={play}
                                    >
                                        <PlayCardIcon/>
                                    </Button>

                                    <Button
                                        aria-label={i18n.chain.action.breakthrough2Res}
                                        disabled={!canPlayOrBreakthrough || p.action < 1 || p.resource < 2}
                                        onClick={archive2res}
                                        style={{textTransform: 'none'}}
                                    >
                                        <ResIcon/>X2<FreeBreakthroughIcon/>
                                    </Button>
                                    <Button
                                        aria-label={i18n.chain.action.breakthrough1Res}
                                        disabled={!canPlayOrBreakthrough || p.action < 1 || p.resource < 1 || p.deposit < 1}
                                        onClick={archive1res}
                                        style={{textTransform: 'none'}}
                                    >
                                        <ResIcon/><DepositIcon/> <FreeBreakthroughIcon/>
                                    </Button>
                                    <Button
                                        aria-label={i18n.chain.action.breakthrough0Res}
                                        disabled={!canPlayOrBreakthrough || p.action < 1 || p.deposit < 2}
                                        onClick={archive0res}
                                        style={{textTransform: 'none'}}
                                    >
                                        <DepositIcon/> X2<FreeBreakthroughIcon/>
                                    </Button>
                                </Grid>
                            </Grid>
                        </AccordionDetails>
                    </Accordion>
                }
            )}
    </Grid>
}

export default PlayerHand;
