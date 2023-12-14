import React, {useState} from "react";
import {accumulator, emptySongTroop, MAX_DICES, SJPlayer, SongJinnGame, UNIT_SHORTHAND,} from "../constant/general";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import {
    confirmRespondLogText,
    confirmRespondText,
    getCityText,
    getRegionText,
    getTroopText,
    playerById,
    sjCardById,
    unitsToString
} from "../util";
import {Dices} from "./dices";
import Button from "@material-ui/core/Button";
import {ChooseUnitsDialog} from "./recruit";
import Paper from "@material-ui/core/Paper";
import {actualStage} from "../../game/util";
import ChoiceDialog from "../../components/modals";
import CheckBoxDialog from "./choice";


export interface ICombatInfo {
    G: SongJinnGame,
    pid: PlayerID | null,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean,
    log: LogEntry[]
}


export const CombatInfoPanel = ({G, ctx, pid, moves, isActive, log}: ICombatInfo) => {
    const s = G.combat;

    const pub = pid === SJPlayer.P1 ? G.song : G.jinn;
    const cci = pid === SJPlayer.P1 ? s.song : s.jinn;
    const opCCI = pid === SJPlayer.P2 ? s.song : s.jinn;
    const troop = pid === SJPlayer.P1 ? s.song.troop : s.jinn.troop;
    const [count, setCount] = useState(5);

    const emptyTroop = emptySongTroop();

    const [readyUnits, setReadyUnits] = React.useState(emptyTroop.u);
    const [standbyUnits, setStandbyUnits] = React.useState(emptyTroop.u);
    const readySum = readyUnits.reduce(accumulator);
    const standbySum = standbyUnits.reduce(accumulator);
    const readyText = readySum > 0 ? `溃${unitsToString(readyUnits)}` : '';
    const standbyText = standbySum > 0 ? `死${unitsToString(standbyUnits)}` : '';
    const unitNames = pid === SJPlayer.P2 ? UNIT_SHORTHAND[1] : UNIT_SHORTHAND[0];


    const takeDamageReadyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setReadyUnits(u);
        }} max={troop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && actualStage(G, ctx) === 'takeDamage'} title={"选择被击溃的部队"}
        toggleText={"击溃"} initial={false} country={troop.g}/>

    const takeDamageStandbyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setStandbyUnits(u);
        }} max={troop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && actualStage(G, ctx) === 'takeDamage'} title={"选择要被消灭的部队"}
        toggleText={"消灭部队"} initial={false} country={troop.g}/>


    const mockStandby = {
        g: troop.g,
        p: troop.p,
        c: troop.c,
        u: standbyUnits
    }
    const mockReady = {
        g: troop.g,
        p: troop.p,
        c: troop.c,
        u: readyUnits
    }

    const getAllEndurance = () => {
        const all = [...emptyTroop.u]
        for (let i = 0; i < emptyTroop.u.length; i++) {
            all[i] = readyUnits[i] + standbyUnits[i];
        }

    }

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
    const npid = pid === SJPlayer.P1 ? SJPlayer.P1 : SJPlayer.P2;
    const player = playerById(G, npid);
    const showCC = (isActive && actualStage(G, ctx) === 'showCC') && <Button
        onClick={() => moves.showCC(player.combatCard)}
        color={"primary"} variant={"contained"}>展示战斗牌</Button>
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


    const choiceDialog = <ChoiceDialog
        callback={(c) => {
            const opponent = c === "yes";
            moves.confirmRespond({choice: opponent, text: confirmRespondLogText(G, opponent, ctr)})
        }}
        choices={[
            {label: "是", value: "yes", disabled: false, hidden: false},
            {label: "否", value: "no", disabled: false, hidden: false}
        ]} defaultChoice={"no"}
        show={isActive && actualStage(G, ctx) === 'confirmRespond' && G.combat.ongoing}
        title={confirmRespondText(G, ctx, npid)}
        toggleText={"请求确认"}
        initial={true}/>;

    return <>{s.ongoing &&
        <Grid container item xs={12}><Paper>
            <div><label>进攻方：</label>{s.atk}</div>
            <div><label>类型：</label>{s.type}</div>
            <div><label>阶段：</label>{s.phase}</div>
            <div><label>区域：</label>{s.region === null ? "" : `${getRegionText(s.region)}`}</div>
            <div><label>城市：</label>{s.city === null ? "" : `${getCityText(s.city)}`}</div>
            <div><label>宋军：</label>{G.song.troops.map(
                (t, idx) => {
                    if (t.p === s.region || t.c === s.city) {
                        return <label key={`song-label-troop-${idx}`}>{getTroopText(G, t)}</label>
                    } else {
                        return <label key={`song-label-troop-${idx}`}> {" "}</label>
                    }

                })}</div>
            <div><label>金军：</label>{G.jinn.troops.map(
                (t, idx) => {
                    if (t.p === s.region || t.c === s.city) {
                        return <label key={`jinn-label-troop-${idx}`}>{getTroopText(G, t)}</label>
                    } else {
                        return <label key={`jinn-label-troop-${idx}`}> {" "}</label>
                    }

                })}</div>
            <div><label>宋未处理伤害：</label>{s.song.damageLeft}</div>
            <div><label>金未处理伤害：</label>{s.jinn.damageLeft}</div>
            <div><label>宋战斗牌：</label>{s.song.combatCard}</div>
            <div><label>金战斗牌：</label>{s.jinn.combatCard}</div>
            宋骰子<Dices pub={G.song}/>
            金骰子<Dices pub={G.jinn}/>
            {takeDamageStandbyDialog}
            {takeDamageReadyDialog}

            {choiceDialog}

            {isActive && actualStage(G, ctx) === 'takeDamage' && <Button
                fullWidth onClick={() => {
                moves.takeDamage({
                    src: troop.p,
                    c: troop.g,
                    idx: 0,
                    ready: readyUnits,
                    standby: standbyUnits
                });
                setReadyUnits(emptyTroop.u);
                setStandbyUnits(emptyTroop.u);
            }} variant={"outlined"} color={"primary"}>
                确认受创{readyText} {standbyText}
            </Button>}
            {log.length}
            {pid !== null && isActive && <Grid item>
                <Button key={'adjust-5'} onClick={() => adjustDice(-5)}>-5</Button>
                <Button key={'adjust-1'} onClick={() => adjustDice(-1)}>-1</Button>
                <Button key={`roll-sj-dice-button-${pid}`}
                        onClick={() => moves.rollDices({count: count, idx: pub.dices.length})}>掷{count}个骰子</Button>
                <Button key={'adjust+1'} onClick={() => adjustDice(1)}>+1</Button>
                <Button key={'adjust+5'} onClick={() => adjustDice(5)}>+5</Button>
            </Grid>}
        </Paper>
        </Grid>
    }</>
}