import React from "react";
import {CardCategory, IPubInfo, ValidRegions} from "../types/core";
import {Grid, Typography} from "@material-ui/core";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'
import {ChoiceDialog} from "./modals";
import {getCardName} from "../game/util";
import {IG} from "../types/setup";

export interface IPubPanelProps {
    i:IPubInfo,
    G:IG,
}
export const PubPanel = ({i,G}:IPubPanelProps) => {
    useI18n(i18n);

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
                <Typography> {i18n.pub.school} {getCardName(i.school.cardId)} </Typography> : <></>}
            <Typography>   {i18n.pub.share} </Typography>
            {ValidRegions.map(r =>
                <Typography key={r}>   {i18n.region[r]} {i.shares[r as 0 | 1 | 2 | 3]}
                /{i.allCards.filter(c=>c.category === CardCategory.LEGEND  &&
                        // @ts-ignore
                        c.era===G.regions[r].era).length}
                </Typography>

            )}
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            {i.champions.map(champion=><Typography>
                {i18n.region[champion.region]}
                {i18n.era[champion.era]}</Typography>)}
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <ChoiceDialog
                callback={() => {
                }}
                choices={i.discard.map((card, idx) => {
                    return {
                        label: getCardName(card.cardId),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={i18n.pub.discard}
                toggleText={i18n.pub.discard} initial={false}/>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <ChoiceDialog
                callback={() => {
                }}
                choices={i.allCards.map((card, idx) => {
                    return {
                        label: getCardName(card.cardId),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={i18n.pub.allCards}
                toggleText={i18n.pub.allCards} initial={false}/>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <ChoiceDialog
                callback={() => {
                }}
                choices={i.archive.map((card, idx) => {
                    return {
                        label: getCardName(card.cardId),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={i18n.pub.archive}
                toggleText={i18n.pub.archive} initial={false}/>
        </Grid>
        <Grid item xs={4} sm={3} md={2} lg={1}>
            <ChoiceDialog
                callback={() => {
                }}
                choices={i.playedCardInTurn.map((card, idx) => {
                    return {
                        label: getCardName(card.cardId),
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={i18n.pub.playedCards}
                toggleText={i18n.pub.playedCards} initial={false}/>
        </Grid>
    </>
}
