import React from "react";
import {IPubInfo} from "../types/core";
import {Grid, Typography} from "@material-ui/core";
import { useI18n } from '@i18n-chain/react';
import i18n from '../constant/i18n'

export const PubPanel = (i:IPubInfo)=>{
    useI18n(i18n);

    return <Grid container>
      <Typography>   {i18n.pub.res} {i.resource}</Typography>
      <Typography>   {i18n.pub.cash} {i.cash}</Typography>
      <Typography>   {i18n.pub.industry} {i.industry}</Typography>
      <Typography>   {i18n.pub.aesthetics} {i.aesthetics}</Typography>
    </Grid>
}
