import React from "react";
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";

export interface IMarchProps {
    G: SongJinnGame,
    moves: Record<string, (...args: any[]) => void>;
}

export const March = ({G, moves}: IMarchProps) => {
    return <Grid>

    </Grid>
}