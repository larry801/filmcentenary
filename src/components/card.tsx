import React from "react";
import {CardID} from "../types/core";
import Typography from "@material-ui/core/Typography";
import {
    archiveCardEffectText,
    buyCardEffectText,
    playCardEffectText,
    schoolEffectText,
    scoreEffectText
} from "../game/util";

export interface ICardEffectProps {
    cid:CardID,
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
