import React, { useState } from "react";
import {
    Country,
    MAX_DICES, RegionID,
    SJPlayer,
    SongJinnGame,
} from "../constant/general";
import { Ctx, LogEntry, PlayerID } from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import {
    ciJinnTroop,
    ciSongTroop,
    confirmRespondChoices,
    confirmRespondLogText,
    confirmRespondText,
    getCityText,
    getRegionText, getRetreatDst,
    getTroopText, placeToStr,
    sjCardById,
} from "../util";
import { Dices } from "./dices";
import Button from "@material-ui/core/Button";
import Paper from "@material-ui/core/Paper";
import { actualStage } from "../../game/util";
import ChoiceDialog from "../../components/modals";
import CheckBoxDialog from "./choice";
import { TakeDamageDialog } from "./take-damage";


export interface ICombatInfo {
    G: SongJinnGame,
    pid: PlayerID | null,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>;
    isActive: boolean,
    log: LogEntry[]
}


export const CombatInfoPanel = ({ G, ctx, pid, moves, isActive }: ICombatInfo) => {
    const s = G.combat;

    const pub = pid === SJPlayer.P1 ? G.song : G.jinn;
    const ctr = pid === SJPlayer.P1 ? Country.SONG : Country.JINN;
    const troop = pid === SJPlayer.P1 ? ciSongTroop(G) : ciJinnTroop(G);
    const [count, setCount] = useState(5);

    const retreatDialog = <ChoiceDialog
        callback={(c) => {
            const regID = parseInt(c) as RegionID;
            moves.retreat({
                src: troop,
                dst: regID,
                country: troop.g
            })
        }}
        choices={getRetreatDst(G, troop).map(r => {
            return {
                label: placeToStr(r),
                value: r.toString(),
                hidden: false,
                disabled: false
            }
        })} defaultChoice={""}
        show={isActive
            // && actualStage(G, ctx) === 'retreat'
            && actualStage(G, ctx) === 'react'
        }
        title={"选择撤退目标区域"}
        popAfterShow={false}
        toggleText={"撤退"} initial={false} />;

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
    const takeDamageDialog = <TakeDamageDialog
        callback={(r: number[], s: number[]) => {
            moves.takeDamage({
                ready: r,
                standby: s,
                src: troop.p,
                c: troop.g,
                city: troop.c,
            });
        }}
        G={G}
        p={troop.p}
        c={troop.c}
        show={isActive && actualStage(G, ctx) === 'takeDamage'}
        country={troop.g}
        initUnits={troop.u.map(() => 0)}
        max={troop.u}
        initial={false}
    />

    React.useEffect(() => {
        if (isActive && actualStage(G, ctx) === 'showCC') {
            if (pid !== null) {
                moves.showCC(G.player[pid as SJPlayer].combatCard)
            } else {
                console.log('pid is null');
            }
        } else {
            console.log('not in stage');
        }
    }, [isActive, ctx.activePlayers])

    React.useEffect(() => {
        if (isActive && actualStage(G, ctx) === 'combatCard') {
            if (pid !== null) {
                if (G.player[pid as SJPlayer].hand.filter(c => sjCardById(c).combat).length === 0) {
                    moves.combatCard([])
                } else {
                    console.log('hasCC');
                }
            } else {
                console.log('pid is null');
            }
        } else {
            console.log('not in stage');
        }
    }, [isActive, ctx.activePlayers])

    return <>
        <Grid container item xs={12}><Paper>

            <div><label></label>{s.atk}</div>
            <div><label>进攻方：</label>{s.atk}</div>
            <div><label>类型：</label>{s.ongoing ? `(*)${s.type}` : `${s.type}`}</div>
            <div><label>阶段：</label>{s.phase}</div>
            <div><label>区域：</label>{s.region === null ? "" : `${getRegionText(s.region)}`}</div>
            <div><label>城市：</label>{s.city === null ? "" : `${getCityText(s.city)}`}</div>
            {s.region === null && s.city === null ? <></> :
                <>
                    <div><label>宋军：</label>{G.song.troops.map(
                        (t, idx) => {
                            if (t.p === s.region || t.c === s.city) {
                                return <label key={`song-label-troop-${idx}`}>
                                    {getTroopText(G, t)}
                                </label>
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
                </>}
            <div><label>宋未处理伤害：</label>{s.song.damageLeft}</div>
            <div><label>金未处理伤害：</label>{s.jinn.damageLeft}</div>
            <div><label>宋战斗牌：</label>{s.song.combatCard.map(c => sjCardById(c).name)}</div>
            <div><label>金战斗牌：</label>{s.jinn.combatCard.map(c => sjCardById(c).name)}</div>
            宋骰子<Dices pub={G.song} />
            金骰子<Dices pub={G.jinn} />
            {pid !== null ? <>
                {
                    (isActive && actualStage(G, ctx) === 'showCC') && <Button
                        onClick={() => moves.showCC(G.player[pid as SJPlayer].combatCard)}
                        color={"primary"} variant={"contained"}>展示战斗牌</Button>
                }
                <CheckBoxDialog
                    callback={(c) => moves.combatCard(c)}
                    choices={G.player[pid as SJPlayer].hand.filter(c => sjCardById(c).combat).map(c => {
                        return {
                            label: sjCardById(c).name,
                            value: c,
                            disabled: false,
                            hidden: false
                        }
                    })}
                    show={isActive && actualStage(G, ctx) === 'combatCard'} title={"请选择战斗牌"}
                    toggleText={"战斗牌"} initial={false} />
                <ChoiceDialog
                    callback={(c) => {
                        moves.confirmRespond({ choice: c, text: confirmRespondLogText(G, c, ctr) })
                    }}
                    choices={confirmRespondChoices(G, ctx, pid)} defaultChoice={"no"}
                    show={isActive && G.combat.ongoing && actualStage(G, ctx) === 'confirmRespond'}
                    title={confirmRespondText(G, ctx, pid)}
                    toggleText={"请求确认"}
                    initial={true} />;

                {retreatDialog}
                {takeDamageDialog}
            </> : <></>}

            {pid !== null && isActive && <Grid item>
                <Button key={'adjust-5'} onClick={() => adjustDice(-5)}>-5</Button>
                <Button key={'adjust-1'} onClick={() => adjustDice(-1)}>-1</Button>
                <Button key={`roll-sj-dice-button-${pid}`}
                    onClick={() => moves.rollDices({ count: count, idx: pub.dices.length })}>掷{count}个骰子</Button>
                <Button key={'adjust+1'} onClick={() => adjustDice(1)}>+1</Button>
                <Button key={'adjust+5'} onClick={() => adjustDice(5)}>+5</Button>
            </Grid>}
        </Paper>
        </Grid>
    </>
}