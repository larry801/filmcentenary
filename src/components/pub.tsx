import React from "react";
import {
    CardCategory,
    CardID,
    Champion,
    getCardById,
    IEra,
    IPubInfo,
    SchoolCardID,
    SimpleRuleNumPlayers,
    valid_regions,
    ValidRegion
} from "../types/core";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'
import {IG} from "../types/setup";
import DeckIcon from '@material-ui/icons/Layers';
import NoScoringCardIcon from '@material-ui/icons/Block';
import DiscardDeckIcon from '@material-ui/icons/Block';
import PlayedCardDeck from '@material-ui/icons/Unarchive';
import AestheticsIcon from '@material-ui/icons/ImportContacts';
import IndustryIcon from '@material-ui/icons/Settings';
import ResourceIcon from '@material-ui/icons/MonetizationOn';
import DepositIcon from '@material-ui/icons/LocalAtm';
import {nanoid} from "nanoid";
import {getCardName} from "./card";
import EmojiEventsIcon from '@material-ui/icons/EmojiEvents';
import PanToolIcon from "@material-ui/icons/PanTool";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import {ActionPointIcon, ChampionIcon, DrawnShareIcon, getColor} from "./icons";
import makeStyles from '@material-ui/core/styles/makeStyles';
import Paper from "@material-ui/core/Paper";
import ArchiveIcon from '@material-ui/icons/Archive';
import LegendCardIcon from '@material-ui/icons/StarBorder';
import {getPlayerInferredHand} from "../game/board-util";
import {getPlayerRegionRank} from "../game/util";
import TextField from '@material-ui/core/TextField';
import {CardList, getLogText} from "./boards/list-card";
import ErrorBoundary from "./error";

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
    const reverseLog = cloneLog.filter(l => l.action.payload.playerID === playerID).reverse().slice(0, 40);
    const playerLogText = reverseLog.map(l => getLogText(l, getName, G)).join('\n');

    return <Grid container item key={`pub${idx}-${playerID}`}>
        <Grid item xs={12}>
            {/*<textarea*/}
            {/*    defaultValue={playerLogText}*/}
            {/*    disabled*/}
            {/*    rows={6}*/}
            {/*/>*/}
            <TextField
                aria-live="polite"
                disabled
                defaultValue={playerLogText}
                fullWidth
                multiline
                rows={6}
                rowsMax={6}
                variant="filled"
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
                    <CardList
                        title={`${getCardName(i.school)}${i.school === SchoolCardID.S3101 ? (i.newHollyWoodUsed ? "(x)" : "(*)") : ""}`}
                        cards={[i.school]}
                        label={
                            <Typography>
                                {`${getCardName(i.school)}`}
                            </Typography>}
                    />
                </> : <></>}
            {G.playerCount > SimpleRuleNumPlayers ?
                <ErrorBoundary>
                    <Paper aria-label={shareAndLegendAriaLabel()}>
                        {valid_regions.map((r: ValidRegion) => {
                                const share = i.shares[r];
                                const legend = legendCount(r);
                                const rank = getPlayerRegionRank(G, ctx, playerID, r);
                                const rankEraHint: IEra = rank;
                                const rankHintIcon = rank === -1 ? <NoScoringCardIcon className={classes.iconAlign}/> :
                                    <ChampionIcon champion={{
                                        region: r,
                                        era: rankEraHint,
                                    }}/>;
                                return <Grid container key={nanoid()}>
                                    <Grid item xs={4} key={nanoid()}>
                                        <DrawnShareIcon key={nanoid()} r={r}/>
                                        {share}
                                    </Grid>
                                    <Grid item xs={4} key={nanoid()}>
                                        {rankHintIcon}
                                    </Grid>
                                    <Grid item xs={4} key={nanoid()}>
                                        <LegendCardIcon key={idx} style={{color: getColor(r)}}/>
                                        {legend}
                                    </Grid>
                                </Grid>
                            }
                        )}
                    </Paper>
                </ErrorBoundary>
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
            {i.champions.length > 0 ? <Paper aria-label={championAriaLabel()}>
                {i.champions.map((c: Champion) => <ChampionIcon key={nanoid()} champion={c}/>)}
            </Paper> : <></>}
        </Grid>

        <Grid item sm={3}>
            <CardList
                title={`${i18n.pub.discard}${i.discard.length}`}
                cards={i.discard}
                label={
                    <Typography><DiscardDeckIcon className={classes.iconAlign}/>{i.discard.length}</Typography>
                }
            />
            <CardList
                cards={possibleHand} label={
                <Typography>
                    <PanToolIcon className={classes.iconAlign}/>
                    <DeckIcon className={classes.iconAlign}/>
                    {possibleHand.length}
                </Typography>
            } title={
                `${i18n.pub.allCards}(${possibleHand.length})`
            }/>
            {i.revealedHand.length > 0 ?
                <CardList
                    cards={i.revealedHand} label={
                    <Typography>
                        <PanToolIcon className={classes.iconAlign}/>{i.revealedHand.length}
                    </Typography>
                }
                    title={`${i18n.pub.revealedHand}(${i.revealedHand.length})`}/>
                : <></>}
            <CardList
                cards={i.archive}
                title={`${i18n.pub.archive}(${i.archive.length})`}
                label={<Typography><ArchiveIcon className={classes.iconAlign}/>{i.archive.length} </Typography>}
            />
            <CardList
                cards={i.playedCardInTurn} title={`${i18n.pub.playedCards}(${i.playedCardInTurn.length})`}
                label={<Typography>
                    <PlayedCardDeck className={classes.iconAlign}/>{i.playedCardInTurn.length}
                </Typography>}/>
        </Grid>
    </Grid>

}

export default PubPanel;
