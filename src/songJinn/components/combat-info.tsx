import React, {useState} from "react";
import {MAX_DICES, SJPlayer, SJPubInfo, SongJinnGame} from "../constant/general";
import {Ctx, PlayerID} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import {getCityText, getReadyGeneralNames, getStateById, getTroopText, sjCardById, unitsToString} from "../util";
import {getPlanById} from "../constant/plan";
import ChoiceDialog from "../../components/modals";
import {ShowCards} from "./show-cards";
import ErrorBoundary from "../../components/error";
import {Dices} from "./dices";
import Button from "@material-ui/core/Button";


export interface ICombatInfo {
    G: SongJinnGame,
    pid: PlayerID | null,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean
}

export const CountryPubInfo = ({G, pid, moves, isActive}: ICombatInfo) => {
    const s = G.combat;

    const pub = pid === null ? G.song : getStateById(G, pid);
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
    const diceRoller = <Grid item>
        <Button onClick={() => adjustDice(-5)}>-5</Button>
        <Button onClick={() => adjustDice(-1)}>-1</Button>
        <Button onClick={() => moves.rollDices({count: count, idx: pub.dices.length})}>掷{count}个骰子</Button>
        <Button onClick={() => adjustDice(1)}>+1</Button>
        <Button onClick={() => adjustDice(5)}>+5</Button>
    </Grid>

    return <>{s.ongoing &&
            <Grid container item xs={12}>
                <div><label>进攻方：</label>{s.attacker}</div>
                <div><label>类型：</label>{s.type}</div>
                <div><label>类型：</label>{}</div>
                <div><label>宋军：</label>{getTroopText(G, s.song.troop)}</div>
                <div><label>金军：</label>{getTroopText(G, s.jinn.troop)}</div>
                宋<Dices pub={G.song}/>
                金<Dices pub={G.jinn}/>
                {pid !== null && isActive && {diceRoller}}
            </Grid>
    }</>
}