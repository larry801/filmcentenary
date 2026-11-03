import {Ctx} from "boardgame.io";
import {
    CityID,
    Country,
    GeneralStatus,
    NationID,
    RegionID,
    SJPlayer,
    SongJinnGame,
    SongGeneral,
    setupSongJinn,
} from "./constant/general";
import {
    cityIsBesieged,
    getCitySupplyLevel,
    getReinforcementCities,
    getSongTroopByCity,
    hasSupply,
    resolveDeployPhase,
    canRecruitUnitType,
} from "./util";
import {deploy, deployGeneral, jianLiDaQi} from "./moves";

const fakeCtx = (phase = "deploy", playerID: string = SJPlayer.P1): Ctx => ({
    phase,
    playerID,
    events: {
        setActivePlayers: jest.fn(),
        endStage: jest.fn(),
        setPhase: jest.fn(),
        endGame: jest.fn(),
    },
} as unknown as Ctx);

const newGame = (): SongJinnGame => JSON.parse(JSON.stringify(setupSongJinn(fakeCtx("setup"), {})));

describe("补充阶段规则 5.2.8", () => {
    it("补充阶段开始时，腐败消灭预备区部队而不是备用兵库部队", () => {
        const G = newGame();
        G.song.corruption = 2;
        G.song.ready = [2, 1, 0, 0, 0, 0];
        G.song.standby = [8, 8, 8, 8, 8, 8];

        resolveDeployPhase(G);

        expect(G.song.ready).toEqual([0, 1, 0, 0, 0, 0]);
        expect(G.song.standby).toEqual([8, 8, 8, 8, 8, 8]);
    });

    it("缺乏补给的军团和其中的将领被消灭", () => {
        const G = newGame();
        G.song.troops.push({
            p: NationID.XiXia,
            c: null,
            u: [1, 0, 0, 0, 0, 0],
            g: Country.SONG,
        });
        G.song.generalPlace[SongGeneral.ZongZe] = NationID.XiXia;
        G.song.generals[SongGeneral.ZongZe] = GeneralStatus.TROOP;

        expect(hasSupply(G, G.song.troops[G.song.troops.length - 1])).toBe(false);
        resolveDeployPhase(G);

        expect(G.song.troops.some(t => t.p === NationID.XiXia)).toBe(false);
    });

    it("被围困城市按城市补给等级和机械部队数量计算损耗", () => {
        const G = newGame();
        G.song.troops = [{
            p: RegionID.R43,
            c: CityID.KaiFeng,
            u: [2, 0, 0, 0, 1, 0],
            g: Country.SONG,
        }];
        G.jinn.troops = [{
            p: RegionID.R43,
            c: null,
            u: [1, 0, 0, 0, 0, 0, 0],
            g: Country.JINN,
        }];
        G.song.emperor = CityID.KaiFeng;

        expect(cityIsBesieged(G, CityID.KaiFeng)).toBe(true);
        expect(getCitySupplyLevel(G, CityID.KaiFeng)).toBe(3);
        resolveDeployPhase(G);

        // 3 units - supply 3 = 0, so no unit is lost.
        expect(getSongTroopByCity(G, CityID.KaiFeng)!.u).toEqual([2, 0, 0, 0, 1, 0]);
    });

    it("补充每座城市最多使用城市补给等级，且不能补充未殖民金国城市", () => {
        const G = newGame();
        const ctx = fakeCtx("deploy", SJPlayer.P1);
        G.song.ready = [2, 0, 0, 0, 0, 0];

        deploy.move(G, ctx, {
            city: CityID.LiCheng,
            units: [2, 0, 0, 0, 0, 0],
            country: Country.SONG,
        });
        expect(getSongTroopByCity(G, CityID.LiCheng)!.u[0]).toBe(0);
        expect(G.song.ready[0]).toBe(2);

        deploy.move(G, ctx, {
            city: CityID.LiCheng,
            units: [1, 0, 0, 0, 0, 0],
            country: Country.SONG,
        });
        expect(getSongTroopByCity(G, CityID.LiCheng)!.u[0]).toBe(1);
        expect(G.song.ready[0]).toBe(1);

        G.jinn.ready = [1, 0, 0, 0, 0, 0, 0];
        expect(getReinforcementCities(G, Country.JINN)).not.toContain(CityID.ZhenDing);
    });

    it("补充阶段可以把预备将领放入合法城市，不能把在场将领重复放置", () => {
        const G = newGame();
        const ctx = fakeCtx("deploy", SJPlayer.P1);

        G.song.generals[SongGeneral.YueFei] = GeneralStatus.READY;
        deployGeneral.move(G, ctx, {
            country: Country.SONG,
            general: SongGeneral.YueFei,
            dst: CityID.LiCheng,
        });
        expect(G.song.generals[SongGeneral.YueFei]).toBe(GeneralStatus.TROOP);
        expect(G.song.generalPlace[SongGeneral.YueFei]).toBe(CityID.LiCheng);

        const before = G.song.generalPlace[SongGeneral.ZongZe];
        deployGeneral.move(G, ctx, {
            country: Country.SONG,
            general: SongGeneral.ZongZe,
            dst: CityID.LiCheng,
        });
        expect(G.song.generalPlace[SongGeneral.ZongZe]).toBe(before);
    });

    it("建立大齐写入持续事件并解锁签军、齐军，重复路不合法", () => {
        const G = newGame();
        const ctx = fakeCtx("action", SJPlayer.P2);
        const provinces = G.jinn.provinces.slice(0, 3);

        jianLiDaQi.move(G, ctx, provinces);
        expect(G.events).toContain("建立大齐");
        expect(G.qi).toEqual(provinces);
        expect(canRecruitUnitType(G, Country.JINN, 5)).toBe(true);
        expect(canRecruitUnitType(G, Country.JINN, 6)).toBe(true);

        const before = [...G.qi];
        jianLiDaQi.move(G, ctx, [provinces[0], provinces[0], provinces[1]]);
        expect(G.qi).toEqual(before);
    });
});
