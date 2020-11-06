import React from "react";
import {
    CardCategory,
    CardID,
    Champion,
    getCardById, IPubInfo,
    SimpleRuleNumPlayers,
    ValidRegion,
    valid_regions, IEra
} from "../types/core";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'
import {ChoiceDialog} from "./modals";
import {IG} from "../types/setup";
import DeckIcon from '@material-ui/icons/Layers';
import NoScoringCardIcon from '@material-ui/icons/Block';
import DiscardDeckIcon from '@material-ui/icons/Block';
import PlayedCardDeck from '@material-ui/icons/Unarchive';
import AestheticsIcon from '@material-ui/icons/ImportContacts';
import IndustryIcon from '@material-ui/icons/Settings';
import ResourceIcon from '@material-ui/icons/MonetizationOn';
import DepositIcon from '@material-ui/icons/LocalAtm';
import {generate} from "shortid";
import {CardInfo, getCardName} from "./card";
import EmojiEventsIcon from '@material-ui/icons/EmojiEvents';
import PanToolIcon from "@material-ui/icons/PanTool";
import {Ctx, PlayerID} from "boardgame.io";
import {ActionPointIcon, ChampionIcon, DrawnShareIcon, getColor} from "./icons";
import makeStyles from '@material-ui/core/styles/makeStyles';
import Paper from "@material-ui/core/Paper";
import ArchiveIcon from '@material-ui/icons/Archive';
import LegendCardIcon from '@material-ui/icons/StarBorder';
import {getLogText, getPlayerInferredHand} from "../game/board-util";
import {getPlayerRegionRank} from "../game/util";
import TextareaAutosize from "@material-ui/core/TextareaAutosize";
import {LogEntry} from "boardgame.io";

const useStyles = makeStyles({
    root: {
        background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
        border: 0,
        borderRadius: 3,
        boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
        color: 'white',
        height: 48,
        padding: '0 30px',
    },
    iconAlign: {
        verticalAlign: "-0.25em"
    }
});

export interface IPubPanelProps {
    i: IPubInfo,
    idx: number,
    getName: (p: PlayerID) => string,
    G: IG,
    ctx: Ctx,
    log: LogEntry[],
}

export const PubPanel = ({log, ctx, i, idx, getName, G}: IPubPanelProps) => {
    useI18n(i18n);
    const classes = useStyles();
    const inferHand = (): CardID[] => getPlayerInferredHand(G, idx.toString());
    const playerID = idx.toString()
    const legendCount = (r: ValidRegion) => i.allCards.filter(c => getCardById(c).category === CardCategory.LEGEND &&
        getCardById(c).region === r &&
        getCardById(c).era === G.regions[r].era
    ).length

    const possibleHand = inferHand();

    const noOp = () => false;


    const shareAndLegendAriaLabel = () => {
        let labelText = ""
        valid_regions.forEach(r => labelText += `${i18n.region[r]}${i.shares[r]}${i18n.pub.share}${i18n.pub.legend}${legendCount(r)}`)
        return labelText
    }
    const sharesAriaLabel = () => {
        let labelText = i18n.pub.share
        valid_regions.forEach(r => labelText += `${i18n.region[r]}${i.shares[r]}`)
        return labelText
    }
    const championAriaLabel = () => {
        let labelText = i18n.pub.champion
        i.champions.forEach((champion: Champion) => labelText += `${i18n.region[champion.region]}${i18n.era[champion.era]}`)
        return labelText
    }
    const cloneLog = [...log]
    const reverseLog = cloneLog.filter(l=>l.action.payload.playerID===playerID).reverse()
    const playerLogText = reverseLog.map(l=>getLogText(l, getName)).join('\n');

    return <Grid container key={generate()}>
        <Grid item xs={12}>
            <TextareaAutosize
                readOnly={true}
                rowsMin={1}
                rowsMax={6}
                defaultValue={playerLogText}
                style={{
                    width: "100%"
                }}
            />
        </Grid>
        <Grid item sm={3}>
            <Typography>
                {getName(idx.toString())}
            </Typography>
            <Typography aria-label={`${i18n.pub.handSize}${i.handSize}`}>
                <PanToolIcon className={classes.iconAlign}/>{i.handSize}
            </Typography>
            <Typography>
                <ResourceIcon className={classes.iconAlign}/> {i.resource}
            </Typography>
            <Typography>
                <DepositIcon className={classes.iconAlign}/>{i.deposit}
            </Typography>
        </Grid>
        <Grid item sm={3}>
            <Typography aria-label={`${i18n.pub.industry}${i.industry}`}>
                <IndustryIcon className={classes.iconAlign}/> {i.industry}
                {i.school !== null && getCardById(i.school).industry > 0 ? `(+${getCardById(i.school).industry})` : ""}
            </Typography>
            <Typography aria-label={`${i18n.pub.aesthetics}${i.aesthetics}`}>
                <AestheticsIcon className={classes.iconAlign}/> {i.aesthetics}
                {i.school !== null && getCardById(i.school).aesthetics > 0 ? `(+${getCardById(i.school).aesthetics})` : ""}
            </Typography>
            <Typography aria-label={`${i18n.pub.action}${i.action}`}>
                <ActionPointIcon/> {i.action}</Typography>
            <Typography aria-label={`${i18n.pub.vp}${i.vp}`}> <EmojiEventsIcon className={classes.iconAlign}/> {i.vp}
            </Typography>
        </Grid>
        <Grid item sm={3}>
            {i.school !== null ?
                <>
                    <Typography>
                        {i18n.pub.school}
                    </Typography>
                    <CardInfo cid={i.school}/>
                </> : <></>}
            {G.playerCount > SimpleRuleNumPlayers ?
                <Paper aria-label={shareAndLegendAriaLabel()}>
                    {valid_regions.map((r: ValidRegion) => {
                            const share = i.shares[r];
                            const legend = legendCount(r);
                            const rank = getPlayerRegionRank(G, ctx, playerID, r);
                            const rankHintIcon = rank === -1 ? <NoScoringCardIcon className={classes.iconAlign}/> : <ChampionIcon champion={{
                                region:r,
                                era: rank as IEra,
                            }}/>;
                            return <Grid container key={generate()}>
                                <Grid item xs={4} key={generate()}>
                                    <DrawnShareIcon key={generate()} r={r}/>
                                    {share}
                                </Grid>
                                <Grid item xs={4} key={generate()}>
                                    {rankHintIcon}
                                </Grid>
                                <Grid item xs={4} key={generate()}>
                                    <LegendCardIcon key={idx} style={{color: getColor(r)}}/>
                                    {legend}
                                </Grid>
                            </Grid>
                        }
                    )}
                </Paper>
                :
                <Paper aria-label={sharesAriaLabel()}>
                    {valid_regions.map((r: ValidRegion) => {
                        const share = i.shares[r];
                        return <Grid container key={r}>
                            <DrawnShareIcon key={idx} r={r}/>
                            {share}
                        </Grid>
                    })}
                </Paper>
            }
        </Grid>
        {i.champions.length > 0 ? <Grid item sm={3}>
            <Paper aria-label={championAriaLabel()}>
                {i.champions.map((c: Champion) => <ChampionIcon key={generate()} champion={c}/>)}
            </Paper>
        </Grid> : <></>}
        <Grid item sm={3}>
            <ChoiceDialog
                callback={noOp}
                choices={i.discard.map((card, idx) => {
                    return {
                        label: getCardName(card),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={`${i18n.pub.discard}${i.discard.length}`}
                toggleText={<Typography><DiscardDeckIcon className={classes.iconAlign}/>{i.discard.length}</Typography>}
                initial={false}/>
            <ChoiceDialog
                callback={noOp}
                choices={possibleHand.map((card, idx) => {
                    return {
                        label: getCardName(card),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={`${i18n.pub.allCards}(${possibleHand.length})`}
                toggleText={<Typography>
                    <PanToolIcon className={classes.iconAlign}/>
                    <DeckIcon className={classes.iconAlign}/>
                    {possibleHand.length}
                </Typography>} initial={false}/>
            <ChoiceDialog
                callback={noOp}
                choices={i.revealedHand.map((card, idx) => {
                    return {
                        label: getCardName(card),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={i.revealedHand.length > 0} title={`${i18n.pub.revealedHand}(${i.revealedHand.length})`}
                toggleText={<Typography>
                    <PanToolIcon className={classes.iconAlign}/>{i.revealedHand.length}
                </Typography>} initial={false}/>
            <ChoiceDialog
                callback={noOp}
                choices={i.archive.map((card, idx) => {
                    return {
                        label: getCardName(card),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={`${i18n.pub.archive}(${i.archive.length})`}
                toggleText={<Typography><ArchiveIcon className={classes.iconAlign}/>{i.archive.length} </Typography>}
                initial={false}/>
            <ChoiceDialog
                callback={noOp}
                choices={i.playedCardInTurn.map((card, idx) => {
                    return {
                        label: getCardName(card),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={`${i18n.pub.playedCards}(${i.playedCardInTurn.length})`}
                toggleText={<Typography>
                    <PlayedCardDeck className={classes.iconAlign}/>{i.playedCardInTurn.length}
                </Typography>} initial={false}/>
        </Grid>
    </Grid>

}

export default PubPanel;
