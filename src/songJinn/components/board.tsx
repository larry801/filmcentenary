import React from "react";
import {BoardProps} from "boardgame.io/react";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {
    Country, MountainPassID, OtherCountryID, RegionID, SJPlayer, UNIT_SHORTHAND, DevelopChoice, 
    accumulator,
    SongUnit,
    JinnUnit
} from "../constant/general";
import {getPlanById} from "../constant/plan";
import {getStateById, playerById, getCountryById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";
import Typography from "@material-ui/core/Typography";
import {getCardById} from "./constant/cards";

export const SongJinnBoard = ({
                                  G,
                                  log,
                                  ctx,
                                  events,
                                  moves,
                                  undo,
                                  redo,
                                  matchData,
                                  matchID,
                                  playerID,
                                  isActive,
                                  isMultiplayer,
                                  isConnected
                              }: BoardProps<SongJinnGame>) => {

    const pub = getStateById(G, playerID as SJPlayer);
    const player = playerById(G, playerID as SJPlayer);
    const contry = getCountryById(playerID);
    const isSpectate = playerID === null;

    const recruit = (choice: string) => {
        moves.recruit(choice);
    }

    const recruitDialog = <ChoiceDialog
        callback={recruit}
        choices = {country === Country.SONG ? [
            {label:SongUnit.Bu,value:SongUnit.Bu,disabled:false,hidden:false},
            {label:SongUnit.Gong,value:SongUnit.Gong,disabled:false,hidden:false},
            {label:SongUnit.CHuan,value:SongUnit.Chuan,disabled:false,hidden:false},
        ] : [
            {label:JinnUnit.Bu,value:JinnUnit.Bu,disabled:false,hidden:false},
            {label:JinnUnit.Guai,value:JinnUnit.Guai,disabled:false,hidden:false},
            {label:JinnUnit.Tie,value:JinnUnit.Tie,disabled:false,hidden:false},
            {label:JinnUnit.Qian,value:JinnUnit.Qian,disabled:false,hidden:false},
            {label:JinnUnit.Qi,value:JinnUnit.Qi,disabled:false,hidden:!G.events.includes(ActiveEvents.JianLiDaQi)},
        ]}
        toggleText={"征募"} title={"请选择要征募的兵种"}
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
    const remainDevelop = remainDevelop(G, ctx, ctx.playerIDf);

    return <ErrorBoundary>
        <Grid container>
            <Grid item>
                {pub.troops.map((t, idx) => {
                    const c = t.c === null ? "" : getCityById(t.c).name;
                    const p = t.p === null ? "" : (typeof t.p === "number" ? getRegionById(t.p).name : t.p.toString());
                    let shortUnits = '';
                    switch (t.country) {
                        case Country.JINN:
                            UNIT_SHORTHAND[1].forEach((v, i) => {
                                if (t.u[i] > 0) {
                                    shortUnits += `${t.u[i]}${v}`
                                }
                            });
                            break;
                        case Country.SONG:
                            UNIT_SHORTHAND[0].forEach((v, i) => {
                                if (t.u[i] > 0) {
                                    shortUnits += `${t.u[i]}${v}`;
                                }
                            });
                            break;
                    }
                    return <Button key={`troop-${idx}`}>{p}|{c}|{shortUnits}</Button>;
                })}
            </Grid>
            <ChoiceDialog
                callback={returnToHand}
                choices={[
                    {
                        label: DevelopChoice.COLONY,value: DevelopChoice.COLONY,
                        disabled:false,
                        hidden:country!==Country.JINN
                    },
                    {
                        label: DevelopChoice.MILITARY,value: DevelopChoice.MILITARY,
                        disabled: pub.military === 7 || pub.military + 1 > remainDevelop,
                        hidden:false
                    },
                    {
                        label: DevelopChoice.POLICY,value: DevelopChoice.POLICY,
                        disabled: remainDevelop < 3,
                        hidden:country !== Country.SONG
                    },
                    {
                        label: DevelopChoice.CIVIL,value: DevelopChoice.CIVIL,
                        disabled: pub.civil === 7 || pub.civil + 1  > remainDevelop,
                        hidden: false
                    },
                    {
                        label: DevelopChoice.EMPEROR,value: DevelopChoice.EMPEROR,
                        disabled: G.song.emperor !== null || pub.usedDevelop > 0,
                        hidden: country !== Country.SONG
                    },

                ]}
                show={isActive && ctx.stage === 'returnToHand'}
                title={"请选择需要返回手牌的发展牌"} toggleText={"发展牌回手"} initial={true}
            />
            <ChoiceDialog
                callback={returnToHand}
                choices={pub.develop.map(bcid=>{
                    return {
                    label: getCardById(bcid).name,
                    value: bcid,
                    disabled: false,
                    hidden: false
                }})}
                show={isActive && ctx.stage === 'returnToHand'}
                title={"请选择需要返回手牌的发展牌"} toggleText={"发展牌回手"} initial={true}
            />
            <ChoiceDialog
                callback={discard}
                choices={player.hand.map(bcid=>{
                    return {
                    label: getCardById(bcid).name,
                    value: bcid,
                    disabled: false,
                    hidden: false
                }})}
                show={isActive && ctx.stage === 'discard'}
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
    </ErrorBoundary>
}