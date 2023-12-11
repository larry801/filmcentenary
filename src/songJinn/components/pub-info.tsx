import React from "react";
import {Ctx} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import {getPlanById} from "../constant/plan";
import {SJPlayer, SongJinnGame} from "../constant/general";
import Typography from "@material-ui/core/Typography";

import {
    getCityText,
    getJinnPower,
    getJinnScore,
    getPolicy,
    getReadyGeneralNames,
    getSongPower, getSongScore,
    phaseName, sjCardById, totalDevelop,
    unitsToString
} from "../util";
import ChoiceDialog from "../../components/modals";
import {ShowCards} from "./show-cards";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";

export interface IPubInfo {
    G: SongJinnGame,
    ctx: Ctx
}

export const PubInfo = ({G, ctx}: IPubInfo) => {
    const s = G.song;
    const j = G.jinn;
    return <Grid container>
        <Grid item xs={12} key={`game-info`}>
            第{G.turn}回合 第{G.round}轮 {phaseName(ctx.phase)}
        </Grid>
        <Grid item xs={6} key={`song-pub`}><Paper>
            <label>宋</label>
            <div><label>军事：</label>{s.military}</div>
            <div><label>内政：</label>{s.civil}</div>
            <div><label>政策：</label>{getPolicy(G, ctx)}</div>
            <div><label>国力：</label>{getSongPower(G)}</div>
            <div><label>腐败：</label>{s.corruption}</div>
            <div><label>盟国：</label>{s.nations.join('')}</div>
            <div><label>预备区：{unitsToString(s.ready)} {getReadyGeneralNames(G, SJPlayer.P1).join('')}</label></div>
            <div><label>备用兵区： {unitsToString(s.standby)}</label></div>
            <div><label>本回合计划：{s.plan.map(p => getPlanById(p).name)}</label></div>
            <div><label>完成计划：</label><br/>
                {s.completedPlan.map(p => <label key={`jinn-plan-name-${p}`}>{getPlanById(p).name}</label>)}
            </div>
            <div>控制路：<br/>{s.provinces.map(p => <label key={ `jinn-prov-${p}`}>{p}<br/></label>)}</div>

            <ChoiceDialog callback={() => {
            }} choices={
                s.cities.map(c => {
                    const city = getCityById(c);
                    const region = getRegionById(city.region);
                    return {
                        label: getCityText(c),
                        value: c,
                        hidden: false,
                        disabled: true
                    }
                })
            } defaultChoice={""} show={true} title={"查看占领城市"} toggleText={"城市"} initial={false}/>
            <div><ShowCards cards={s.discard} title={"查看弃牌"} toggleText={"弃牌"}/></div>
            <div><ShowCards cards={s.remove} title={"查看移除"} toggleText={"移除牌"}/></div>
            {s.dices.length > 0 && <Typography>
                {s.dices.join(',')}中
                {s.dices.filter(d => d > 3).length}
                |{s.dices.filter(d => d > 4).length}
                |{s.dices.filter(d => d > 5).length}
                {/*<div><label>手牌数：</label></div>*/}
                <div><label>发展牌：{s.develop.map(p => `${sjCardById(p).name}|${sjCardById(p).op}`)}</label></div>
            </Typography>}
            {ctx.phase === 'develop' &&
                <div><label> 使用/总发展点数： {s.usedDevelop}/{totalDevelop(G, ctx, SJPlayer.P1)} </label></div>}
            {G.turn > 6 && <div><label>绍兴和议分数：{getSongScore(G)}</label></div>}
        </Paper></Grid>
        <Grid item xs={6} key={`jinn-pub`}><Paper><label>金</label>
            <div><label>军事：</label>{j.military}</div>
            <div><label>内政：</label>{j.civil}</div>
            <div><label>殖民：</label>{G.colony}</div>
            <div><label>国力：</label>{getJinnPower(G)}</div>
            <div><label>腐败：</label>{j.corruption}</div>
            <div><label>盟国：</label>{j.nations.join('')}</div>
            <div><label>预备区：{unitsToString(j.ready)}{getReadyGeneralNames(G, SJPlayer.P2).join('')}</label></div>
            <div><label>备用兵区： {unitsToString(j.standby)}</label></div>
            <div><label>本回合计划：{j.plan.map(p => getPlanById(p).name)}</label></div>
            <div><label>完成计划：</label><br/>
                {j.completedPlan.map(p => <label key={ `song-jinn-${p}`}>{getPlanById(p).name}</label>)}
            </div>
            <div>控制路：<br/>{j.provinces.map(p => <label key={ `song-jinn-${p}`}>{p}<br/></label>)}</div>
            <ChoiceDialog callback={() => {
            }} choices={
                j.cities.map(c => {
                    const city = getCityById(c);
                    const region = getRegionById(city.region);
                    return {
                        label: getCityText(c),
                        value: c,
                        hidden: false,
                        disabled: true
                    }
                })
            } defaultChoice={""} show={true} title={"查看占领城市"} toggleText={"城市"} initial={false}/>
            {/* TODO 手牌数 在pubInfo里面维护一个还是 playerView */}
            <div><ShowCards cards={j.discard} title={"查看弃牌"} toggleText={"弃牌"}/></div>
            <div><ShowCards cards={j.remove} title={"查看移除"} toggleText={"移除牌"}/></div>

            {j.dices.length > 0 && <Typography>{j.dices.join(',')}中
                {j.dices.filter(d => d > 3).length}
                |{j.dices.filter(d => d > 4).length}
                |{j.dices.filter(d => d > 5).length}
            </Typography>}
            {/*<div><label>手牌数：</label></div>*/}
            <div><label>发展牌：{j.develop.map(p => `${sjCardById(p).name}|${sjCardById(p).op}`)}</label></div>
            {ctx.phase === 'develop' &&
                <div><label> 使用/总发展点数： {j.usedDevelop}/{totalDevelop(G, ctx, SJPlayer.P2)} </label></div>}
            {G.turn > 6 && <div><label>绍兴和议分数：{getJinnScore(G)}</label></div>}
        </Paper></Grid>
    </Grid>
}