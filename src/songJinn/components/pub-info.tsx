import React from "react";
import {Ctx} from "boardgame.io";
import {SongJinnGame} from "../constant/setup";
import Grid from "@material-ui/core/Grid";
import {getPolicy, unitsToString} from "../util/fetch";
import {getJinnPower, getSongPower} from "../util/calc";
import Paper from "@material-ui/core/Paper";
import {getPlanById} from "../constant/plan";
import {eventCardById} from "../constant/cards";

export interface IPubInfo {
    G: SongJinnGame,
    ctx: Ctx
}

export const PubInfo = ({G, ctx}: IPubInfo) => {
    const s = G.song;
    const j = G.jinn;
    return <Grid container><Grid item><Paper>
        <label>宋</label>
        <div><label>军事：</label>{s.military}</div>
        <div><label>内政：</label>{s.civil}</div>
        <div><label>政策：</label>{getPolicy(G, ctx)}</div>
        <div><label>国力：</label>{getSongPower(G)}</div>
        <div><label>腐败：</label>{s.corruption}</div>
        <div><label>预备区：{unitsToString(s.ready)}</label></div>
        <div><label>备用兵区： {unitsToString(s.standby)}</label></div>
        <div><label>本回合计划：{s.plan.map(p => getPlanById(p).name)}</label></div>
        <div><label>完成计划：{s.completedPlan.map(p => getPlanById(p).name)}</label></div>
        <div><label>弃牌：{s.discard.map(p => eventCardById(p).name)}</label></div>
        <div><label>移除：{s.remove.map(p => eventCardById(p).name)}</label></div>
        <div><label>手牌数：</label></div>
        <div><label>发展牌：{s.remove.map(p => eventCardById(p).name)}</label></div>
        {G.turn > 6 && <div><label>绍兴和议分数：</label></div>}
    </Paper></Grid>
        <Grid item><Paper><label>金</label>
            <div><label>军事：</label>{j.military}</div>
            <div><label>内政：</label>{j.civil}</div>
            <div><label>殖民：</label>{G.colony}</div>
            <div><label>国力：</label>{getJinnPower(G)}</div>
            <div><label>腐败：</label>{j.corruption}</div>
            <div><label>预备区：
                {unitsToString(j.ready)}</label></div>
            <div><label> 备用兵区： {unitsToString(j.standby)}</label></div>
            <div><label>本回合计划：{j.plan.map(p => getPlanById(p).name)}</label></div>
            <div><label>完成计划：{j.completedPlan.map(p => getPlanById(p).name)}</label></div>
            {/* TODO 手牌数 弃牌 移除 */}
            <div><label>弃牌：{j.discard.map(p => eventCardById(p).name)}</label></div>
            <div><label>移除：{j.remove.map(p => eventCardById(p).name)}</label></div>
            <div><label>手牌数：</label></div>
            <div><label>发展牌：{j.develop.map(p => eventCardById(p).name)}</label></div>
            {G.turn > 6 && <div><label>绍兴和议分数：</label></div>}
        </Paper></Grid>
    </Grid>
}