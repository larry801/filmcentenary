import React from "react";
import {Ctx, PlayerID} from "boardgame.io";
import Grid from "@material-ui/core/Grid";
import Paper from "@material-ui/core/Paper";
import {getPlanById} from "../constant/plan";
import Typography from "@material-ui/core/Typography";
import {ActiveEvents, SJPlayer, SJPubInfo, SongJinnGame} from "../constant/general";

import {
    getCityText,
    getJinnPower,
    getJinnScore,
    getPolicy,
    getReadyGeneralNames,
    getSeasonText,
    getSongPower,
    getSongScore, handDeckCards, isSongEvent,
    phaseName,
    stageName,
    pid2ctr,
    sjCardById,
    totalDevelop,
    unitsToString
} from "../util";
import ChoiceDialog from "../../components/modals";
import {ShowCards} from "./show-cards";
import ErrorBoundary from "../../components/error";
import {Dices} from "./dices";

export interface IPubInfo {
    G: SongJinnGame,
    ctx: Ctx
}

export interface ICPubInfo {
    G: SongJinnGame,
    pub: SJPubInfo,
    ctx: Ctx;
    pid: PlayerID;
}

export const CountryPubInfo = ({pub, G, ctx, pid}: ICPubInfo) => {
    const s = pub;

    const ready = pid === SJPlayer.P1 ? s.ready.slice(0,6) : s.ready;
    const standby = pid === SJPlayer.P1 ? s.standby.slice(0,6) : s.standby;
    const reversedPlan = [...s.completedPlan].reverse();
    const searchCards = handDeckCards(G, ctx, pid);
    return <Grid>
        <div><label>军事：</label>{s.military}({s.maxMilitary})</div>
        <div><label>内政：</label>{s.civil}({s.maxCivil})</div>
        <div><label>腐败：</label>{s.corruption}</div>
        <div><label>盟国：</label>{s.nations.join(',')}</div>
        <div><label>国书：</label>{s.lodNations !== undefined ? s.lodNations.join(',') : ""}</div>
        <div><label>预备区：{unitsToString(ready)} {getReadyGeneralNames(G, pid).join('')}</label></div>
        <div><label>手牌数：{pub.handCount}</label></div>
        <div><label>皇帝：{s.emperor === null ? "" : s.emperor}</label></div>
        <div><label>本回合计划：{s.plan.map(p => getPlanById(p).name)}</label></div>
        <div><label>完成计划：</label><br/>
            {reversedPlan.map(p => <label key={`plan-name-${p}`}>{getPlanById(p).name}</label>)}
        </div>

        <ChoiceDialog callback={() => {
        }} choices={
            s.cities.map(c => {
                return {
                    label: getCityText(c),
                    value: c,
                    hidden: false,
                    disabled: true
                }
            })
        } defaultChoice={""} show={true} title={`查看占领城市`} toggleText={`城市${s.cities.length}`} initial={false}/>
        <div><ShowCards cards={s.discard} title={"查看弃牌"} toggleText={`弃牌${s.discard.length}`}/></div>
        <div><ShowCards cards={s.remove} title={"查看移除"} toggleText={`移除牌${s.remove.length}`}/></div>
        <div><ShowCards cards={searchCards} title={"手牌+牌堆"}
                        toggleText={`手牌+牌堆${searchCards.length}`}/></div>
        <div><label>备用兵区： {unitsToString(standby)}</label></div>
        <ErrorBoundary>
            <Dices pub={s}/>
        </ErrorBoundary>
        <div>控制路：<br/>{s.provinces.join(',')}</div>
        <div><label>发展牌：{s.develop.map(p => `${sjCardById(p).name}|${sjCardById(p).op}`)}</label></div>
    </Grid>
}
export const PubInfo = ({G, ctx}: IPubInfo) => {
    return <Grid container>
        <Grid item xs={12} key={`game-info`}>
            <Typography>第{G.turn}回合
                第{G.round}轮 {getSeasonText(G.round)} {pid2ctr(ctx.currentPlayer)} {phaseName(ctx.phase)}
                ({ctx.activePlayers === null ? "" : Object.keys(ctx.activePlayers).map(p=>`${pid2ctr(p)}:${stageName(ctx.activePlayers[p])}`).join(',')})
            </Typography>
            <Typography>已发生事件：
                {G.events.filter(e => isSongEvent(e)).map(e =>
                    <label key={`event-global-${e}`}>{e},</label>
                )}
                <br/>
                {G.events.filter(e => !isSongEvent(e)).map(e =>
                    <label key={`event-global-${e}`}>{e},</label>
                )}
                <br/>
                移除的国家：{G.removedNation}
                {ctx.phase === 'action' ? `征募和进军点数${G.op}` : ''}
            </Typography>
            {G.qi.length > 0 && <div>齐控制路：<br/>{G.qi.map(p => <label key={`qi-${p}`}>{p}<br/></label>)}</div>}
        </Grid>
        <Grid item xs={6} key={`song-pub`}><Paper>
            <label>宋</label>

            <div><label>政策：</label>{getPolicy(G)}</div>
            <div><label>国力：</label>{getSongPower(G)}</div>
            <CountryPubInfo G={G} pub={G.song} ctx={ctx} pid={SJPlayer.P1}/>
            {ctx.phase === 'develop' &&
                <div><label> 使用/总发展点数： {G.song.usedDevelop}/{totalDevelop(G, ctx, SJPlayer.P1)} </label></div>}
            {G.turn > 6 && <div><label>绍兴和议分数：{getSongScore(G)}</label></div>}

        </Paper></Grid>
        <Grid item xs={6} key={`jinn-pub`}><Paper><label>金</label>
            <div><label>殖民：</label>{G.colony}</div>
            <div><label>国力：</label>{getJinnPower(G)}</div>
            <CountryPubInfo G={G} pub={G.jinn} ctx={ctx} pid={SJPlayer.P2}/>
            {/*// TODO 和议 分数 分类*/}
            {ctx.phase === 'develop' &&
                <div><label> 使用/总发展点数： {G.jinn.usedDevelop}/{totalDevelop(G, ctx, SJPlayer.P2)} </label></div>}
            {G.turn > 6 && <div><label>绍兴和议分数：{getJinnScore(G)}</label></div>}
        </Paper></Grid>
    </Grid>
}