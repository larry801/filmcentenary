import React from "react";
import {BoardProps} from "boardgame.io/react";
import {Ctx} from "boardgame.io"
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {Country, MountainPassID, OtherCountryID, RegionID, SJPlayer , DevelopChoice, accumulator, OtherCountries} from "../constant/general";
import {getPlanById} from "../constant/plan";
import {getStateById, playerById, getCountryById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";
import Typography from "@material-ui/core/Typography";
import {getCardById} from "./constant/cards";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';

export interface IPlayerHandProps {
    G: SongJinnGame,
    ctx: Ctx,
    hand: CardID[],
    isActive: boolean,
    moves: any,
}

export const playerHand = ({G, ctx, pid, isActive, moves}:IPlayerHandProps) => {

    const {expanded, setExpaned} = React.useState(null);
    const {dipCard, setDipCard} = React.useState(null);
    const inPhase = ctx.phase === 'action';
    const player = playerById(G, pid);
    const hand = player.hand; 
    const onPlayAsEvent = (cid: CardID) => moves.eventCard(cid);


    return <Grid>
        <ChoiceDialog
            callback={(cid: string) => moves.letter({country:cid,card:dipCard})}
            choices={
             OtherCountries.map((c) => {
                    return {
                        label: c,
                        value: c,
                        disabled: false,
                        hidden: false,
                    }
                })}
            default={OtherCountries[0]}
            show={dipCard !== null && isActive}
            title={"请选择国家递交国书"}
            toggleText={"外交"}
            initial={true}
        />
        {hand.map(cid=><Accordion expanded={expanded === cid} onChange={()=>setExpaned(cid)} key={`playerHand-${id}`}>
            <AccordionSummary key={`summary-${id}`}>{getCardById(id).name}|{getCardById(id).op}</AccordionSummary>
            <AccordionDetails>
                        <Button
                            disabled={!(isActive && inPhase)}
                            onClick={() => moves.op(id)}
                        >征募和进军</Button>
                        <Button
                            disabled={!(isActive && inPhase)}
                            onClick={() => onPlayAsEvent(cid)}
                        >事件</Button>
                        <Button
                            disabled={!(isActive && inPhase)}
                        >派遣</Button>
                        <Button
                            disabled={!(isActive && inPhase)}
                            onClick={() => setDipCard(cid)}
                        >外交</Button>
                        <Button
                            disabled={!(isActive && inPhase)}
                            onClick={() => moves.develop(id)}
                        >发展</Button>
                        {getStateById(pid) === Country.SONG ? <Button
                                disabled={!(isActive && inPhase)}
                            >和议</Button> :
                            <Button
                                disabled={!(isActive && inPhase)}
                            >贴军</Button>}
                    </AccordionDetails>
        </Accordion>)}
    </Grid>
    
}