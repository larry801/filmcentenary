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

const rootElement = document.getElementById("root");

render(
    <BrowserRouter>
        <CssBaseline/>
        <DrawerAppBar/>
        <Switch>
            <Route exact path="/">
                <MUICreateMatch serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/cards">
                <DenseTable/>
            </Route>
            <Route exact path="/about">
                <AboutPage/>
            </Route>
            <Route exact path="/join/:matchID/:player/:credential">
                <JoinPage serverURL={`${window.location.protocol}//${window.location.host}`}/>
            </Route>
            <Route exact path="/join/:matchID/:player">
                <JoinPage serverURL={`${window.location.protocol}//${window.location.host}`}/>
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

