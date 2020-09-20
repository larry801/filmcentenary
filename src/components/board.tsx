import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardRegion} from "./region";
import {Typography} from "@material-ui/core";

export const FilmCentenaryBoard=({G,ctx,moves,isActive,playerID}:BoardProps<IG>)=>{

    return <>
        <Typography>区域</Typography>
        <BoardRegion {...G.regions[0]}/>
        <BoardRegion {...G.regions[1]}/>
        <BoardRegion {...G.regions[2]}/>
        <BoardRegion {...G.regions[3]}/>
    </>
}
