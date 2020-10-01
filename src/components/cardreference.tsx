import React from "react";
import {BasicCardID, EventCardID, NoneBasicCardID} from "../types/core";
import {Typography, Grid} from "@material-ui/core";
import {cardEffectText} from "../game/util";
import {getCardById} from "../types/cards";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {effects, eventEffects} from "../constant/effects";

interface ICardItemProps {
 cardId:BasicCardID|EventCardID|NoneBasicCardID,
}

export const CardItem = ({cardId}:ICardItemProps)=>{

    useI18n(i18n)
    const card = getCardById(cardId);

    return <div>
        <Typography>{
            // @ts-ignore
            i18n.card[cardId]
        }</Typography>
        <Typography>{i18n.pub.industryMarker} {card.industry}</Typography>
        <Typography>{i18n.pub.aestheticsMarker} {card.aesthetics}</Typography>
        <Typography>{
            // @ts-ignore
            cardEffectText(cardId)
        }</Typography>
    </div>
}

export const CardList = () => {

    return <>
        // @ts-ignore
        {Object.keys(effects).map(id=><Grid key={id}><CardItem cardId={id}  /></Grid>)}
        // @ts-ignore
        {Object.keys(eventEffects).map(id=><Grid key={id}><CardItem cardId={id}/></Grid>)}
    </>
}
