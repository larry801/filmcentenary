import React from "react";

import {IBasicCard, ICardSlot, IRegionInfo, Region, validRegion} from "../types/core";
import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {BuyCard, Comment} from "./buyCard";
import makeStyles from '@material-ui/core/styles/makeStyles';
import createStyles from '@material-ui/core/styles/createStyles'
import {activePlayer, actualStage, getCardName} from "../game/util";
import Button from "@material-ui/core/Button";
import {blue, purple, red, yellow} from "@material-ui/core/colors";
import Icon from "@material-ui/core/Icon";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import {Theme}  from "@material-ui/core/styles/createMuiTheme";
import Grid from "@material-ui/core/Grid";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import AccordionDetails from "@material-ui/core/AccordionDetails";
export interface ICardSlotProp {
    slot: ICardSlot,
    G: IG,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
    comment: (slot: ICardSlot, card: IBasicCard | null) => void,
    playerID: PlayerID | null,
}
export interface IShareIconProps {
    r:validRegion
}
const getColor = (r:validRegion):string =>{
    switch (r){
        case Region.WE:
            return purple[500]
        case Region.NA:
            return blue[800]
        case Region.EE:
            return red[500]
        case Region.ASIA:
            return yellow[700]
    }
}
export const ShareIcon = ({r}:IShareIconProps) => <Icon style={{ color: getColor(r) }}>label</Icon>


export const BoardCardSlot = ({playerID, slot, moves, G, ctx, comment}: ICardSlotProp) => {

    const variant = slot.isLegend ? "elevation" : "outlined"

    return <>
        <Paper style={{display: 'inline-flex'}} variant={variant}>
            <Typography>{slot.card === null ? "" : getCardName(slot.card.cardId)} </Typography>
            <Typography>{slot.comment === null ? "" : getCardName(slot.comment.cardId)} </Typography>
            {playerID !== null && slot.card !== null?
                  <BuyCard
                        card={slot.card}
                        helpers={G.player[(parseInt(playerID))].hand.map(c=>c.cardId)}
                        ctx={ctx}
                        G={G}
                        playerID={playerID} moves={moves}/> : <></>}
            {activePlayer(ctx) === playerID &&
            actualStage(G,ctx) === "updateSlot"? <Button onClick={()=>{moves.updateSlot(slot)}}
                >{i18n.action.updateSlot}</Button>:<></>}

            {activePlayer(ctx) === playerID && actualStage(G,ctx) === "comment"?
                <Comment slot={slot} comment={comment} G={G}/>:<></>}
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
            border: '5px solid rgba(0, 0, 0, .125)',
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

    // eslint-disable-next-line
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

    const playerName = (p: string): string => {
        if (p === "") {
            return i18n.pub.emptyBuildingSlot
        } else {
            return getPlayerName(p);
        }
    }

    const content = (isCinema: boolean): string => {
        if (isCinema) {
            return i18n.pub.cinema;
        } else {
            return i18n.pub.studio;
        }
    }

    const buildingSlots = region.buildings.map((slot, idx) => {
        if(slot.activated) {
            return (<Grid item xs={2} sm={1} key={`building-slot-${idx}`}>
                <Paper>
                    <Typography> {slot.owner !== "" ? content(slot.isCinema) :""}</Typography>
                    <Typography>{playerName(slot.owner)}</Typography>
                </Paper>
            </Grid>)
        }else {
            return <div key={`building-slot-${idx}`}/>
        }
    })

    return <Grid item xs={12} sm={6}>
        <Accordion
            className={classes.root}
            expanded={expanded}
                   onChange={() => setExpanded(!expanded)}
                   key={r}>
            <AccordionSummary key={r}>
                <Grid container
                      justify="space-evenly"
                      alignItems="baseline"
                      className={classes.root} >
                    <Grid item xs={2} sm={1} ><Paper variant={"outlined"}><Typography>{i18n.region[r]} </Typography></Paper></Grid>
                    <Grid item xs={2} sm={1}><Paper
                        variant={"outlined"}><Typography>
                        {i18n.era[era]}
                        /{G.secretInfo.regions[r].legendDeck.length}
                        /{G.secretInfo.regions[r].normalDeck.length}
                        </Typography></Paper></Grid>
                    <Grid item container xs={2} sm={1}

                    ><Paper
                        variant={"outlined"}>
                        {Array(share).fill(1).map((i,idx)=><Grid item xs={6} key={idx}>
                            <ShareIcon r={r} />
                        </Grid>)} </Paper></Grid>
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
