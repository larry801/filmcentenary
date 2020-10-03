import React, {useEffect} from "react";
import {Client} from "boardgame.io/react";
import {Prompt,useParams} from 'react-router-dom'
import {SocketIO} from "boardgame.io/multiplayer";
import {LobbyConnection} from "../../api/connection";
import {loadCredentials,saveCredentials} from "../../api/localStorage";
import {joinMatch} from "../../api/match";
import {PlayerID} from "boardgame.io";

const LobbyPhases = {
    ENTER: 'enter',
    PLAY: 'play',
    LIST: 'list',
};

export interface IStockLobbyProps {
    gameComponents:[],
    lobbyServer:string,
    matchID:string,
    player:PlayerID,
    gameServer:string,
    clientFactory:()=>void,
    refreshInterval:number,
    debug:boolean,
}


export const Lobby = ({refreshInterval,gameServer,lobbyServer,gameComponents,debug}:IStockLobbyProps)=>{
    const [credentials, setCredentials] = React.useState("");
    const [error, setError] = React.useState("");


}
