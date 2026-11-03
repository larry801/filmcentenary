import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer';
import {Ctx} from "boardgame.io";
import {SongJinnGameDef} from './game';
import {
    CityID,
    Country,
    GeneralStatus,
    JinnBaseCardID,
    RegionID,
    SJPlayer,
    SongGeneral,
    SongJinnGame,
    setupSongJinn,
} from "./constant/general";
import {
    cityIsBesieged,
    getDispatchDsts,
    getDispatchableGenerals,
    getTieJunCities,
    generalIsBesieged,
} from "./util";

const fakeCtx = () => ({
    events: {setActivePlayers: jest.fn(), endStage: jest.fn(), setPhase: jest.fn(), endGame: jest.fn()}
} as unknown as Ctx);

const newGame = (): SongJinnGame => JSON.parse(JSON.stringify(setupSongJinn(fakeCtx(), {})));

/**
 * 游戏开局停在 chooseFirst，需要走完作战计划阶段才进入 action（行动阶段），
 * 行动相关 move 才可用。用种子固定的对局来驱动。
 */
function driveToActionPhase() {
    const spec = {
        numPlayers: 2,
        game: {...SongJinnGameDef, seed: "l2fp6gsf"},
        multiplayer: Local(),
    };
    const p0 = Client<SongJinnGame, Ctx>({...spec, playerID: '0'} as any) as any;
    const p1 = Client<SongJinnGame, Ctx>({...spec, playerID: '1'} as any) as any;
    p0.start();
    p1.start();
    p0.moves.chooseFirst({choice: '0', matchID: 'test'});
    // 种子固定：双方各抽到计划，第一张一定能选
    p0.moves.choosePlan(p0.getState().G.player['0'].plans[0]);
    p1.moves.choosePlan(p1.getState().G.player['1'].plans[0]);
    // 先手展示作战计划结束自己的回合，后手展示后离开 showPlan 阶段
    const first = p0.getState().G.order[0] as string;
    const firstClient = first === '0' ? p0 : p1;
    firstClient.moves.showPlan(firstClient.getState().G.player[first].chosenPlans);
    const second = p0.getState().G.order[1] as string;
    const secondClient = second === '0' ? p0 : p1;
    secondClient.moves.showPlan(secondClient.getState().G.player[second].chosenPlans);
    return {p0, p1};
}

/** 让金国（P1）成为当前玩家：行动阶段的 move 会检查「是否轮到你」 */
function passTurnToJinn(p0: any, p1: any) {
    if (p0.getState().ctx.currentPlayer === '1') {
        return;
    }
    p0.moves.endRound();
    expect(p1.getState().ctx.currentPlayer).toBe('1');
}

describe('cityIsBesieged（规则 10.1）', () => {
    it('城市所在区域有对方军团即为被围困', () => {
        const G = newGame();
        // 襄阳在 R42，初始宋国自己驻守 -> 没有被围困
        expect(cityIsBesieged(G, CityID.XiangYang)).toBe(false);
        // 金国军团进入襄阳所在区域 -> 城市被围困
        G.jinn.troops.push({u: [1, 0, 0, 0, 0, 0, 0], p: RegionID.R42, c: null, g: Country.JINN});
        expect(cityIsBesieged(G, CityID.XiangYang)).toBe(true);
    });

    it('金国城市同理', () => {
        const G = newGame();
        expect(cityIsBesieged(G, CityID.DaTong)).toBe(false);
        G.song.troops.push({u: [1, 0, 0, 0, 0, 0], p: RegionID.R02DaTonFu, c: null, g: Country.SONG});
        expect(cityIsBesieged(G, CityID.DaTong)).toBe(true);
    });

    it('初始只有宗泽在场（在 R19），岳飞与韩世忠还在预备兵区', () => {
        const G = newGame();
        expect(G.song.generalPlace[SongGeneral.ZongZe]).toBe(RegionID.R19);
        expect(G.song.generals[SongGeneral.YueFei]).toBe(GeneralStatus.PRE);
        expect(G.song.generals[SongGeneral.HanShiZhong]).toBe(GeneralStatus.PRE);
        expect(getDispatchableGenerals(G, SJPlayer.P1)).toEqual([SongGeneral.ZongZe]);
    });
});

describe('贴军（规则 7.7）', () => {
    let p0: any;
    let p1: any;

    beforeEach(() => {
        const clients = driveToActionPhase();
        p0 = clients.p0;
        p1 = clients.p1;
        passTurnToJinn(p0, p1);
    });

    afterEach(() => {
        p0.stop();
        p1.stop();
    });

    it('支付征募消耗的行动力，把预备部队直接放上场并弃牌', () => {
        p1.moves.modifyGameState({
            player: {"1": {hand: [JinnBaseCardID.J01]}},
            jinn: {standby: [5, 5, 0, 0, 0, 0, 0]},
            op: 5,
        });
        // 元城所在区域 R18 初始就有金国军团
        const countAtR18 = p1.getState().G.jinn.troops.filter((t: any) => t.p === RegionID.R18).length;
        const beforeTotal = p1.getState().G.jinn.troops
            .filter((t: any) => t.p === RegionID.R18)
            .reduce((acc: number[], t: any) => [acc[0] + t.u[0], acc[1] + t.u[1]], [0, 0]);
        expect(countAtR18).toBeGreaterThan(0);
        // 1 个步军(1) + 1 个拐子马(2) = 3 行动力
        p1.moves.tieJun({
            card: JinnBaseCardID.J01,
            city: CityID.YuanCheng,
            units: [1, 1, 0, 0, 0, 0, 0],
        });
        const G = p1.getState().G;
        expect(G.op).toBe(2);
        expect(G.jinn.standby[0]).toBe(4);
        expect(G.jinn.standby[1]).toBe(4);
        // 合并到 R18 已有的军团：总数增加 1 步军 + 1 拐子马
        const after = G.jinn.troops.filter((t: any) => t.p === RegionID.R18);
        expect(after.length).toBe(countAtR18);
        const afterTotal = after.reduce((acc: number[], t: any) => [acc[0] + t.u[0], acc[1] + t.u[1]], [0, 0]);
        expect(afterTotal[0]).toBe(beforeTotal[0] + 1);
        expect(afterTotal[1]).toBe(beforeTotal[1] + 1);
        expect(G.player['1'].hand).toEqual([]);
        expect(G.jinn.discard).toContain(JinnBaseCardID.J01);
    });

    it('行动力不够时被拒绝', () => {
        p1.moves.modifyGameState({
            player: {"1": {hand: [JinnBaseCardID.J01]}},
            jinn: {standby: [5, 5, 0, 0, 0, 0, 0]},
            op: 1,
        });
        p1.moves.tieJun({
            card: JinnBaseCardID.J01,
            city: CityID.YuanCheng,
            units: [0, 1, 0, 0, 0, 0, 0], // 拐子马需要 2 行动力
        });
        const G = p1.getState().G;
        expect(G.op).toBe(1);
        expect(G.jinn.standby[1]).toBe(5);
        expect(G.player['1'].hand).toContain(JinnBaseCardID.J01);
    });

    it('不能贴军到被围困的城市', () => {
        p1.moves.modifyGameState({
            player: {"1": {hand: [JinnBaseCardID.J01]}},
            jinn: {standby: [5, 0, 0, 0, 0, 0, 0]},
            op: 5,
        });
        expect(getTieJunCities(p1.getState().G)).toContain(CityID.YuanCheng);
        // 宋军进入元城所在区域 R18 -> 元城被围困
        p1.moves.modifyGameState({
            song: {troops: [{u: [1, 0, 0, 0, 0, 0], p: RegionID.R18, c: null, g: Country.SONG}]},
        });
        const G0 = p1.getState().G;
        expect(G0.song.troops.filter((t: any) => t.p === RegionID.R18).length).toBe(1);
        expect(cityIsBesieged(G0, CityID.YuanCheng)).toBe(true);
        expect(getTieJunCities(G0)).not.toContain(CityID.YuanCheng);

        p1.moves.tieJun({
            card: JinnBaseCardID.J01,
            city: CityID.YuanCheng,
            units: [1, 0, 0, 0, 0, 0, 0],
        });
        const G = p1.getState().G;
        expect(G.op).toBe(5);
        expect(G.player['1'].hand).toContain(JinnBaseCardID.J01);
    });

    it('没有征募许可的兵种（消耗 0）不能贴军', () => {
        p1.moves.modifyGameState({
            player: {"1": {hand: [JinnBaseCardID.J01]}},
            jinn: {standby: [0, 0, 0, 0, 0, 2, 0]},
            op: 5,
        });
        p1.moves.tieJun({
            card: JinnBaseCardID.J01,
            city: CityID.YuanCheng,
            units: [0, 0, 0, 0, 0, 1, 0], // 签军初始没有征募许可
        });
        // 被拒绝：行动力与预备部队都不变，牌还在手上
        expect(p1.getState().G.op).toBe(5);
        expect(p1.getState().G.jinn.standby[5]).toBe(2);
        expect(p1.getState().G.player['1'].hand).toContain(JinnBaseCardID.J01);
    });
});

describe('派遣（规则 7.5）', () => {
    let p0: any;
    let p1: any;

    beforeEach(() => {
        const clients = driveToActionPhase();
        p0 = clients.p0;
        p1 = clients.p1;
        // 宋国 P0 是先手，行动阶段由它开始
        expect(p0.getState().ctx.currentPlayer).toBe('0');
    });

    afterEach(() => {
        p0.stop();
        p1.stop();
    });

    it('打出事件牌后可以把在场将领派到本方军团所在的区域', () => {
        const G0 = p0.getState().G;
        // 宗泽在 R19，那里有宋国军团；R32（天兴）也有宋国军团
        expect(getDispatchableGenerals(G0, SJPlayer.P1)).toEqual([SongGeneral.ZongZe]);
        expect(getDispatchDsts(G0, SJPlayer.P1)).toContain(RegionID.R19);
        expect(getDispatchDsts(G0, SJPlayer.P1)).toContain(RegionID.R32);

        const card = p0.getState().G.player['0'].hand[0];
        p0.moves.paiQIan(card);
        expect(p0.getState().G.pending.dispatch).toBe(true);
        expect(p0.getState().G.player['0'].hand).not.toContain(card);
        expect(p0.getState().G.song.discard).toContain(card);

        p0.moves.moveGeneral({dst: RegionID.R32, general: SongGeneral.ZongZe, country: Country.SONG});
        const G = p0.getState().G;
        expect(G.song.generalPlace[SongGeneral.ZongZe]).toBe(RegionID.R32);
        expect(G.pending.dispatch).toBe(false);
    });

    it('没有先打派遣牌时不能移动将领', () => {
        const before = p0.getState().G.song.generalPlace[SongGeneral.ZongZe];
        expect(p0.getState().G.pending.dispatch).toBe(false);
        p0.moves.moveGeneral({dst: RegionID.R32, general: SongGeneral.ZongZe, country: Country.SONG});
        expect(p0.getState().G.song.generalPlace[SongGeneral.ZongZe]).toBe(before);
    });

    it('不能派到没有本方军团的区域', () => {
        p0.moves.paiQIan(p0.getState().G.player['0'].hand[0]);
        const before = p0.getState().G.song.generalPlace[SongGeneral.ZongZe];
        // R01 是金国领地，没有宋国军团
        expect(getDispatchDsts(p0.getState().G, SJPlayer.P1)).not.toContain(RegionID.R01);
        p0.moves.moveGeneral({dst: RegionID.R01, general: SongGeneral.ZongZe, country: Country.SONG});
        expect(p0.getState().G.song.generalPlace[SongGeneral.ZongZe]).toBe(before);
    });

    it('预备兵区的将领不能派遣，登场后才可以', () => {
        expect(getDispatchableGenerals(p0.getState().G, SJPlayer.P1)).not.toContain(SongGeneral.YueFei);
        // 让岳飞登场到宋国控制的 R32（天兴）
        p0.moves.modifyGameState({
            song: {
                generals: [GeneralStatus.TROOP, GeneralStatus.TROOP, GeneralStatus.PRE, GeneralStatus.PRE, GeneralStatus.PRE, GeneralStatus.PRE],
                generalPlace: [RegionID.R19, RegionID.R32, RegionID.R01, RegionID.R01, RegionID.R01, RegionID.R01],
            },
        });
        expect(getDispatchableGenerals(p0.getState().G, SJPlayer.P1)).toContain(SongGeneral.YueFei);
    });

    it('退入城内的将领所在军团被围困时不能派遣', () => {
        // 宗泽随军团退入城中：被围困时军团位置 p 与城市 c 相同（天兴 R32）
        p0.moves.modifyGameState({
            song: {
                troops: [{u: [1, 1, 0, 0, 0, 0], p: RegionID.R32, c: RegionID.R32, g: Country.SONG}],
                generalPlace: [RegionID.R32, RegionID.R01, RegionID.R01, RegionID.R01, RegionID.R01, RegionID.R01],
            },
            jinn: {
                troops: [{u: [1, 0, 0, 0, 0, 0, 0], p: RegionID.R32, c: null, g: Country.JINN}],
            },
        });
        const G = p0.getState().G;
        expect(G.song.generalPlace[SongGeneral.ZongZe]).toBe(RegionID.R32);
        expect(generalIsBesieged(G, SJPlayer.P1, SongGeneral.ZongZe)).toBe(true);
        expect(getDispatchableGenerals(G, SJPlayer.P1)).not.toContain(SongGeneral.ZongZe);
    });
});
