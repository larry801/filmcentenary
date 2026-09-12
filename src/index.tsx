import React from "react";
import {createRoot} from "react-dom/client";
import CssBaseline from "@mui/material/CssBaseline";
import {Navigate, Route, Routes, BrowserRouter} from "react-router-dom";
import DrawerAppBar from "./components/drawer-app-bar";
import Local4p from "./components/single/4p";
import Local2p from "./components/single/2p";
import MUICreateMatch from "./components/create-match";
import JoinPage from "./components/join";
import DenseTable from "./components/card-table";
import AboutPage from "./components/about-page";
import Lobby from "./components/lobby";
import Local from "./songJinn/components/local";

const rootElement = document.getElementById("root")!;

createRoot(rootElement).render(
    <BrowserRouter>
        <CssBaseline/>
        <DrawerAppBar/>
        <Routes>
            <Route path="/lobby" element={<Lobby/>}/>
            <Route path="/" element={<MUICreateMatch gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/songJinn" element={<MUICreateMatch gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/cards" element={<DenseTable/>}/>
            <Route path="/about" element={<AboutPage/>}/>
            <Route path="/join/film/:matchID/:player/:credential" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/join/film/:matchID/:player" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/join/songJinn/:matchID/:player/:credential" element={<JoinPage gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/join/songJinn/:matchID/:player" element={<JoinPage gameName={"songJinn"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/join/:matchID/:player/:credential" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/join/:matchID/:player" element={<JoinPage gameName={"film"} serverURL={`${window.location.protocol}//${window.location.host}`}/>}/>
            <Route path="/local" element={<Local/>}/>
            <Route path="/local2p" element={<Local2p/>}/>
            <Route path="/local4p" element={<Local4p/>}/>
            <Route path="*" element={<Navigate replace to="/"/>}/>
        </Routes>
    </BrowserRouter>
);

