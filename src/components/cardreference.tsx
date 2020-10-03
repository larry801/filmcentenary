import React from "react";
import {BasicCardID, EventCardID, NoneBasicCardID} from "../types/core";
import {Typography, Grid} from "@material-ui/core";
import {cardEffectText} from "../game/util";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {effects} from "../constant/effects";

interface ICardItemProps {
 cardId:BasicCardID|EventCardID|NoneBasicCardID,
}

export const CardItem = ({cardId}:ICardItemProps)=>{

    useI18n(i18n)
    //const card = getCardById(cardId);
    const effText = ()=>{
        try{
            // @ts-ignore
            return  cardEffectText(cardId)
        }catch (e){

        }
    }

    return <div>
        <Typography>{
            // @ts-ignore
            i18n.card[cardId]
        } {cardId}</Typography>
        {/*<Typography>{i18n.pub.industryMarker} {card.industry}</Typography>*/}
        {/*<Typography>{i18n.pub.aestheticsMarker} {card.aesthetics}</Typography>*/}
        <Typography>{effText()}</Typography>
    </div>
}

export const CardList = () => {

    return <>

        {Object.keys(effects).map(id=><Grid item key={id} xs={12}><CardItem
            // @ts-ignore
            cardId={id}  /></Grid>)}
    </>
}
