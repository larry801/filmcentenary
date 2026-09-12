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
import i18n from "../constant/i18n";
import BuyCard, {Comment} from "./buy-card";
import UpdateSlotIcon from '@mui/icons-material/Loop';
import NormalCardIcon from '@mui/icons-material/RadioButtonUnchecked';
import LegendCardIcon from '@mui/icons-material/StarBorder';
import {activePlayer, actualStage} from "../game/util";
import Button from "@mui/material/Button";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import Grid from "@mui/material/Grid";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import StudioIcon from '@mui/icons-material/Business';
import TheatersIcon from '@mui/icons-material/Theaters';
import AccordionDetails from "@mui/material/AccordionDetails";
import DeckIcon from '@mui/icons-material/Layers';
import CardInfo, {getCardName} from "./card";
import {ChampionIcon, DrawnShareIcon, getColor} from "./icons";
import {nanoid} from "nanoid";
import PrestigeIcon from "@mui/icons-material/EmojiEvents";
import ResourceIcon from "@mui/icons-material/MonetizationOn";
import AestheticsIcon from "@mui/icons-material/ImportContacts";
import IndustryIcon from "@mui/icons-material/Settings";
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
                <Grid size={12}>
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
                                    <Typography>{i18n.chain.region[region]}</Typography> : <></>
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
                        ? <Button fullWidth onClick={updateSlot} aria-label={i18n.chain.action.updateSlot}>
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

const styles = {
    root: {
        flexGrow: 1,
        borderColor: 'rgba(0, 0, 0, .25)',
        borderWidth: '0.25em',
        borderStyle: 'solid',
    },
    control: {
        p: 2,
    },
};


export const BoardRegion = ({getPlayerName, r, region, G, ctx, playerID, moves}: IRegionProp) => {
    i18n.use();
    const {era, share, legend, normal, legendDeckLength, normalDeckLength} = region;

    const comment = (slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    })

    const buildingSlotName = (r: ValidRegion, idx: number): string => {
        switch (r) {
            case Region.ASIA:
                if (idx === 0) {
                    return i18n.chain.pub.cinemaORStudio + i18n.chain.pub.twoToFourPlayer;
                } else {
                    return i18n.chain.pub.bollywood;
                }
            case Region.EE:
                if (idx === 0) {
                    return i18n.chain.pub.cinemaORStudio + i18n.chain.pub.twoToFourPlayer;
                } else {
                    return i18n.chain.pub.unfreeze;
                }
            case Region.NA:
                if (idx === 0) {
                    return i18n.chain.pub.cinemaORStudio + i18n.chain.pub.twoToFourPlayer;
                } else {
                    if (idx === 1) {
                        return i18n.chain.pub.cinemaORStudio + i18n.chain.pub.threeToFourPlayer;
                    } else {
                        return i18n.chain.pub.hollywood;
                    }
                }
            case Region.WE:
                if (idx === 0) {
                    return i18n.chain.pub.cinemaORStudio + i18n.chain.pub.twoToFourPlayer;
                } else {
                    return i18n.chain.pub.cinemaORStudio + i18n.chain.pub.threeToFourPlayer;
                }
        }
    }

    const playerName = (p: string): string => {
        if (p === "") {
            return i18n.chain.pub.emptyBuildingSlot
        } else {
            return getPlayerName(p);
        }
    }

    const buildingName = (b: BuildingType | null) => {
        switch (b) {
            case null:
                return ""
            case BuildingType.cinema:
                return i18n.chain.pub.cinema
            case BuildingType.studio:
                return i18n.chain.pub.studio
        }
    }

    const buildingSlots = region.buildings.map((slot, idx) => {
        if (slot.activated) {
            return (<Grid key={`building-slot-${idx}`} size={{xs: 2, sm: 2}}>
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

    return <Grid size={12}>
        <Accordion
            sx={styles.root}
            expanded={true}
            key={r}>
            <AccordionSummary key={r}>
                <Grid container sx={{...(styles.root), justifyContent: 'space-evenly', alignItems: 'baseline'}}>
                    <Grid size={{xs: 2, sm: 1}}>
                        <Paper
                            variant={"outlined"}>
                            <Typography>
                                <ChampionIcon champion={{region: r, era: era}}/>
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{xs: 4, sm: 2}}>
                        <Paper>
                            <DeckIcon style={{color: getColor(r)}}/>
                            <LegendCardIcon style={{color: getColor(r)}}/>
                            {legendDeckLength}
                            <NormalCardIcon style={{color: getColor(r)}}/>
                            {normalDeckLength}
                        </Paper>
                    </Grid>
                    <Grid size={{xs: 2, sm: 1}}>
                        <Paper
                            aria-label={`${i18n.chain.pub.share}${share}`}
                            variant={"outlined"}>
                            <DrawnShareIcon key={r} r={r}/>X{share}
                        </Paper>
                    </Grid>
                    {buildingSlots}
                </Grid>
            </AccordionSummary>
            <AccordionDetails key={r}>
                <Grid container>
                    <Grid size={{xs: 12, md: 6}}>
                        <BoardCardSlot
                            G={G} ctx={ctx} slot={legend}
                            moves={moves}
                            comment={comment}
                            playerID={playerID}
                        /></Grid>
                    {normal.map((slot) => {
                        if (slot.card !== null) {
                            return <Grid key={nanoid()} size={{xs: 12, md: 6}}>
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
    i18n.use();
    const {era, share, legend, normal, legendDeckLength, normalDeckLength} = region;

    const comment = (slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    })

    return <Grid size={12}>
        <Accordion
            sx={styles.root}
            expanded={true}
            key={r}>
            <AccordionSummary key={r}>
                <Grid container sx={{...(styles.root), justifyContent: 'space-evenly', alignItems: 'baseline'}}>
                    <Grid size={{xs: 2, sm: 1}}>
                        <Paper
                            variant={"outlined"}>
                            <Typography>
                                <ChampionIcon champion={{region: r, era: era}}/>
                            </Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{xs: 4, sm: 2}}>
                        <Paper>
                            <DeckIcon style={{color: getColor(r)}}/>
                            <LegendCardIcon style={{color: getColor(r)}}/>
                            {legendDeckLength}
                            <NormalCardIcon style={{color: getColor(r)}}/>
                            {normalDeckLength}
                        </Paper>
                    </Grid>
                    <Grid size={{xs: 2, sm: 1}}>
                        <Paper
                            aria-label={`${i18n.chain.pub.share}${share}`}
                            variant={"outlined"}>
                            <DrawnShareIcon key={r} r={r}/>X{share}
                        </Paper>
                    </Grid>
                </Grid>
            </AccordionSummary>
            <AccordionDetails key={r}>
                <Grid container>
                    <Grid size={{xs: 12, md: 6}}>
                        <BoardCardSlot
                            G={G} ctx={ctx} slot={legend}
                            moves={moves}
                            comment={comment}
                            playerID={playerID}
                        /></Grid>
                    {normal.map((slot) => {
                        if (slot.card !== null) {
                            return <Grid key={nanoid()} size={{xs: 12, md: 6}}>
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
