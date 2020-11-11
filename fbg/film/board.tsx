import * as React from 'react';
import {IG} from "./types/setup";
import ScopedCssBaseline from '@material-ui/core/ScopedCssBaseline';
import { FilmCentenaryBoard } from './components/board';
import { IGameArgs } from 'gamesShared/definitions/game';
import {BoardProps} from "boardgame.io/react";
import Grid from '@material-ui/core/Grid';


type FBGBoardProps = BoardProps<IG> & {gameArgs?:IGameArgs};

export class Board extends React.Component<FBGBoardProps, {}> {
    render() {
        return <Grid container>
            <ScopedCssBaseline>
                <FilmCentenaryBoard  {...this.props} playerID={this.props.playerID}/>
            </ScopedCssBaseline>
        </Grid>
    }
}
