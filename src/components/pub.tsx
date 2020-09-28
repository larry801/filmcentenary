import React from "react";
import {BasicCardID, IPubInfo, Region} from "../types/core";
import {Grid, Typography} from "@material-ui/core";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'
import {ChoiceDialog} from "./modals";

export const PubPanel = (i: IPubInfo) => {
    useI18n(i18n);

    return <>
        <Grid item>
            <Typography>   {i18n.pub.res} {i.resource}</Typography>
            <Typography>   {i18n.pub.deposit} {i.deposit}</Typography>
            <Typography>   {i18n.pub.industry} {i.industry}</Typography>
            <Typography>   {i18n.pub.aesthetics} {i.aesthetics}</Typography>
            <Typography>   {i18n.pub.action} {i.action}</Typography>
            <Typography>   {i18n.pub.vp} {i.vp}</Typography>
        </Grid>
        <Grid item>
            {i.school !== null ?
                <Typography> {i18n.pub.school} {i18n.card[i.school.cardId as BasicCardID]} </Typography> : <></>}
                <Typography>   {i18n.pub.share} </Typography>
            {[Region.NA, Region.WE, Region.EE, Region.ASIA].map(r =>
                <Typography>   {i18n.region[r]} {
                    i.shares[r as 0 | 1 | 2 | 3]
                }</Typography>
            )}
        </Grid>
        <Grid item>
            <ChoiceDialog
                callback={() => {
                }}
                choices={i.discard.map((card, idx) => {
                    return {
                        label: i18n.card[card.cardId as BasicCardID],
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={i18n.pub.discard}
                toggleText={i18n.pub.discard} initial={false}/>
        </Grid>
        <Grid item>
            <ChoiceDialog
                callback={() => {
                }}
                choices={i.allCards.map((card, idx) => {
                    return {
                        label: i18n.card[card.cardId as BasicCardID],
                        hidden: false,
                        disabled: true,
                        value: idx.toString(),
                    }
                })} defaultChoice={'0'}
                show={true} title={i18n.pub.allCards}
                toggleText={i18n.pub.allCards} initial={false}/>
        </Grid>        <Grid item>
        <ChoiceDialog
            callback={() => {
            }}
            choices={i.archive.map((card, idx) => {
                return {
                    label: i18n.card[card.cardId as BasicCardID],
                    hidden: false,
                    disabled: true,
                    value: idx.toString(),
                }
            })} defaultChoice={'0'}
            show={true} title={i18n.pub.archive}
            toggleText={i18n.pub.archive} initial={false}/>
        <ChoiceDialog
            callback={() => {
            }}
            choices={i.playedCardInTurn.map((card, idx) => {
                return {
                    label: i18n.card[card.cardId as BasicCardID],
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
