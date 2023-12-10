import React, {useState} from "react";
import {SongJinnGame} from "../constant/setup";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {
    getCountryById,
    getPresentGeneral,
    getReadyGenerals,
    getStateById,
    playerById,
    StrProvince
} from "../util/fetch";
import {CityID, DevelopChoice, General, ProvinceID, RegionID} from "../constant/general";
import {getGeneralNameByCountry} from "../util/text";
import {getProvinceById} from "../constant/province";
import {getRegionById} from "../constant/regions";

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

    const pub = getStateById(G, playerID);
    const player = playerById(G, playerID);
    const ctr = getCountryById(playerID);

    const presentGeneral = getPresentGeneral(G, playerID);
    const [moveGeneralStep, setMoveGeneralStep] = useState(MoveGeneralStep.PROVINCE);
    const [regions, setRegions] = useState([RegionID.R20]);
    const [moveGeneralRegion, setMoveGeneralRegion] = useState(RegionID.R01);

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
        show={isActive && presentGeneral.length > 0 && moveGeneralStep === MoveGeneralStep.PROVINCE}
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
            const reg = getRegionById(r);
            return {
                label: reg.name,
                value: r.toString(),
                hidden: false,
                disabled: false
            }
        })} defaultChoice={""} show={isActive && moveGeneralStep === MoveGeneralStep.REGION}
        title={"选择目标区域"}
        toggleText={"选择目标区域"} initial={true}/>;


    const chooseGeneralDialog = <ChoiceDialog
        callback={(c) => {
            const g: General = parseInt(c) as General;
            moves.moveGeneral({
                dst: moveGeneralRegion,
                country: ctr,
                general:g
            })
        }} choices={presentGeneral.map(gen => {
        return {
            label: getGeneralNameByCountry(ctr, gen),
            value: gen.toString(),
            disabled: false,
            hidden: false
        }
    })} show={isActive && presentGeneral.length > 0 && moveGeneralStep === MoveGeneralStep.GENERAL}
        defaultChoice={""}
        title={"请选择要移动的将领"} toggleText={"移动将领"} initial={false}/>




    const [deployCityChosen, setDeployCityChosen] = useState(false);
    const readyGenerals = getReadyGenerals(G, playerID);

    const deployDialog = <ChoiceDialog
        callback={
            (c) => {
                if(readyGenerals.length > 1){
                    setCity(c as CityID);
                    setDeployCityChosen(true)
                }else{
                    moves.deployGeneral({country: ctr, general: readyGenerals[0],dst:c})

                }
            }
        } choices={Object.values(CityID).map(c => {
        return {
            label: c,
            value: c,
            disabled: false,
            hidden: false,
        }
    })} defaultChoice={""} show={isActive && readyGenerals.length > 0 && !deployCityChosen}
        title={"请选择要派遣的城市"} toggleText={"派遣"} initial={false}/>
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
            (c) => moves.checkProvince(c)
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
            (c) => moves.controlProvince(c)
        } choices={Object.values(CityID).filter(c => !pub.cities.includes(c)).map(c => {
        return {
            label: c,
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
            label: c,
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
                label: DevelopChoice.POLICY, value: DevelopChoice.POLICY,
                disabled: G.policy === -3,
                hidden: G.policy === -3
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

    return <Grid container>
        {cityDialog}
        {loseCityToOpponentDialog}

        {loseProvDialog}
        {loseProvToOpponentDialog}

        {controlCityDialog}
        {controlProvDialog}

        {checkProvDialog}

        {chooseGeneralDialog}
        {chooseProvDialog}
        {chooseRegionDialog}

        {deployDialog}
        {deployGeneralDialog}


        {downDialog}
    </Grid>
}