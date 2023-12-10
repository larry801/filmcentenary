import React from "react";
import Grid from "@material-ui/core/Grid";
import {SongJinnGame} from "../constant/general";

export interface IMarchProps {
    G: SongJinnGame,
    moves: Record<string, (...args: any[]) => void>;
}

export const March = ({G, moves}: IMarchProps) => {
    return <Grid>

    </Grid>
}