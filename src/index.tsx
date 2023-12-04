import React from "react";
import {render} from "react-dom";
import CssBaseline from "@material-ui/core/CssBaseline";
import {Redirect, Route, Switch, BrowserRouter} from "react-router-dom";
import DrawerAppBar from "./components/drawer-app-bar";
import Local4p from "./components/single/4p";
import Local2p from "./components/single/2p";
import MUICreateMatch from "./components/create-match";
import JoinPage from "./components/join";
import DenseTable from "./components/card-table";
import AboutPage from "./components/about-page";
import Lobby from "./components/lobby";
import {FilmCentenaryGame} from "./Game";

const rootElement = document.getElementById("root");

render(
    <BrowserRouter>
        <CssBaseline/>
        <DrawerAppBar/>
        <Switch>
            <Route exact path="/lobby">
                <Lobby/>
            </Route>
            <Route exact path="/">
                <MUICreateMatch gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/songjinn">
                <MUICreateMatch gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/cards">
                <DenseTable/>
            </Route>
            <Route exact path="/about">
                <AboutPage/>
            </Route>
            <Route exact path="/join/film/:matchID/:player/:credential">
                <JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/join/film/:matchID/:player">
                <JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/join/songjinn/:matchID/:player/:credential">
                <JoinPage gameName={"songjinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/join/songjinn/:matchID/:player">
                <JoinPage gameName={"songjinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/join/:matchID/:player/:credential">
                <JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/join/:matchID/:player">
                <JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/local2p">
                <Local2p/>
            </Route>
            <Route exact path="/local4p">
                <Local4p/>
            </Route>
            <Route path="*">
                <Redirect to="/"/>
            </Route>
        </Switch>
    </BrowserRouter>
    , rootElement
);

