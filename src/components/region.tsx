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
import {IBasicCard, IBuildingSlot, ICardSlot, IEra, IRegionInfo, Region, validRegion} from "../types/core";
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
    r: validRegion,
    region: IRegionInfo,
    G: IG,
    ctx: Ctx,
    getPlayerName: (pid: string) => string,
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


export const BoardRegion = ({getPlayerName, r, region, G, ctx, playerID, moves}: IRegionProp) => {
    useI18n(i18n);
    const {era, share, legend, normal} = region;
    const [expanded, setExpanded] = React.useState(true);
    const classes = useStyles();

    const comment = (slot: ICardSlot, card: IBasicCard | null) => moves.comment(G, ctx, {target: slot, comment: card})

    const buildingSlotName = (r: validRegion, idx: number): string => {
        switch (r) {
            case Region.ASIA:
                if (idx === 0) {
                    return i18n.pub.cinemaORStudio + i18n.pub.twoToFourPlayer;
                } else {
                    return i18n.pub.bollywood;
                }
            case Region.EE:
                if (idx === 0) {
                    return i18n.pub.cinemaORStudio + i18n.pub.twoToFourPlayer;
                } else {
                    return i18n.pub.cinemaORStudio + i18n.pub.fourPlayerOnly;
                }
            case Region.NA:
                if (idx === 0) {
                    return i18n.pub.cinemaORStudio + i18n.pub.twoToFourPlayer;
                } else {
                    if (idx === 1) {
                        return i18n.pub.cinemaORStudio + i18n.pub.threeToFourPlayer;
                    } else {
                        return i18n.pub.hollywood;
                    }
                }
            case Region.WE:
                if (idx === 0) {
                    return i18n.pub.cinemaORStudio + i18n.pub.twoToFourPlayer;
                } else {
                    return i18n.pub.cinemaORStudio + i18n.pub.threeToFourPlayer;
                }
        }
    }

    const playerName = (p:string):string=>{
        if (p===""){
            return i18n.pub.emptyBuildingSlot
        }else {
            return getPlayerName(p);
        }
    }

    const buildingSlots = region.buildings.map((slot,idx)=><Grid item>
        <Typography>{buildingSlotName(r,idx)}</Typography>
        <Typography>{playerName(slot.owner)}</Typography>
        {slot.activated?<Typography>{slot.isCinema?i18n.pub.cinema:i18n.pub.studio}</Typography>:<></>}
    </Grid>)

    return <Grid item xs={12} sm={6}>
        <Accordion expanded={expanded}
                   onChange={() => setExpanded(!expanded)}
                   key={r}>
            <AccordionSummary key={r}>
                <Grid container className={classes.root} spacing={4}>
                    <Grid item><Paper variant={"outlined"}><Typography>{i18n.region[r]} </Typography></Paper></Grid>
                    <Grid item><Paper
                        variant={"outlined"}><Typography>{i18n.pub.era} {i18n.era[era]}</Typography></Paper></Grid>
                    <Grid item><Paper
                        variant={"outlined"}><Typography>{i18n.pub.share} {share} </Typography></Paper></Grid>
                    {buildingSlots}
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
    </Grid>
}
