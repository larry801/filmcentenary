import React, {useState} from "react";
import {
    Country,
    emptySongTroop,
    MAX_DICES,
    SJPlayer,
    SJPubInfo,
    SongJinnGame,
    UNIT_SHORTHAND
} from "../constant/general";
import {Ctx, PlayerID} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import {
    getCityText,
    getReadyGeneralNames,
    getStateById,
    getTroopText,
    sjCardById,
    unitsToString,
    pid2ctr
} from "../util";
import {getPlanById} from "../constant/plan";
import ChoiceDialog from "../../components/modals";
import {ShowCards} from "./show-cards";
import ErrorBoundary from "../../components/error";
import {Dices} from "./dices";
import Button from "@material-ui/core/Button";
import {ChooseUnitsDialog} from "./recruit";
import Paper from "@material-ui/core/Paper";


export interface ICombatInfo {
    G: SongJinnGame,
    pid: PlayerID | null,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean
}

enum TakeDamageStep {
    TROOP,
    READY,
    STANDBY
}

export const CombatInfoPanel = ({G, pid, moves, isActive}: ICombatInfo) => {
    const s = G.combat;

    const pub = pid === SJPlayer.P1 ? G.song : G.jinn;
    const cci = pid === SJPlayer.P1 ? s.song : s.jinn;
    const [count, setCount] = useState(5);

    const emptyTroop = emptySongTroop();

    const [takeDamageStep, setTakeDamageStep] = React.useState(TakeDamageStep.READY);
    const [takeDamageTroop, setTakeDamageTroop] = useState(emptyTroop);
    const [takeDamageReadyUnits, setTakeDamageReadyUnits] = React.useState(emptyTroop.u);
    const unitNames = pid === SJPlayer.P2 ? UNIT_SHORTHAND[1] : UNIT_SHORTHAND[0];

    const takeDamageReadyDialog = <ChooseUnitsDialog
        callback={(u) => {
            setTakeDamageStep(TakeDamageStep.STANDBY)
            setTakeDamageReadyUnits(u)
        }} max={takeDamageTroop.u} initUnits={unitNames.map(() => 0)}
        show={isActive && cci.damageLeft >= 0 } title={"选择被击溃的部队"}
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
            <div><label>宋军：</label>{getTroopText(G, s.song.troop)}</div>
            <div><label>金军：</label>{getTroopText(G, s.jinn.troop)}</div>
            <div><label>宋未处理伤害：</label>{s.song.damageLeft}</div>
            <div><label>金未处理伤害：</label>{s.jinn.damageLeft}</div>
            <div><label>宋战斗牌：</label>{s.song.combatCard}</div>
            <div><label>金战斗牌：</label>{s.jinn.combatCard}</div>
            宋<Dices pub={G.song}/>
            金<Dices pub={G.jinn}/>
            {takeDamageStandbyDialog}
            {takeDamageReadyDialog}
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