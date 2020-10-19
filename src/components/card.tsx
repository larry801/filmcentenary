import React from "react";
import {CardID} from "../types/core";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import {
    archiveCardEffectText,
    buyCardEffectText, getCardName,
    playCardEffectText,
    schoolEffectText,
    scoreEffectText
} from "../game/util";
import i18n from "../constant/i18n";
import {getCardById} from "../types/cards";

export interface ICardEffectProps {
    cid:CardID,
}

export const CardInfo  = ({cid}:ICardEffectProps) =>{
    const card = getCardById(cid);
    return <Grid item xs={12}>
        <Typography>{getCardName(cid)}</Typography>
        <Typography>
        {card.industry > 0 ? `${i18n.pub.industryMarker}${card.industry}` : ""}
        {card.aesthetics > 0 ? `${i18n.pub.aestheticsMarker}${card.aesthetics}` : ""}
        </Typography>
        <CardEffect cid={cid}/>
    </Grid>
}

export const CardEffect = ({cid}:ICardEffectProps) =>{
    const buy = buyCardEffectText(cid);
    const play = playCardEffectText(cid);
    const school = schoolEffectText(cid);
    const arch = archiveCardEffectText(cid);
    const score = scoreEffectText(cid);
    return <>
        {buy!==""?<Typography>{buy}</Typography>:<></>}
        {play!==""?<Typography>{play}</Typography>:<></>}
        {arch!==""?<Typography>{arch}</Typography>:<></>}
        {school!==""?<Typography>{school}</Typography>:<></>}
        {score!==""?<Typography>{score}</Typography>:<></>}
    </>
}
