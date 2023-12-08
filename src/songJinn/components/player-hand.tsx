import React from "react";
import {Ctx, PlayerID} from "boardgame.io"
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {Country, Nations, CardID} from "../constant/general";

import {playerById, getCountryById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getFullDesc, sjCardById} from "../constant/cards";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Typography from "@material-ui/core/Typography";

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

    const inPhase = ctx.phase === 'action';
    const player = playerById(G, pid);
    const hand = player.hand;

    return <Grid container>
        <ChoiceDialog
            callback={(cid: string) => moves.letter({nation: cid, card: dipCard[0]})}
            choices={
                Nations.map((c) => {
                    return {
                        label: c,
                        value: c,
                        disabled: false,
                        hidden: false,
                    }
                })}
            defaultChoice={Nations[0]}
            show={isActive && dipChosen}
            title={"请选择国家递交国书"}
            toggleText={"外交"}
            initial={true}
        />
        {hand.map((cid, idx) => <Accordion expanded={expanded === idx} onChange={() => setExpanded(idx)}
                                           key={`playerHand-${cid}`}>
            <AccordionSummary key={`summary-${cid}`}>
                <Typography key={`summary-text-${cid}`}>{sjCardById(cid).name}|{sjCardById(cid).op}</Typography>
                {getFullDesc(sjCardById(cid))}

            </AccordionSummary>
            <AccordionDetails>
                    <Button
                        disabled={!(isActive && inPhase)}
                        onClick={() => moves.op(cid)}
                    >征募和进军</Button>
                    <Button
                        disabled={!(isActive && inPhase)}
                        onClick={() => moves.cardEvent(cid)}
                    >事件</Button>
                    <Button
                        disabled={!(isActive && inPhase)}
                        onClick={() => moves.paiQIan(cid)}
                    >派遣</Button>
                    <Button
                        disabled={!(isActive && inPhase)}
                        onClick={() => {
                            setDipChosen(true);
                            // @ts-ignore
                            setDipCard([cid]);
                        }}
                    >外交</Button>
                    <Button
                        disabled={!(isActive && inPhase)}
                        onClick={() => moves.developCard(cid)}
                    >发展</Button>
                    {getCountryById(pid) === Country.SONG ? <Button
                        disabled={!(isActive && inPhase)}
                    >和议</Button> : <Button
                        onClick={() => moves.tieJun(cid)}
                        disabled={!(isActive && inPhase)}
                    >贴军</Button>}
            </AccordionDetails>
        </Accordion>)}
    </Grid>

}