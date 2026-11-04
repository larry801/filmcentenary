import React, {Suspense} from "react";
import {createRoot} from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import {Navigate, Route, Routes, BrowserRouter} from "react-router-dom";
import DrawerAppBar from "./components/drawer-app-bar";
import "./virginQueen/components/virgin-queen.css";

const Local4p = React.lazy(() => import("./components/single/4p"));
const Local2p = React.lazy(() => import("./components/single/2p"));
const MUICreateMatch = React.lazy(() => import("./components/create-match"));
const JoinPage = React.lazy(() => import("./components/join"));
const DenseTable = React.lazy(() => import("./components/card-table"));
const AboutPage = React.lazy(() => import("./components/about-page"));
const Lobby = React.lazy(() => import("./components/lobby"));
const Local = React.lazy(() => import("./songJinn/components/local"));
const LocalVirginQueen = React.lazy(() => import("./virginQueen/components/local"));

const RouteFallback = () => (
    <Box sx={{display: 'flex', justifyContent: 'center', p: 4}}>
        <CircularProgress/>
    </Box>
);

const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
    <BrowserRouter>
        <CssBaseline/>
        <DrawerAppBar/>
        <Suspense fallback={<RouteFallback/>}>
            <Routes>
                <Route path="/lobby" element={<Lobby/>}/>
                <Route path="/" element={<MUICreateMatch gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/songJinn" element={<MUICreateMatch gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/virginQueen" element={<MUICreateMatch gameName={"virginQueen"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/cards" element={<DenseTable/>}/>
                <Route path="/about" element={<AboutPage/>}/>
                <Route path="/join/film/:matchID/:player/:credential" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/film/:matchID/:player" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/songJinn/:matchID/:player/:credential" element={<JoinPage gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/songJinn/:matchID/:player" element={<JoinPage gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/virginQueen/:matchID/:player/:credential" element={<JoinPage gameName={"virginQueen"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/virginQueen/:matchID/:player" element={<JoinPage gameName={"virginQueen"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/:matchID/:player/:credential" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/join/:matchID/:player" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
                <Route path="/local" element={<Local/>}/>
                <Route path="/localVQ" element={<LocalVirginQueen/>}/>
                <Route path="/localVQ/tutorial" element={<LocalVirginQueen initialScenario="tutorial"/>}/>
                <Route path="/local2p" element={<Local2p/>}/>
                <Route path="/local4p" element={<Local4p/>}/>
                <Route path="*" element={<Navigate replace to="/"/>}/>
            </Routes>
        </Suspense>
    </BrowserRouter>
);

