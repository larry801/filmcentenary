import React from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    createStyles,
    Grid,
    Paper,
    Theme,
    Typography,
} from "@material-ui/core";
import {IBasicCard, ICard, ICardSlot, IEra, IRegionInfo, Region} from "../types/core";
import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {BuyCard, Comment} from "./buyCard";
import {makeStyles} from "@material-ui/core/styles";

export interface ICardSlotProp {
    slot: ICardSlot,
    G: IG,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
    comment: (slot: ICardSlot, card: IBasicCard | null) => void,
    playerID: PlayerID | null,
}

export const BoardCardSlot = ({playerID, slot, moves, G, ctx, comment}: ICardSlotProp) => {

    const variant = slot.isLegend ? "elevation" : "outlined"

    return <>
        <Paper style={{display: 'inline-flex'}} variant={variant}>
            <Typography>{slot.card === null ? "" :
                // @ts-ignore
                i18n.card[slot.card.cardId]
            } </Typography>
            <Typography>{slot.comment === null ? "" :
                // @ts-ignore
                i18n.card[slot.card.cardId]
            } </Typography>
            {playerID !== null && slot.card !== null && ctx.currentPlayer === playerID ?
                <><Comment slot={slot} comment={comment} G={G}/>
                    <BuyCard
                         card={slot.card}
                         helpers={G.player[(parseInt(playerID))].hand}
                         ctx={ctx}
                         G={G}
                         playerID={playerID} moves={moves}/>
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

    const show = r===Region.ASIA ? era !== IEra.ONE : true;

    const comment = (slot: ICardSlot, card: IBasicCard | null) => moves.comment(G, ctx, {target: slot, comment: card})

    return show?<Grid container>
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
                    moves={moves}
                    comment={comment}
                    playerID={playerID}
                /></Grid>
                {normal.map((slot, i) =>
                    <Grid item key={i}>
                        <BoardCardSlot
                            moves={moves}
                            G={G} ctx={ctx} slot={slot}
                            comment={comment} playerID={playerID}
                        />
                    </Grid>
                )}
            </AccordionDetails>
        </Accordion>
    </Grid>:<></>
}
