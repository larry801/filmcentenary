import React from "react";
import {SongJinnGame} from "../constant/setup";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {getCountryById, getStage, getStateById, playerById} from "../util/fetch";
import {ActiveEvents, Country, DevelopChoice, JinnUnit, SJPlayer, SongUnit, UNIT_FULL_NAME} from "../constant/general";
import {remainDevelop} from "../util/calc";
import {getCardById} from "../constant/cards";
import {getPlanById} from "../constant/plan";
import Button from "@material-ui/core/Button";


export interface IOperationProps {
    G: SongJinnGame;
    ctx: Ctx;
    playerID: string;
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean;
}

export const Operation = ({
                              G,
                              ctx,
                              playerID,
                              moves,
                              isActive
                          }: IOperationProps) => {

    const pub = getStateById(G, playerID);
    const player = playerById(G, playerID);
    const country = getCountryById(playerID);

    const recruit = (choice: string) => {
        moves.recruit(choice);
    }

    const recruitDialog = <ChoiceDialog
        callback={recruit}
        choices={country === Country.SONG ? [
            {label: UNIT_FULL_NAME[0][0], value: SongUnit.Bu.toString(), disabled: false, hidden: false},
            {label: UNIT_FULL_NAME[0][1], value: SongUnit.Gong.toString(), disabled: false, hidden: false},
            {label: UNIT_FULL_NAME[0][2], value: SongUnit.Chuan.toString(), disabled: false, hidden: false},
        ] : [
            {label: UNIT_FULL_NAME[0][0], value: JinnUnit.Bu.toString(), disabled: false, hidden: false},
            {label: UNIT_FULL_NAME[0][1], value: JinnUnit.Guai.toString(), disabled: false, hidden: false},
            {label: UNIT_FULL_NAME[0][2], value: JinnUnit.Tie.toString(), disabled: false, hidden: false},
            {label: UNIT_FULL_NAME[0][5], value: JinnUnit.Qian.toString(), disabled: false, hidden: false},
            {label: UNIT_FULL_NAME[0][6], value: JinnUnit.Qi.toString(), disabled: false, hidden: !G.events.includes(ActiveEvents.JianLiDaQi)},
        ]}
        defaultChoice={""}
        toggleText={"征募"} title={"请选择要征募的兵种"}
        show={true} initial={true}
    />

    const chooseFirst = (choice: string) => {
        moves.chooseFirst(choice);
    }
    const choosePlan = (choice: string) => {
        moves.choosePlan(choice);
    }
    const search = (choice: string) => {
        moves.search(choice);
    }
    const discard = (choice: string) => {
        moves.discard(choice);
    }
    const returnToHand = (choice: string) => {
        moves.returnToHand(choice);
    }
    const develop = (choice: string) => {
        moves.develop(choice);
    }
    const remainDevelopPoint: number = remainDevelop(G, ctx, playerID);

    return <Grid>
        <ChoiceDialog
            callback={returnToHand}
            defaultChoice={DevelopChoice.CIVIL}
            choices={[
                {
                    label: DevelopChoice.COLONY, value: DevelopChoice.COLONY,
                    disabled: false,
                    hidden: country !== Country.JINN
                },
                {
                    label: DevelopChoice.MILITARY, value: DevelopChoice.MILITARY,
                    disabled: pub.military === 7 || pub.military + 1 > remainDevelopPoint,
                    hidden: false
                },
                {
                    label: DevelopChoice.POLICY, value: DevelopChoice.POLICY,
                    disabled: remainDevelopPoint < 3,
                    hidden: country !== Country.SONG
                },
                {
                    label: DevelopChoice.CIVIL, value: DevelopChoice.CIVIL,
                    disabled: pub.civil === 7 || pub.civil + 1 > remainDevelopPoint,
                    hidden: false
                },
                {
                    label: DevelopChoice.EMPEROR, value: DevelopChoice.EMPEROR,
                    disabled: G.song.emperor !== null || pub.usedDevelop > 0,
                    hidden: country !== Country.SONG
                },

            ]}
            show={isActive && getStage(ctx) === 'develop'}
            title={"请选择需要返回手牌的发展牌"} toggleText={"发展牌回手"} initial={true}
        />
        <ChoiceDialog
            callback={returnToHand}
            choices={pub.develop.map(bcid => {
                return {
                    label: getCardById(bcid).name,
                    value: bcid.toString(),
                    disabled: false,
                    hidden: false
                }
            })}
            defaultChoice={""}
            show={isActive}
            title={"请选择需要返回手牌的发展牌"} toggleText={"发展牌回手"} initial={true}
        />
        <ChoiceDialog
            callback={discard}
            choices={player.hand.map(bcid => {
                return {
                    label: getCardById(bcid).name,
                    value: bcid.toString(),
                    disabled: false,
                    hidden: false
                }
            })}
            show={isActive} defaultChoice=""
            title={""} toggleText={""} initial={true}
        />
        <ChoiceDialog
            callback={chooseFirst}
            choices={[
                {label: "宋", value: SJPlayer.P1, disabled: false, hidden: false,},
                {label: "金", value: SJPlayer.P2, disabled: false, hidden: false,},
            ]} defaultChoice={SJPlayer.P1}
            show={isActive && ctx.phase === 'chooseFirst'} title={"请选择先手玩家"}
            toggleText={"请选择先手玩家"} initial={true}/>
        <ChoiceDialog
            callback={choosePlan}
            choices={player.plans.map((pid) => {
                    const plan = getPlanById(pid);
                    return {
                        label: plan.name,
                        value: plan.id,
                        disabled: plan.level > pub.military,
                        hidden: false
                    }
                }
            )}
            defaultChoice={player.plans.length > 0 ? player.plans[0] : 'J01'}
            show={isActive && ctx.phase === 'choosePlan'}
            title={"请选择1张作战计划"} toggleText={"选择作战计划"}
            initial={true}/>
        {
            (isActive && ctx.phase === 'showPlan') &&
            <Button
                onClick={() => moves.showPlan(player.chosenPlans)}
                color={"primary"}
                variant={"contained"}
            >
                展示作战计划
            </Button>}
    </Grid>
}