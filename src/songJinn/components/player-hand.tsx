import React, {useState} from "react";
import {Ctx, PlayerID} from "boardgame.io"
import Grid from "@mui/material/Grid";
import ChoiceDialog from "../../components/modals";
import {ChooseUnitsDialog} from "./recruit";
import {
    BaseCardID,
    CityID,
    General,
    JinnBaseCardID,
    Country,
    Nations,
    SongBaseCardID,
    SongJinnGame
} from "../constant/general";

import Button from "@mui/material/Button";
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from "@mui/material/Typography";

import {
    canSendLetter,
    cityIsBesieged,
    getCardLabel,
    getCityText,
    getCountryById,
    getDispatchDsts,
    getDispatchableGenerals,
    getFullDesc,
    getGeneralNameByCountry,
    heYiCities,
    optionToPlace,
    pid2ctr,
    placeToOption,
    placeToStr,
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
    // 贴军：先选牌，再选目标城市，最后选要贴军的部队
    const [tieJunCard, setTieJunCard] = useState<BaseCardID | null>(null);
    const [tieJunCity, setTieJunCity] = useState<CityID | null>(null);
    const tieJunCityDialog = <ChoiceDialog
        callback={(c) => {
            setTieJunCity(c as unknown as CityID);
        }}
        choices={G.jinn.cities.filter(cid => !cityIsBesieged(G, cid)).map(cid => {
            return {
                label: getCityText(cid),
                value: cid,
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""}
        show={isActive && inPhase && tieJunCard !== null && tieJunCity === null}
        title={"选择贴军的目标城市（不能是被围困的城市）"} toggleText={"选择贴军城市"}
        initial={false}/>
    const tieJunUnitsDialog = <ChooseUnitsDialog
        callback={(u) => {
            if (tieJunCard === null || tieJunCity === null) {
                return;
            }
            moves.tieJun({card: tieJunCard, city: tieJunCity, units: u});
            setTieJunCard(null);
            setTieJunCity(null);
        }}
        max={[...G.jinn.standby]} initUnits={G.jinn.standby.map(() => 0)}
        show={isActive && inPhase && tieJunCard !== null && tieJunCity !== null}
        title={"选择要贴军的预备部队"} toggleText={"选择贴军部队"}
        initial={false} country={Country.JINN} />
    // 派遣（规则 7.5）：先选牌，再选要派遣的将领，最后选目标区域
    const [paiQianCard, setPaiQianCard] = useState<BaseCardID | null>(null);
    const [paiQianGeneral, setPaiQianGeneral] = useState<General | null>(null);
    const dispatchableGenerals = getDispatchableGenerals(G, pid);
    const dispatchDsts = getDispatchDsts(G, pid);
    const paiQianGeneralDialog = <ChoiceDialog
        callback={(g) => {
            setPaiQianGeneral(parseInt(g) as General);
        }}
        choices={dispatchableGenerals.map(gen => {
            return {
                label: getGeneralNameByCountry(pid2ctr(pid), gen),
                value: gen.toString(),
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""}
        show={isActive && inPhase && paiQianCard !== null && paiQianGeneral === null}
        title={"选择要派遣的将领"} toggleText={"选择派遣将领"}
        initial={false}/>
    const paiQianDstDialog = <ChoiceDialog
        callback={(c) => {
            if (paiQianCard === null || paiQianGeneral === null) {
                return;
            }
            const dst = optionToPlace(c);
            if (dst === null) {
                console.log(`${c}|cannot|convertToPlace`);
                return;
            }
            moves.moveGeneral({dst: dst, general: paiQianGeneral, country: pid2ctr(pid)});
            setPaiQianCard(null);
            setPaiQianGeneral(null);
        }}
        choices={dispatchDsts.map(p => {
            return {
                label: placeToStr(p),
                value: placeToOption(p),
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""}
        show={isActive && inPhase && paiQianCard !== null && paiQianGeneral !== null}
        title={"选择派遣的目标（本方军团所在的区域或关隘）"} toggleText={"选择派遣目标"}
        initial={false}/>
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
                    <Grid key={`grid-1-${cid}`} container size={detail ? 8 : 12}>
                        <Typography key={`summary-text-${cid}`}>{getCardLabel(cid)}</Typography>
                    </Grid>
                    {detail && <Grid key={`grid-2-${cid}`} container size={8}>
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
                        disabled={!(isActive && inPhase) || dispatchableGenerals.length === 0}
                        onClick={() => {
                            setPaiQianGeneral(null);
                            setPaiQianCard(cid);
                            moves.paiQIan(cid);
                        }}
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
                            onClick={() => {
                                setTieJunCity(null);
                                setTieJunCard(cid);
                            }}
                            disabled={!(isActive && inPhase)}
                        >贴军</Button>
                    }
                </AccordionDetails>

            </Accordion>
        })}

        {tieJunCityDialog}
        {tieJunUnitsDialog}
        {paiQianGeneralDialog}
        {paiQianDstDialog}
    </Grid>

}