import React, {useState} from "react";
import {
    emptySongTroop,
    MAX_DICES,
    SJPlayer,
    SongJinnGame,
    UNIT_SHORTHAND,
    accumulator,
} from "../constant/general";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import {
    getCityText,
    getRegionText,
    getTroopText,
    unitsToString
} from "../util";
import {Dices} from "./dices";
import Button from "@material-ui/core/Button";
import {ChooseUnitsDialog} from "./recruit";
import Paper from "@material-ui/core/Paper";
import {actualStage} from "../../game/util";


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
                        return <></>
                    }

                })}</div>
            <div><label>金军：</label>{G.jinn.troops.map(
                (t, idx) => {
                    if (t.p === s.region || t.c === s.city) {
                        return <label key={`jinn-label-troop-${idx}`}>{getTroopText(G, t)}</label>
                    } else {
                        return <></>
                    }

                })}</div>
            <div><label>宋未处理伤害：</label>{s.song.damageLeft}</div>
            <div><label>金未处理伤害：</label>{s.jinn.damageLeft}</div>
            <div><label>宋战斗牌：</label>{s.song.combatCard}</div>
            <div><label>金战斗牌：</label>{s.jinn.combatCard}</div>
            宋<Dices pub={G.song}/>
            金<Dices pub={G.jinn}/>
            {takeDamageStandbyDialog}
            {takeDamageReadyDialog}

            {isActive && actualStage(G, ctx) === 'takeDamage' && <Button
                fullWidth onClick={() => {
                moves.takeDamage({
                    src: troop.p,
                    c: troop.g,
                    idx: 0,
                    ready: standbyUnits,
                    standby: readyUnits
                });
                setReadyUnits(emptyTroop.u);
                setStandbyUnits(emptyTroop.u);
            }} variant={"outlined"} color={"primary"}>
                确认受创{readyText} {standbyText}
            </Button>}
            {log.length}
            {pid !== null && isActive && <Grid item>
                <Button onClick={() => adjustDice(-5)}>-5</Button>
                <Button onClick={() => adjustDice(-1)}>-1</Button>
                <Button onClick={() => moves.rollDices({count: count, idx: pub.dices.length})}>掷{count}个骰子</Button>
                <Button onClick={() => adjustDice(1)}>+1</Button>
                <Button onClick={() => adjustDice(5)}>+5</Button>
            </Grid>}
        </Paper>
        </Grid>
    }</>
}