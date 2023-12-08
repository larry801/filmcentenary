import React, {useState} from "react";
import {Ctx, PlayerID} from "boardgame.io"
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";

import {getStateById, getCountryById, unitsToString, StrProvince, getMarchDst, optionToActualDst} from "../util/fetch";
import Button from "@material-ui/core/Button";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import {placeToStr} from "../util/text";
import {CityID, Country, isRegionID, ProvinceID, RegionID, UNIT_SHORTHAND} from "../constant/general";
import ChoiceDialog from "../../components/modals";
import {getProvinceById} from "../constant/province";
import {getRegionById} from "../constant/regions";
import CheckBoxDialog from "./choice";
import {ChooseUnitsDialog} from "./recruit";

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

enum MarchStep {
    TROOP,
    UNITS,
    TARGET
}

enum RemoveStep {
    TROOP,
    UNITS
}

enum PlaceStep {
    TROOP,
    UNITS
}

enum MoveStep {
    TROOP,
    PROVINCE,
    REGION
}

enum DeployStep {
    TROOP,
    UNITS
}

enum DeployNewStep {
    TROOP,
    CITY,
    UNITS
}

enum TakeDamageStep {
    TROOP,
    READY,
    STANDBY
}

const TroopOperation = ({G, pid, isActive, moves}: IPlayerHandProps) => {
    const [expanded, setExpanded] = React.useState(0);

    const pub = getStateById(G, pid);
    const troops = pub.troops;
    const ctr = getCountryById(pid);
    const unitNames = ctr === Country.SONG ? UNIT_SHORTHAND[0] : UNIT_SHORTHAND[1];


    const [removeStep, setRemoveStep] = React.useState(RemoveStep.TROOP);
    const [removeTroop, setRemoveTroop] = React.useState(0);

    const [deployStep, setDeployStep] = React.useState(DeployStep.TROOP);
    const [deployTroop, setDeployTroop] = useState(0);

    const depUnitDialog = <ChooseUnitsDialog
        callback={(u) => {
            moves.deploy({
                units: u,
                idx: deployTroop
            });
            setDeployStep(DeployStep.TROOP);
        }}
        max={[...pub.ready]}
        initUnits={unitNames.map(() => 0)}
        show={isActive && deployStep === DeployStep.UNITS}
        title={"选择补充部队"} toggleText={"补充"}
        initial={true} country={ctr}
    />


    const [takeDamageStep, setTakeDamageStep] = React.useState(TakeDamageStep.TROOP);
    const [takeDamageTroop, setTakeDamageTroop] = useState(0);
    const [readyUnits, setReadyUnits] = React.useState([0]);

    const takeDamageReadyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setTakeDamageStep(TakeDamageStep.STANDBY)
            setReadyUnits(u)
        }} max={troops[takeDamageTroop].u} initUnits={unitNames.map(() => 0)}
        show={isActive && takeDamageStep === TakeDamageStep.READY} title={"选择被击溃的部队"}
        toggleText={"击溃"} initial={true} country={ctr}/>

    const takeDamageStandbyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setTakeDamageStep(TakeDamageStep.TROOP)
            moves.takeDamage({
                src: troops[takeDamageTroop].p,
                c: ctr,
                idx: takeDamageTroop,
                ready: readyUnits,
                standby: u
            })
        }} max={troops[takeDamageTroop].u} initUnits={unitNames.map(() => 0)}
        show={isActive && takeDamageStep === TakeDamageStep.STANDBY} title={"选择要被消灭的部队"}
        toggleText={"消灭部队"} initial={true} country={ctr}/>

    const [moveTroop, setMoveTroop] = useState(0);
    const [moveStep, setMoveStep] = useState(MoveStep.TROOP);

    const moveProvDialog = <ChoiceDialog
        callback={(c) => {
            const newProv = StrProvince.get(c);
            if (newProv === undefined) {
                console.log(`${c}|cannot|convertToProv`);
                return;
            }
            const province = getProvinceById(newProv);
            const newRegions = province.regions;
            setRegions(newRegions);
            setMoveStep(MoveStep.REGION);
        }} choices={
        Object.values(ProvinceID).map(p => {
            return {
                label: p,
                value: p,
                disabled: false,
                hidden: false
            }
        })} defaultChoice={""}
        show={isActive && moveStep === MoveStep.PROVINCE}
        title={"选择移动目标路"} toggleText={"选择移动到的路"} initial={true}/>


    const [newTroopRegion, setNewTroopRegion] = React.useState(RegionID.R01);
    const [newStep, setNewStep] = React.useState(TroopStep.START);
    const [regions, setRegions] = React.useState([RegionID.R01]);

    const regionDialog = <ChoiceDialog
        callback={(c) => {
            const regID = parseInt(c) as RegionID;
            if (newStep === TroopStep.REGION) {
                setNewTroopRegion(regID);
                setNewStep(TroopStep.UNIT);
            }
            if (moveStep === MoveStep.REGION) {
                setMoveStep(MoveStep.TROOP);
                moves.moveTroop({
                    src: troops[moveTroop],
                    idx: moveTroop,
                    dst: regID
                })
            }
        }}
        choices={regions.map(r => {
            const reg = getRegionById(r);
            return {
                label: reg.name,
                value: r.toString(),
                hidden: false,
                disabled: false
            }
        })} defaultChoice={""} show={isActive && newStep === TroopStep.REGION || moveStep === MoveStep.REGION}
        title={"选择目标区域"}
        toggleText={"选择目标区域"} initial={true}/>;

    const unitDialog = <CheckBoxDialog
        callback={(c) => {
            const units = unitNames.map(() => 0);
            c.forEach(u => {
                const idx = unitNames.indexOf(u);
                units[idx] = 1;
            })
            moves.placeUnit({
                dst: newTroopRegion,
                units: units,
                country: ctr
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
        title={"选择兵种"} toggleText={"选择兵种"} initial={true}/>;

    const provDialog = <ChoiceDialog
        callback={(c) => {
            const newProv = StrProvince.get(c);
            if (newProv === undefined) {
                console.log(`${c}|cannot|convertToProv`);
                return;
            }
            const province = getProvinceById(newProv);
            const newRegions = province.regions;
            setRegions(newRegions);
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
        toggleText={"选择目标路"} initial={true}/>;


    const [marchStep, setMarchStep] = React.useState(MarchStep.TROOP);
    const [marchUnits, setMarchUnits] = React.useState([0, 0, 0]);
    const [marchTroop, setMarchTroop] = React.useState(0);

    const marchRegionDialog = <ChoiceDialog
        callback={(r) => {
            moves.march({
                src: troops[marchTroop].p,
                dst: optionToActualDst(r),
                units: marchUnits,
                country: ctr,
                idx: marchTroop
            });
            setMarchStep(MarchStep.TROOP);
        }}
        choices={getMarchDst(G, troops[marchTroop].p).map(r => {
            if (r == null) {
                return {
                    label: "",
                    value: "",
                    hidden: true,
                    disabled: true
                }
            }
            if (isRegionID(r)) {
                const reg = getRegionById(r);
                return {
                    label: reg.name,
                    value: r.toString(),
                    hidden: false,
                    disabled: false
                }
            } else {
                return {
                    label: r.toString(),
                    value: r.toString(),
                    hidden: false,
                    disabled: false
                }
            }

        })}
        defaultChoice={""}
        show={isActive && marchStep === MarchStep.TARGET}
        title={"选择目标区域"}
        toggleText={"选择目标区域"}
        initial={true}/>;


    const marchDialog = <ChooseUnitsDialog
        callback={(c) => {
            setMarchUnits(c);
            setMarchStep(MarchStep.TARGET)
        }} max={[...troops[marchTroop].u]} initUnits={[...troops[marchTroop].u]}
        show={isActive && marchStep === MarchStep.UNITS}
        popAfterShow={true}
        title={"选择进军部队"} toggleText={"选择进军部队"} initial={true} country={ctr}/>

    const [deployNewStep, setDeployNewStep] = React.useState(DeployNewStep.TROOP);
    const [deployNewCity, setDeployNewCity] = React.useState(CityID.DaTong);

    const deployNewCityDialog = <ChoiceDialog
        callback={(c) => {
            setDeployNewCity(c as unknown as CityID);
            setDeployNewStep(DeployNewStep.UNITS);
        }} choices={pub.cities.map(c => {
        return {
            label: c.toString(),
            value: c.toString(),
            hidden: false,
            disabled: false
        }
    })} defaultChoice={""}
        show={isActive && deployNewStep === DeployNewStep.CITY} title={"补充城市"} toggleText={"补充城市"}
        initial={true}/>

    const deployNewCityUnitsDialog = <ChooseUnitsDialog
        callback={(u) => {
            moves.deploy({city: deployNewCity, units: u});
            setDeployNewStep(DeployNewStep.TROOP);
        }}
        max={pub.ready} initUnits={unitNames.map(() => 0)}
        show={isActive && deployNewStep === DeployNewStep.UNITS} title={"补充部队"} toggleText={"补充部队"}
        initial={true} country={ctr}
    />

    const removeUnitDialog = <ChooseUnitsDialog
        callback={(u) => {
            setRemoveStep(RemoveStep.TROOP)
            moves.removeUnit({
                src: troops[removeTroop].p,
                units: u,
                idx: removeTroop,
                country: ctr
            })
        }} max={troops[removeTroop].u} initUnits={unitNames.map(() => 0)}
        show={isActive && removeStep === RemoveStep.UNITS} title={"选择要消灭的部队"}
        toggleText={"消灭部队"} initial={true} country={ctr}/>

    const [placeStep, setPlaceStep] = useState(PlaceStep.TROOP);
    const [placeTroop, setPlaceTroop] = useState(0);

    const placeUnitsDialog = <ChooseUnitsDialog
        callback={(u) => {
            setPlaceStep(PlaceStep.TROOP)
            moves.placeTroop({
                units: u,
                idx: placeTroop,
                country: ctr
            })
        }} max={[...pub.standby]} initUnits={unitNames.map(() => 0)}
        show={isActive && placeStep === PlaceStep.UNITS} title={"选择要放置的的部队"}
        toggleText={"放置部队"} initial={true} country={ctr}/>


    return <Grid item container xs={12}>
       <Grid item xs={12}>
           <Button variant={"contained"} fullWidth onClick={() => setNewStep(TroopStep.PROVINCE)}>放置部队</Button>
           <Button variant={"contained"} fullWidth onClick={() => setDeployNewStep(DeployNewStep.CITY)}>补充空城市</Button>
           {provDialog}
           {unitDialog}
           {regionDialog}

           {marchDialog}
           {marchRegionDialog}

           {deployNewCityDialog}
           {deployNewCityUnitsDialog}

           {depUnitDialog}

           {takeDamageReadyDialog}
           {takeDamageStandbyDialog}

           {removeUnitDialog}

           {moveProvDialog}

           {placeUnitsDialog}
       </Grid>

        {troops.map((t, idx) => <Grid item xs={6} key={`troop-grid-${idx}`}>
            <Accordion expanded={expanded === idx} onChange={() => setExpanded(idx)}
                       key={`troop-${idx}`}>
                <AccordionSummary>{placeToStr(t.p)}|{unitsToString(t.u)}</AccordionSummary>
                <AccordionDetails>
                    <button onClick={
                        () => {
                            setMarchTroop(idx);
                            setMarchStep(MarchStep.UNITS);
                        }
                    }>进军</button>
                    <button onClick={
                        () => {
                            setMoveTroop(idx);
                            setMoveStep(MoveStep.PROVINCE)
                        }
                    }>移动</button>
                    <button onClick={
                        () => {
                            setTakeDamageStep(TakeDamageStep.READY);
                            setTakeDamageTroop(idx);
                        }
                    }>受创</button>
                    <button onClick={
                        () => {
                            setDeployStep(DeployStep.UNITS);
                            setDeployTroop(idx);
                        }
                    }>补充</button>
                    <button onClick={
                        () => {
                            setPlaceStep(PlaceStep.UNITS);
                            setPlaceTroop(idx);
                        }
                    }>放置</button>
                    <button onClick={
                        () => {
                            setRemoveStep(RemoveStep.UNITS);
                            setRemoveTroop(idx);
                        }
                    }>消灭</button>
                </AccordionDetails>
            </Accordion>

        </Grid>)}
    </Grid>
}

export default TroopOperation;