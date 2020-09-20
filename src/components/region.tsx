import React from "react";
import {Paper, Typography} from "@material-ui/core";
import {ICardSlot, IRegionInfo} from "../types/core";
import {BoardProps} from "boardgame.io/react";

export const BoardCardSlot =({region,card,isLegend,comment}:ICardSlot)=>{
    return <>
        <Paper>
            {card===null? "":card.name}
        </Paper>
    </>
}

export const BoardRegion = (region:IRegionInfo)=>{
    const {era,share,legend,normal} = region;
    return <>
    <Paper>
        <Typography>时代:{era}</Typography>
        <Typography>份额:{share}</Typography>
        <BoardCardSlot region={legend.region}
                       isLegend={true} card={legend.card} comment={legend.comment}/>
        {normal.map(slot=>
            <BoardCardSlot region={slot.region} isLegend={false} card={slot.card} comment={slot.comment}/>
            )}
    </Paper>
    </>
}
