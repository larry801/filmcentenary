import React, {useState} from "react";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {
    ActiveEvents,
    Country,
    DevelopChoice,
    General, MAX_DICES,
    SJPlayer, SongJinnGame,
} from "../constant/general";
import {getPlanById} from "../constant/plan";
import Button from "@material-ui/core/Button";
import CheckBoxDialog from "./choice";
import {ChooseUnitsDialog} from "./recruit";
import {actualStage} from "../../game/util";

import {
    cardToSearch, confirmRespondLogText, confirmRespondText,
    generalWithOpponentTroop, getCityText,
    getCountryById,
    getGeneralNameByCountry, getSkillGeneral,
    getStateById, phaseName,
    playerById, remainDevelop, returnDevCardCheck, sjCardById
} from "../util";
import {Dices} from "./dices";


export interface IOperationProps {
    G: SongJinnGame;
    ctx: Ctx;
    playerID: string;
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean;
    matchID: string;
}

export const Operation = ({
                              G,
                              ctx,
                              playerID,
                              moves,
                              isActive,
                              matchID
                          }: IOperationProps) => {

    const ctr = getCountryById(playerID);
    const pub = getStateById(G, playerID);
    const player = playerById(G, playerID);
    const country = getCountryById(playerID);
    const remainDevelopPoint: number = remainDevelop(G, ctx, playerID);


    const chooseFirst = (choice: string) => {
        moves.chooseFirst({choice: choice, matchID: matchID});
    }
    const chooseFirstDialog = <ChoiceDialog
        callback={chooseFirst}
        choices={[
            {label: "宋", value: SJPlayer.P1, disabled: false, hidden: false,},
            {label: "金", value: SJPlayer.P2, disabled: false, hidden: false,},
        ]} defaultChoice={SJPlayer.P1}
        show={isActive && ctx.phase === 'chooseFirst'} title={"请选择先手玩家"}
        toggleText={"请选择先手玩家"} initial={true}/>;


    const choosePlan = (choice: string) => {
        moves.choosePlan(choice);
    }
    const choosePlanDialog = <ChoiceDialog
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
        initial={true}/>;

    const combatCardDialog = <CheckBoxDialog
        callback={(c) => moves.combatCard(c)}
        choices={player.hand.filter(c => sjCardById(c).combat).map(c => {
            return {
                label: sjCardById(c).name,
                value: c,
                disabled: false,
                hidden: false
            }
        })}
        show={isActive && actualStage(G, ctx) === 'combatCard'} title={"请选择战斗牌"}
        toggleText={"战斗牌"} initial={false}/>

    const autoPhases = ['showPlan', 'chooseFirst', 'choosePlan', 'diplomacy']
    const showPlan = (isActive && ctx.phase === 'showPlan') && <Button
        onClick={() => moves.showPlan(player.chosenPlans)}
        color={"primary"} variant={"contained"}>展示作战计划</Button>
    const showCC = (isActive && actualStage(G, ctx) === 'showCC') && <Button
        onClick={() => moves.showCC(player.combatCard)}
        color={"primary"} variant={"contained"}>展示战斗牌</Button>
    const showLetters = (isActive && ctx.phase === 'diplomacy') && <Button
        onClick={() => {
            moves.showLetters({
                nations: pub.nations,
                letters: player.lod
            })
        }}
        color={"primary"} variant={"contained"}>展示国书</Button>
    const endRound = (ctx.currentPlayer === playerID && !autoPhases.includes(ctx.phase)) && <Button
        onClick={() => {
            // TODO add phase info  Song ended develop phase
            if (ctx.phase === 'action') {
                moves.endRound(G.round);
            } else {
                moves.endRound();
            }
        }}
        color={"primary"} variant={"contained"}>结束{phaseName(ctx.phase)}</Button>

    const search = (choice: string) => {
        moves.search(choice);
    }
    const searchDialog = <ChoiceDialog
        callback={search}
        choices={cardToSearch(G, ctx, playerID).map(c => {
            const card = sjCardById(c);
            return {
                label: card.name,
                value: c,
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={''}
        show={isActive && ctx.phase === 'draw'} title={"请选择检索牌"} toggleText={"检索"} initial={true}/>

    const discard = (choice: string) => {
        moves.discard(choice);
    }
    const discardDialog = <ChoiceDialog
        callback={discard}
        choices={player.hand.map(bcid => {
            return {
                label: sjCardById(bcid).name,
                value: bcid.toString(),
                disabled: false,
                hidden: false
            }
        })}
        show={isActive} defaultChoice={""}
        title={"弃牌"} toggleText={"弃牌"} initial={false}
    />

    const returnToHand = (choice: string) => {
        moves.returnToHand(choice);
    }

    const returnToHandDialog = <ChoiceDialog
        callback={returnToHand}
        choices={pub.develop.map(bcid => {
            return {
                label: sjCardById(bcid).name,
                value: bcid.toString(),
                // disabled: !returnDevCardCheck(G, ctx, playerID, bcid),
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""}
        show={isActive && ctx.phase === 'develop'}
        title={"请选择需要返回手牌的发展牌"} toggleText={"发展牌回手"} initial={false}
    />

    const [rescueCard, setRescueCard] = useState("");
    const [rescueCardChosen, setRescueCardChosen] = useState(false);
    const rescueGenerals = generalWithOpponentTroop(G, playerID);
    const rescueGeneralDialog = <ChoiceDialog
        callback={(c) => {
            if (rescueGenerals.length === 1) {
                moves.rescueGeneral({
                    general: rescueGenerals[0],
                    card: c,
                })
            } else {
                setRescueCard(c);
                setRescueCardChosen(true);
            }
        }}
        choices={pub.develop.map(bcid => {
            return {
                label: sjCardById(bcid).name,
                value: bcid.toString(),
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""}
        // actualStage(G,ctx)==='rescueGeneral'
        show={isActive && pub.develop.length > 0 && rescueGenerals.length > 0}
        title={"请选择救援将领的发展牌"} toggleText={"发展牌救援"} initial={false}
    />
    const chooseRescueGeneralsDialog = <ChoiceDialog
        callback={(c) => {
            const general: General = parseInt(c);
            setRescueCardChosen(false);

            moves.rescueGeneral({
                general: general,
                card: rescueCard,
            })

        }} choices={rescueGenerals.map(gen => {
        return {
            label: getGeneralNameByCountry(ctr, gen),
            value: gen.toString(),
            disabled: false,
            hidden: false
        }
    })} show={isActive && rescueCardChosen}
        defaultChoice={""}
        title={"请选择要救援的将领"} toggleText={"救援将领"} initial={true}/>

    const emperorDialog = <ChoiceDialog
        callback={(c) => moves.emperor(c)}
        choices={pub.cities.map(c => {
            return {
                label: getCityText(c),
                value: c,
                disabled: false,
                hidden: false
            }
        })}
        defaultChoice={""}
        show={isActive && ctr === Country.SONG && actualStage(G, ctx) === 'emperor'}
        title={"请选择拥立目标城市"} toggleText={"拥立"} initial={false}
    />

    const confirmRespondDialog = <ChoiceDialog
        callback={(c) => {
            const opponent = c === "yes";
            moves.confirmRespond({choice:opponent,text:confirmRespondLogText(G,opponent,ctr)})
        }}
        choices={[
            {label: "是", value: "yes", disabled: false, hidden: false},
            {label: "否", value: "no", disabled: false, hidden: false}
        ]} defaultChoice={"no"}
        show={isActive && actualStage( G,ctx)==='confirmRespond'}
        title={confirmRespondText(G, ctx, playerID)}
        toggleText={"请求确认"}
        initial={true}/>

    const develop = (choice: string) => {
        moves.develop(choice);
    }

    const developDialog = <ChoiceDialog
        callback={develop}
        defaultChoice={DevelopChoice.CIVIL}
        choices={[
            {
                label: DevelopChoice.COLONY, value: DevelopChoice.COLONY,
                disabled: false,
                hidden: country !== Country.JINN
            },
            {
                label: DevelopChoice.MILITARY, value: DevelopChoice.MILITARY,
                disabled: false,
                // disabled: pub.military === 7 || pub.military + 1 > remainDevelopPoint,
                hidden: false
            },
            {
                label: DevelopChoice.POLICY_DOWN, value: DevelopChoice.POLICY_DOWN,
                disabled: G.policy <= -3,
                // disabled: remainDevelopPoint < 3,
                hidden: country !== Country.SONG
            },
            {
                label: DevelopChoice.POLICY_UP, value: DevelopChoice.POLICY_UP,
                disabled: G.policy >= 3,
                // disabled: remainDevelopPoint < 3,
                hidden: country !== Country.SONG
            },
            {
                label: DevelopChoice.CIVIL, value: DevelopChoice.CIVIL,
                disabled: false,
                // disabled: pub.civil === 7 || pub.civil + 1 > remainDevelopPoint,
                hidden: false
            },
            {
                label: DevelopChoice.EMPEROR, value: DevelopChoice.EMPEROR,
                disabled: G.song.emperor !== null
                    || pub.usedDevelop > 0
                    || G.events.includes(ActiveEvents.JinBingLaiLe),
                hidden: country !== Country.SONG
            },

        ]}
        show={isActive && ctx.phase === 'develop'}
        title={"请选择发展项目"} toggleText={"发展"} initial={false}
    />


    const takePlan = (choices: string[]) => {
        moves.takePlan(choices)
    };
    const takePlanDialog = <CheckBoxDialog
        callback={takePlan}
        choices={G.plans.map(p => {
            return {
                label: getPlanById(p).name,
                value: p,
                disabled: false,
                hidden: false
            }
        })}
        show={isActive && ctx.phase === 'resolvePlan' && G.plans.length > 0} title={"选择计划"}
        toggleText={"选择完成的计划"}
        initial={true}/>

    const chooseTopPlanDialog =
        <ChoiceDialog
            callback={(p) => moves.chooseTop(p)}
            choices={pub.completedPlan.map(p => {
                return {
                    label: getPlanById(p).name,
                    value: p,
                    disabled: false,
                    hidden: false
                }
            })}
            show={isActive && ctx.phase === 'resolvePlan' && pub.completedPlan.length > 0} title={"顶端计划"}
            toggleText={"选择放在顶端的计划"}
            initial={true} defaultChoice={""}/>

    const skillGeneral = getSkillGeneral(G, playerID);
    const generalSkillDialog = <ChoiceDialog
        callback={(c) => {
            const g: General = parseInt(c) as General;
            moves.generalSkill({country: ctr, general: g})
        }} choices={skillGeneral.map(gen => {
        return {
            label: getGeneralNameByCountry(ctr, gen),
            value: gen.toString(),
            disabled: false,
            hidden: false
        }
    })} show={isActive && skillGeneral.length > 0}
        defaultChoice={""}
        title={"请选择横置将领"} toggleText={"横置将领"} initial={false}/>

    const recruitPuppetDialog = <ChoiceDialog
        callback={(c) => {
            moves.recruitPuppet(c);
        }} choices={G.jinn.cities.map(c => {
        return {label: getCityText(c), value: c, hidden: false, disabled: false}
    })} defaultChoice={""} show={isActive && ctr === Country.JINN} title={"选择征伪城市"} toggleText={"征募伪军"}
        initial={false}/>

    const recruitPhases = ['action', 'deploy'];

    const recruitDialog = <ChooseUnitsDialog
        callback={(u) => moves.recruitUnit(u)} max={pub.standby}
        initUnits={pub.standby.map(() => 0)}
        show={isActive && recruitPhases.includes(ctx.phase)}
        title={"征募"} toggleText={"请选择要征募的兵种"} initial={false} country={ctr}
    />

    const [count, setCount] = useState(5);
    const adjustDice = (n: number) => {
        const newDice = count + n;
        if (newDice <= 1) {
            setCount(1);
        } else {
            if (newDice >= MAX_DICES) {
                setCount(MAX_DICES);
            } else {
                setCount(newDice);
            }
        }

    }

    const jianLiDaQiButton = <CheckBoxDialog
        callback={(c) => moves.jianLiDaQi(c)} choices={G.jinn.provinces.map((prov) => {
        return {label: prov, value: prov, disabled: false, hidden: false}
    })} show={isActive && actualStage(G, ctx) === 'jianLiDaQi'} title={"选择齐控制的路"} toggleText={"建立大齐"}
        initial={true}/>

    const emptyRoundButton = ctx.phase === 'action' && <Button
        disabled={player.hand.length + G.round > 9}
        onClick={() => moves.emptyRound()}>空过</Button>

    const opponentButton = <Button
        disabled={false}
        onClick={() => moves.opponentMove()}>对方操作</Button>
    const sDice: number[] = pub.dices.length > 0 ? pub.dices[pub.dices.length - 1] : [];

    return <Grid container>

        宋<Dices pub={G.song}/>
        金<Dices pub={G.jinn}/>

        <Grid item>
            <Button onClick={() => adjustDice(-5)}>-5</Button>
            <Button onClick={() => adjustDice(-1)}>-1</Button>
            <Button onClick={() => moves.rollDices({count: count, idx: pub.dices.length})}>掷{count}个骰子</Button>
            <Button onClick={() => adjustDice(1)}>+1</Button>
            <Button onClick={() => adjustDice(5)}>+5</Button>
        </Grid>
        {endRound}
        {emptyRoundButton}
        {opponentButton}
        {jianLiDaQiButton}
        {showLetters}
        {showPlan}
        {showCC}
        {confirmRespondDialog}
        {rescueGeneralDialog}
        {chooseRescueGeneralsDialog}

        {recruitPuppetDialog}
        {takePlanDialog}
        {chooseTopPlanDialog}
        {combatCardDialog}
        {developDialog}
        {returnToHandDialog}
        {emperorDialog}
        {chooseFirstDialog}
        {choosePlanDialog}
        {generalSkillDialog}

        {recruitDialog}
        {discardDialog}
        {searchDialog}
    </Grid>
}