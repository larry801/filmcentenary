import React, {useState} from "react";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {
    CityID,
    Country,
    DevelopChoice,
    emptyJinnTroop,
    emptySongTroop,
    General,
    NationID, PlanID,
    ProvinceID,
    RegionID, SongGeneral,
    SongJinnGame
} from "../constant/general";
import {getProvinceById} from "../constant/province";
import {
    currentProvStatus,
    getCityText,
    getCountryById,
    getGeneralNameByCountry, getPlanById,
    getReadyGenerals,
    getRegionText,
    pid2pub,
    StrProvince
} from "../util";
import Button from "@material-ui/core/Button";
import {ChooseUnitsDialog} from "./recruit";
import CheckBoxDialog from "./choice";

export interface IOperationProps {
    G: SongJinnGame;
    ctx: Ctx;
    playerID: string;
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean;
}

enum MoveGeneralStep {
    PROVINCE,
    REGION,
    GENERAL,
}

export const AdjustOps = ({
                              G,
                              ctx,
                              playerID,
                              moves,
                              isActive
                          }: IOperationProps) => {

    const pub = pid2pub(G, playerID);
    const ctr = getCountryById(playerID);

    const readyGenerals: General[] = getReadyGenerals(G, playerID);
    const [moveGeneralStep, setMoveGeneralStep] = useState(MoveGeneralStep.PROVINCE);
    const [regions, setRegions] = useState([RegionID.R20]);
    const [moveGeneralRegion, setMoveGeneralRegion] = useState(RegionID.R01);


    const removeNationDialog = <ChoiceDialog
        callback={(c) => {
            moves.removeNation(c)
        }} choices={
        Object.values(NationID).map(p => {
            return {
                label: p,
                value: p,
                disabled: false,
                hidden: false
            }
        })} defaultChoice={""}
        show={isActive}
        title={"选择移除国家"} toggleText={"移除国家"} initial={false}/>
    const adjustNationDialog = <ChoiceDialog
        callback={(c) => {
            moves.adjustNation(c)
        }} choices={
        Object.values(NationID).map(p => {
            return {
                label: p,
                value: p,
                disabled: false,
                hidden: false
            }
        })} defaultChoice={""}
        show={isActive}
        title={"选择调整国家"} toggleText={"调整外交"} initial={false}/>

    const takePlan = (choices: string[]) => {
        moves.takePlan(choices)
    };
    const takePlanDialog = <CheckBoxDialog
        callback={takePlan}
        choices={Object.values(PlanID).map((p: PlanID) => {
            return {
                label: getPlanById(p).name,
                value: p,
                disabled: false,
                hidden: false
            }
        })}
        show={isActive} title={"选择完成的计划"}
        toggleText={"修改完成的计划"}
        initial={false}/>

    const chooseProvDialog = <ChoiceDialog
        callback={(c) => {
            const newProv = StrProvince.get(c);
            if (newProv === undefined) {
                console.log(`${c}|cannot|convertToProv`);
                return;
            }
            const province = getProvinceById(newProv);
            const newRegions = province.regions;
            setRegions(newRegions);
            setMoveGeneralStep(MoveGeneralStep.REGION);
        }} choices={
        Object.values(ProvinceID).map(p => {
            return {
                label: p,
                value: p,
                disabled: false,
                hidden: false
            }
        })} defaultChoice={""}
        show={isActive && moveGeneralStep === MoveGeneralStep.PROVINCE}
        title={"选择移动目标路"} toggleText={"移动将领"} initial={false}/>


    const chooseRegionDialog = <ChoiceDialog
        callback={(c) => {
            const regID = parseInt(c) as RegionID;

            if (moveGeneralStep === MoveGeneralStep.REGION) {
                setMoveGeneralStep(MoveGeneralStep.GENERAL);
                setMoveGeneralRegion(regID);
            }
        }}
        choices={regions.map(r => {
            return {
                label: getRegionText(r),
                value: r.toString(),
                hidden: false,
                disabled: false
            }
        })} defaultChoice={""} show={isActive && moveGeneralStep === MoveGeneralStep.REGION}
        title={"选择目标区域"}
        toggleText={"选择目标区域"} initial={true}/>;


    // @ts-ignore
    const chooseGeneralDialog = <ChoiceDialog
        callback={(c) => {
            const g: General = parseInt(c) as General;
            moves.moveGeneral({
                dst: moveGeneralRegion,
                country: ctr,
                general: g
            })
        }} choices={Object.values(SongGeneral).map(gen => {
        return {
            // @ts-ignore
            label: getGeneralNameByCountry(ctr, gen as General),
            value: gen.toString(),
            disabled: false,
            hidden: false
        }
    })} show={isActive && moveGeneralStep === MoveGeneralStep.GENERAL}
        defaultChoice={""}
        title={"请选择要移动的将领"} toggleText={"移动将领"} initial={false}/>

    const completedPlans = [...G.song.completedPlan, ...G.jinn.completedPlan];
    const removeCompletedPlanDialog = <ChoiceDialog
        callback={(c) => moves.removeCompletedPlan(c)}
        choices={completedPlans.map((pid) => {
                const plan = getPlanById(pid);
                return {
                    label: plan.name,
                    value: plan.id,
                    disabled: plan.level > pub.military,
                    hidden: false
                }
            }
        )}
        defaultChoice={''}
        show={isActive && ctx.phase === 'resolvePlan'}
        title={"请选择1张已完成作战计划移除"} toggleText={"移除完成作战计划"}
        initial={false}/>;

    const [deployCityChosen, setDeployCityChosen] = useState(false);
    const deployDialog = <ChoiceDialog
        callback={
            (c) => {
                if (readyGenerals.length > 1) {
                    setCity(c as CityID);
                    setDeployCityChosen(true)
                } else {
                    moves.deployGeneral({country: ctr, general: readyGenerals[0], dst: c})
                }
            }
        } choices={pub.cities.map(c => {
        return {
            label: getCityText(c),
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive && readyGenerals.length > 0 && !deployCityChosen}
        title={"请选择要派遣的城市"} toggleText={"派遣将领"} initial={false}/>

    const deployGeneralDialog = <ChoiceDialog
        callback={(c) => {
            const g: General = parseInt(c) as General;
            setDeployCityChosen(false);
            moves.deployGeneral({country: ctr, general: g})
        }} choices={readyGenerals.map(gen => {
        return {
            label: getGeneralNameByCountry(ctr, gen),
            value: gen.toString(),
            disabled: false,
            hidden: false
        }
    })} show={isActive && readyGenerals.length > 0 && deployCityChosen}
        defaultChoice={""}
        title={"请选择派遣将领"} toggleText={"派遣将领"} initial={false}/>


    const checkProvDialog = <ChoiceDialog
        callback={
            (c) => moves.checkProvince({prov: c, text: currentProvStatus(G, c as ProvinceID)})
        } choices={Object.values(ProvinceID).map(c => {
        return {
            label: c,
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive}
        title={"请选择结算要的路"} toggleText={"结算路权"} initial={false}/>

    const controlCityDialog = <ChoiceDialog
        callback={
            (c) => moves.controlCity(c)
        } choices={Object.values(CityID).filter(c => !pub.cities.includes(c)).map(c => {
        return {
            label: getCityText(c),
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive}
        title={"请选择控制的城市"} toggleText={"控制城市"} initial={false}/>

    const controlProvDialog = <ChoiceDialog
        callback={
            (c) => moves.controlProvince(c)
        } choices={Object.values(ProvinceID).filter(c => !pub.provinces.includes(c)).map(c => {
        return {
            label: c,
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive}
        title={"请选择要控制的路"} toggleText={"控制路权"} initial={false}/>

    const [loseProv, setLoseProv] = useState(ProvinceID.XIJINGLU);

    enum LoseProvStep {
        PROVINCE,
        OPPONENT
    }

    const [loseProvStep, setLoseProvStep] = useState(LoseProvStep.PROVINCE);

    const loseProvDialog = <ChoiceDialog
        callback={
            (c) => {
                setLoseProv(c as ProvinceID);
                setLoseProvStep(LoseProvStep.OPPONENT)
            }
        } choices={pub.provinces.map(c => {
        return {
            label: c,
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive && loseProvStep === LoseProvStep.PROVINCE}
        title={"请选择丢失的路"} toggleText={"丢失路权"} initial={false}/>

    const loseProvToOpponentDialog = <ChoiceDialog
        callback={(c) => {
            const opponent = c === "yes";
            setLoseProvStep(LoseProvStep.PROVINCE);
            moves.loseProvince({province: loseProv, opponent: opponent});
        }}
        choices={[
            {label: "是", value: "yes", disabled: false, hidden: false},
            {label: "否", value: "no", disabled: false, hidden: false}
        ]} defaultChoice={"no"}
        show={isActive && loseProvStep === LoseProvStep.OPPONENT}
        title={"是否对手控制"}
        toggleText={"确认"}
        initial={true}/>

    const [city, setCity] = useState(CityID.DaTong);

    enum LoseCityStep {
        CITY,
        OPPONENT
    }

    const [loseCityStep, setLoseCityStep] = useState(LoseCityStep.CITY);
    const cityDialog = <ChoiceDialog
        callback={
            (c) => {
                setCity(c as CityID);
                setLoseCityStep(LoseCityStep.OPPONENT)
            }
        } choices={pub.cities.map(c => {
        return {
            label: getCityText(c),
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive && loseCityStep === LoseCityStep.CITY}
        title={"请选择丢失的城市"} toggleText={"丢失城市"} initial={false}/>


    const loseCityToOpponentDialog = <ChoiceDialog
        callback={(c) => {
            const opponent = c === "yes";
            moves.loseCity({cityID: city, opponent: opponent});
            setLoseCityStep(LoseCityStep.CITY)
        }}
        choices={[
            {label: "是", value: "yes", disabled: false, hidden: false},
            {label: "否", value: "no", disabled: false, hidden: false}
        ]} defaultChoice={"no"}
        show={isActive && loseCityStep === LoseCityStep.OPPONENT}
        title={"是否对手控制"}
        toggleText={"确认"}
        initial={true}/>


    const downDialog = <ChoiceDialog
        callback={(c) => moves.down(c)}
        defaultChoice={DevelopChoice.CIVIL}
        choices={[
            {
                label: DevelopChoice.COLONY, value: DevelopChoice.COLONY,
                disabled: false,
                hidden: G.colony === 0
            },
            {
                label: DevelopChoice.MILITARY, value: DevelopChoice.MILITARY,
                disabled: pub.military === 1,
                hidden: false
            },
            {
                label: DevelopChoice.POLICY_UP, value: DevelopChoice.POLICY_UP,
                disabled: G.policy >= 3,
                hidden: false
            }, {
                label: DevelopChoice.POLICY_DOWN, value: DevelopChoice.POLICY_DOWN,
                disabled: G.policy <= -3,
                hidden: false
            },
            {
                label: DevelopChoice.CIVIL, value: DevelopChoice.CIVIL,
                disabled: pub.civil === 1,
                hidden: false
            },
        ]}
        show={isActive}
        title={"请选择项目"} toggleText={"降低等级"} initial={false}
    />


    const removeSongReadyUnitDialog = <ChooseUnitsDialog
        callback={(c) => moves.removeReadyUnit({units: c, country: Country.SONG})}
        max={G.song.ready} initUnits={emptySongTroop().u} show={isActive}
        title={"消灭宋预备区部队"} toggleText={"消灭宋预备区部队"} initial={false} country={Country.SONG}/>

    const removeJinnReadyUnitDialog = <ChooseUnitsDialog
        callback={(c) => moves.removeReadyUnit({units: c, country: Country.JINN})}
        max={G.jinn.ready} initUnits={emptyJinnTroop().u} show={isActive}
        title={"消灭金预备区部队"} toggleText={"消灭金预备区部队"} initial={false} country={Country.JINN}/>

    return <Grid container>
        <Grid item xs={6} sm={3}>
            {removeSongReadyUnitDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {removeJinnReadyUnitDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            <Button fullWidth variant={"outlined"} onClick={() => moves.drawExtraCard()}>
                额外摸一张牌
            </Button>
        </Grid>
        <Grid item xs={6} sm={3}>
            {takePlanDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {removeCompletedPlanDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {removeNationDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {adjustNationDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {cityDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {loseCityToOpponentDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {loseProvDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {loseProvToOpponentDialog}
        </Grid>

        <Grid item xs={6} sm={3}>
            {controlCityDialog}
        </Grid>

        <Grid item xs={6} sm={3}>
            {controlProvDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {checkProvDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {chooseGeneralDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {chooseProvDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {chooseRegionDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {deployDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {deployGeneralDialog}
        </Grid>
        <Grid item xs={6} sm={3}>
            {downDialog}
        </Grid>
    </Grid>
}