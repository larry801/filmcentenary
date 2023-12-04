import React from "react";
import {BoardProps} from "boardgame.io/react";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {IG} from "../../types/setup";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";

export const SongJinnBoard = ({
                                       G,
                                       log,
                                       ctx,
                                       events,
                                       moves,
                                       undo,
                                       redo,
                                       matchData,
                                       matchID,
                                       playerID,
                                       isActive,
                                       isMultiplayer,
                                       isConnected
                                   }: BoardProps<SongJinnGame>) => {
    return <ErrorBoundary>
        <Grid>

        </Grid>
    </ErrorBoundary>
}