import React, {useState} from "react";
import {Ctx, PlayerID} from "boardgame.io"
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";

import {
    ctr2pub,
    getCountryById,
    getMarchDst,
    getOpponentStateById,
    getStateById,
    optionToActualDst,
    StrProvince,
    unitsToString
} from "../util/fetch";
import Button from "@material-ui/core/Button";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import {getPlaceGeneralNames, placeToStr} from "../util/text";
import {CityID, Country, isRegionID, ProvinceID, RegionID, Troop, UNIT_SHORTHAND} from "../constant/general";
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

enum NewTroopStep {
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

    const emptyTroop: Troop = {p: RegionID.R19, u: [0, 0, 0, 0, 0, 0], c: null, country: Country.SONG};

    const pub = getStateById(G, pid);
    const opp = getOpponentStateById(G, pid);
    const troops = [...pub.troops, ...opp.troops];
    const ctr = getCountryById(pid);
    const unitNames = ctr === Country.SONG ? UNIT_SHORTHAND[0] : UNIT_SHORTHAND[1];


    const [deployStep, setDeployStep] = React.useState(DeployStep.TROOP);
    const [deployTroop, setDeployTroop] = useState(emptyTroop);

    const depUnitDialog = <ChooseUnitsDialog
        callback={(u) => {
            moves.deploy({
                units: u,
                city: deployTroop.c,
                country: deployTroop.country
            });
            setDeployStep(DeployStep.TROOP);
            setDeployTroop(emptyTroop);
        }}
        max={[...ctr2pub(G, deployTroop.country).ready]}
        initUnits={unitNames.map(() => 0)}
        show={isActive && deployStep === DeployStep.UNITS}
        title={"选择补充部队"} toggleText={"补充"}
        initial={true} country={deployTroop.country}
    />


    const [takeDamageStep, setTakeDamageStep] = React.useState(TakeDamageStep.TROOP);
    const [takeDamageTroop, setTakeDamageTroop] = useState(emptyTroop);
    const [takeDamageReadyUnits, setTakeDamageReadyUnits] = React.useState(emptyTroop.u);

    const takeDamageReadyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setTakeDamageStep(TakeDamageStep.STANDBY)
            setTakeDamageReadyUnits(u)
        }} max={takeDamageTroop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && takeDamageStep === TakeDamageStep.READY} title={"选择被击溃的部队"}
        toggleText={"击溃"} initial={true} country={takeDamageTroop.country}/>

    const takeDamageStandbyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setTakeDamageStep(TakeDamageStep.TROOP)
            moves.takeDamage({
                src: takeDamageTroop.p,
                c: takeDamageTroop.country,
                idx: takeDamageTroop,
                ready: takeDamageReadyUnits,
                standby: u
            })
        }} max={takeDamageTroop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && takeDamageStep === TakeDamageStep.STANDBY} title={"选择要被消灭的部队"}
        toggleText={"消灭部队"} initial={true} country={takeDamageTroop.country}/>


    const [moveTroop, setMoveTroop] = useState(emptyTroop);
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
    const [newTroopStep, setNewTroopStep] = React.useState(NewTroopStep.START);

    const [regions, setRegions] = React.useState([RegionID.R01]);

    const regionDialog = <ChoiceDialog
        callback={(c) => {
            const regID = parseInt(c) as RegionID;
            if (newTroopStep === NewTroopStep.REGION) {
                setNewTroopRegion(regID);
                setNewTroopStep(NewTroopStep.UNIT);
            }
            if (moveStep === MoveStep.REGION) {
                setMoveStep(MoveStep.TROOP);
                moves.moveTroop({
                    src: moveTroop,
                    dst: regID,
                    country: moveTroop.country
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
        })} defaultChoice={""} show={isActive && newTroopStep === NewTroopStep.REGION || moveStep === MoveStep.REGION}
        title={"选择目标区域"}
        toggleText={"选择目标区域"} initial={true}/>;

    const unitDialog = <CheckBoxDialog
        callback={(c) => {
            const units = unitNames.map(() => 0);
            c.forEach(u => {
                const idx = unitNames.indexOf(u);
                units[idx] = 1;
            })
            moves.placeTroop({
                dst: newTroopRegion,
                units: units,
                country: ctr
            })
            setNewTroopStep(NewTroopStep.START);
        }}
        choices={unitNames.map(u => {
            return {
                label: u,
                value: u,
                disabled: false,
                hidden: false
            }
        })}
        show={isActive && newTroopStep === NewTroopStep.UNIT}
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
            setNewTroopStep(NewTroopStep.REGION);
        }} choices={
        Object.values(ProvinceID).map(p => {
            return {
                label: p,
                value: p,
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""} show={isActive && newTroopStep === NewTroopStep.PROVINCE} title={"选择目标路"}
        toggleText={"选择目标路"} initial={true}/>;


    const [marchStep, setMarchStep] = React.useState(MarchStep.TROOP);
    const [marchUnits, setMarchUnits] = React.useState(emptyTroop.u);
    const [marchTroop, setMarchTroop] = React.useState(emptyTroop);

    const marchRegionDialog = <ChoiceDialog
        callback={(r) => {
            moves.march({
                src: marchTroop.p,
                dst: optionToActualDst(r),
                units: marchUnits,
                country: ctr
            });
            setMarchStep(MarchStep.TROOP);
        }}
        choices={getMarchDst(G, marchTroop.p).map(r => {
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
        }} max={[...marchTroop.u]} initUnits={[...marchTroop.u]}
        show={isActive && marchStep === MarchStep.UNITS}
        popAfterShow={true}
        title={"选择进军部队"} toggleText={"选择进军部队"} initial={true} country={marchTroop.country}/>

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

    const [removeUnitStep, setRemoveUnitStep] = React.useState(RemoveStep.TROOP);
    const [removeUnitTroop, setRemoveUnitTroop] = React.useState(emptyTroop);
    const removeUnitDialog = <ChooseUnitsDialog
        callback={(u) => {
            setRemoveUnitStep(RemoveStep.TROOP)
            moves.removeUnit({
                src: removeUnitTroop.p,
                units: u,
                country: removeUnitTroop.c
            })
        }} max={removeUnitTroop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && removeUnitStep === RemoveStep.UNITS} title={"选择要消灭的部队"}
        toggleText={"消灭部队"} initial={true} country={ctr}/>

    const [placeStep, setPlaceStep] = useState(PlaceStep.TROOP);
    const [placeUnitTroop, setPlaceUnitTroop] = useState(emptyTroop);

    const placeUnitsDialog = <ChooseUnitsDialog
        callback={(u) => {
            setPlaceStep(PlaceStep.TROOP)
            moves.placeUnit({
                place: placeUnitTroop.p,
                units: u,
                country: placeUnitTroop.country
            })
        }} max={[...ctr2pub(G,placeUnitTroop.country).standby]} initUnits={unitNames.map(() => 0)}
        show={isActive && placeStep === PlaceStep.UNITS} title={"选择要放置的的部队"}
        toggleText={"放置新部队"} initial={true} country={ctr}/>

    return <Grid item container xs={12}>
        <Grid item xs={12}>
            <Button
                variant={"contained"} fullWidth
                onClick={() => {
                    setPlaceStep(PlaceStep.TROOP);
                    // setNewTroopStep(NewTroopStep.START);
                    setDeployNewStep(DeployNewStep.TROOP);

                    setTakeDamageStep(TakeDamageStep.TROOP);
                    setMarchStep(MarchStep.TROOP);
                    setRemoveUnitStep(RemoveStep.TROOP);
                    setDeployStep(DeployStep.TROOP)
                    setMoveStep(MoveStep.TROOP);
                    setNewTroopStep(NewTroopStep.PROVINCE);
                }}>放置新部队</Button>
            <Button
                variant={"contained"} fullWidth
                onClick={() => {
                    setPlaceStep(PlaceStep.TROOP);
                    setNewTroopStep(NewTroopStep.START);
                    // setDeployNewStep(DeployNewStep.TROOP);

                    setTakeDamageStep(TakeDamageStep.TROOP);
                    setMarchStep(MarchStep.TROOP);
                    setRemoveUnitStep(RemoveStep.TROOP);
                    setDeployStep(DeployStep.TROOP)
                    setMoveStep(MoveStep.TROOP);
                    setDeployNewStep(DeployNewStep.CITY);
                }}>补充空城市</Button>
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
            <Accordion expanded={isActive && expanded === idx} onChange={() => setExpanded(idx)}
                       key={`troop-${idx}`}>
                <AccordionSummary>
                    {t.country}|{placeToStr(t.p)}|{unitsToString(t.u)}|{getPlaceGeneralNames(G, pid, t.p)}</AccordionSummary>
                <AccordionDetails>
                    {isActive && <Grid item container spacing={1} key={`grid-ops-${idx}`}>
                        <button
                            key={`grid-ops-${idx}-march`}
                            onClick={
                                () => {
                                    setPlaceStep(PlaceStep.TROOP);
                                    setNewTroopStep(NewTroopStep.START);
                                    setDeployNewStep(DeployNewStep.TROOP);

                                    setTakeDamageStep(TakeDamageStep.TROOP);
                                    // setMarchStep(MarchStep.TROOP);
                                    setRemoveUnitStep(RemoveStep.TROOP);
                                    setDeployStep(DeployStep.TROOP)
                                    setMoveStep(MoveStep.TROOP);
                                    setMarchTroop(t);
                                    setMarchStep(MarchStep.UNITS);
                                }
                            }>进军
                        </button>
                        <button
                            key={`grid-ops-${idx}-all-march`}
                            onClick={
                                () => {
                                    setPlaceStep(PlaceStep.TROOP);
                                    setNewTroopStep(NewTroopStep.START);
                                    setDeployNewStep(DeployNewStep.TROOP);

                                    setTakeDamageStep(TakeDamageStep.TROOP);
                                    // setMarchStep(MarchStep.TROOP);
                                    setRemoveUnitStep(RemoveStep.TROOP);
                                    setDeployStep(DeployStep.TROOP)
                                    setMoveStep(MoveStep.TROOP);

                                    setMarchTroop(t);
                                    setMarchUnits(t.u)
                                    setMarchStep(MarchStep.TARGET);
                                }
                            }>全军进军
                        </button>
                        <button
                            key={`grid-ops-${idx}-move`}
                            onClick={
                                () => {
                                    setPlaceStep(PlaceStep.TROOP);
                                    setNewTroopStep(NewTroopStep.START);
                                    setDeployNewStep(DeployNewStep.TROOP);

                                    setTakeDamageStep(TakeDamageStep.TROOP);
                                    setMarchStep(MarchStep.TROOP);
                                    setRemoveUnitStep(RemoveStep.TROOP);
                                    setDeployStep(DeployStep.TROOP)
                                    // setMoveStep(MoveStep.TROOP);
                                    setMoveTroop(t);
                                    setMoveStep(MoveStep.PROVINCE);
                                }
                            }>移动
                        </button>
                        <button
                            key={`grid-ops-${idx}-takeDamge`}
                            onClick={
                                () => {
                                    setPlaceStep(PlaceStep.TROOP);
                                    setNewTroopStep(NewTroopStep.START);
                                    setDeployNewStep(DeployNewStep.TROOP);

                                    // setTakeDamageStep(TakeDamageStep.TROOP);
                                    setMarchStep(MarchStep.TROOP);
                                    setRemoveUnitStep(RemoveStep.TROOP);
                                    setDeployStep(DeployStep.TROOP)
                                    setMoveStep(MoveStep.TROOP);
                                    setTakeDamageStep(TakeDamageStep.READY);
                                    setTakeDamageTroop(t);
                                }
                            }>受创
                        </button>
                        <button
                            key={`grid-ops-${idx}-deploy`}
                            disabled={t.c === null}
                            onClick={
                                () => {
                                    setPlaceStep(PlaceStep.TROOP);
                                    setNewTroopStep(NewTroopStep.START);
                                    setDeployNewStep(DeployNewStep.TROOP);

                                    setTakeDamageStep(TakeDamageStep.TROOP);
                                    setMarchStep(MarchStep.TROOP);
                                    setRemoveUnitStep(RemoveStep.TROOP);
                                    // setDeployStep(DeployStep.TROOP)
                                    setMoveStep(MoveStep.TROOP);

                                    setDeployStep(DeployStep.UNITS);
                                    setDeployTroop(t);
                                }
                            }>补充
                        </button>
                        <button onClick={
                            () => {
                                setPlaceStep(PlaceStep.TROOP);
                                setNewTroopStep(NewTroopStep.START);
                                setDeployNewStep(DeployNewStep.TROOP);

                                setTakeDamageStep(TakeDamageStep.TROOP);
                                setMarchStep(MarchStep.TROOP);
                                setRemoveUnitStep(RemoveStep.TROOP);
                                setDeployStep(DeployStep.TROOP)
                                setMoveStep(MoveStep.TROOP);

                                setPlaceStep(PlaceStep.UNITS);
                                setPlaceUnitTroop(t);
                            }
                        }>放置
                        </button>
                        <button onClick={
                            () => {
                                setPlaceStep(PlaceStep.TROOP);

                                setNewTroopStep(NewTroopStep.START);
                                setDeployNewStep(DeployNewStep.TROOP);

                                setTakeDamageStep(TakeDamageStep.TROOP);
                                setMarchStep(MarchStep.TROOP);
                                // setRemoveStep(RemoveStep.TROOP);
                                setDeployStep(DeployStep.TROOP)
                                setMoveStep(MoveStep.TROOP);

                                setRemoveUnitStep(RemoveStep.UNITS);
                                setRemoveUnitTroop(t);
                            }
                        }>消灭
                        </button>
                    </Grid>
                    }
                </AccordionDetails>
            </Accordion>

        </Grid>)}
    </Grid>
}

export default TroopOperation;