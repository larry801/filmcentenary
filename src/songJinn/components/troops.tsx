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
import {Country, ProvinceID, RegionID, UNIT_SHORTHAND} from "../constant/general";
import ChoiceDialog from "../../components/modals";
import {getProvinceById} from "../constant/province";
import {getRegionById} from "../constant/regions";
import CheckBoxDialog from "./choice";

export interface IPlayerHandProps {
    G: SongJinnGame,
    ctx: Ctx,
    isActive: boolean,
    pid: PlayerID,
    moves: Record<string, (...args: any[]) => void>;
}

enum TroopStep {
    START,
    PROVINCE,
    REGION,
    UNIT
}

const TroopOperation = ({G, ctx, pid, isActive, moves}: IPlayerHandProps) => {
    const [expanded, setExpanded] = React.useState(0);
    const [prov, setProv] = React.useState(ProvinceID.JINGJILU);
    const [reg, setReg] = React.useState(RegionID.R01);
    const [newStep, setNewStep] = React.useState(TroopStep.START);
    const [regions, setRegions] = React.useState([RegionID.R01])

    const player = playerById(G, pid);
    const troops = getStateById(G, pid).troops;
    const ctr = getCountryById(pid);
    const unitNames = ctr === Country.SONG ? UNIT_SHORTHAND[0] : UNIT_SHORTHAND[1];
    return <Grid>
        <Button variant={"contained"} fullWidth onClick={() => setNewStep(TroopStep.PROVINCE)}>新增部队</Button>
        <ChoiceDialog
            callback={(c) => {
                const newProv = c as ProvinceID;
                setRegions(getProvinceById(newProv).regions);
                setProv(newProv);
                setNewStep(TroopStep.REGION);
            }} choices={
            Object.values(ProvinceID).map(p => {
                return {
                    label: p,
                    value: p,
                    disabled: false,
                    hidden: false
                }
            })}
            defaultChoice={""} show={isActive && newStep === TroopStep.PROVINCE} title={"选择目标路"}
            toggleText={"选择目标路"} initial={true}/>
        <CheckBoxDialog
            callback={(c) => {
                const units = unitNames.map(() => 0);
                c.forEach(u => {
                    const idx = unitNames.indexOf(u);
                    units[idx] = 1;
                })
                moves.placeUnit({
                    dst: reg,
                    units: units
                })
                setNewStep(TroopStep.START);
            }}
            choices={unitNames.map(u => {
                return {
                    label: u,
                    value: u,
                    disabled: false,
                    hidden: false
                }
            })}
            show={isActive && newStep === TroopStep.UNIT}
            title={"选择兵种"} toggleText={"选择兵种"} initial={true}/>
        <ChoiceDialog
            callback={(c) => {
                const regID = parseInt(c) as RegionID;
                setReg(regID);

            }}
            choices={regions.map(r => {
                const reg = getRegionById(r);
                return {
                    label: reg.name,
                    value: r.toString(),
                    hidden: false,
                    disabled: false
                }
            })} defaultChoice={""} show={isActive && newStep === TroopStep.REGION} title={"选择目标区域"}
            toggleText={"选择目标区域"} initial={true}/>

        <ChoiceDialog callback={() => {
        }} choices={[]} defaultChoice={""} show={false} title={"选择受创单位"} toggleText={"单位"} initial={true}/>
        {troops.map((t, idx) => <Accordion expanded={expanded === idx} onChange={() => setExpanded(idx)}
                                           key={`troop-${idx}`}>
            <AccordionSummary>{placeToStr(t.p)}|{unitsToString(t.u)}</AccordionSummary>
            <AccordionDetails>
                <Button>进军</Button>
                <Button>移动</Button>
                <Button>受创</Button>
                <Button>补充</Button>
                <Button>放置</Button>
                <Button>消灭</Button>
            </AccordionDetails>
        </Accordion>)}
    </Grid>
}

export default TroopOperation;