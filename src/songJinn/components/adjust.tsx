import React, {useState} from "react";
import {SongJinnGame} from "../constant/setup";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {getCountryById, getStateById, playerById} from "../util/fetch";
import {CityID, Country, DevelopChoice, ProvinceID} from "../constant/general";

export interface IOperationProps {
    G: SongJinnGame;
    ctx: Ctx;
    playerID: string;
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean;
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
        } choices={Object.values(CityID).filter(c=>!pub.cities.includes(c)).map(c => {
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
        } choices={Object.values(ProvinceID).filter(c=>!pub.provinces.includes(c)).map(c => {
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

        {downDialog}
    </Grid>
}