import React from "react";
import {
    BasicCardID,
    BuildingType,
    getCardById,
    ICardSlot,
    IRegionInfo,
    Region,
    SimpleRuleNumPlayers,
    ValidRegion
} from "../types/core";
import {Ctx, PlayerID} from "boardgame.io";
import {IG} from "../types/setup";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import BuyCard, {Comment} from "./buy-card";
import makeStyles from '@material-ui/core/styles/makeStyles';
import createStyles from '@material-ui/core/styles/createStyles'
import UpdateSlotIcon from '@material-ui/icons/Loop';
import NormalCardIcon from '@material-ui/icons/RadioButtonUnchecked';
import LegendCardIcon from '@material-ui/icons/StarBorder';
import {activePlayer, actualStage} from "../game/util";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import {Theme} from '@material-ui/core/styles'
import Grid from "@material-ui/core/Grid";
import Accordion from "@material-ui/core/Accordion";
import AccordionSummary from "@material-ui/core/AccordionSummary";
import StudioIcon from '@material-ui/icons/Business';
import TheatersIcon from '@material-ui/icons/Theaters';
import AccordionDetails from "@material-ui/core/AccordionDetails";
import DeckIcon from '@material-ui/icons/Layers';
import CardInfo, {getCardName} from "./card";
import {ChampionIcon, DrawnShareIcon, getColor} from "./icons";
import {nanoid} from "nanoid";
import PrestigeIcon from "@material-ui/icons/EmojiEvents";
import ResourceIcon from "@material-ui/icons/MonetizationOn";
import AestheticsIcon from "@material-ui/icons/ImportContacts";
import IndustryIcon from "@material-ui/icons/Settings";
import {getValidHelper} from "../game/board-util";

export interface ICardSlotProp {
    slot: ICardSlot,
    G: IG,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
    comment: (slot: ICardSlot, card: BasicCardID | null) => void,
    playerID: PlayerID | null,
}

export const BoardCardSlot = ({playerID, slot, moves, G, ctx, comment}: ICardSlotProp) => {

    const variant = !slot.isLegend ? "elevation" : "outlined"

    const updateSlot = () => {
        moves.updateSlot({
            slot: slot,
            p: playerID,
            cardId: slot.card,
            updateHistoryIndex: G.updateCardHistory.length,
        });
    }

    const helpers = playerID === null ? [] : getValidHelper(G, playerID);

    const cardObj = slot.card === null ? getCardById("B07") : getCardById(slot.card);
    const region = slot.card === null ? Region.NA : cardObj.region;
    return <>
        <Paper variant={variant}>
            <Grid container>
                <Grid item xs={12}>
                    {slot.card === null ? <></> :
                        <>
                            <CardInfo cid={slot.card}/>
                            <Typography
                                style={{
                                    display: 'inline-flex',
                                    verticalAlign: 'middle'
                                }}>
                                <ResourceIcon/>
                                {cardObj.cost.res}
                                <IndustryIcon/>
                                {cardObj.cost.industry}
                                <AestheticsIcon/>
                                {cardObj.cost.aesthetics}
                                <PrestigeIcon/>
                                {cardObj.vp}
                            </Typography>
                            {
                                ctx.numPlayers <= SimpleRuleNumPlayers ?
                                    <Typography>{i18n.region[region]}</Typography> : <></>
                            }
                        </>
                    }
                    <Typography>{slot.comment === null ? "" : getCardName(slot.comment)} </Typography>
                </Grid>
                {
                    playerID !== null &&
                    slot.card !== null ?
                        <BuyCard
                            card={slot.card}
                            helpers={helpers}
                            ctx={ctx}
                            G={G}
                            playerID={playerID} moves={moves}/>
                        : <></>
                }
                {
                    activePlayer(ctx) === playerID &&
                    actualStage(G, ctx) === "updateSlot" &&
                    slot.card !== null
                        ? <Button fullWidth onClick={updateSlot} aria-label={i18n.action.updateSlot}>
                            <UpdateSlotIcon/>
                        </Button>
                        : <></>
                }
                {
                    activePlayer(ctx) === playerID && actualStage(G, ctx) === "comment" ?
                        <Comment slot={slot} comment={comment} G={G}/>
                        : <></>
                }
            </Grid>
        </Paper>
    </>
}

export interface IRegionProp {
    r: ValidRegion,
    region: IRegionInfo,
    G: IG,
    ctx: Ctx,
    getPlayerName: (pid: string) => string,
    playerID: PlayerID | null,
    moves: Record<string, (...args: any[]) => void>;
}

export interface InvRegionProp {
    r: Region,
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
            borderColor: 'rgba(0, 0, 0, .25)',
            borderWidth: '0.25em',
            borderStyle: 'solid'
        },
        control: {
            padding: theme.spacing(2),
        },
    }),
);


export const BoardRegion = ({getPlayerName, r, region, G, ctx, playerID, moves}: IRegionProp) => {
    useI18n(i18n);
    const {era, share, legend, normal, legendDeckLength, normalDeckLength} = region;
    const classes = useStyles();

    const comment = (slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    })

    const buildingSlotName = (r: ValidRegion, idx: number): string => {
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
                    return i18n.pub.unfreeze;
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

    const buildingName = (b: BuildingType | null) => {
        switch (b) {
            case null:
                return ""
            case BuildingType.cinema:
                return i18n.pub.cinema
            case BuildingType.studio:
                return i18n.pub.studio
        }
    }

    const buildingSlots = region.buildings.map((slot, idx) => {
        if (slot.activated) {
            return (<Grid item xs={2} sm={2} key={`building-slot-${idx}`}>
                <Paper>
                    {slot.owner === "" ? <Typography
                        aria-label={`${buildingName(slot.building)}${playerName(slot.owner)}${buildingSlotName(r, idx)}`}>
                        <TheatersIcon/>/<StudioIcon/>{playerName(slot.owner)}
                    </Typography> : <Typography
                        aria-label={`${buildingName(slot.building)}${playerName(slot.owner)}${buildingSlotName(r, idx)}`}>
                        {slot.building === BuildingType.cinema ? <TheatersIcon/> : <StudioIcon/>}
                        {playerName(slot.owner)}
                    </Typography>}
                </Paper>
            </Grid>)
        } else {
            return <div key={`building-slot-${idx}`}/>
        }
    })

    return <Grid item xs={12}>
        <Accordion
            className={classes.root}
            expanded={true}
            key={r}>
            <AccordionSummary key={r}>
                <Grid container
                      justifyContent="space-evenly"
                      alignItems="baseline"
                      className={classes.root}>
                    <Grid item xs={2} sm={1}>
                        <Paper
                            variant={"outlined"}>
                            <Typography>
                                <ChampionIcon champion={{region: r, era: era}}/>
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={4} sm={2}>
                        <Paper>
                            <DeckIcon style={{color: getColor(r)}}/>
                            <LegendCardIcon style={{color: getColor(r)}}/>
                            {legendDeckLength}
                            <NormalCardIcon style={{color: getColor(r)}}/>
                            {normalDeckLength}
                        </Paper>
                    </Grid>
                    <Grid item xs={2} sm={1}>
                        <Paper
                            aria-label={`${i18n.pub.share}${share}`}
                            variant={"outlined"}>
                            <DrawnShareIcon key={r} r={r}/>X{share}
                        </Paper>
                    </Grid>
                    {buildingSlots}
                </Grid>
            </AccordionSummary>
            <AccordionDetails key={r}>
                <Grid container>
                    <Grid item xs={12} md={6}>
                        <BoardCardSlot
                            G={G} ctx={ctx} slot={legend}
                            moves={moves}
                            comment={comment}
                            playerID={playerID}
                        /></Grid>
                    {normal.map((slot) => {
                        if (slot.card !== null) {
                            return <Grid item key={nanoid()} xs={12} md={6}>
                                <BoardCardSlot
                                    moves={moves}
                                    G={G} ctx={ctx} slot={slot}
                                    comment={comment} playerID={playerID}
                                />
                            </Grid>
                        } else {
                            return <React.Fragment key={nanoid()}/>
                        }
                    })}
                </Grid>
            </AccordionDetails>
        </Accordion>
    </Grid>
}

export const SchoolRegion = ({getPlayerName, r, region, G, ctx, playerID, moves}: InvRegionProp) => {
    useI18n(i18n);
    const {era, share, legend, normal, legendDeckLength, normalDeckLength} = region;
    const classes = useStyles();

    const comment = (slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    })

    return <Grid item xs={12}>
        <Accordion
            className={classes.root}
            expanded={true}
            key={r}>
            <AccordionSummary key={r}>
                <Grid container
                      justifyContent="space-evenly"
                      alignItems="baseline"
                      className={classes.root}>
                    <Grid item xs={2} sm={1}>
                        <Paper
                            variant={"outlined"}>
                            <Typography>
                                <ChampionIcon champion={{region: r, era: era}}/>
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid item xs={4} sm={2}>
                        <Paper>
                            <DeckIcon style={{color: getColor(r)}}/>
                            <LegendCardIcon style={{color: getColor(r)}}/>
                            {legendDeckLength}
                            <NormalCardIcon style={{color: getColor(r)}}/>
                            {normalDeckLength}
                        </Paper>
                    </Grid>
                    <Grid item xs={2} sm={1}>
                        <Paper
                            aria-label={`${i18n.pub.share}${share}`}
                            variant={"outlined"}>
                            <DrawnShareIcon key={r} r={r}/>X{share}
                        </Paper>
                    </Grid>
                </Grid>
            </AccordionSummary>
            <AccordionDetails key={r}>
                <Grid container>
                    <Grid item xs={12} md={6}>
                        <BoardCardSlot
                            G={G} ctx={ctx} slot={legend}
                            moves={moves}
                            comment={comment}
                            playerID={playerID}
                        /></Grid>
                    {normal.map((slot) => {
                        if (slot.card !== null) {
                            return <Grid item key={nanoid()} xs={12} md={6}>
                                <BoardCardSlot
                                    moves={moves}
                                    G={G} ctx={ctx} slot={slot}
                                    comment={comment} playerID={playerID}
                                />
                            </Grid>
                        } else {
                            return <React.Fragment key={nanoid()}/>
                        }
                    })}
                </Grid>
            </AccordionDetails>
        </Accordion>
    </Grid>
}


export default React.memo(BoardRegion);
