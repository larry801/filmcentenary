import React from "react";
import {
    CardCategory,
    CardID,
    Champion,
    getCardById,
    SimpleRuleNumPlayers,
    validRegion,
    ValidRegions
} from "../types/core";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'
import {ChoiceDialog} from "./modals";
import {inferDeckRemoveHelper} from "../game/util";
import {IG} from "../types/setup";
import ImportContactsIcon from '@material-ui/icons/ImportContacts';
import SettingsIcon from '@material-ui/icons/Settings';
import MonetizationOnIcon from '@material-ui/icons/MonetizationOn';
import LocalAtmIcon from '@material-ui/icons/LocalAtm';
import {generate} from "shortid";
import {CardInfo, getCardName} from "./card";
import EmojiEventsIcon from '@material-ui/icons/EmojiEvents';
import PanToolIcon from "@material-ui/icons/PanTool";
import {PlayerID} from "boardgame.io";
import {ActionPointIcon, ChampionIcon, DrawnShareIcon} from "./icons";
import makeStyles from '@material-ui/core/styles/makeStyles';
import Paper from "@material-ui/core/Paper";

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
    idx: number,
    getName: (p: PlayerID) => string,
    G: IG,
}

export const PubPanel = ({idx, getName, G}: IPubPanelProps) => {
    useI18n(i18n);
    const classes = useStyles();
    const i = G.pub[idx]
    const inferHand = (): CardID[] => {
        let result = [...i.allCards]
        inferDeckRemoveHelper(result, i.discard)
        inferDeckRemoveHelper(result, i.archive)
        inferDeckRemoveHelper(result, i.playedCardInTurn)
        if (i.school !== null) {
            let sIndex = result.indexOf(i.school)
            if (sIndex !== -1) {
                result.splice(sIndex, 1);
            }
        }
        return result;
    }

    const legendCount = (r:validRegion) => i.allCards.filter(c => getCardById(c).category === CardCategory.LEGEND &&
        getCardById(c).region === r &&
        getCardById(c).era === G.regions[r].era
    ).length

    const possibleHand = inferHand();

    const noOp = () => false;


    const shareAndLegendAriaLabel = () => {
        let labelText = ""
        ValidRegions.forEach(r=>labelText+=`${i18n.region[r]}${i.shares[r]}${i18n.pub.share}${i18n.pub.legend}`)
        return labelText
    }
    const sharesAriaLabel = () =>{
        let labelText = i18n.pub.share
        ValidRegions.forEach(r=>labelText+=`${i18n.region[r]}${i.shares[r]}`)
        return labelText
    }
    const championAriaLabel = () =>{
        let labelText = i18n.pub.champion
        i.champions.forEach((champion: Champion) => labelText+=`${i18n.region[champion.region]}${i18n.era[champion.era]}`)
        return labelText
    }

    return <Grid container key={generate()}>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography>
                {getName(idx.toString())}
            </Typography>
            <Typography aria-label={`${i18n.pub.handSize}${G.player[idx].handSize}`}>
                <PanToolIcon/>{G.player[0].handSize}
            </Typography>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography>
                <MonetizationOnIcon className={classes.iconAlign}/> {i.resource}
            </Typography>
            <Typography>
                <LocalAtmIcon className={classes.iconAlign}/>{i.deposit}
            </Typography>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography> <SettingsIcon className={classes.iconAlign}/> {i.industry}
                {i.school !== null && getCardById(i.school).industry > 0 ? `(+${getCardById(i.school).industry})` : ""}
            </Typography>
            <Typography>
                <ImportContactsIcon className={classes.iconAlign}/> {i.aesthetics}
                {i.school !== null && getCardById(i.school).aesthetics > 0 ? `(+${getCardById(i.school).aesthetics})` : ""}
            </Typography>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography aria-label={`${i18n.pub.action}${i.action}`}>
                <ActionPointIcon/> {i.action}</Typography>
            <Typography aria-label={`${i18n.pub.vp}${i.vp}`}> <EmojiEventsIcon className={classes.iconAlign}/> {i.vp}
            </Typography>
        </Grid>
        <Grid item xs={12} sm={6} md={6} lg={3}>
            {i.school !== null ?
                <>
                    <Typography>
                        {i18n.pub.school}
                    </Typography>
                    <CardInfo cid={i.school}/>
                </> : <></>}
            {G.playerCount > SimpleRuleNumPlayers ?
                <Paper aria-label={shareAndLegendAriaLabel()}>
                    <Typography>   {i18n.pub.shareLegend} </Typography>
                    {
                        ValidRegions.map((r: validRegion) =>
                            <Typography key={r}>
                                {i18n.region[r]} {i.shares[r as 0 | 1 | 2 | 3]}
                                /
                                {i.allCards.filter(c => getCardById(c).category === CardCategory.LEGEND &&
                                    getCardById(c).region === r &&
                                    getCardById(c).era === G.regions[r].era
                                ).length}
                            </Typography>
                        )
                    }
                </Paper>
                :
                <Paper aria-label={sharesAriaLabel()}>
                    {
                        ValidRegions.map((r: validRegion) =>
                            <div key={r}>
                                {Array(i.shares[r as 0 | 1 | 2 | 3]).fill(1).map((i, idx) =>
                                    <Grid item xs={6} key={idx}>
                                        <DrawnShareIcon key={idx} r={r}/>
                                    </Grid>)}
                            </div>
                        )
                    }
                </Paper>
            }
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Paper aria-label={championAriaLabel()}>
                {i.champions.map((c:Champion)=><ChampionIcon champion={c}/>)}
            </Paper>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
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
                show={true} title={i18n.pub.discard}
                toggleText={`${i18n.pub.discard}(${i.discard.length})`} initial={false}/>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
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
                show={true} title={i18n.pub.allCards}
                toggleText={`${i18n.pub.allCards}(${possibleHand.length})`} initial={false}/>
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
                show={i.revealedHand.length > 0} title={i18n.pub.revealedHand}
                toggleText={`${i18n.pub.revealedHand}(${i.revealedHand.length})`} initial={false}/>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
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
                show={true} title={i18n.pub.archive}
                toggleText={`${i18n.pub.archive}(${i.archive.length})`} initial={false}/>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
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
                show={true} title={i18n.pub.playedCards}
                toggleText={`${i18n.pub.playedCards}(${i.playedCardInTurn.length})`} initial={false}/>
        </Grid>
    </Grid>

}

export default PubPanel;
