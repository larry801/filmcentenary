import React from "react";
import {BoardProps} from "boardgame.io/react";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {Country, MountainPassID, OtherCountryID, RegionID, SJPlayer, UNIT_SHORTHAND} from "../constant/general";
import {getPlanById} from "../constant/plan";
import {getStateById, playerById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";
import Typography from "@material-ui/core/Typography";

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

    const chooseFirst = (choice: string) => {
        moves.chooseFirst(choice);
    }
    const choosePlan = (choice: string) => {
        moves.choosePlan(choice);
    }
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