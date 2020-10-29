import React from "react";
import {Game} from "boardgame.io";

export interface ICreateMatchProps {
    games:Game[],
    createMatch:()=>void,
}

export const CreateMatch = ({createMatch,games}:ICreateMatchProps)=>{
    const [selected,setSelected] = React.useState(0);
    const [num,setNum] = React.useState(2);
}

export default CreateMatch;
