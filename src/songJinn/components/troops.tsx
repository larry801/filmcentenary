import React, {useState} from "react";
import {Ctx, PlayerID} from "boardgame.io"
import Grid from "@material-ui/core/Grid";

import Button from "@material-ui/core/Button";
import Accordion from '@material-ui/core/Accordion';
import AccordionSummary from '@material-ui/core/AccordionSummary';
import AccordionDetails from '@material-ui/core/AccordionDetails';
import {
    CityID,
    Country,
    General,
    isRegionID,
    JinnGeneral,
    ProvinceID,
    RegionID,
    SongGeneral,
    SongJinnGame,
    Troop,
    UNIT_SHORTHAND
} from "../constant/general";
import ChoiceDialog from "../../components/modals";
import {getProvinceById} from "../constant/province";
import CheckBoxDialog from "./choice";
import {ChooseUnitsDialog} from "./recruit";
import {
    ctr2pub,
    getCountryById,
    getGeneralNameByCountry,
    getMarchDst,
    getOpponentStateById, getPlaceCountryGeneral,
    getPlaceGeneral, getPresentGeneral,
    getReadyGenerals,
    getRegionText,
    getStateById, getTroopPlaceText,
    getTroopText, hasOpponentTroop,
    optionToActualDst,
    StrProvince, troopIsWeiKun, unitsToString,
} from "../util";

export interface IPlayerHandProps {
    G: SongJinnGame,
    ctx: Ctx,
    isActive: boolean,
    pid: PlayerID,
    moves: Record<string, (...args: any[]) => void>;
    setRegion?: (r: RegionID) => void;
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
    GENERALS,
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

    const emptyTroop: Troop = {p: RegionID.R19, u: [0, 0, 0, 0, 0, 0], c: null, g: Country.SONG};

    const pub = getStateById(G, pid);
    const opp = getOpponentStateById(G, pid);
    const troops = [...pub.troops, ...opp.troops];
    const ctr = getCountryById(pid);
    const unitNames = ctr === Country.SONG ? UNIT_SHORTHAND[0] : UNIT_SHORTHAND[1];
    const emptyUnitsByCountry = (c: Country) => {
        return c === Country.JINN ? [0, 0, 0, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0];
    }

    const [showTroops, setShowTroops] = useState(true);


    const [deployStep, setDeployStep] = React.useState(DeployStep.TROOP);
    const [deployTroop, setDeployTroop] = useState(emptyTroop);

    const depUnitDialog = <ChooseUnitsDialog
        callback={(u) => {
            moves.deploy({
                units: u,
                city: deployTroop.c,
                country: deployTroop.g
            });
            setDeployStep(DeployStep.TROOP);
            setDeployTroop(emptyTroop);
        }}
        max={[...ctr2pub(G, deployTroop.g).ready]}
        initUnits={unitNames.map(() => 0)}
        show={isActive && deployStep === DeployStep.UNITS}
        title={`选择补充部队 剩余${unitsToString(pub.ready)}`} toggleText={"补充"}
        initial={true} country={deployTroop.g}
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
        toggleText={"击溃"} initial={true} country={takeDamageTroop.g}/>

    const takeDamageStandbyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setTakeDamageStep(TakeDamageStep.TROOP)
            moves.takeDamage({
                src: takeDamageTroop.p,
                c: takeDamageTroop.g,
                idx: takeDamageTroop,
                ready: takeDamageReadyUnits,
                standby: u
            })
        }} max={takeDamageTroop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && takeDamageStep === TakeDamageStep.STANDBY} title={"选择要被消灭的部队"}
        toggleText={"消灭部队"} initial={true} country={takeDamageTroop.g}/>


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
                    country: moveTroop.g
                })
            }
        }}
        choices={regions.map(r => {
            return {
                label: getRegionText(r),
                value: r.toString(),
                hidden: false,
                disabled: false
            }
        })} defaultChoice={""} show={isActive && newTroopStep === NewTroopStep.REGION || moveStep === MoveStep.REGION}
        title={"选择目标区域"}
        toggleText={"选择目标区域"} initial={true}/>;

    const unitDialog = <ChooseUnitsDialog
        callback={(c) => {
            moves.placeUnit({
                place: newTroopRegion,
                units: c,
                country: ctr
            })
            setNewTroopStep(NewTroopStep.START);
        }}
        show={isActive && newTroopStep === NewTroopStep.UNIT}
        title={"选择部队"} toggleText={"选择部队"}
        initUnits={emptyUnitsByCountry(ctr)}
        initial={true} country={ctr} max={pub.standby}/>;

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
    const [marchGenerals, setMarchGenerals] = useState([JinnGeneral.WoLiBu, SongGeneral.ZongZe]);
    const [marchTroop, setMarchTroop] = React.useState(emptyTroop);


    const marchGeneralsDialog = <CheckBoxDialog
        callback={(c) => {
            const generals: General[] = c.map(g => parseInt(g));
            setMarchGenerals(generals);
            setMarchStep(MarchStep.TARGET);
        }} choices={getPlaceCountryGeneral(G, marchTroop.g, marchTroop.p).map(gen => {
        return {
            label: getGeneralNameByCountry(marchTroop.g, gen),
            value: gen.toString(),
            disabled: false,
            hidden: false
        }
    })} show={isActive && marchStep === MarchStep.GENERALS}
        title={"请选择进军将领"} toggleText={"选择将领"} initial={true}/>

    const marchRegionDialog = <ChoiceDialog
        callback={(r) => {
            moves.march({
                src: marchTroop.p,
                dst: optionToActualDst(r),
                units: marchUnits,
                generals: marchGenerals,
                country: marchTroop.g
            });
            setMarchStep(MarchStep.TROOP);
        }}
        choices={getMarchDst(G, marchTroop.p, marchTroop).map(r => {
            if (r == null) {
                return {
                    label: "",
                    value: "",
                    hidden: true,
                    disabled: true
                }
            }
            if (isRegionID(r)) {
                return {
                    label: getRegionText(r),
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
        title={"选择进军目标区域"}
        toggleText={"进军目标"}
        initial={true}/>;


    const marchDialog = <ChooseUnitsDialog
        callback={(c) => {
            setMarchUnits(c);
            if (getPlaceCountryGeneral(G, marchTroop.g, marchTroop.p).length === 0) {
                setMarchStep(MarchStep.TARGET);
                setMarchGenerals([]);
            } else {

                setMarchStep(MarchStep.GENERALS);
            }
        }} max={[...marchTroop.u]} initUnits={emptyUnitsByCountry(marchTroop.g)}
        show={isActive && marchStep === MarchStep.UNITS}
        popAfterShow={true}
        title={"选择进军部队"} toggleText={"选择进军部队"} initial={true} country={marchTroop.g}/>

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
            moves.deploy({city: deployNewCity, units: u, country: ctr});
            setDeployNewStep(DeployNewStep.TROOP);
        }}
        max={pub.ready} initUnits={unitNames.map(() => 0)}
        show={isActive && deployNewStep === DeployNewStep.UNITS} title={"补充部队"} toggleText={"补充部队"}
        initial={true} country={ctr}
    />
    const generals = [...getReadyGenerals(G, pid),...getPresentGeneral(G,pid)]

    const removeGeneralDialog = <ChoiceDialog
        callback={(g) => {
            moves.removeOwnGeneral(parseInt(g));
        }} choices={generals.map(g => {
        return {label: getGeneralNameByCountry(ctr, g), value: g.toString(), disabled: false, hidden: false}
    })} defaultChoice={""} show={isActive} title={"移除将领"} toggleText={"移除将领"} initial={false}/>

    const [removeUnitStep, setRemoveUnitStep] = React.useState(RemoveStep.TROOP);
    const [removeUnitTroop, setRemoveUnitTroop] = React.useState(emptyTroop);
    const removeUnitDialog = <ChooseUnitsDialog
        callback={(u) => {
            setRemoveUnitStep(RemoveStep.TROOP)
            moves.removeUnit({
                src: removeUnitTroop.p,
                units: u,
                country: removeUnitTroop.g
            })
        }} max={removeUnitTroop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && removeUnitStep === RemoveStep.UNITS} title={"选择要消灭的部队"}
        toggleText={"消灭部队"} initial={true} country={removeUnitTroop.g}/>

    const [placeStep, setPlaceStep] = useState(PlaceStep.TROOP);
    const [placeUnitTroop, setPlaceUnitTroop] = useState(emptyTroop);

    const placeUnitsDialog = <ChooseUnitsDialog
        callback={(u) => {
            setPlaceStep(PlaceStep.TROOP)
            moves.placeUnit({
                place: placeUnitTroop.p,
                units: u,
                country: placeUnitTroop.g
            })
        }} max={[...ctr2pub(G, placeUnitTroop.g).standby]} initUnits={unitNames.map(() => 0)}
        show={isActive && placeStep === PlaceStep.UNITS} title={"选择要放置的的部队"}
        toggleText={"放置部队"} initial={true} country={ctr}/>

    const mapper = (t: Troop, idx: number) => <Accordion key={`troop-${idx}-${t.g}`}
                                                         expanded={isActive && expanded === idx}
                                                         onChange={() => setExpanded(idx)}>
        <AccordionSummary> {hasOpponentTroop(G, t) ? '(**)' : ''} {troopIsWeiKun(G, t) ? "被围困" : ""}{t.g}{getTroopPlaceText(t)} {getTroopText(G, t)} </AccordionSummary>
        <AccordionDetails>
            {isActive && <Grid item container spacing={1} key={`grid-ops-${idx}`}>
                <button
                    disabled={G.op <= 0}
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
                    disabled={G.op <= 0}
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
                            setMarchGenerals(getPlaceGeneral(G, pid, t.p));
                            setMarchStep(MarchStep.TARGET);
                        }
                    }>全军进军
                </button>
                {troopIsWeiKun(G, t) && <button
                    key={`grid-ops-${idx}-breakout`}
                    onClick={() => {
                        moves.breakout({
                            ctr: t.g,
                            src: t.p
                        });
                    }}
                >
                    突围
                </button>}
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
                    key={`grid-ops-${idx}-takeDamage`}
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
                    // disabled={t.c === null}
                    disabled={false}
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
    </Accordion>;

    return <Grid item container xs={12}>
        <Grid item xs={12}>
            <Button
                variant={"contained"} fullWidth
                onClick={() => setShowTroops(!showTroops)}
            >切换部队显示</Button>

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
            {marchGeneralsDialog}
            {marchRegionDialog}

            {deployNewCityDialog}
            {deployNewCityUnitsDialog}

            {depUnitDialog}

            {takeDamageReadyDialog}
            {takeDamageStandbyDialog}

            {removeUnitDialog}
            {removeGeneralDialog}
            {moveProvDialog}

            {placeUnitsDialog}</Grid>
        {showTroops && <>
            <Grid item container xs={12}>
                <Grid item xs={6}>
                    {G.song.troops.map(mapper)}
                </Grid>
                <Grid item xs={6}>
                    {G.jinn.troops.map(mapper)}
                </Grid>
            </Grid>

        </>
        }
    </Grid>
}

export default TroopOperation;