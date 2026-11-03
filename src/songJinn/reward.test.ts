import {Client} from 'boardgame.io/client';
import {Local} from 'boardgame.io/multiplayer';
import {Ctx, PlayerID} from "boardgame.io";
import {SongJinnGameDef} from './game';
import {
    ActiveEvents,
    Country,
    EarlyPlanID,
    Nations,
    PendingReward,
    PlanID,
    ProvinceID,
    SJPlayer,
    SongJinnGame,
    SongGeneral,
} from "./constant/general";
import {setupSongJinn} from "./constant/general";
import {ChoosePlanPhaseConfig} from "./constant/config";
import {
    baseUnitEndurance,
    ctr2pid,
    diplomaticVictory,
    getJinnScore,
    getPlanById,
    getSongScore,
    getStage,
    getTroopByCountryPlace,
} from "./util";

/**
 * 计划奖励的实现方式是：effect 里写入 G.pending.reward 并把对应 stage 给到玩家，
 * 玩家在那个 stage 里调用对应 move 选目标，move 结束后清标志并 endStage。
 * 这里用最少的 ctx 假对象直接驱动 effect / move，避免依赖完整对局。
 */
function fakeCtx() {
    const events = {
        setActivePlayers: jest.fn(),
        endStage: jest.fn(),
        setPhase: jest.fn(),
        endGame: jest.fn(),
    };
    // changePlayerStage 通过 ctx.events?.setActivePlayers?.({value: {...}}) 切 stage
    return {events} as unknown as Ctx;
}

function activeStage(ctx: Ctx, pid: PlayerID): string | undefined {
    const calls = (ctx.events?.setActivePlayers as unknown as jest.Mock).mock.calls;
    const last = calls[calls.length - 1];
    return last?.[0]?.value?.[pid]?.stage;
}

const newGame = (): SongJinnGame =>
    JSON.parse(JSON.stringify(setupSongJinn(fakeCtx(), {})));

describe('plan rewards', () => {
    const cases: Array<[PlanID, PendingReward, string]> = [
        [PlanID.J04, PendingReward.AdjustNation, 'adjustNation'],
        [PlanID.J13, PendingReward.AdjustNation, 'adjustNation'],
        [PlanID.J06, PendingReward.RemoveUnit, 'removeUnit'],
        [PlanID.J16, PendingReward.RemoveGeneral, 'removeGeneral'],
        [PlanID.J17, PendingReward.RemovePlan, 'removeCompletedPlan'],
        [PlanID.J18, PendingReward.RemoveNation, 'removeNation'],
    ];

    cases.forEach(([plan, reward, stage]) => {
        it(`${plan} 完成后进入 ${stage} 奖励`, () => {
            const G = newGame();
            const ctx = fakeCtx();
            getPlanById(plan).effect(G, ctx, SJPlayer.P1);
            expect(G.pending.reward).toBe(reward);
            expect(activeStage(ctx, SJPlayer.P1)).toBe(stage);
        });
    });

    it('奖励给的是完成计划的那一方', () => {
        const G = newGame();
        const ctx = fakeCtx();
        getPlanById(PlanID.J04).effect(G, ctx, SJPlayer.P2);
        expect(activeStage(ctx, SJPlayer.P2)).toBe('adjustNation');
        expect(activeStage(ctx, SJPlayer.P1)).toBeUndefined();
    });

    it('不需要选择目标的计划奖励仍然直接生效', () => {
        const G = newGame();
        const ctx = fakeCtx();
        const military = G.song.military;
        getPlanById(PlanID.J02).effect(G, ctx, SJPlayer.P1);
        expect(G.pending.reward).toBeNull();
        expect(G.song.military).toBe(military + 1);
    });
});

describe('removeUnit reward budget', () => {
    let p0: any;

    beforeEach(() => {
        const spec = {
            numPlayers: 2,
            game: {...SongJinnGameDef, seed: "l2fp6gsf"},
            multiplayer: Local(),
        };
        p0 = Client<SongJinnGame, Ctx>({...spec, playerID: '0'} as any) as any;
        p0.start();
    });

    afterEach(() => {
        p0.stop();
    });

    const songTroopAt42 = () => getTroopByCountryPlace(p0.getState().G, Country.SONG, 42);

    it('超出 2 点耐久的选择被拒绝', () => {
        const before = songTroopAt42()!.u[0];
        // 步兵基础耐久 2，2 个就是 4 点，超过奖励上限
        p0.moves.removeUnit({src: 42, units: [2, 0, 0, 0, 0, 0], country: Country.SONG});
        expect(songTroopAt42()!.u[0]).toBe(before);
    });

    it('不在 removeUnit stage 时奖励选择被拒绝', () => {
        expect(getStage(p0.getState().ctx)).not.toBe('removeUnit');
        const before = songTroopAt42()!.u.map((n: number) => n);
        p0.moves.removeUnit({src: 42, units: [1, 0, 0, 0, 0, 0], country: Country.SONG});
        expect(songTroopAt42()!.u).toEqual(before);
        // 没有待结算奖励，普通消灭部队的流程不受影响
        expect(p0.getState().G.pending.reward).toBeNull();
    });
});

describe('baseUnitEndurance', () => {
    it('宋金基础耐久表', () => {
        const G = newGame();
        expect(baseUnitEndurance(G, Country.SONG)).toEqual([2, 1, 1, 0, 0, 2]);
        expect(baseUnitEndurance(G, Country.JINN)).toEqual([2, 1, 2, 0, 0, 1, 1]);
    });
});

describe('choosePlan deck recycling', () => {
    it('选不出计划的玩家的计划牌回到牌堆，不会凭空消失', () => {
        const G = newGame();
        // 军事等级 1 时 J01 已经是最低等级 2 的计划，两张都选不了
        G.song.military = 1;
        G.jinn.military = 1;
        G.secret.planDeck = [PlanID.J03, PlanID.J04, PlanID.J05, PlanID.J06];
        G.player[SJPlayer.P1].plans = [PlanID.J01, PlanID.J02];
        G.player[SJPlayer.P2].plans = [];
        G.order = [SJPlayer.P1, SJPlayer.P2];

        const deckSize = G.secret.planDeck.length;
        const p1Plans = G.player[SJPlayer.P1].plans.length;
        const ctx = fakeCtx();
        ChoosePlanPhaseConfig.onBegin!(G, ctx);

        // 原来 concat 的返回值被丢掉，这两张牌会凭空消失，牌堆会少 2 张
        expect(G.player[SJPlayer.P1].plans).toEqual([]);
        const p2Plans = G.player[SJPlayer.P2].plans.length;
        expect(G.secret.planDeck.length + p2Plans).toBe(deckSize + p1Plans);
    });
});

describe('diplomacy victory', () => {
    it('宋国拿到所有国家时由宋国玩家获胜', () => {
        const G = newGame();
        // 判断外交胜利只看国家归属，和国力无关
        G.song.nations = [...new Set([...G.song.nations, ...G.jinn.nations])];
        G.jinn.nations = [];
        // removedNation 表示已经移出游戏的国家，要补足剩下的名额
        G.removedNation = Nations.filter(n => !G.song.nations.includes(n));
        expect(diplomaticVictory(G)).toBe(Country.SONG);
        // 与 game.ts endIf 里的映射保持一致：宋国外交胜利 => P1
        expect(ctr2pid(Country.SONG)).toBe(SJPlayer.P1);
    });

    it('金国拿到所有国家时由金国玩家获胜', () => {
        const G = newGame();
        G.jinn.nations = [...new Set([...G.song.nations, ...G.jinn.nations])];
        G.song.nations = [];
        G.removedNation = Nations.filter(n => !G.jinn.nations.includes(n));
        expect(diplomaticVictory(G)).toBe(Country.JINN);
        expect(ctr2pid(Country.JINN)).toBe(SJPlayer.P2);
    });

    it('国家还没分完时没有外交胜利', () => {
        const G = newGame();
        expect(diplomaticVictory(G)).toBeNull();
    });
});

describe('规则书胜负与终局计分', () => {
    it('建炎南渡后金控制两浙路触发国破家亡', () => {
        const G = newGame();
        G.events.push(ActiveEvents.JianYanNanDu);
        G.jinn.provinces.push(ProvinceID.LIANGZHELU);
        const result = SongJinnGameDef.endIf!(G, fakeCtx()) as any;
        expect(result).toEqual({winner: SJPlayer.P2, reason: '国破家亡'});
    });

    it('绍兴和议分数包含盟国', () => {
        const G = newGame();
        const songBefore = getSongScore(G);
        const jinnBefore = getJinnScore(G);
        G.song.nations.push(Nations.find(n => !G.song.nations.includes(n))!);
        G.jinn.nations.push(Nations.find(n => !G.jinn.nations.includes(n))!);
        expect(getSongScore(G)).toBe(songBefore + 1);
        expect(getJinnScore(G)).toBe(jinnBefore + 1);
    });
});
