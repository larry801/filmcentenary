import React, {useState} from "react";
import {Ctx, PlayerID} from "boardgame.io"
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {JinnBaseCardID, Country, Nations, SongBaseCardID, SongJinnGame} from "../constant/general";

import Button from "@material-ui/core/Button";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import Typography from "@material-ui/core/Typography";

import {
    canSendLetter,
    getCardLabel,
    getCityText,
    getCountryById,
    getFullDesc,
    heYiCities,
    pid2ctr,
    playerById,
    sjCardById
} from "../util";
import {actualStage} from "../../game/util";

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
    const [detail, setDetail] = useState(false);
    const inPhase = ctx.phase === 'action';
    const player = playerById(G, pid);
    const hand = player.hand;
    const [heYiChosen, setHeYiChosen] = useState(false);
    const [heYiCard, setHeYiCard] = useState([SongBaseCardID.S01, JinnBaseCardID.J01]);
    return <Grid container>
        <Button fullWidth onClick={() => {
            setDetail(!detail)
        }}>
            {detail ? "简化" : "详细"}
        </Button>

        <ChoiceDialog
            callback={(c) => {
                if (heYiChosen) {
                    setHeYiChosen(false);
                    moves.heYi({card: heYiCard[0], city: c});
                } else {
                    moves.freeHeYi(c);
                }
            }}
            choices={heYiCities(G).map(c => {
                return {label: getCityText(c), value: c, hidden: false, disabled: false}
            })} defaultChoice={""} show={isActive && (heYiChosen || actualStage(G, ctx) === 'freeHeYi')}
            title={"选择要割让的城市"} toggleText={"割让城市"}
            initial={true}/>

        <ChoiceDialog
            callback={(cid: string) => moves.letter({nation: cid, card: dipCard[0]})}
            choices={
                Nations.map((c) => {
                    return {
                        label: c,
                        value: c,
                        disabled:  !canSendLetter(G, pid2ctr(pid),c),
                        hidden: G.removedNation.includes(c),
                    }
                })}
            defaultChoice={Nations[0]}
            show={isActive && dipChosen}
            title={"请选择国家递交国书"}
            toggleText={"外交"}
            initial={true}
        />
        {hand.map((cid, idx) => {
            const card = sjCardById(cid);
            return <Accordion expanded={expanded === idx} onChange={() => setExpanded(idx)}
                              key={`playerHand-${cid}`}>
                <AccordionSummary key={`summary-${cid}`}>
                    <Grid key={`grid-1-${cid}`} item container xs={detail ? 8 : 12}>
                        <Typography key={`summary-text-${cid}`}>{getCardLabel(cid)}</Typography>
                    </Grid>
                    {detail && <Grid key={`grid-2-${cid}`} item container xs={8}>
                        {getFullDesc(card)}
                    </Grid>}

                </AccordionSummary>
                <AccordionDetails>
                    <Button
                        disabled={!(isActive && inPhase)}
                        onClick={() => moves.op(cid)}
                    >征募和进军</Button>
                    <Button
                        disabled={!(isActive && inPhase && card.pre(G, ctx))}
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
                    {
                        getCountryById(pid) === Country.SONG ? <Button
                            disabled={!(isActive && inPhase)}
                            onClick={
                                () => {
                                    setHeYiChosen(true);
                                    setHeYiCard([cid]);
                                }}
                        >和议</Button> : <Button
                            onClick={() => moves.tieJun(cid)}
                            disabled={!(isActive && inPhase)}
                        >贴军</Button>
                    }
                </AccordionDetails>

            </Accordion>
        })}
    </Grid>

}