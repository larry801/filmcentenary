import React from "react";
import {Grid, Paper, Typography} from "@material-ui/core";
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
    return <Grid container>
        <Typography>时代:{era}</Typography>
        <Typography>份额:{share}</Typography>
        <Grid item><BoardCardSlot region={legend.region}
                       isLegend={true} card={legend.card} comment={legend.comment}/></Grid>
        {normal.map((slot,i)=>
                <Grid item key={i}>
                    <BoardCardSlot region={slot.region} isLegend={false} card={slot.card}
                                   comment={slot.comment}/>
                </Grid>
            )}
    </Grid>
}
