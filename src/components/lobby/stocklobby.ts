import React from "react";
import {Client} from "boardgame.io/react";

import {SocketIO} from "boardgame.io/multiplayer";
import {LobbyConnection} from "../../api/connection";

const LobbyPhases = {
    ENTER: 'enter',
    PLAY: 'play',
    LIST: 'list',
};

export interface IStockLobbyProps {
    gameComponents:[],
    lobbyServer:string,
    gameServer:string,
    clientFactory:()=>void,
    refreshInterval:number,
    debug:boolean,
}


export const Lobby = ({})=>{

}
