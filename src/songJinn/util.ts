import { Ctx, LogEntry, PlayerID } from "boardgame.io";
import {
    accumulator,
    ActiveEvents,
    BaseCardID,
    BeatGongChoice,
    CityID,
    CombatPhase,
    CombatType,
    Country,
    CountryCombatInfo,
    DevelopChoice,
    emptyCombatInfo,
    EventDuration,
    General,
    GeneralNames,
    GeneralStatus,
    IEra,
    INITIAL_RECRUIT_COST,
    INITIAL_RECRUIT_PERMISSION,
    isCityID,
    isMountainPassID,
    isNationID,
    isRegionID,
    JinnBaseCardID,
    JinnEarlyCardID,
    JinnGeneral,
    JinnLateCardID,
    JinnMidCardID,
    LatePlanID,
    LetterOfCredence,
    MarchDstStatus,
    MAX_DICES,
    MAX_ROUND,
    MidPlanID,
    MountainPasses,
    MountainPassID,
    NationID,
    Nations,
    NationState,
    OptionalSongCardID,
    PendingEvents,
    PlanID,
    ProvinceID,
    ProvinceState,
    RegionID,
    SJEventCardID,
    SJPlayer,
    SongBaseCardID,
    SongEarlyCardID,
    SongGeneral,
    SongJinnGame,
    SongLateCardID,
    SongMidCardID,
    SpecialPlan,
    TerrainType,
    Troop,
    TroopPlace,
    UNIT_SHORTHAND,
    VictoryReason
} from "./constant/general";
import { getPlanById } from "./constant/plan";
import { getRegionById } from "./constant/regions";
import { activePlayer, shuffle } from "../game/util";
import { logger } from "../game/logger";
import { INVALID_MOVE, Stage } from "boardgame.io/core";
import { getProvinceById } from "./constant/province";
import { getCityById } from "./constant/city";
import { changePlayerStage } from "../game/logFix";

export const isSongEvent = (e: ActiveEvents) => {
    switch (e) {
        case ActiveEvents.LiGang:
        case ActiveEvents.JianYanNanDu:
        case ActiveEvents.XiJunQuDuan:
        case ActiveEvents.JinTaiZongJiaBeng:
        case ActiveEvents.BaZiJun:
        case ActiveEvents.WuLuKeTui:
        case ActiveEvents.XiangHaiShangFaZhan:
        case ActiveEvents.FuHaiTaoSheng:
        case ActiveEvents.ShenBiGong:
        case ActiveEvents.ZhongBuBing:
        case ActiveEvents.YueShuaiZhiLai:
        case ActiveEvents.WuLin:
        case ActiveEvents.YanJingYiNan:
            return true;
        case ActiveEvents.JingKangZhiBian:
        case ActiveEvents.LiuJiaShenBing:
        case ActiveEvents.JinTaiZong:
        case ActiveEvents.ZhuiWangZhuBei:
        case ActiveEvents.JiNanZhiFuLiuYu:
        case ActiveEvents.JinBingLaiLe:
        case ActiveEvents.ZhangZhaoZhiZheng:
        case ActiveEvents.JianLiDaQi:
        case ActiveEvents.QinHuiDuXiang:
        case ActiveEvents.BuJianLaiShi:
        case ActiveEvents.QuDuanZhiSi:
        case ActiveEvents.XuZhouYeTie:
        case ActiveEvents.TianJuanZhengBian:
        case ActiveEvents.JieChuBingQuan:
            return false;
    }
}

export const jinnSorter = (a: Troop, b: Troop) => {
    const unitDelta = a.u.reduce(accumulator) - b.u.reduce(accumulator);
    if (unitDelta === 0) {
        return a.p > b.p ? 1 : -1;
    } else {
        return -unitDelta;
    }
}
export const songSorter = (a: Troop, b: Troop) => {
    const unitDelta = a.u.reduce(accumulator) - b.u.reduce(accumulator);
    if (unitDelta === 0) {
        return b.p > a.p ? 1 : -1;
    } else {
        return -unitDelta;
    }
}

function area(coords: [number, number][][]) {
    let s = 0.0;
    let ring = coords[0];
    for (let i = 0; i < (ring.length - 1); i++) {
        s += (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]);
    }
    return 0.5 * s;
}

export function getTerrainTypeByPlace(troop: Troop) {
    if (isRegionID(troop.p)) {
        return getRegionById(troop.p).terrain;
    } else {
        if (isMountainPassID(troop.p)) {
            return TerrainType.RAMPART;
        } else {
            if (isCityID(troop.p)) {
                return TerrainType.RAMPART;
            } else {
                // TODO other country endurance
                return TerrainType.FLATLAND;
            }
        }
    }
}

export const centroid = (coordinates: [number, number][][]): [number, number] => {
    let c: [number, number] = [0, 0];
    let ring = coordinates[0];
    for (let i = 0; i < (ring.length - 1); i++) {
        c[0] += (ring[i][0] + ring[i + 1][0]) * (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]);
        c[1] += (ring[i][1] + ring[i + 1][1]) * (ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]);
    }
    let a = area(coordinates);
    c[0] /= a * 6;
    c[1] /= a * 6;
    return c;
}

export const stageName = (c: string) => {
    const stageMap = {
        'react': "回合外行动",
        'takeDamage': "受创",
        'emperor': "拥立",
        'jianLiDaQi': "建立大齐",
        'combatCard': "选择战斗牌",
        'rescueGeneral': "发展牌救援将领",
        'showCC': "展示战斗牌",
        'freeHeYi': "免费和议",
    }
    // @ts-ignore
    const result = stageMap[c];
    return result !== undefined ? result : " ";

}
export const phaseName = (c: string) => {
    const phaseMap = {
        'draw': '摸牌阶段',
        'chooseFirst': '行动顺序',
        'choosePlan': '选择作战计划',
        'showPlan': '作战计划',
        'action': '行动',
        'resolvePlan': '结算计划',
        'diplomacy': '结算外交',
        'develop': '发展阶段',
        'deploy': '补充阶段',
        'turnEnd': '回合结束',
    }
    // @ts-ignore
    const result = phaseMap[c];
    return result !== undefined ? result : " ";
}
export const StrProvince: Map<string, ProvinceID> = new Map(Object.values(ProvinceID).map(
    (memberValue) => [`${memberValue}`, memberValue] as const
));
export const getNationState = (G: SongJinnGame, n: NationID) => {
    if (G.song.nations.includes(n)) {
        return NationState.SONG;
    } else {
        if (G.jinn.nations.includes(n)) {
            return NationState.JINN;
        } else {
            return NationState.NEUTRAL;
        }
    }
}

export const ctr2pub = (G: SongJinnGame, country: Country) => country === Country.SONG ? G.song : G.jinn;
export const ctr2pid = (country: Country) => country === Country.SONG ? SJPlayer.P1 : SJPlayer.P2;
export const pid2ctr = (pid: PlayerID) => pid === SJPlayer.P1 ? Country.SONG : Country.JINN;

export const currentProvStatus = (G: SongJinnGame, prov: ProvinceID) => {
    const province = getProvinceById(prov);
    const allCities = [...province.capital, ...province.other];
    const songCity = allCities.filter(c => G.song.cities.includes(c)).length;
    const jinnCity = allCities.filter(c => G.jinn.cities.includes(c)).length;
    if (songCity === allCities.length) {
        return ProvinceState.SONG;
    }
    if (jinnCity === allCities.length) {
        return ProvinceState.JINN;
    }
    return ProvinceState.NEUTRAL
}
export const getPresentGeneral = (G: SongJinnGame, pid: PlayerID): General[] => {
    const generals: General[] = [];
    const pub = pid2pub(G, pid);
    pub.generals.forEach((p, idx) => {
        if (p === GeneralStatus.TROOP) {
            generals.push(idx as General);
        }
    })
    return generals;
}
export const getSkillGeneral = (G: SongJinnGame, pid: PlayerID): General[] => {
    const generals: General[] = [];
    const pub = pid2pub(G, pid);
    pub.generalSkill.forEach((p, idx) => {
        if (p && pub.generals[idx] === GeneralStatus.TROOP) {
            generals.push(idx as General);
        }
    })
    return generals;
}
export const getPlaceCountryGeneral = (G: SongJinnGame, ctr: Country, place: TroopPlace): General[] => {
    const log = [`getPlaceCountryGeneral|p${ctr}${placeToStr(place)}`]
    const generals: General[] = [];
    const pub = ctr2pub(G, ctr);
    pub.generalPlace.forEach((p, idx) => {
        if (p === place && pub.generals[idx] === GeneralStatus.TROOP) {
            log.push(`|${getGeneralNameByCountry(ctr, idx)}`);
            generals.push(idx as General);
        }
    })
    log.push(`|result${generals}`);
    logger.warn(`${G.matchID}|${log.join('')}`);
    return generals;
}
export const getPlaceGeneral = (G: SongJinnGame, pid: PlayerID, place: TroopPlace): General[] => {
    const log = [`getPlaceGeneral|p${pid}|${placeToStr(place)}`]
    const generals: General[] = [];
    const pub = pid2pub(G, pid);
    pub.generalPlace.forEach((p, idx) => {
        if (p === place && pub.generals[idx] === GeneralStatus.TROOP) {
            log.push(`|${getGeneralNameByCountry(pid2ctr(pid), idx)}`);
            generals.push(idx as General);
        }
    })
    logger.debug(`${G.matchID}|${log.join('')}`);
    return generals;
}
export const optionToActualDst = (dst: string): TroopPlace => {
    const parsed = parseInt(dst);
    return (parsed === undefined || isNaN(parsed) ? dst : parsed) as TroopPlace;
}
// export const hasOpponentTroop = (G: SongJinnGame, dst: TroopPlace, ctr: Country) => {
//     ctr2pub(G, ctr);
// }
export const isZhouXing = (t: Troop) => {
    return t.u[3] > 0;
}


export const getRetreatDst = (G: SongJinnGame, t: Troop): TroopPlace[] => {
    return getMarchAdj(G, t.p);
}
export const getMarchDst = (G: SongJinnGame, t: Troop): TroopPlace[] => {
    const adj = getMarchAdj(G, t.p);
    let res: TroopPlace[] = [...adj];
    if (isQiXing(t) || isZhouXing(t) || hasGeneral(G, t, SongGeneral.LiXianZhong)) {
        adj.forEach(p => {
            const newAdj = getMarchAdj(G, p).filter(a => !res.includes(a));
            res = res.concat(newAdj);
            // TODO complex rule for qi xing and zhou xing
            // if (isMountainPassID(p)) {
            //     const d = getPassAdj(p).filter(r => {
            //         const terrain = getRegionById(r).terrain;
            //         return terrain === TerrainType.FLATLAND || terrain === TerrainType.HILLS
            //     }).filter(p=>!adj.includes(p));
            //     res = res.concat(d);
            // }else{
            //     if (isRegionID(p)) {
            //         const reg = getRegionById(p);
            //         const result: TroopPlace[] = [...reg.land, ...reg.water, ...reg.pass];
            //         Nations.forEach(n => {
            //             if (getNationAdj(n).includes(dst)) {
            //                 result.push(n);
            //             }
            //         })
            //         MountainPasses.forEach(n => {
            //             if (getPassAdj(n).includes(p)) {
            //                 result.push(n);
            //             }
            //         })
            //         const regAdj = result.filter(r => {
            //             const terrain = getRegionById(r).terrain;
            //             return terrain === TerrainType.FLATLAND || terrain === TerrainType.HILLS
            //         }).filter(p=>((!adj.includes(p)) && (!res.includes(p))));
            //         res = res.concat(regAdj)
            //     }else{
            //         if (isNationID(dst)) {
            //             return getNationAdj(dst);
            //         }
            //     }
        })
    }
    return res
}

export const getMarchAdj = (_G: SongJinnGame, dst: TroopPlace): TroopPlace[] => {
    if (isMountainPassID(dst)) {
        return getPassAdj(dst);
    }
    if (isRegionID(dst)) {
        const reg = getRegionById(dst);
        const result: TroopPlace[] = [...reg.land, ...reg.water, ...reg.pass];
        Nations.forEach(n => {
            if (getNationAdj(n).includes(dst)) {
                result.push(n);
            }
        })
        MountainPasses.forEach(n => {
            if (getPassAdj(n).includes(dst)) {
                result.push(n);
            }
        })
        return result;
    }
    if (isNationID(dst)) {
        return getNationAdj(dst);
    }
    // bei wei kun
    return [];
}
export const getTroopByPlace = (G: SongJinnGame, p: TroopPlace) => {
    const result: Troop[] = []
    G.song.troops.forEach(t => {
        if (t.p === p) {
            result.push(t);
        }
    });
    G.jinn.troops.forEach(t => {
        if (t.p === p) {
            result.push(t);
        }
    });
    return result;
}

function getGeneralTroop(G: SongJinnGame, pid: string, g: General) {
    return getTroopByPlace(G, pid2pub(G, pid).generalPlace[g]);
}

export const generalWithOpponentTroop = (G: SongJinnGame, pid: PlayerID,): General[] => {
    const result: General[] = []
    const general = getPresentGeneral(G, pid);
    general.forEach(g => {
        const generalTroop = getGeneralTroop(G, pid, g);
        let hasOwn = false;
        let hasOppo = false;
        generalTroop.forEach(t => {
            if (t.g === pid2ctr(pid)) {
                hasOwn = true;
                // result.push(g);
            } else {
                hasOppo = true;
            }
        })
        if (hasOppo && !hasOwn) {
            result.push(g)
        }
    })
    return result;
}
export const generalInTroop = (G: SongJinnGame, pid: PlayerID, general: General): boolean => {
    const pub = pid2pub(G, pid);
    return pub.generals[general] === GeneralStatus.TROOP
}
export const generalRemoved = (G: SongJinnGame, pid: PlayerID, general: General): boolean => {
    const pub = pid2pub(G, pid);
    return pub.generals[general] === GeneralStatus.REMOVED
}

export const getReadyGenerals = (G: SongJinnGame, pid: PlayerID): General[] => {
    const readyGenerals = [];
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            for (let i = 0; i < 6; i++) {
                if (G.song.generals[i] === GeneralStatus.READY) {
                    readyGenerals.push(i);
                }
            }
            break;
        case SJPlayer.P2:
            for (let i = 0; i < 6; i++) {
                if (G.jinn.generals[i] === GeneralStatus.READY) {
                    readyGenerals.push(i);
                }
            }
            break;
    }
    return readyGenerals;
}
export const getMovePlan = (G: SongJinnGame) => {
    const plans = [...G.song.plan, ...G.jinn.plan];
    if (G.song.completedPlan.length > 0 && !G.events.includes(ActiveEvents.YanJingYiNan)) {
        const songTop = G.song.completedPlan[G.song.completedPlan.length - 1];
        plans.push(songTop);
    }
    if (G.jinn.completedPlan.length > 0) {
        plans.push(G.jinn.completedPlan[G.jinn.completedPlan.length - 1])
    }
    return plans;
}
export const diplomaticVictory = (G: SongJinnGame) => {
    if (G.jinn.nations.length + G.removedNation.length === Nations.length) {
        return Country.JINN;
    } else {
        if (G.song.nations.length + G.removedNation.length === Nations.length) {
            return Country.SONG;
        } else {
            return null;
        }
    }
}
export const getStage = (ctx: Ctx) => {
    if (ctx.activePlayers === null) {
        return Stage.NULL;
    } else {
        return ctx.activePlayers[activePlayer(ctx)]
    }
}
export const getJinnTroopByRegion = (G: SongJinnGame, r: RegionID): Troop | null => {
    return getJinnTroopByPlace(G, r);
}

export const getSongTroopByPlace = (G: SongJinnGame, r: TroopPlace): Troop | null => {
    const log = [`getSongTroopByPlace|${r}`];
    let result = null;
    G.song.troops.forEach(t => {
        log.push(`|${getSimpleTroopText(G, t)}|t`);
        if (t.p === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.warn(`${G.matchID}|${log.join('')}`);
    return result;
}
export const getTroopByCountryCity = (G: SongJinnGame, ctr: Country, src: CityID) => {
    return ctr === Country.SONG ? getSongTroopByCity(G, src) : getJinnTroopByCity(G, src)
}
export const getTroopByCountryPlace = (G: SongJinnGame, ctr: Country, src: TroopPlace) => {
    return ctr === Country.SONG ? getSongTroopByPlace(G, src) : getJinnTroopByPlace(G, src)
}
export const getJinnTroopByPlace = (G: SongJinnGame, r: TroopPlace): Troop | null => {
    const log = [`getJinnTroopByPlace|${JSON.stringify(r)}`];
    let result = null;
    G.jinn.troops.forEach(t => {
        log.push(`|${getSimpleTroopText(G, t)}|t`);
        if (t.p === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    log.push(`|${JSON.stringify(result)}result`);
    logger.warn(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getTroopByCityCountry = (G: SongJinnGame, r: CityID, ctr: Country): Troop | null => {
    return ctr === Country.JINN ? getJinnTroopByCity(G, r) : getSongTroopByCity(G, r);
}
export const getJinnTroopByCity = (G: SongJinnGame, r: CityID): Troop | null => {
    const log = [`getJinnTroopByCity|${r}`];
    let result = null;
    G.jinn.troops.forEach(t => {
        log.push(`|${getSimpleTroopText(G, t)}|t`);
        if (t.c === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.warn(`${G.matchID}|${log.join('')}`);
    return result;
}
export const getSongTroopByCity = (G: SongJinnGame, r: CityID): Troop | null => {
    const log = [`getSongTroopByCity|${r}`];
    let result = null;
    G.song.troops.forEach(t => {
        log.push(`|${getSimpleTroopText(G, t)}|t`);
        if (t.c === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.warn(`${G.matchID}|${log.join('')}`);
    return result;
}


export const getDeployCities = (G: SongJinnGame, ctr: Country) => {
    return ctr === Country.SONG ? getSongDeployCities(G) : getJinnDeployCities(G);
}

export const getSongDeployCities = (G: SongJinnGame) => {
    return G.song.cities.filter((cid) => {
        const troop = getJinnTroopByCity(G, cid);
        return troop === null;
    })
}
export const getJinnDeployCities = (G: SongJinnGame) => {
    return G.jinn.cities.filter((cid) => {
        const troop = getSongTroopByCity(G, cid);
        const city = getCityById(cid)
        return troop === null && city.colonizeLevel <= G.colony;
    })
}

export const getPolicy = (G: SongJinnGame) => {
    if (G.events.includes(ActiveEvents.LiGang)) {
        return G.policy > 1 ? 3 : G.policy + 2;
    } else {
        return G.policy;
    }
}


export function unitsToString(units: number[]) {
    if (units.length === 7) {
        return jinnUnitsStr(units);
    } else {
        return songUnitsStr(units);
    }
}

export function jinnUnitsStr(units: number[]) {
    let result = "";
    units.forEach((item, index) => {
        if (item > 0) {
            result = result.concat(item.toString(), UNIT_SHORTHAND[1][index]);
        }
    })
    return result;
}

export function songUnitsStr(units: number[]) {
    let result = "";
    units.forEach((item, index) => {
        if (item > 0) {
            result = result.concat(item.toString(), UNIT_SHORTHAND[0][index]);
        }
    })
    return result;
}

export const getNationAdj = (pid: NationID): TroopPlace[] => {
    switch (pid) {
        case NationID.XiLiao:
            return [NationID.XiXia];
        case NationID.XiXia:
            return [
                RegionID.R01, RegionID.R02DaTonFu,
                RegionID.R09,
                RegionID.R29, RegionID.R30, RegionID.R31, RegionID.R32
            ];
        case NationID.TuBo:
            return [
                RegionID.R29, RegionID.R33,
                RegionID.R51, RegionID.R53, RegionID.R54,
            ]
        case NationID.DaLi:
            return [RegionID.R53, RegionID.R57, RegionID.R58]
        case NationID.GaoLi:
            return [RegionID.R23, RegionID.R06];
    }

}
export const getPassAdj = (pid: MountainPassID) => {
    switch (pid) {
        case MountainPassID.WuGuan:
            return [RegionID.R36, RegionID.R40];
        case MountainPassID.DaSanGuan:
            return [RegionID.R33, RegionID.R52];
        case MountainPassID.TongGuan:
            return [RegionID.R36, RegionID.R37];
        case MountainPassID.JuYongGuan:
            return [RegionID.R02DaTonFu, RegionID.R07];
        case MountainPassID.JianMenGuan:
            return [RegionID.R51, RegionID.R54, RegionID.R55];

    }
}
export const oppoPlayerById = (G: SongJinnGame, pid: PlayerID) => {
    return G.player[oppoPid(pid) as SJPlayer];
}
export const playerById = (G: SongJinnGame, pid: PlayerID) => {
    return G.player[pid as SJPlayer];
}
export const oppoPub = (G: SongJinnGame, pid: PlayerID) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return G.jinn;
    } else {
        return G.song;
    }
}

export const setTroopPlaceByCtr = (G: SongJinnGame, ctr: Country, p: TroopPlace, newPlace: TroopPlace) => {
    const log = [`setTroopPlaceByCtr`];
    log.push(`|${ctr}|ctr`);
    log.push(`|${placeToStr(p)}|src`);
    log.push(`|${placeToStr(newPlace)}|dst`);
    const troops = ctr === Country.SONG ? G.song.troops : G.jinn.troops;
    const target = troops.filter(tr => tr.p === p);
    log.push(`|${JSON.stringify(target)}|target`);
    if (target.length > 0) {
        if (target.length > 1) {
            log.push(`|more than one error`);
        } else {
            target[0].p = newPlace;
        }
    } else {
        log.push(`|noTroop|error`);
    }
    log.push(`|${JSON.stringify(troops)}|troops`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const getOpponentPlaceTroopByCtr = (G: SongJinnGame, ctr: Country, p: TroopPlace) => {
    if (ctr === Country.SONG) {
        return getJinnTroopByPlace(G, p);
    } else {
        return getSongTroopByPlace(G, p);
    }
}
export const getOpponentCityTroopByCtr = (G: SongJinnGame, ctr: Country, c: CityID) => {
    if (ctr === Country.SONG) {
        return getJinnTroopByCity(G, c);
    } else {
        return getSongTroopByCity(G, c);
    }
}
export const getOpponentPlaceTroopById = (G: SongJinnGame, pid: PlayerID, p: TroopPlace) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return getJinnTroopByPlace(G, p);
    } else {
        return getSongTroopByPlace(G, p);
    }
}

export const getCombatStateById = (G: SongJinnGame, pid: PlayerID) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return G.combat.song;
    } else {
        return G.combat.jinn;
    }
}
export const pid2cci = (G: SongJinnGame, pid: PlayerID) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return G.combat.song;
    } else {
        return G.combat.jinn;
    }
}
export const pid2pub = (G: SongJinnGame, pid: PlayerID) => {
    if (pid as SJPlayer === SJPlayer.P1) {
        return G.song;
    } else {
        return G.jinn;
    }
}
export const getFullDesc = (card: Cards): string => {
    let effText = "效果：" + card.effectText;
    if (card.precondition !== null) {
        effText = ` 前置条件：${card.precondition} ${effText}`
    }
    if (card.ban !== null) {
        effText += `撤销：${card.ban}`
    }
    if (card.block !== null) {
        effText += `禁止：${card.block}`
    }
    if (card.unlock !== null) {
        effText += `解锁：${card.unlock}`
    }
    return effText;
}

export interface Cards {
    id: SJEventCardID,
    block: string | null
    name: string,
    country: Country,
    op: number,
    remove: boolean,
    era: IEra,
    duration: EventDuration,
    effectText: string,
    ban: string | null,
    precondition: string | null,
    combat: boolean,
    unlock: string | null,
    pre: (G: SongJinnGame, ctx: Ctx) => boolean,
    event: (G: SongJinnGame, ctx: Ctx) => void
}

export const sjCardById: (cid: BaseCardID) => Cards = (cid: BaseCardID) => {
    return idToCard[cid];
}


export function checkSongLoseEmperor(G: SongJinnGame, ctx: Ctx) {
    const log = [`checkSongLoseEmperor`];
    if (G.player['0'].hand.includes(SongBaseCardID.S30)) {
        log.push(`|${PendingEvents.FuHaiTaoSheng}`);
        G.pending.events.push(PendingEvents.FuHaiTaoSheng);
        changePlayerStage(G, ctx, 'confirmRespond', SJPlayer.P1);
    } else {
        log.push(`|doLose`);
        songLoseEmperor(G, ctx);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function songLoseEmperor(G: SongJinnGame, ctx: Ctx) {
    const log = [`songLoseEmperor`];
    log.push(`|${G.song.emperor}|G.song.emperor`);
    G.song.emperor = null;
    log.push(`|${G.song.emperor}|G.song.emperor`);
    policyDown(G, 1);
    G.pending.events.push(PendingEvents.LoseCorruption);
    changePlayerStage(G, ctx, 'confirmRespond', SJPlayer.P1);
    log.push(`|chooseLoseNormalOrCorruiton`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const idToCard = {
    [SongBaseCardID.S01]: {
        id: SongBaseCardID.S01,
        name: "建炎南渡",
        op: 4,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "宋国未控制开封",
        ban: null,
        block: null,
        unlock: "【苗刘兵变】",
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "在两浙路或江南两路免费拥立。宋国获得1国力禁止金国以事件方式在两浙路放置部队。",
        pre: (G: SongJinnGame, _ctx: Ctx) => !G.song.cities.includes(CityID.KaiFeng),
        event: (G: SongJinnGame, ctx: Ctx) => {
            G.events.push(ActiveEvents.JianYanNanDu);
            ctx.events?.setStage('emperor');
        }
    },
    [SongBaseCardID.S02]: {
        id: SongBaseCardID.S02,
        name: "李纲",
        op: 3,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "第7回合前",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "腐败值减1。本回合余下的时间内，政策倾向视为提升2级的状态（最高为主战3）。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.turn < 7,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            if (G.song.corruption > 0) {
                G.song.corruption--;
            }
            G.events.push(ActiveEvents.LiGang)
        }
    },
    [SongBaseCardID.S03]: {
        id: SongBaseCardID.S03,
        name: "靖康学生运动",
        op: 3,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "政策倾向为和议",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "腐败值变为0 ,每因此减少1点腐败值就提升1级政策倾向。",
        pre: (G: SongJinnGame, _ctx: Ctx) => getPolicy(G) < 0,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            policyUp(G, G.song.corruption);
            G.song.corruption = 0;
        }
    },
    [SongBaseCardID.S04]: {
        id: SongBaseCardID.S04,
        name: "西军曲端",
        op: 3,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "【三年之约】作为事件打出时行动点数减1。每当回合结束阶段时，宋国在陕西六路放置1个步兵。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            G.events.push(ActiveEvents.XiJunQuDuan);
        }
    },
    [SongBaseCardID.S05]: {
        id: SongBaseCardID.S05,
        name: "天下兵马大元帅",
        op: 3,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移动1个宋国军团到所在路内或相邻路内1座没有被围困的宋国城市。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S06]: {
        id: SongBaseCardID.S06,
        name: "霹雳炮",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个宋国控制的城市，放置1个霹雳炮。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S07]: {
        id: SongBaseCardID.S07,
        name: "一盆凉水",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "夏季",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除斡离不。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.round === 4 || G.round === 8,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            removeGeneral(G, SJPlayer.P2, JinnGeneral.WoLiBu)
        }
    },
    [SongBaseCardID.S08]: {
        id: SongBaseCardID.S08,
        name: "张邦昌还政",
        op: 3,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "【靖康之变】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "金国在开封的军团移动到大同府或大定府，宋国在开封放置1个步兵。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.JingKangZhiBian),
        event: (G: SongJinnGame, _ctx: Ctx) => {
            G.song.troops.push({
                u: [1, 0, 0, 0, 0, 0], c: CityID.KaiFeng,
                g: Country.SONG,
                p: RegionID.R43
            });
        }
    },
    [SongBaseCardID.S09]: {
        id: SongBaseCardID.S09,
        name: "耶律大石",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "西辽成为宋国的盟国。若西辽已经是宋国的盟国，消灭金国1个部队。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            if (!G.song.nations.includes(NationID.XiLiao)) {
                if (G.jinn.nations.includes(NationID.XiLiao)) {
                    G.jinn.nations.splice(G.jinn.nations.indexOf(NationID.XiLiao), 1);
                }
                G.song.nations.push(NationID.XiLiao);
            } else {

            }
        }
    },
    [SongBaseCardID.S10]: {
        id: SongBaseCardID.S10,
        name: "李彦仙",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1座被围困的城市放置1个步兵，或者消灭围城军团的1个部队。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S11]: {
        id: SongBaseCardID.S11,
        name: "勤王诏令",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "宋国皇帝在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "宋国按照补充规则，在宋国控制且殖民难度大于金国殖民能力的城市，放置预备兵。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.emperor !== null,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S12]: {
        id: SongBaseCardID.S12,
        name: "战车",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: false,
        precondition: "宗泽在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：在平原，宋国每个步兵战斗力加1。",
        pre: (G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S13]: {
        id: SongBaseCardID.S13,
        name: "红巾军",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "金国每控制1个尚未殖民的城市，宋国就在隆德府放置1个步兵〔上限为宋国军事等级〕。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S14]: {
        id: SongBaseCardID.S14,
        name: "大理矮脚马",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "若大理中立，则征募1个骑兵。若大理是宋国的盟国，则效果翻倍且不受内政等级限制。",
        pre: (G: SongJinnGame, _ctx: Ctx) => !G.jinn.nations.includes(NationID.DaLi),
        event: (G: SongJinnGame, _ctx: Ctx) => {
            if (G.song.nations.includes(NationID.DaLi)) {
                doRecruit(G, [0, 0, 2, 0, 0, 0], SJPlayer.P1);
            } else {
                const readySum = G.song.ready.reduce(accumulator);
                if (readySum < G.song.civil) {
                    doRecruit(G, [0, 0, 1, 0, 0, 0], SJPlayer.P1);
                }
            }
        }
    },
    [SongBaseCardID.S15]: {
        id: SongBaseCardID.S15,
        name: "八字军",
        op: 3,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "在河北两路的1个区域，放置2个步兵。【刘錡】伤害加1。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.BaZiJun)
    },
    [SongBaseCardID.S16]: {
        id: SongBaseCardID.S16,
        name: "赵榛",
        op: 2,
        country: Country.SONG,
        era: IEra.E,
        remove: true,
        precondition: "【靖康之变】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个未完成殖民的金国城市，放置2个步兵，这个城市所在的路结算控制权。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.JingKangZhiBian),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S17]: {
        id: SongBaseCardID.S17,
        name: "金太宗驾崩",
        op: 4,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "第5回合开始之后",
        ban: "【金太宗】",
        block: "【金太宗】",
        unlock: "【完颜昌主和】【天眷新政】",
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "移除粘罕，选择金国内政等级、军事等级或殖民能力降低1级。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.turn >= 5,
        event: (G: SongJinnGame, ctx: Ctx) => {
            removeGeneral(G, SJPlayer.P2, JinnGeneral.ZhanHan);
            G.events.push(ActiveEvents.JinTaiZongJiaBeng);
            if (G.events.includes(ActiveEvents.JinTaiZong)) {
                G.events.splice(G.events.indexOf(ActiveEvents.JinTaiZong), 1);
            }
            G.pending.events.push(PendingEvents.JiaBeng);
            ctx.events?.setStage('confirmRespond');
        }
    },
    [SongBaseCardID.S18]: {
        id: SongBaseCardID.S18,
        name: "废黜伪齐",
        op: 4,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "【建立大齐】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除1个齐状态标志物，结算这个路的控制权，消灭2个齐军。若此时齐控制的城市不多于4个，则金国失去齐军征募许可。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.JianLiDaQi),
        event: (G: SongJinnGame, ctx: Ctx) => {
            G.pending.events.push(PendingEvents.WeiQi);
            ctx.events?.setStage('confirmRespond');
        }
    },
    [SongBaseCardID.S19]: {
        id: SongBaseCardID.S19,
        name: "岳飞登场",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "宋国军事等级不低于4",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除宗泽，在准南两路或荆湖两路放置岳飞。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.military >= 4,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            removeGeneral(G, SJPlayer.P1, SongGeneral.ZongZe);
            moveGeneralToReady(G, SJPlayer.P1, SongGeneral.YueFei);
            // TODO auto
            // ctx.events?.setStage('chooseCity');
            // G.pending = "placeGeneral";
        }
    },
    [SongBaseCardID.S20]: {
        id: SongBaseCardID.S20,
        name: "吴玠登场",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: "【西军曲端】",
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在陕西六路或川峡四路内的1个城市放置吴玠。若这座城市没有部队，则放置2个弓兵到该城市",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            moveGeneralToReady(G, SJPlayer.P1, SongGeneral.WuJie);
            if (G.events.includes(ActiveEvents.XiJunQuDuan)) {
                G.events.splice(G.events.indexOf(ActiveEvents.XiJunQuDuan), 1);
            }
        }
    },
    [SongBaseCardID.S21]: {
        id: SongBaseCardID.S21,
        name: "韩世忠登场",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "宋国皇帝在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在宋国皇帝所在的区域放置韩世忠。若相邻区域有金国部队，则放置2个步兵到该城市。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.emperor !== null,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            moveGeneralToReady(G, SJPlayer.P1, SongGeneral.HanShiZhong);
            if (G.song.emperor !== null) {
                const reg = getCityById(G.song.emperor).region;
                const adjPlace = getMarchAdj(G, reg);
                let placeInfantry = false;
                // wei kun cheng nei
                // buweikun cheng wai
                adjPlace.forEach(p => {
                    const jt = getJinnTroopByPlace(G, p);
                    if (jt !== null) {
                        placeInfantry = true;
                    }
                });
                if (placeInfantry) {
                    doPlaceUnit(G, [2, 0, 0, 0, 0, 0], Country.SONG, reg);
                }
            }
            // G.song.generalPlace[SongGeneral.HanShiZhong] = G.song.emperor;
        }
    },
    [SongBaseCardID.S22]: {
        id: SongBaseCardID.S22,
        name: "无路可退",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "宋国国力不大于7时",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "每当金国失去1点国力，宋国政策倾向提升1级。若事件发生时宋国国力不大于6 ,则立即在3个宋国控制的核心城市各放置1个步兵。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.WuLuKeTui)
    },
    [SongBaseCardID.S23]: {
        id: SongBaseCardID.S23,
        name: "完顔昌主和",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "【金太宗驾崩】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "降低金国1级军事等级。若兀术在场，则放置到预备兵区。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.JinTaiZongJiaBeng)
            && !G.events.includes(ActiveEvents.TianJuanZhengBian),
        event: (G: SongJinnGame, _ctx: Ctx) => {
            changeMilitary(G, SJPlayer.P2, -1);
            if (G.jinn.generals[JinnGeneral.WuZhu] === GeneralStatus.TROOP) {
                moveGeneralToReady(G, SJPlayer.P2, JinnGeneral.WuZhu)
            }
        }
    },
    [SongBaseCardID.S24]: {
        id: SongBaseCardID.S24,
        name: "向海上发展",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "宋国内政等级不低于5",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "福建路提供1国力。宋国可以从平江府向高丽进行外交。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.civil >= 5,
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.XiangHaiShangFaZhan)
    },
    [SongBaseCardID.S25]: {
        id: SongBaseCardID.S25,
        name: "背嵬军",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "征募2个背嵬军。若岳飞在场，则可以在岳飞所在区域，直接放置这2个背嵬军。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S26]: {
        id: SongBaseCardID.S26,
        name: "伪齐良马",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "齐每控制1个路，宋国就征募1个骑兵（不受内政等级限制〕。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.qi.length > 0,
        event: (G: SongJinnGame, _ctx: Ctx) => doRecruit(G, [0, 0, G.qi.length, 0, 0, 0], SJPlayer.P1)
    },
    [SongBaseCardID.S27]: {
        id: SongBaseCardID.S27,
        name: "任用赵鼎 张浚",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "腐败值减1。若腐败值已经为0 ,则提升1级政策倾向。发展阶段时，提供4点发展力。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            if (G.song.corruption === 0) {
                policyUp(G, 1);
            } else {
                G.song.corruption--;
            }
        }
    },
    [SongBaseCardID.S28]: {
        id: SongBaseCardID.S28,
        name: "锁江困敌",
        op: 3,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "征募2个战船。若韩世忠在场，则可以在韩世忠所在区域，直接放置这2个战船。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => doRecruit(G, [0, 0, 0, 2, 0, 0], SJPlayer.P1)
    },
    [SongBaseCardID.S29]: {
        id: SongBaseCardID.S29,
        name: "招降",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：每消灭或击溃1个签军，就征募1个步兵，不受内政等级限制。",
        pre: (G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S30]: {
        id: SongBaseCardID.S30,
        name: "浮海逃生",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: "【搜山检海】",
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "当宋国失去皇帝时，可以移除这张牌，移动宋国皇帝到任意宋国控制的城市。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S31]: {
        id: SongBaseCardID.S31,
        name: "改进神臂弓",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "宋国军事等级不低于5",
        ban: null,
        block: "【普及重步兵】",
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "宋国弓兵在全部地形战斗力变为2 ,征募消变为2。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.military >= 5 && !G.events.includes(ActiveEvents.ShenBiGong),
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.ShenBiGong)
    },
    [SongBaseCardID.S32]: {
        id: SongBaseCardID.S32,
        name: "普及重步兵",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "宋国军事等级不低于5",
        ban: null,
        block: "【改进神臂弓】",
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "宋国步兵耐久度加1。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.military >= 5 && !G.events.includes(ActiveEvents.ZhongBuBing),
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.ZhongBuBing)
    },
    [SongBaseCardID.S33]: {
        id: SongBaseCardID.S33,
        name: "杨沂中",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在宋国皇帝所在的区域放置1个步兵和1个弓兵。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.emperor !== null,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            if (G.song.emperor !== null) {
                const reg = getCityById(G.song.emperor).region;
                const tr = getTroopByCountryPlace(G, Country.SONG, reg);
                if (tr === null) {
                    doPlaceUnit(G, [1, 1, 0, 0, 0, 0], Country.SONG, G.song.emperor);
                } else {
                    doPlaceUnit(G, [1, 1, 0, 0, 0, 0], Country.SONG, reg);
                }
            }
        }
    },
    [SongBaseCardID.S34]: {
        id: SongBaseCardID.S34,
        name: "金夏边境冲突",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "若西夏是宋国的盟国，则消灭总共2耐久的部队若西夏中立，则消灭总共1耐久的部队。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S35]: {
        id: SongBaseCardID.S35,
        name: "水浒赛",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在泰州地区放置1个战船，在准南两路消灭1个金国部队。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            doPlaceUnit(G, [0, 0, 0, 1, 0, 0], Country.SONG, RegionID.R47);
        }
    },
    [SongBaseCardID.S36]: {
        id: SongBaseCardID.S36,
        name: "岳家军",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: "岳飞在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：参战军团中视为增加1个岳飞。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S37]: {
        id: SongBaseCardID.S37,
        name: "驻队矢",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：宋国远程部队在远程阶段和交锋阶段优先结算。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S38]: {
        id: SongBaseCardID.S38,
        name: "王庶",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: "【曲端之死】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在陕西六路和川峡四路每个宋国控制的城市，各放置1个【步兵】〔上限为宋国军事等级〕。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.QuDuanZhiSi),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S39]: {
        id: SongBaseCardID.S39,
        name: "《守城录》",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: false,
        precondition: "宋国军团在城墙时",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：金国战斗骰点数减1。",
        pre: (G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [SongBaseCardID.S40]: {
        id: SongBaseCardID.S40,
        name: "刘光世",
        op: 2,
        country: Country.SONG,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "腐败值加1。使用这张牌的行动力执行征募和进军，若没有触发任何战斗，则用此牌执行发展。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            G.song.corruption++;
            G.op = 2;
            // TODO check combat??
            developInstead(G, SJPlayer.P1, SongBaseCardID.S40);
        }
    },
    [SongBaseCardID.S41]: {
        id: SongBaseCardID.S41,
        name: "岳帅之来此间震恐",
        op: 4,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: "岳飞在场且宋国军事等级不低于6",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "宋国作战计划替换为【还我河山】。本回合内宋国所有战斗骰点数加1。当岳飞被移除时，此事件被撤销。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.military >= 6 &&
            G.song.generals[SongGeneral.YueFei] === GeneralStatus.TROOP,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            G.events.push(ActiveEvents.YueShuaiZhiLai);
            const planDeck = G.secret.planDeck;
            G.song.plan.forEach(p => planDeck.push(p));
            if (planDeck.includes(PlanID.J23)) {
                planDeck.splice(planDeck.indexOf(PlanID.J23), 1);
            }
            G.song.plan = [PlanID.J23];
        }
    },
    [SongBaseCardID.S42]: {
        id: SongBaseCardID.S42,
        name: "李显忠登场",
        op: 3,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "西夏向金国方向调整1级。在1个宋国控制的区域放置李显忠和2个骑兵。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            nationMoveJinn(G, NationID.XiXia);
            moveGeneralToReady(G, SJPlayer.P1, SongGeneral.LiXianZhong);
        }
    },
    [SongBaseCardID.S43]: {
        id: SongBaseCardID.S43,
        name: "刘錡",
        op: 3,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "掷骰1次，对1个围城军团造成等于掷骰点数的伤害。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.jinn.troops.filter(t=>troopCanSiege(G,t)).length > 0,
        event: (G: SongJinnGame, ctx: Ctx) => rollDiceByPid(G, ctx, SJPlayer.P1 , 1)
    },
    [SongBaseCardID.S44]: {
        id: SongBaseCardID.S44,
        name: "吴璘登场",
        op: 3,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: "吴玠不在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在陕西六路或川峡四路放置吴璘。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.generals[SongGeneral.WuJie] !== GeneralStatus.TROOP,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            moveGeneralToReady(G, SJPlayer.P1, SongGeneral.WuLin);
        }
    },
    [SongBaseCardID.S45]: {
        id: SongBaseCardID.S45,
        name: "梁兴渡河",
        op: 3,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: "岳飞在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "降低金国1级殖民能力，用此牌执行发展。发展阶段，此牌提供发展力等于金国占领但没有完成殖民的城市数量。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.generals[SongGeneral.YueFei] === GeneralStatus.TROOP,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            colonyDown(G, 1);
            developInstead(G, SJPlayer.P1, SongBaseCardID.S45);
        }
    },
    [SongBaseCardID.S46]: {
        id: SongBaseCardID.S46,
        name: "定都临安",
        op: 2,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: "宋国皇帝在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移动宋国皇帝到钱塘，用此牌执行派遣。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.emperor !== null,
        event: (G: SongJinnGame, _ctx: Ctx) => G.song.emperor = CityID.QianTang
    },
    [SongBaseCardID.S47]: {
        id: SongBaseCardID.S47,
        name: "告老迁乡",
        op: 2,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除银术可。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => removeGeneral(G, SJPlayer.P2, JinnGeneral.YinShuKe)
    },
    [SongBaseCardID.S48]: {
        id: SongBaseCardID.S48,
        name: "北谒宋陵",
        op: 2,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: "宋国控制洛阳",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "用此牌执行发展，宋国摸1张牌。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.cities.includes(CityID.LuoYang),
        event: (G: SongJinnGame, ctx: Ctx) => {
            developInstead(G, SJPlayer.P1, SongBaseCardID.S48);
            drawCardForSong(G, ctx);
        }
    },
    [SongBaseCardID.S49]: {
        id: SongBaseCardID.S49,
        name: "燕京以南 号令不行",
        op: 2,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: "宋国控制析津",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "放在宋国完成的作战计划堆最上面。绍兴和议时，宋国额外获得1胜利分数。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.song.cities.includes(CityID.XiJin),
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.YanJingYiNan)
    },
    [SongBaseCardID.S50]: {
        id: SongBaseCardID.S50,
        name: "李宝",
        op: 2,
        country: Country.SONG,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌： 在宋国参战军团，放置1个战船。",
        pre: (_G: SongJinnGame, _ctx: Ctx) => false,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J01]: {
        id: JinnBaseCardID.J01,
        name: "靖康之变",
        op: 4,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: "宋国未控制开封",
        ban: null,
        block: null,
        unlock: "【金兵来了】【张邦昌还政】【赵榛】",
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "宋国失去1国力。金国获得1国力，并提升1级内政等级。",
        pre: (G: SongJinnGame, _ctx: Ctx) => !G.song.cities.includes(CityID.KaiFeng),
        event: (G: SongJinnGame, _ctx: Ctx) => {
            changeCivil(G, SJPlayer.P2, 1);
            G.events.push(ActiveEvents.JingKangZhiBian);
            policyDown(G, 1);
        }
    },
    [JinnBaseCardID.J02]: {
        id: JinnBaseCardID.J02,
        name: "折可求献三州",
        op: 3,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: "金国控制肤施",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在陕西六路消灭2个部队，并结算路控制权。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.jinn.cities.includes(CityID.Fushi),
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J03]: {
        id: JinnBaseCardID.J03,
        name: "韩昉",
        op: 3,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "提升金国1级内政等级或殖民能力。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            G.pending.events.push(PendingEvents.HanFang);
            ctx.events?.setStage('confirmRespond');
        }
    },
    [JinnBaseCardID.J04]: {
        id: JinnBaseCardID.J04,
        name: "杜充降金",
        op: 3,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "消灭1个宋国部队，征募1个签军〔不能消灭皇帝或将领所在区域的部队〕。若【宗泽】不在场，则效果翻倍。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J05]: {
        id: JinnBaseCardID.J05,
        name: "金太宗",
        op: 3,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "在补充阶段开始时可以使用1行动力征募。在发展阶段提供额外1发展力。",
        pre: (G: SongJinnGame, ctx: Ctx) => !G.events.includes(ActiveEvents.JinTaiZongJiaBeng),
        event: (G: SongJinnGame, ctx: Ctx) => G.events.push(ActiveEvents.JinTaiZong)
    },
    [JinnBaseCardID.J06]: {
        id: JinnBaseCardID.J06,
        name: "苗刘兵变",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: "【建炎南渡】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "宋国选择以下一项执行：弃掉1张手牌，并移动1个和宋国皇帝相邻的军团到宋国皇帝所在区域；或者宋国失去皇帝。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.events.includes(ActiveEvents.JianYanNanDu),
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J07]: {
        id: JinnBaseCardID.J07,
        name: "渡河！渡河！渡河！",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: "第2回合开始之后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除 宗泽",
        pre: (G: SongJinnGame, ctx: Ctx) => G.turn >= 2,
        event: (G: SongJinnGame, ctx: Ctx) => removeGeneral(G, SJPlayer.P1, SongGeneral.ZongZe)
    },
    [JinnBaseCardID.J08]: {
        id: JinnBaseCardID.J08,
        name: "追亡逐北",
        op: 3,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: "【耶律大石】",
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "移除西辽。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => doRemoveNation(G, NationID.XiLiao)
    },
    [JinnBaseCardID.J09]: {
        id: JinnBaseCardID.J09,
        name: "济南知府刘豫",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: "【建立大齐】",
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "在历城消灭灭全部宋国部队，放置2个签军。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            const troop = getSongTroopByCity(G, CityID.LiCheng);
            if (troop !== null) {
                removeUnitByPlace(G, troop.u, SJPlayer.P1, troop.p);
            }
            doPlaceUnit(G, [0, 0, 0, 0, 0, 2, 0], Country.JINN, RegionID.R21);
            G.events.push(ActiveEvents.JiNanZhiFuLiuYu);
        }
    },
    [JinnBaseCardID.J10]: {
        id: JinnBaseCardID.J10,
        name: "猛安谋克",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "使用3行动力征募。若降低1级殖民能力，则可以使用6行动力征募，且无视内政等级限制。不能征募签军。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J11]: {
        id: JinnBaseCardID.J11,
        name: "辽国旧部",
        op: 3,
        country: Country.JINN,
        era: IEra.E,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "金国每控制西京路、北京路、燕京路或东京路中的1个，就可以使用1行动力征募〔不受内政等级限制",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J12]: {
        id: JinnBaseCardID.J12,
        name: "六甲神兵",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个被围困的城市发动进攻，在远程阶段城防的作用改为：攻城方增加等于城防的战斗力，守城方减少等于城防的战斗力。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G.events.push(ActiveEvents.LiuJiaShenBing)
    },
    [JinnBaseCardID.J13]: {
        id: JinnBaseCardID.J13,
        name: "金兵来了",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: true,
        precondition: "【靖康之变】发生后且金国军团与宋国皇帝处在相邻区域",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "禁止拥立。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.events.includes(ActiveEvents.JingKangZhiBian),
        event: (G: SongJinnGame, ctx: Ctx) => G.events.push(ActiveEvents.JinBingLaiLe)
    },
    [JinnBaseCardID.J14]: {
        id: JinnBaseCardID.J14,
        name: "西军内斗",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: false,
        precondition: "吴玠或吴璘未参战，且战斗在陕西六路或川峡四路",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：宋国战斗骰点数减1。",
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J15]: {
        id: JinnBaseCardID.J15,
        name: "河面封冻",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: false,
        precondition: "冬季",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "使用1行动力进军，不受河流边界限制。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.round === 2 || G.round == 6,
        event: (G: SongJinnGame, ctx: Ctx) => G.op = 1
    },
    [JinnBaseCardID.J16]: {
        id: JinnBaseCardID.J16,
        name: "掠夺",
        op: 2,
        country: Country.JINN,
        era: IEra.E,
        remove: false,
        precondition: "夏季或秋季",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "使用1行动力进军，不受补给限制。",
        pre: (G: SongJinnGame, _ctx: Ctx) => [1, 4, 5, 8].includes(G.round),
        event: (G: SongJinnGame, _ctx: Ctx) => G.op = 1
    },
    [JinnBaseCardID.J17]: {
        id: JinnBaseCardID.J17,
        name: "张赵之争",
        op: 4,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: "【任用赵鼎张浚】",
        unlock: "【秦桧独相】【淮西军变】",
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "放置1个在场的宋国将领到预备兵区或者宋国内政等级降低1级。【莫须有】结算时，金国内政等级视为提升1级的状态。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            G.events.push(ActiveEvents.ZhangZhaoZhiZheng);
            G.pending.events.push(PendingEvents.ZhangZhaoZhiZheng);
            ctx.events?.setStage('confirmRespond')
        }
    },
    [JinnBaseCardID.J18]: {
        id: JinnBaseCardID.J18,
        name: "建立大齐",
        op: 4,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "【济南知府刘豫】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "在3个金国控制的路，放置齐控制标志，齐控制的城市视为完成了殖民。金国获得齐军征募许可，齐军在任何结算时都同时视为签军。若金国军事等级不小于5 ,签军获得远程属性。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.JiNanZhiFuLiuYu),
        event: (G: SongJinnGame, ctx: Ctx) => ctx.events?.setStage('jianLiDaQi')
    },
    [JinnBaseCardID.J19]: {
        id: JinnBaseCardID.J19,
        name: "兀朮登场",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除斡离不。在1个金国控制的区域放置兀术。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            removeGeneral(G, SJPlayer.P2, JinnGeneral.WoLiBu);
            moveGeneralToReady(G, SJPlayer.P2, JinnGeneral.WuZhu);

        }
    },
    [JinnBaseCardID.J20]: {
        id: JinnBaseCardID.J20,
        name: "银术可登场",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个金国控制的区域放置银术可。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            moveGeneralToReady(G, SJPlayer.P2, JinnGeneral.YinShuKe);