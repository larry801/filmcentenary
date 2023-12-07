import React from "react";
import {Ctx, PlayerID} from "boardgame.io"
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {Country, Nations, CardID} from "../constant/general";

import {getStateById, playerById, getCountryById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {sjCardById} from "../constant/cards";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';

export interface IPlayerHandProps {
    G: SongJinnGame,
    ctx: Ctx,
    isActive: boolean,
    pid: PlayerID,
    moves: Record<string, (...args: any[]) => void>;
}

export const SJPlayerHand = ({G, ctx, pid, isActive, moves}: IPlayerHandProps) => {
    const [expanded, setExpanded] = React.useState(0);
    const [dipCard, setDipCard] = React.useState([]);
    const [dipChosen, setDipChosen] = React.useState(false);

    const player = playerById(G, pid);
    const hand = player.hand;
    const troops = getStateById(G, pid).troops;
    return <Grid>
        {troops.map((t, idx)=><Accordion expanded={expanded===idx} onChange={() => setExpanded(idx)} key={`troop-${idx}`}>
            <AccordionSummary></AccordionSummary>
        </Accordion>)}
    </Grid>
}