import React from "react";
import {Ctx, PlayerID} from "boardgame.io"
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";

import {getStateById, playerById, getCountryById, unitsToString} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {sjCardById} from "../constant/cards";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import {placeUnit} from "../moves";
import {placeToStr} from "../util/text";
import {ProvinceID, RegionID} from "../constant/general";
import ChoiceDialog from "../../components/modals";
import {getProvinceById} from "../constant/province";
import {getRegionById} from "../constant/regions";

export interface IPlayerHandProps {
    G: SongJinnGame,
    ctx: Ctx,
    isActive: boolean,
    pid: PlayerID,
    moves: Record<string, (...args: any[]) => void>;
}

const TroopOperation = ({G, ctx, pid, isActive, moves}: IPlayerHandProps) => {
    const [expanded, setExpanded] = React.useState(0);
    const [dipCard, setDipCard] = React.useState([]);
    const [chooseProvince, setChooseProvince] = React.useState(false);
    const [prov, setProv] = React.useState(ProvinceID.JINGJILU);
    const [chooseUnit, setChooseUnit] = React.useState(false);

    const player = playerById(G, pid);
    const troops = getStateById(G, pid).troops;
    return <Grid>
        <Button>新增部队</Button>
        <ChoiceDialog
            callback={(c) => setProv(c as ProvinceID)} choices={
            Object.values(ProvinceID).map(p => {
                return {
                    label: p,
                    value: p,
                    disabled: false,
                    hidden: false
                }
            })}
            defaultChoice={""} show={chooseProvince} title={"选择目标路"} toggleText={"选择目标路"} initial={true}/>
        <ChoiceDialog
            callback={(c) => {
                const regID = parseInt(c) as RegionID;
                moves.placeUnit({
                    dst:regID,
                    units:[]
                })
            }}
            choices={getProvinceById(prov).regions.map(r=>{
                const reg =getRegionById(r);
                return {
                    label:reg.name,
                    value:r.toString(),
                    hidden:false,
                    disabled:false
                }
            })} defaultChoice={""} show={isActive && chooseUnit} title={"选择目标区域"}
            toggleText={"选择目标区域"} initial={true}/>
        {troops.map((t, idx) => <Accordion expanded={expanded === idx} onChange={() => setExpanded(idx)}
                                           key={`troop-${idx}`}>
            <AccordionSummary>{placeToStr(t.p)}|{unitsToString(t.u)}</AccordionSummary>
            <AccordionDetails>
                <Button>进军</Button>
                <Button onClick={() => {
                    setChooseProvince(true)
                }}>移动</Button>
                <Button onClick={() => {
                    setChooseProvince(true)
                }}>受创</Button>
                <Button>补充</Button>
                <Button>放置</Button>
                <Button>消灭</Button>
            </AccordionDetails>
        </Accordion>)}
    </Grid>
}

export default TroopOperation;