import * as React from "react";
import {render} from "react-dom";

import CssBaseline from "@material-ui/core/CssBaseline";
import CircularProgress from "@material-ui/core/CircularProgress";
import {Redirect, Route, Switch, BrowserRouter} from "react-router-dom";
import DrawerAppBar from "./components/drawer-app-bar";

const MUICreateMatch = React.lazy(async ()=> import("./components/create-match"));
const JoinPage = React.lazy(async ()=> import("./components/join"));
const DenseTable = React.lazy(async ()=> import("./components/cardreference"));
const Local4p = React.lazy(async ()=> import("./components/local/2p"));

const LoadingFallback  = () => <CircularProgress/>

const rootElement = document.getElementById("root");
render(
    <BrowserRouter>
        <CssBaseline/>
        <DrawerAppBar/>
        <Switch>
            <Route exact path="/" >
                <React.Suspense fallback={<LoadingFallback/>}>
                    <MUICreateMatch serverURL={`${window.location.protocol}//${window.location.host}`}/>
                </React.Suspense>
            </Route>
            <Route exact path="/cards">
                <React.Suspense fallback={<LoadingFallback/>}>
                    <DenseTable />
                </React.Suspense>
            </Route>
            <Route exact path="/join/:matchID/:player">
                <React.Suspense fallback={<LoadingFallback/>}>
                    <JoinPage serverURL={`${window.location.protocol}//${window.location.host}`}/>
                </React.Suspense>
            </Route>
            <Route exact path="/local4p">
                <React.Suspense fallback={<LoadingFallback/>}>
                    <Local4p />
                </React.Suspense>
            </Route>

            <Route path="*">
                <Redirect to="/"/>
            </Route>
        </Switch>
    </BrowserRouter>, rootElement
);

