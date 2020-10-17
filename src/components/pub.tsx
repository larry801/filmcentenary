import React from "react";
import {CardCategory, CardID, IPubInfo, ValidRegions} from "../types/core";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'
import {ChoiceDialog} from "./modals";
import {getCardName, inferDeckRemoveHelper} from "../game/util";
import {IG} from "../types/setup";
import shortid from "shortid";
import {getCardById} from "../types/cards";
import {CardEffect} from "./card";

export interface IPubPanelProps {
    i: IPubInfo,
    G: IG,
}

export const PubPanel = ({i, G}: IPubPanelProps) => {
    useI18n(i18n);
    const inferHand = (): CardID[] => {
        let result = [...i.allCards]
        inferDeckRemoveHelper(result,i.discard)
        inferDeckRemoveHelper(result,i.archive)
        return result;
    }

    const possibleHand = inferHand();

    const noOp = () => {
    }

    return <>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography>   {i18n.pub.res} {i.resource}</Typography>
            <Typography>   {i18n.pub.deposit} {i.deposit}</Typography>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography>   {i18n.pub.industry} {i.industry}</Typography>
            <Typography>   {i18n.pub.aesthetics} {i.aesthetics}</Typography>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography>   {i18n.pub.action} {i.action}</Typography>
            <Typography>   {i18n.pub.vp} {i.vp}</Typography>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            {i.school !== null ?
                <Typography>
                    {i18n.pub.school}
                    {getCardName(i.school.cardId)}
                    <CardEffect cid={i.school.cardId}/>
                </Typography> : <></>}
            <Typography>   {i18n.pub.shareLegend} </Typography>
            {ValidRegions.map(r =>
                <Typography key={r}>
                    {i18n.region[r]} {i.shares[r as 0 | 1 | 2 | 3]}
                    /
                    {i.allCards.filter(c => getCardById(c).category === CardCategory.LEGEND &&
                        getCardById(c).region === r &&
                        getCardById(c).era === G.regions[r].era
                    ).length}
                </Typography>
            )}
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <Typography>{i18n.pub.champion}</Typography>
            {i.champions.map(champion => <Typography key={shortid.generate()}>
                {i18n.region[champion.region]}
                {i18n.era[champion.era]}</Typography>)}
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
    </>
}
