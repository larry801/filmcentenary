import * as React from "react";
import {render} from "react-dom";

import {Client} from "boardgame.io/react";
import {FilmCentenaryGame} from "./Game";
import {FilmCentenaryBoard} from "./components/board";
import Grid from "@material-ui/core/Grid"
import CssBaseline from "@material-ui/core/CssBaseline";
import {Local} from "boardgame.io/multiplayer";
import Lobby from './components/lobby'
import {DenseTable} from "./components/cardreference";
import {Redirect, Route, Switch, BrowserRouter} from "react-router-dom";
import {DrawerAppBar} from "./components/drawer-app-bar";
import {JoinPage} from "./components/join";
import {MUICreateMatch} from "./components/create-match";

const FilmClient4pSingle = Client(
    {
        numPlayers: 4,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: true,
    })
const FilmClient3pSingle = Client(
    {
        numPlayers: 3,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: true,
    })
const FilmClient2pSingle = Client(
    {
        numPlayers: 2,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: true,
    }
);
const FilmClient2p = Client(
    {
        numPlayers: 2,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        // @ts-ignore
        multiplayer: new Local(),
    }
);
const FilmClient3p = Client(
    {
        numPlayers: 3,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        // @ts-ignore
        multiplayer: new Local(),
    }
);
const FilmClient4p = Client(
    {
        numPlayers: 4,
        game: FilmCentenaryGame,
        board: FilmCentenaryBoard,
        debug: false,
        // @ts-ignore
        multiplayer: new Local(),
    }
);
const SinglePlayer = () => <Grid container>
    <Grid item> <FilmClient2pSingle playerID='0'/></Grid>
</Grid>
const SinglePlayer3p = () => <Grid container>
    <Grid item> <FilmClient3pSingle playerID='0'/></Grid>
</Grid>
const SinglePlayer4p = () => <Grid container>
    <Grid item> <FilmClient4pSingle playerID='0'/></Grid>
</Grid>
const TwoPlayerLocal = () => <Grid container>
    <Grid item> <FilmClient2p playerID='0'/></Grid>
    <Grid item> <FilmClient2p playerID='1'/></Grid>
</Grid>
const ThreePlayerLocal = () => <Grid container>
    <Grid item> <FilmClient3p playerID='0'/></Grid>
    <Grid item> <FilmClient3p playerID='1'/></Grid>
    <Grid item> <FilmClient3p playerID='2'/></Grid>
</Grid>
const FourPlayerLocal = () => <Grid container>
    <Grid item> <FilmClient4p playerID='0'/></Grid>
    <Grid item> <FilmClient4p playerID='1'/></Grid>
    <Grid item> <FilmClient4p playerID='2'/></Grid>
    <Grid item> <FilmClient4p playerID='3'/></Grid>
</Grid>

const rootElement = document.getElementById("root");
render(
    <BrowserRouter>
        <CssBaseline/>
        <DrawerAppBar/>
        <Switch>
            <Route exact path="/" >
                <MUICreateMatch serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/cards" render={props => <DenseTable/>}/>
            <Route exact path="/single2p" render={props => <SinglePlayer/>}/>
            <Route exact path="/single3p" render={props => <SinglePlayer3p/>}/>
            <Route exact path="/single4p" render={props => <SinglePlayer4p />}/>
            <Route exact path="/2p" render={props => <TwoPlayerLocal/>}/>
            <Route exact path="/3p" render={props => <ThreePlayerLocal/>}/>
            <Route exact path="/4p" render={props => <FourPlayerLocal/>}/>
            <Route exact path="/join/:matchID/:player">
                <JoinPage serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route path="*">
                <Redirect to="/"/>
            </Route>
        </Switch>
    </BrowserRouter>, rootElement
);

