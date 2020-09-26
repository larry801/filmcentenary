import React from "react";
import {
    Grid,
    Paper,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    createStyles, Theme
} from "@material-ui/core";
import {IBasicCard, ICard, ICardSlot, IRegionInfo, Region} from "../types/core";
import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {BuyCard, Comment} from "./buyCard";
import {canAfford, canBuyCard} from "../game/util";
import {makeStyles} from "@material-ui/core/styles";

export interface ICardSlotProp {
    slot: ICardSlot,
    G: IG,
    ctx: Ctx,
    buy: (target: ICard, resource: number, cash: number, helper: ICard[]) => void,
    canBuy: (target: ICard, resource: number, cash: number, helper: ICard[]) => boolean,
    comment: (slot: ICardSlot, card: IBasicCard | null) => void,
    playerID: PlayerID | null,
}

export const BoardCardSlot = ({playerID, slot, buy, canBuy, G, ctx, comment}: ICardSlotProp) => {

    const variant = slot.isLegend ? "elevation" : "outlined"

    return <>
        <Paper style={{display: 'inline-flex'}} variant={variant}>
            <Typography>{slot.card === null ? "" : slot.card.name} </Typography>
            <Typography>{slot.comment === null ? "" : slot.comment.name} </Typography>
            {playerID !== null && slot.card !== null && ctx.currentPlayer === playerID ?
                <><Comment slot={slot} comment={comment} G={G}/>
                    <BuyCard slot={slot}
                             card={slot.card}
                             helpers={G.player[(parseInt(playerID))].hand}
                             buy={buy}
                             canBuy={canBuy}
                             affordable={canAfford(G, ctx, slot.card, playerID)} G={G} playerID={playerID}/>
                </> : <></>}
        </Paper>
    </>
}

export interface IRegionProp {
    r: Region,
    region: IRegionInfo,
    G: IG,
    ctx: Ctx,
    playerID: PlayerID | null,
    moves: Record<string, (...args: any[]) => void>;
}

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            flexGrow: 1,
        },
        control: {
            padding: theme.spacing(2),
        },
    }),
);

export const BoardRegion = ({r, region, G, ctx, playerID, moves}: IRegionProp) => {
    useI18n(i18n);
    const {era, share, legend, normal} = region;
    const [expanded, setExpanded] = React.useState(true);
    const classes = useStyles();

    const canBuy = (target: ICard, resource: number, cash: number, helper: ICard[]) => canBuyCard(G, ctx, {
        buyer: playerID === null ? '0' : playerID,
        target: target,
        resource: resource,
        deposit: cash,
        helper: helper,
    });

    const buy = (target: ICard, resource: number, cash: number, helper: ICard[]) => {
        moves.buyCard({
            buyer: playerID === null ? '0' : playerID,
            target: target,
            resource: resource,
            cash: cash,
            helper: helper,
        })
    }

    const comment = (slot: ICardSlot, card: IBasicCard | null) => moves.comment(G, ctx, {target: slot, comment: card})

    return <Grid container>
        <Accordion expanded={expanded}
                   onChange={() => setExpanded(!expanded)}
                   key={r}>
            <AccordionSummary key={r}>
                <Grid container className={classes.root} spacing={5}>
                    <Grid item><Paper variant={"outlined"}><Typography>{i18n.region[r]} </Typography></Paper></Grid>
                    <Grid item><Paper variant={"outlined"}><Typography>{i18n.pub.era} {i18n.era[era]}</Typography></Paper></Grid>
                    <Grid item><Paper variant={"outlined"}><Typography>{i18n.pub.share} {share} </Typography></Paper></Grid>
                </Grid>
            </AccordionSummary>
            <AccordionDetails key={r}>
                <Grid item><BoardCardSlot
                    G={G} ctx={ctx} slot={legend}
                    comment={comment} canBuy={canBuy}
                    buy={buy} playerID={playerID}
                /></Grid>
                {normal.map((slot, i) =>
                    <Grid item key={i}>
                        <BoardCardSlot
                            G={G} ctx={ctx} buy={buy} slot={slot}
                            canBuy={canBuy} comment={comment} playerID={playerID}
                        />
                    </Grid>
                )}
            </AccordionDetails>
        </Accordion>
    </Grid>
}
