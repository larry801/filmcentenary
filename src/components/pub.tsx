import React from "react";
import {BasicCardID, IPubInfo, Region} from "../types/core";
import {Grid, Typography} from "@material-ui/core";
import {useI18n} from '@i18n-chain/react';
import i18n from '../constant/i18n'

export const PubPanel = (i: IPubInfo) => {
    useI18n(i18n);

    return <Grid container>
        <Typography>   {i18n.pub.res} {i.resource}</Typography>
        <Typography>   {i18n.pub.deposit} {i.deposit}</Typography>
        <Typography>   {i18n.pub.industry} {i.industry}</Typography>
        <Typography>   {i18n.pub.aesthetics} {i.aesthetics}</Typography>
        <Typography>   {i18n.pub.action} {i.action}</Typography>
        <Typography>   {i18n.pub.vp} {i.vp}</Typography>
        {i.school !== null ? <Typography> {i18n.pub.school} {i18n.card[i.school.cardId as BasicCardID]} </Typography>:<></>}
        <Typography>   {i18n.pub.share} </Typography>
        {[Region.NA,Region.WE,Region.EE,Region.ASIA].map(r=>
            <Typography>   {i18n.region[r]} {
                // @ts-ignore
                i.shares[r as number]
            }</Typography>
        )}
    </Grid>
}
