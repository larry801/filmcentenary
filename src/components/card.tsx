import React from "react";
import {CardID, getCardById} from "../types/core";
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import {
    archiveCardEffectText,
    buyCardEffectText, getCardName,
    playCardEffectText,
    schoolEffectText,
    scoreEffectText
} from "../game/util";
import ImportContactsIcon from '@material-ui/icons/ImportContacts';
import SettingsIcon from '@material-ui/icons/Settings';
import {getColor} from "./region";
import {generate} from "shortid";

export interface ICardEffectProps {
    cid:CardID,
}

export const CardInfo  = ({cid}:ICardEffectProps) =>{
    const card = getCardById(cid);
    const r = card.region;
    return <Grid item xs={12}>
        <Typography>{getCardName(cid)}</Typography>
        {card.industry > 0 ? Array(card.industry).fill(1).map(()=><SettingsIcon key={generate()} style={{color: getColor(r)}}/>) : <></>}
        {card.aesthetics > 0 ? Array(card.aesthetics).fill(1).map(()=><ImportContactsIcon key={generate()} style={{color: getColor(r)}}/>) : <></>}
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

export default CardInfo;
