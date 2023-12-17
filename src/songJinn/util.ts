import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import {
    accumulator,
    ActiveEvents,
    BaseCardID,
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
    MAX_DICES,
    MAX_ROUND,
    MidPlanID,
    MountainPasses,
    MountainPassID,
    NationID,
    Nations,
    NationState,
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
import {getPlanById} from "./constant/plan";
import {getRegionById} from "./constant/regions";
import {activePlayer, shuffle} from "../game/util";
import {logger} from "../game/logger";
import {INVALID_MOVE, Stage} from "boardgame.io/core";
import {getProvinceById} from "./constant/province";
import {getCityById} from "./constant/city";
import {changePlayerStage} from "../game/logFix";


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
    const log = [`getPlaceGeneral|p${pid}${placeToStr(place)}`]
    const generals: General[] = [];
    const pub = pid2pub(G, pid);
    pub.generalPlace.forEach((p, idx) => {
        if (p === place && pub.generals[idx] === GeneralStatus.TROOP) {
            log.push(`|${getGeneralNameByCountry(pid2ctr(pid), idx)}`);
            generals.push(idx as General);
        }
    })
    logger.warn(`${G.matchID}|${log.join('')}`);
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

export const getMarchDst = (G: SongJinnGame, dst: TroopPlace, t: Troop): TroopPlace[] => {
    const adj = getMarchAdj(G, dst);
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

export const getMarchAdj = (G: SongJinnGame, dst: TroopPlace): TroopPlace[] => {
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
    const log = [`getJinnTroopByPlace|${r}`];
    let result = null;
    G.jinn.troops.forEach(t => {
        if (t.p === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.warn(`${G.matchID}|${log.join('')}`);
    return result;
}
// export const getTroopByRegion = (G: SongJinnGame, r: RegionID): Troop | null => {
//     const st = getSongTroopByPlace(G, r);
//     const jt = getJinnTroopByRegion(G, r);
//     return st === null ? jt : st;
// }
export const getTroopByCityCountry = (G: SongJinnGame, r: CityID, ctr: Country): Troop | null => {
    return ctr === Country.JINN ? getJinnTroopByCity(G, r) : getSongTroopByCity(G, r);
}
export const getJinnTroopByCity = (G: SongJinnGame, r: CityID): Troop | null => {
    const log = [`getJinnTroopByCity|${r}`];
    let result = null;
    G.jinn.troops.forEach(t => {
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
        if (t.c === r) {
            log.push(`|ok${JSON.stringify(t)}`);
            result = t;
        }
    });
    logger.warn(`${G.matchID}|${log.join('')}`);
    return result;
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
        return troop === null;
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

export const getOpponentPlaceTroopByCtr = (G: SongJinnGame, ctr: Country, p: TroopPlace) => {
    if (ctr === Country.SONG) {
        return getJinnTroopByPlace(G, p);
    } else {
        return getSongTroopByPlace(G, p);
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

export function songLoseEmperor(G: SongJinnGame) {
    G.song.emperor = null;
    policyDown(G, 1);
    if (G.song.corruption > 0) {
        G.song.corruption--;
    }
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
        pre: (G: SongJinnGame, _ctx: Ctx) => G.policy < 0,
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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
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
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
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
        event: (G: SongJinnGame, _ctx: Ctx) => {
            G.events.push(ActiveEvents.JinTaiZongJiaBeng);
            G.events.splice(G.events.indexOf(ActiveEvents.JinTaiZongJiaBeng), 1);
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
        event: (G: SongJinnGame, _ctx: Ctx) => G
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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            changeMilitary(G, SJPlayer.P2, -1);

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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            ctx.events?.setStage('emperor')
        }
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
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.ZhongBuBing)
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
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
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
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        pre: (G: SongJinnGame, ctx: Ctx) => G.events.includes(ActiveEvents.QuDuanZhiSi),
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
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
        pre: (G: SongJinnGame, ctx: Ctx) => G.song.military >= 6 &&
            G.song.generals[SongGeneral.YueFei] === GeneralStatus.TROOP,
        event: (G: SongJinnGame, ctx: Ctx) => {
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
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
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
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
        }
    },
    [SongBaseCardID.S44]: {
        id: SongBaseCardID.S44,
        name: "吴璘登场",
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
        effectText: "在陕西六路或川峡四路放置吴璘。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
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
        pre: (G: SongJinnGame, ctx: Ctx) => G.song.generals[SongGeneral.YueFei] === GeneralStatus.TROOP,
        event: (G: SongJinnGame, ctx: Ctx) => {
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
        pre: (G: SongJinnGame, ctx: Ctx) => G.song.emperor !== null,
        event: (G: SongJinnGame, ctx: Ctx) => G.song.emperor = CityID.QianTang
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
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => removeGeneral(G, SJPlayer.P2, JinnGeneral.YinShuKe)
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
        pre: (G: SongJinnGame, ctx: Ctx) => G.song.cities.includes(CityID.LuoYang),
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
        pre: (G: SongJinnGame, ctx: Ctx) => G.song.cities.includes(CityID.XiJin),
        event: (G: SongJinnGame, ctx: Ctx) => G.events.push(ActiveEvents.YanJingYiNan)
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
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        pre: (G: SongJinnGame, ctx: Ctx) => !G.song.cities.includes(CityID.KaiFeng),
        event: (G: SongJinnGame, ctx: Ctx) => {
            changeCivil(G, SJPlayer.P2, 1);
            G.events.push(ActiveEvents.JingKangZhiBian);
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
            // ctx.events?.setStage('confirmRespond');
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
        event: (G: SongJinnGame, ctx: Ctx) => G
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
        event: (G: SongJinnGame, _ctx: Ctx) => G
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

        }
    },
    [JinnBaseCardID.J21]: {
        id: JinnBaseCardID.J21,
        name: "秦桧独相",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "【张赵之争】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "宋国每回合开始时腐败值加1。【莫须有】结算时，金国内政等级视为再提升1级的状态。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.ZhangZhaoZhiZheng),
        event: (G: SongJinnGame, ctx: Ctx) => G.events.push(ActiveEvents.QinHuiDuXiang)
    },
    [JinnBaseCardID.J22]: {
        id: JinnBaseCardID.J22,
        name: "重点进攻",
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
        effectText: "移动1个金国军团到所在路内或相邻路内1座没有被围困的金国城市。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J23]: {
        id: JinnBaseCardID.J23,
        name: "三年之约",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "夏季或秋季",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在陕西六路，使用本卡牌的行动力对任意没有宋国将领的军团执行进军。移除娄室。",
        pre: (G: SongJinnGame, _ctx: Ctx) => [1, 4, 5, 8].includes(G.round),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J24]: {
        id: JinnBaseCardID.J24,
        name: "淮西军变",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "【张赵之争】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在准南两路，消灭2个部队。征募2个步兵和1个战船（不受内政等级限制〕。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.ZhangZhaoZhiZheng),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J25]: {
        id: JinnBaseCardID.J25,
        name: "烽火扬州路",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "金国控制杨州地区",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "与另1张牌一起打出，行动点数合并计算。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.jinn.cities.includes(CityID.JiangDu),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J26]: {
        id: JinnBaseCardID.J26,
        name: "搜山检海",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "宋国皇帝被围困",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "宋国失去皇帝。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            songLoseEmperor(G);
        }
    },
    [JinnBaseCardID.J27]: {
        id: JinnBaseCardID.J27,
        name: "孤注一掷",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "齐只控制1个路",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "降低1级殖民能力，在所有齐控制的城市，各放置1个签军和1个拐子马。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.qi.length === 1,
        event: (G: SongJinnGame, _ctx: Ctx) => {
            colonyDown(G, 1);

        }
    },
    [JinnBaseCardID.J28]: {
        id: JinnBaseCardID.J28,
        name: "唃厮啰入侵",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "若吐蕃中立，在川峡四路，放置1个步兵；若吐蕃是金国的盟国，则效果翻倍。",
        pre: (G: SongJinnGame, _ctx: Ctx) => !G.song.nations.includes(NationID.TuBo),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J29]: {
        id: JinnBaseCardID.J29,
        name: "天眷新政",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "【金太宗驾崩】发生后",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "弃掉数是最多等于内政等级的手牌，然后从金国牌库摸取相等数畺的牌。",
        pre: (G: SongJinnGame, _ctx: Ctx) => G.events.includes(ActiveEvents.JinTaiZongJiaBeng),
        event: (G: SongJinnGame, _ctx: Ctx) => G
    },
    [JinnBaseCardID.J30]: {
        id: JinnBaseCardID.J30,
        name: "不见来使",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "禁止宋国对高丽执行外交。若高丽是金国的盟国，则在发展阶段额外提供1发展力。",
        pre: (G: SongJinnGame, _ctx: Ctx) => true,
        event: (G: SongJinnGame, _ctx: Ctx) => G.events.push(ActiveEvents.BuJianLaiShi)
    },
    [JinnBaseCardID.J31]: {
        id: JinnBaseCardID.J31,
        name: "曲端之死",
        op: 3,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "金国控制河东路或陕西六路",
        ban: "【西军曲端】",
        block: "【西军曲端】",
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "在陕西六路，消灭2个部队。",
        pre: (G: SongJinnGame, ctx: Ctx) =>
            G.jinn.provinces.includes(ProvinceID.SHANXILIULU) ||
            G.jinn.provinces.includes(ProvinceID.HEDONGLU),
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J32]: {
        id: JinnBaseCardID.J32,
        name: "火攻",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: false,
        precondition: "兀术在场",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：消灭1个参战的宋国战船。",
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J33]: {
        id: JinnBaseCardID.J33,
        name: "江淮流宼",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个宋国控制的路内，没有宋国军团的区域，放置1个签军和1个战船。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J34]: {
        id: JinnBaseCardID.J34,
        name: "胡服乡兵",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: false,
        precondition: "有签军参战",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：消灭1个参战的宋国步兵或弓兵。",
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J35]: {
        id: JinnBaseCardID.J35,
        name: "李成",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个有签军的军团内，放置2个步兵。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J36]: {
        id: JinnBaseCardID.J36,
        name: "徐州冶铁",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: "内政等级不低于5且控制京东两路",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "铁浮屠征募消耗变为1。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.jinn.civil >= 5 && G.jinn.provinces.includes(ProvinceID.JINGDONGLIANGLU),
        event: (G: SongJinnGame, ctx: Ctx) => G.events.push(ActiveEvents.XuZhouYeTie)
    },
    [JinnBaseCardID.J37]: {
        id: JinnBaseCardID.J37,
        name: "孔彦舟",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个有签军的军团内，放置1个战船。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J38]: {
        id: JinnBaseCardID.J38,
        name: "杀马为粮",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "替换1个金国骑行部队为步兵，这个步兵所在的军团立即进军，不受补给限制。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J39]: {
        id: JinnBaseCardID.J39,
        name: "徽宗病逝",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "若【靖康之变】已经发生，免费和议。若【靖康之变】没有发生，宋国随机弃掉1张手牌",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            if (G.events.includes(ActiveEvents.JingKangZhiBian)) {
                if (getPolicy(G) < 0) {
                    changePlayerStage(G, ctx, 'freeHeYi', SJPlayer.P1);
                }
            } else {
                randomDiscardForSong(G, ctx);
            }
        }
    },
    [JinnBaseCardID.J40]: {
        id: JinnBaseCardID.J40,
        name: "南人归南 北人归北",
        op: 2,
        country: Country.JINN,
        era: IEra.M,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "用此牌发展，提供发展力等于实时殖民能力的2倍",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J41]: {
        id: JinnBaseCardID.J41,
        name: "莫須有",
        op: 4,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: "金国内政等级不低于7",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "降低2级政策倾向，消灭宋国总共4个部队。若此时政策倾向为和议，则移除岳飞。否则，放置岳飞到预备兵区。",
        pre: (G: SongJinnGame, ctx: Ctx) => {
            let limit = 7;
            if (G.events.includes(ActiveEvents.QinHuiDuXiang)) {
                limit--;
            }
            if (G.events.includes(ActiveEvents.ZhangZhaoZhiZheng)) {
                limit--;
            }
            return G.jinn.civil >= limit
        },
        event: (G: SongJinnGame, ctx: Ctx) => {
            policyDown(G, 2);
        }
    },
    [JinnBaseCardID.J42]: {
        id: JinnBaseCardID.J42,
        name: "奔睹登场",
        op: 3,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "在1个金国控制的区域放置奔睹。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            moveGeneralToReady(G, SJPlayer.P2, JinnGeneral.BenZhu);

        }
    },
    [JinnBaseCardID.J43]: {
        id: JinnBaseCardID.J43,
        name: "天眷政变",
        op: 3,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: "金国军事等级不低于5",
        ban: null,
        block: "【完颜昌主和】",
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "提升金国1级军事等级，本回合作战计划替换为【吴山立马】。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.jinn.military >= 5,
        event: (G: SongJinnGame, ctx: Ctx) => {
            changeMilitary(G, SJPlayer.P2, 1);
            G.jinn.plan.forEach(p => G.secret.planDeck.push(p));
            G.secret.planDeck.splice(G.secret.planDeck.indexOf(PlanID.J24), 1);
            G.jinn.plan = [PlanID.J24]
        }
    },
    [JinnBaseCardID.J44]: {
        id: JinnBaseCardID.J44,
        name: "十二道金牌",
        op: 3,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: "政策倾向为和议",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "使用该卡牌的行动点数，对宋国军团执行进军，不能触发战斗，不能移动到缺乏补给的区域。",
        pre: (G: SongJinnGame, ctx: Ctx) => G.policy < 0,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },
    [JinnBaseCardID.J45]: {
        id: JinnBaseCardID.J45,
        name: "败盟南下",
        op: 3,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "降低1级政策倾向，使用这张牌的行动力执行征募和进军。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            policyDown(G, 1);
            G.op = 3;
        }
    },
    [JinnBaseCardID.J46]: {
        id: JinnBaseCardID.J46,
        name: "解除兵权",
        op: 2,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: "政策倾向为和议",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.CONTINUOUS,
        combat: false,
        effectText: "若宋国皇帝在场，则将韩世忠移动到皇帝所在区域，韩世忠之后只能随宋国皇帝移动。否则，移除韩世忠。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            if (G.song.emperor !== null) {
                moveGeneralByPid(G, SJPlayer.P1, SongGeneral.HanShiZhong, G.song.emperor);
            }
        }
    },
    [JinnBaseCardID.J47]: {
        id: JinnBaseCardID.J47,
        name: "臣构言",
        op: 2,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "若政策倾向为和议，提升1级殖民能力。若政策倾向为主战或中立，降低1级政策倾向。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => {
            if (G.policy < 0) {
                colonyUp(G, 1);
            } else {
                policyDown(G, 1);
            }
        }
    },
    [JinnBaseCardID.J48]: {
        id: JinnBaseCardID.J48,
        name: "吴玠病逝",
        op: 2,
        country: Country.JINN,
        era: IEra.L,
        remove: true,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "移除吴玠",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => removeGeneral(G, SJPlayer.P1, SongGeneral.WuJie)
    },
    [JinnBaseCardID.J49]: {
        id: JinnBaseCardID.J49,
        name: "钱眼将军张俊",
        op: 2,
        country: Country.JINN,
        era: IEra.L,
        remove: false,
        precondition: null,
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: false,
        effectText: "宋国腐败值加1。",
        pre: (G: SongJinnGame, ctx: Ctx) => true,
        event: (G: SongJinnGame, ctx: Ctx) => G.song.corruption++
    },
    [JinnBaseCardID.J50]: {
        id: JinnBaseCardID.J50,
        name: "疑兵",
        op: 2,
        country: Country.JINN,
        era: IEra.L,
        remove: false,
        precondition: "奔睹在场，且金国守城",
        ban: null,
        block: null,
        unlock: null,
        duration: EventDuration.INSTANT,
        combat: true,
        effectText: "战斗牌：先于任何战斗卡结算，宋国军团立即撤退，全部战斗结算结束。",
        pre: (G: SongJinnGame, ctx: Ctx) => false,
        event: (G: SongJinnGame, ctx: Ctx) => G
    },

};
const cardIdSort = (a: SJEventCardID, b: SJEventCardID) => {
    return sjCardById(a).op - sjCardById(b).op;
}


export const cardToSearch = (G: SongJinnGame, ctx: Ctx, pid: PlayerID): SJEventCardID[] => {

    const isSong = pid as SJPlayer === SJPlayer.P1;
    let totalDeck: SJEventCardID[] = isSong ? SongEarlyCardID : JinnEarlyCardID;
    if (G.turn > 2) {
        const mid = isSong ? [...SongMidCardID] : [...JinnMidCardID];
        totalDeck = [...totalDeck, ...mid];
    }
    if (G.turn > 6) {
        const late = isSong ? [...SongLateCardID] : [...JinnLateCardID];
        totalDeck = [...totalDeck, ...late];
    }
    const discard = isSong ? G.song.discard : G.jinn.discard;
    const remove = isSong ? G.song.remove : G.jinn.remove;
    const hand = isSong ? G.player[SJPlayer.P1].hand : G.player[SJPlayer.P2].hand;
    return totalDeck.filter(c => !(hand.includes(c) || discard.includes(c) || remove.includes(c)))
}
export const getCountryById = (pid: PlayerID) => {
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            return Country.SONG;
        case SJPlayer.P2:
            return Country.JINN;
    }
}
export const troopToString = (G: SongJinnGame, pid: PlayerID, t: Troop) => {
    return t.g + placeToStr(t.p) + unitsToString(t.u) + getPlaceGeneral(G, pid, t.p);
}
export const getGeneralNameByPid = (pid: PlayerID, general: General) => {
    if (pid === SJPlayer.P1) {
        return GeneralNames[0][general];
    } else {
        return GeneralNames[1][general];
    }
}
export const getGeneralNameByCountry = (country: Country, general: General) => {
    const name = country === Country.SONG ? GeneralNames[0][general] : GeneralNames[1][general];
    logger.warn(`getGeneralNameByCountry|${country}|${general}|${name}`);
    return name;
}
export const getPlaceCountryGeneralNames = (G: SongJinnGame, country: Country, place: TroopPlace) => {
    const pid = ctr2pid(country);
    const readyGenerals = getPlaceGeneral(G, pid, place);
    if (pid === SJPlayer.P1) {
        return readyGenerals.map(g => GeneralNames[0][g]);
    } else {
        return readyGenerals.map(g => GeneralNames[1][g]);
    }
}
export const getPlaceGeneralNames = (G: SongJinnGame, pid: PlayerID, place: TroopPlace) => {
    const readyGenerals = getPlaceGeneral(G, pid, place);
    if (pid === SJPlayer.P1) {
        return readyGenerals.map(g => GeneralNames[0][g]);
    } else {
        return readyGenerals.map(g => GeneralNames[1][g]);
    }
}
export const getReadyGeneralNames = (G: SongJinnGame, pid: PlayerID) => {
    const readyGenerals = getReadyGenerals(G, pid);
    if (pid === SJPlayer.P1) {
        return readyGenerals.map(g => GeneralNames[0][g]);
    } else {
        return readyGenerals.map(g => GeneralNames[1][g]);
    }
}
export const placeToStr = (p: TroopPlace) => {
    return typeof p === "number" && !isNaN(p) ? getRegionById(p).name : p;
}
export const sjPlayerName = (l: PlayerID): string => {
    return l === SJPlayer.P1 ? "宋" : "金";
}
export const addGeneralTo = (G: SongJinnGame, pid: PlayerID, general: General, dst: TroopPlace) => {
    const pub = pid2pub(G, pid);
    pub.generals[general] = GeneralStatus.TROOP;
    pub.generalPlace[general] = dst;
}
export const moveGeneralToReady = (G: SongJinnGame, pid: PlayerID, general: General) => {
    const pub = pid2pub(G, pid);
    pub.generals[general] = GeneralStatus.READY;
    pub.generalPlace[general] = RegionID.R01;
}
export const moveGeneralByPid = (G: SongJinnGame, pid: PlayerID, general: General, dst: TroopPlace) => {
    const pub = pid2pub(G, pid);
    pub.generalPlace[general] = dst;
    pub.generals[general] = GeneralStatus.TROOP;
}
export const generalToReadyByPid = (G: SongJinnGame, pid: PlayerID, general: General) => {
    const pub = pid2pub(G, pid);
    pub.generals[general] = GeneralStatus.READY;
}
export const generalToReadyByCountry = (G: SongJinnGame, ctr: Country, general: General) => {
    const pub = ctr2pub(G, ctr);
    pub.generals[general] = GeneralStatus.READY;
}
export const moveGeneralByCountry = (G: SongJinnGame, ctr: Country, general: General, dst: TroopPlace) => {
    const pub = ctr2pub(G, ctr);
    pub.generalPlace[general] = dst;
}
export const removeGeneral = (G: SongJinnGame, pid: PlayerID, general: General) => {
    const country = getCountryById(pid);
    switch (country) {
        case Country.SONG:
            G.song.generals[general] = GeneralStatus.REMOVED;
            G.song.generalPlace[general] = RegionID.R01;
            if (general === SongGeneral.YueFei) {
                if (G.events.includes(ActiveEvents.YueShuaiZhiLai)) {
                    G.events.splice(G.events.indexOf(ActiveEvents.YueShuaiZhiLai), 1);
                }
            }
            break;
        case Country.JINN:
            G.jinn.generals[general] = GeneralStatus.REMOVED;
            G.jinn.generalPlace[general] = RegionID.R01;
            break;
    }
}

export const doLoseCity = (G: SongJinnGame, pid: PlayerID, cityID: CityID, opponent: boolean) => {
    const log = [`doLostCity|p${pid}lose${cityID}`];
    const ctr = getCountryById(pid);
    const pub = pid2pub(G, pid);
    const oppo = oppoPub(G, pid);
    if (pub.cities.includes(cityID)) {
        pub.cities.splice(pub.cities.indexOf(cityID), 1);
        if (ctr === Country.SONG && G.song.emperor === cityID) {
            log.push(`|song|emperor`);
            songLoseEmperor(G);
        }
        if (ctr === Country.JINN && G.jinn.emperor === cityID) {
            log.push(`|jinn|emperor`);
            G.jinn.emperor = null;
        }
        const city = getCityById(cityID);
        if (city.capital) {
            log.push(`|loseProvince`);
            doLoseProvince(G, pid, city.province, false);
        }
        if (opponent) {
            oppo.cities.push(cityID)
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const nationMoveJinn = (G: SongJinnGame, c: NationID) => {
    if (G.song.nations.includes(c)) {
        G.song.nations.splice(G.song.nations.indexOf(c), 1);
    } else {
        if (!G.jinn.nations.includes(c)) {
            G.jinn.nations.push(c)
        }
    }
}
export const nationMoveSong = (G: SongJinnGame, c: NationID) => {
    if (G.jinn.nations.includes(c)) {
        G.jinn.nations.splice(G.jinn.nations.indexOf(c), 1);
    } else {
        if (!G.song.nations.includes(c)) {
            G.song.nations.push(c)
        }
    }
}
export const changeDiplomacyByLOD = (G: SongJinnGame) => {
    const log = [`changeDiplomacyByLOD`]
    const song = playerById(G, SJPlayer.P1);
    const jinn = playerById(G, SJPlayer.P2);
    if (song.lod.length === 0) {
        if (jinn.lod.length === 0) {
            log.push(`|noLOD|`)
        } else {
            log.push('|moveForJinn');
            jinn.lod.forEach(l => nationMoveJinn(G, l.nation))
        }
    } else {
        if (jinn.lod.length === 0) {
            log.push('|moveForSong');

            song.lod.forEach(l => nationMoveJinn(G, l.nation))
        } else {
            Nations.forEach(n => {
                let songPoint = 0;
                let jinnPoint = 0;
                song.lod.forEach(l => {
                    if (l.nation === n) {
                        songPoint += sjCardById(l.card).op;
                    }
                })
                jinn.lod.forEach(l => {
                    if (l.nation === n) {
                        jinnPoint += sjCardById(l.card).op;
                    }
                })
                if (songPoint > jinnPoint) {
                    nationMoveSong(G, n);

                } else {
                    if (jinnPoint > songPoint) {
                        nationMoveJinn(G, n);
                    }
                }
            })
        }
    }
    // jinn.lod.forEach(l => G.jinn.discard.push(l.card));
    // song.lod.forEach(l => G.song.discard.push(l.card));
    // jinn.lod = [];
    // song.lod = [];
    G.song.troops.forEach(t => {
        if (isNationID((t.p))) {
            log.push(`|song|${t.p}|hasTroop`);
            nationMoveJinn(G, t.p);
        }
    });
    G.jinn.troops.forEach(t => {
        if (isNationID((t.p))) {
            log.push(`|jinn|${t.p}|hasTroop`);
            nationMoveSong(G, t.p);
        }
    });
    logger.debug(`${G.matchID}|${log.join('')}`);
}


export const removeReadyUnitByCountry = (G: SongJinnGame, units: number[], country: Country) => {
    const log = [`removeUnitByPlace|${unitsToString(units)}`];
    const pub = ctr2pub(G, country);
    let actualUnits = [...units];
    if (country === Country.SONG) {
        actualUnits = actualUnits.slice(0, 6);
    }
    log.push(`|${pub.ready}pub.ready`);
    log.push(`|${pub.standby}standby`);
    for (let i = 0; i < actualUnits.length; i++) {
        if (actualUnits[i] > pub.ready[i]) {
            actualUnits[i] = pub.ready[i];
            pub.standby[i] += pub.ready[i];
            pub.ready[i] = 0;
        } else {
            pub.ready[i] -= actualUnits[i];
            pub.standby[i] += actualUnits[i];
        }
    }
    log.push(`|${pub.ready}pub.ready`);
    log.push(`|${pub.standby}standby`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const removeUnitByCountryPlace = (G: SongJinnGame, units: number[], country: Country, place: TroopPlace) => {
    const log = [`removeUnitByPlace|${place}|${placeToStr(place)}|${unitsToString(units)}`];
    const pub = ctr2pub(G, country);
    const filtered = pub.troops.filter(t => t.p === place);
    const pid = ctr2pid(country);
    log.push(`|filtered${JSON.stringify(filtered)}`);
    if (filtered.length > 0) {
        log.push(`|hasTroop`);
        const idx = pub.troops.indexOf(filtered[0]);
        log.push(`|${idx}idx`);
        if (filtered.length > 1) {
            log.push(`|moreThanOne`);
            removeUnitByIdx(G, units, pid, idx);
        } else {
            log.push(`|onlyOne`);
            removeUnitByIdx(G, units, pid, idx);
        }
    } else {
        log.push(`noTroop`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return null;
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const removeUnitByPlace = (G: SongJinnGame, units: number[], pid: PlayerID, place: TroopPlace) => {
    const log = [`removeUnitByPlace|${placeToStr(place)}|${unitsToString(units)}`]
    const pub = pid2pub(G, pid);
    const filtered = pub.troops.filter(t => t.p === place);
    log.push(`|filtered${(filtered)}`);
    if (filtered.length > 0) {
        log.push(`|hasTroop`);
        if (filtered.length > 1) {
            log.push(`|moreThanOne`);
            // mergeTroopTo(G,
            //     pub.troops.indexOf(filtered[1]),
            //     pub.troops.indexOf(filtered[0]),
            //     pid);
            removeUnitByIdx(G, units, pid, pub.troops.indexOf(filtered[0]));
        } else {
            removeUnitByIdx(G, units, pid, pub.troops.indexOf(filtered[0]));

        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    } else {
        log.push(`noTroop`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return null;
    }
}
export const removeUnitByIdx = (G: SongJinnGame, units: number[], pid: PlayerID, idx: number) => {
    const log = [`removeUnitByIdx|${units}|${pid}|${idx}|${unitsToString(units)}`]

    const pub = pid2pub(G, pid);
    const t = pub.troops[idx];
    log.push(`|troop|${JSON.stringify(t)}`);
    if (t === undefined) {
        return null;
    }
    let actualUnits = [...units];
    log.push(`|before|standby${pub.standby}|units${t.u}`);
    if (t.g === Country.SONG) {
        if (units.length > 6) {
            actualUnits = actualUnits.slice(0, 6);
            log.push(`|${actualUnits}actualUnits`);
        }
    }
    for (let i = 0; i < actualUnits.length; i++) {
        if (units[i] > t.u[i]) {
            log.push(`|insufficient`);
            pub.standby[i] += t.u[i];
            t.u[i] = 0;
        } else {
            pub.standby[i] += units[i]
            t.u[i] -= units[i]
        }
    }
    log.push(`|after|standby${pub.standby}|units${t.u}`);
    if (troopEmpty(t)) {
        pub.troops.splice(pub.troops.indexOf(t), 1);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const canRecruitNoCivilLimit = (G: SongJinnGame, units: number[], pid: PlayerID): boolean => {
    const log = [`canRecruitNoCivilLimit${unitsToString(units)}${pid2ctr(pid)}`];
    let perm: boolean[];
    if (pid === SJPlayer.P1) {
        perm = INITIAL_RECRUIT_PERMISSION[0]
    } else {
        perm = INITIAL_RECRUIT_PERMISSION[1];
        if (G.events.includes(ActiveEvents.JianLiDaQi)) {
            log.push(`|daQi`);
            perm[6] = true;
        }
    }
    for (let i = 0; i < units.length; i++) {
        if (!perm[i] && units[i] > 0) {
            log.push(`|cannot|${i}`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return false;
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return true;
}

export const canRecruit = (G: SongJinnGame, units: number[], pid: PlayerID): number => {
    const log = [`canRecruitCost${unitsToString(units)}${pid2ctr(pid)}`];
    let cost = 0;
    let unitCost = [1, 1, 0, 2, 0, 0]
    if (pid === SJPlayer.P1) {

    } else {
        unitCost = [1, 2, 2, 0, 0, 1, 1]
    }

    for (let i = 0; i < units.length; i++) {
        cost += units[i] * unitCost[i];
    }
    return cost;
}

export const getRecruitCost = (G: SongJinnGame, units: number[], pid: PlayerID): number => {
    const log = [`getRecruitCost${unitsToString(units)}${pid2ctr(pid)}`];
    let cost = 0;
    let unitCost = [1, 1, 0, 2, 0, 0]
    if (pid === SJPlayer.P1) {

    } else {
        unitCost = [1, 2, 2, 0, 0, 1, 1]
    }

    for (let i = 0; i < units.length; i++) {
        cost += units[i] * unitCost[i];
    }
    return cost;
}

export const checkRecruitCivil = (G: SongJinnGame, units: number[], pid: PlayerID) => {
    const log = [`checkRecruitCivil${unitsToString(units)}|p${pid}`];
    const pub = pid2pub(G, pid);
    const readySum = pub.ready.reduce(accumulator);
    const recruitSum = units.reduce(accumulator);
    return readySum + recruitSum <= pub.civil;
}

export const doRecruit = (G: SongJinnGame, units: number[], pid: PlayerID) => {
    const log = [`doRecruit${unitsToString(units)}|p${pid}`];
    const actualUnits = [...units];
    const pub = pid2pub(G, pid);

    log.push(`|${pub.ready}pub.ready`);
    log.push(`|${pub.standby}pub.standby`);
    for (let i = 0; i < units.length; i++) {
        if (pub.standby[i] > units[i]) {
            actualUnits[i] = units[i]
            pub.standby[i] -= units[i];
        } else {
            actualUnits[i] = pub.standby[i];
            pub.standby[i] = 0;
        }
        pub.ready[i] += actualUnits[i];
    }
    log.push(`|${actualUnits}actualUnits`);
    log.push(`|${pub.ready}pub.ready`);
    log.push(`|${pub.standby}pub.standby`);
    const ctr = pid2ctr(pid);

    const unitsCost: number[] = getCtrRecruitCost(G, ctr);
    log.push(`|${unitsCost}unitsCost`);
    let cost = 0;
    for (let i = 0; i < units.length; i++) {
        cost += unitsCost[i] * actualUnits[i];
    }
    log.push(`|${G.op}G.op`);
    G.op -= cost;
    log.push(`|${G.op}G.op`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}


export const getCtrRecruitCost = (G: SongJinnGame, ctr: Country) => {
    let cost: number[] = [0, 0, 0, 0, 0, 0];
    if (ctr === Country.SONG) {
        cost = INITIAL_RECRUIT_COST[0];
        if (G.events.includes(ActiveEvents.ShenBiGong)) {
            cost[1] = 2;
        }
    } else {
        cost = INITIAL_RECRUIT_COST[1];
    }
    return cost;
}

export const mergeTroopTo = (G: SongJinnGame, src: number, dst: number, pid: PlayerID) => {
    const log = [`mergeTroop|${src}to${dst}`];
    const pub = pid2pub(G, pid);
    let a = pub.troops[src];
    log.push(`|${JSON.stringify(a)}`);
    let b = pub.troops[dst];
    log.push(`|${JSON.stringify(b)}`);
    if (a === undefined || b === undefined) {
        log.push(`cannot merge`);
    } else {
        for (let i = 0; i < b.u.length; i++) {
            b.u[i] += a.u[i];
        }
        pub.troops.splice(pub.troops.indexOf(a), 1);
        log.push(`|after|${JSON.stringify(b)}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const addTroop = (G: SongJinnGame, dst: RegionID, units: number[], country: Country) => {
    const actualUnits = [...units];
    switch (country) {
        case Country.SONG:
            const st = getSongTroopByPlace(G, dst);
            for (let i = 0; i < units.length; i++) {
                if (G.song.standby[i] > units[i]) {
                    actualUnits[i] = units[i]
                    G.song.standby[i] -= units[i];
                } else {
                    actualUnits[i] = G.song.standby[i];
                    G.song.standby[i] = 0;
                }
            }
            if (st === null) {
                G.song.troops.push({
                    p: dst,
                    c: getRegionById(dst).city,
                    g: Country.SONG,
                    u: actualUnits,
                })
            } else {
                for (let i = 0; i < units.length; i++) {
                    st.u[i] += actualUnits[i];
                }
            }
            break;
        case Country.JINN:
            const jt = getJinnTroopByRegion(G, dst);
            for (let i = 0; i < units.length; i++) {
                if (G.jinn.standby[i] > units[i]) {
                    actualUnits[i] = units[i]
                    G.jinn.standby[i] -= units[i];
                } else {
                    actualUnits[i] = G.jinn.standby[i];
                    G.jinn.standby[i] = 0;
                }
            }
            if (jt === null) {
                G.jinn.troops.push({
                    p: dst,
                    c: getRegionById(dst).city,
                    g: Country.JINN,
                    u: actualUnits,
                })
            } else {
                for (let i = 0; i < units.length; i++) {
                    jt.u[i] += actualUnits[i];
                }
            }
            break;
        default:
            return null;
    }
}

export const colonyUp = (G: SongJinnGame, a: number) => {
    if (G.colony + a > 4) {
        G.colony = 4;
    } else {
        G.colony += a;
    }
}
export const policyUp = (G: SongJinnGame, a: number) => {
    if (G.policy + a > 3) {
        G.policy = 3;
    } else {
        G.policy += a;
    }
}
export const colonyDown = (G: SongJinnGame, a: number) => {
    if (G.colony - a < 0) {
        G.colony = 0;
    } else {
        G.colony -= a;
    }
}
export const policyDown = (G: SongJinnGame, a: number) => {
    if (G.policy - a < -3) {
        G.policy = -3;
    } else {
        G.policy -= a;
    }
}
export const heYiChange = (G: SongJinnGame, c: CityID) => {
    const log = [``];
    const songTroop: Troop | null = getSongTroopByCity(G, c);
    if (songTroop !== null) {
        for (let i = 0; i < songTroop.u.length; i++) {
            G.song.ready[i] += songTroop.u[i];
        }
        if (G.song.troops.includes(songTroop)) {
            log.push(`|removed`);
            G.song.troops.splice(G.song.troops.indexOf(songTroop), 1);
        } else {
            log.push(`|no|troop`);
        }
    }
    const city = getCityById(c);
    log.push(`|policy|from${G.policy}`);
    policyUp(G, city.colonizeLevel);
    log.push(`|to|${G.policy}`);
    let control = true;
    const availableQianJun = G.jinn.standby[5];
    if (availableQianJun === 0) {
        if (G.events.includes(ActiveEvents.JianLiDaQi)) {
            log.push(`|useQi`);
            if (G.jinn.standby[6] > 1) {
                log.push(`|only|one`);
                G.jinn.troops.push({
                    p: city.region,
                    c: c,
                    u: [0, 0, 0, 0, 0, 0, 2],
                    g: Country.JINN
                });
            } else {
                if (G.jinn.standby[6] > 0) {
                    log.push(`|two`);
                    G.jinn.troops.push({
                        p: city.region,
                        c: c,
                        u: [0, 0, 0, 0, 0, 0, 1],
                        g: Country.JINN
                    });
                } else {
                    control = false;
                    log.push(`|noQi`);
                }
            }
        } else {
            log.push(`|noDaQiYet`);
            control = false;
        }
    } else {
        log.push(`|useQian`);
        if (availableQianJun === 1) {
            G.jinn.troops.push({
                p: city.region,
                c: c,
                u: [0, 0, 0, 0, 0, 1, 0],
                g: Country.JINN
            });
        } else {
            G.jinn.troops.push({
                p: city.region,
                c: c,
                u: [0, 0, 0, 0, 0, 2, 0],
                g: Country.JINN
            });
        }
    }
    doLoseCity(G, SJPlayer.P1, c, control);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

interface ITakeDamageArgs {
    c: Country,
    src: TroopPlace,
    standby: number[],
    ready: number[]
}

export const getSeasonText = (r: number) => {
    if (r === 1 || r === 5) return '秋季';
    if (r === 2 || r === 6) return '冬季';
    if (r === 3 || r === 7) return '春季';
    if (r === 4 || r === 8) return '夏季';
}

const takeDamageText = (arg: ITakeDamageArgs) => {
    let text = `${placeToStr(arg.src)}${arg.c}`;
    const standby = arg.standby.filter(u => u > 0).length > 0;
    if (standby) {
        text += `死${unitsToString(arg.standby)}`;
    }
    const ready = arg.ready.filter(u => u > 0).length > 0;
    if (ready) {
        text += `溃${unitsToString(arg.ready)}`;
    }
    if ((!standby) && (!ready)) {
        text += '未受创';
    }
    return text;
}

export const rollDiceByPid = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, count: number) => {
    const log = [`rollDiceByPid|${pid}|${count}`];
    const country = getCountryById(pid);
    const dices = ctx.random?.D6(count);
    log.push(`|${dices}`);
    if (dices === undefined) {
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (country === Country.SONG) {
        G.song.dices.push(dices);
        G.combat.jinn.damageLeft = countDice(G, Country.SONG);
    } else {
        G.jinn.dices.push(dices);
        G.combat.song.damageLeft = countDice(G, Country.JINN);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}


export const getRegionText = (r: RegionID) => {
    const region = getRegionById(r);
    const province = getProvinceById(region.province);
    const city = region.city;
    return `${region.name}${city === null ? "" :
        (province.capital.includes(city) ? "|*" + city : "|" + city)}|${region.terrain}`;
}

export const getCityText = (cid: CityID) => {
    const city = getCityById(cid);
    const region = getRegionById(city.region);
    return `${city.capital ? "*" : ""}${city.name}${city.colonizeLevel} |${region.name} |${city.province}`;
}

export const getUnitNamesByCtr = (ctr: Country) => {
    return ctr === Country.SONG ? UNIT_SHORTHAND[0] : UNIT_SHORTHAND[1];
}

export const getLogText = (G: SongJinnGame, l: LogEntry): string => {
    const payload = l.action.payload;
    const pid = payload.playerID;
    const s = sjPlayerName(pid);
    switch (l.action.type) {
        case "MAKE_MOVE":
            let log = s;
            try {
                const name = payload.type;
                const args = payload.args !== undefined ? payload.args : "";
                const pub = pid2pub(G, pid);
                if (args === null || args.length === 0) {
                    switch (name) {
                        case 'drawExtraCard':
                            log += `额外摸一张牌`;
                            break;
                        case 'search':
                            log += `检索了一张牌`;
                            break;
                        case 'choosePlan':
                            log += '选择了一张作战计划';
                            break;
                        case 'emptyRound':
                            log += `空过`;
                            break;
                        case 'endRound':
                            log += `结束行动`;
                            break;
                        case 'opponentMove':
                            log += `让对方操作`;
                            break;
                        default:
                            log += `${name}|${JSON.stringify(args)}`;
                    }
                } else {
                    const arg = args[0];
                    switch (name) {
                        case 'returnToHand':
                            log += `拿回发展牌${sjCardById(arg).name}`;
                            break;
                        case 'deployGeneral':
                            log += `派遣${getGeneralNameByCountry(pid2ctr(pid), arg.general)}到${placeToStr(arg.dst)}`;
                            break;
                        case 'freeHeYi':
                            log += `免费和议 割让${arg}`;
                            break;
                        case 'moveGeneral':
                            log += `移动${getGeneralNameByCountry(pid2ctr(pid), arg.general)}到${placeToStr(arg.dst)}`;
                            break;

                        case 'rescueGeneral':
                            log += `弃发展牌${sjCardById(arg.card).name}救援${getGeneralNameByPid(pid, arg.general)}`;
                            break;

                        case 'removeReadyUnit':
                            if (arg.country === Country.SONG) {
                                log += `消灭${arg.country}预备区${unitsToString(arg.units.slice(0, 6))}`;
                            } else {
                                log += `消灭${arg.country}预备区${unitsToString(arg.units)}`;
                            }
                            break;

                        case 'removeUnit':
                            if (arg.country === Country.SONG) {
                                log += `消灭${arg.country}${placeToStr(arg.src)}${unitsToString(arg.units.slice(0, 6))}`;
                            } else {
                                log += `消灭${arg.country}${placeToStr(arg.src)}${unitsToString(arg.units)}`;
                            }
                            break;
                        case 'placeUnit':
                            log += `在${placeToStr(arg.place)}放置${unitsToString(arg.units)}`;
                            break;
                        case 'deploy':
                            log += `在${placeToStr(arg.city)}补充${unitsToString(arg.units)}`;
                            break;
                        case 'showLetters':
                            log += `盟国${arg.nations.map((n: NationID) => n)}`
                            if (arg.letters.length > 0) {
                                log += `国书${arg.letters.map(
                                    (l: LetterOfCredence) => `${l.nation}${sjCardById(l.card).op}${sjCardById(l.card).name}`
                                )}`;
                            } else {
                                log += '无国书';
                            }
                            break;
                        case 'placeUnits':
                            log += `在${placeToStr(arg.dst)}放置${unitsToString(arg.units)}`;
                            break;
                        case 'opponentMove':
                            log = `让对方操作`;
                            break;
                        case 'takeDamage':
                            log += takeDamageText(arg);
                            break;
                        case 'march':
                            log += `${placeToStr(arg.src)}${arg.generals.map((gen: General) => getGeneralNameByCountry(arg.country, gen))}${unitsToString(arg.units)}进军${placeToStr(arg.dst)}`;
                            break;
                        case 'placeTroop':
                            log += `在${placeToStr(arg.dst)}放置${unitsToString(arg.units)}`;
                            break;
                        case 'moveTroop':
                            log += `${placeToStr(arg.src.p)}${arg.country}全军移动到${placeToStr(arg.dst)}`;
                            break;
                        case 'rollDices':
                            log += `扔了${arg === undefined ? 5 : arg.count > MAX_DICES ? MAX_DICES : arg.count}个骰子`;
                            log += `${pub.dices[arg.idx]}`;
                            break;
                        case 'chooseFirst':
                            log +=
                                `选择${sjPlayerName(arg.choice)}先行动`;
                            break;
                        case 'showCC':
                            log += arg.length === 0 ? "不使用战斗牌" :
                                `使用战斗牌${arg.map((p: SJEventCardID) => sjCardById(p).name)}`;
                            break;
                        case 'combatCard':
                            log += "选择战斗牌";
                            break;
                        case 'confirmRespond':
                            log += arg.text;
                            break;
                        case 'generalSkill':
                            log +=
                                `横置${arg.general}${getGeneralNameByCountry(arg.country, arg.general)}`
                            break;

                        case 'takePlan':
                            if (arg.length === 0) {
                                log += `没有拿走计划`;
                            } else {
                                log += `拿走了${arg.map((p: PlanID) => getPlanById(p).name)}`;
                            }
                            break;
                        case 'chooseTop':
                            log +=
                                `把${getPlanById(arg).name}放在最上面`
                            ;
                            break;
                        case 'jianLiDaQi':
                            log += `建立大齐 齐控制${arg.join(',')}`;
                            break;
                        case 'showPlan':
                            log += `展示${arg.map((p: PlanID) => getPlanById(p).name)}`;
                            break;
                        case 'loseProvince':
                            log += `丢失了${arg.province}${arg.opponent ? "对手占领" : ""}`;
                            break;
                        case 'checkProvince':
                            log += `在${arg.prov}结算路权 ${arg.text}`;
                            break;
                        case 'removeNation':
                            log += `移除了${arg}`;
                            break;
                        case 'adjustNation':
                            log += `调整了${arg}的外交状态 ${G.song.nations} 盟宋${G.jinn.nations}盟金`;

                            break;
                        case 'controlProvince':
                            log += `控制了${arg}`;
                            break;
                        case 'controlCity':
                            log += `控制${arg}`
                            break;
                        case 'loseCity':
                            log += `丢失${arg.cityID}${arg.opponent ? "对手占领" : ""}`;
                            break;
                        case 'removeGeneral':
                            log += `${getGeneralNameByPid(pid, arg)}`;
                            break;
                        case 'siege':
                            log += `让${arg.ctr}在${placeToStr(arg.src)}攻城`;
                            break;
                        case 'breakout':
                            log += `让${arg.ctr}在${placeToStr(arg.src)}突围`;
                            break;
                        case 'discard':
                            log += `弃牌${sjCardById(arg).name}`;
                            break;
                        case 'search':
                            log += `检索了一张牌`;
                            break;
                        case 'op':
                            log +=
                                `打出${sjCardById(arg).name}|${sjCardById(arg).op}`
                            ;
                            break;
                        case 'cardEvent':
                            log += `事件${sjCardById(arg).name}`;
                            break;
                        case 'developCard':
                            log += `发展${sjCardById(arg).name}`;
                            break;
                        case 'down':
                            log += `降低${arg}`;
                            break;
                        case 'develop':
                            if (typeof arg === 'string') {
                                log += `${
                                    arg !== DevelopChoice.EMPEROR
                                    && arg !== DevelopChoice.POLICY_UP
                                    && arg !== DevelopChoice.POLICY_DOWN
                                        ? "提升" : ""}${arg}`;
                            } else {
                                const {choice, target} = arg;
                                log += `${
                                    choice !== DevelopChoice.EMPEROR
                                    && choice !== DevelopChoice.POLICY_UP
                                    && choice !== DevelopChoice.POLICY_DOWN
                                        ? "提升" : ""}${choice}到${target}`;
                            }
                            break;
                        case 'recruitUnit':
                            if (pid === SJPlayer.P1) {
                                log += `征募${unitsToString(arg.slice(0, 6))}`;
                            } else {
                                log += `征募${unitsToString(arg)}`;
                            }
                            break;
                        case 'recruitPuppet':
                            log +=
                                `在${getCityById(arg).name}征募签军`
                            ;
                            break;
                        case 'emperor':
                            log +=
                                `在${getCityById(arg).name}拥立`
                            ;
                            break;
                        case 'letter':
                            log +=
                                `向${arg.nation}递交了国书`
                            ;
                            break;
                        case 'heYi':
                            log +=
                                `用${sjCardById(arg.card).name}和议 割让${arg.city}`
                            ;
                            break;
                        case 'tieJun':
                            log +=
                                `用${sjCardById(arg).name}贴军`
                            ;
                            break;
                        case 'paiQian':
                            log +=
                                `用${sjCardById(arg).name}派遣`
                            ;
                            break;
                        case 'choosePlan':
                            log += '选择了一张作战计划';
                            break;
                        case 'endRound':
                            log +=
                                `结束第${arg}行动轮`
                            ;
                            break;
                        default:
                            log +=
                                `|${JSON.stringify(name)}|${JSON.stringify(arg)}`

                    }
                }
            } catch (e) {
                log +=
                    `|${JSON.stringify(l)}|${e.toString()}|${JSON.stringify(e.stackTrace)}`

            }
            return log;
        case "GAME_EVENT":
            if (payload.type === 'endPhase') {
                return `${phaseName(l.phase)}结束`;

            } else {
                return "";
            }
        case "UNDO":
            return s + "撤销";
        case "REDO":
            return s + "恢复";
        default:
            return "";
    }
}
export const developInstead = (G: SongJinnGame, pid: PlayerID, cid: SJEventCardID) => {
    const pub = pid2pub(G, pid)
    pub.develop.push(cid);
    if (pub.discard.includes(cid)) {
        pub.discard.splice(pub.discard.indexOf(cid), 1);
    }
}
export const drawPlanForPlayer = (G: SongJinnGame, pid: PlayerID) => {
    const p = playerById(G, pid);
    const military = pid2pub(G, pid).military;
    for (let i = 0; i < military; i++) {
        const newPlan = G.secret.planDeck.pop();
        if (newPlan !== undefined) {
            p.plans.push(newPlan);
        } else {

        }
    }
}
export const randomDiscardForSong = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`randomDiscardForSong`];
    const songHand = G.player[SJPlayer.P1].hand;
    log.push(`|${songHand}songHand`);
    if (songHand.length > 0) {
        const randomCard = shuffle(ctx, songHand).pop();
        log.push(`|${randomCard}randomCard`);
        log.push(`|${G.song.discard}discard`);
        if (songHand.includes(randomCard)) {
            songHand.splice(songHand.indexOf(randomCard), 1);
            G.song.discard.push(randomCard);
            log.push(`|${songHand}songHand`);
            log.push(`|${G.song.discard}discard`);
        } else {
            log.push(`|error|not|in|hand`);
        }
    } else {
        log.push(`|noHand`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const drawCardForSong = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`drawCardForSong`];
    const deck = G.secret.songDeck;
    log.push(`|deck${deck}`);
    const player = G.player[SJPlayer.P1];
    const card = deck.pop();
    log.push(`|popped${card}`);
    if (card === undefined) {
        G.secret.songDeck = shuffle(ctx, G.song.discard);
        G.song.discard = [];
    } else {
        player.hand.push(card);
    }
    if (deck.length === 0) {
        log.push(`|deck|empty|reshuffle|`);
        G.secret.songDeck = shuffle(ctx, G.song.discard);
        G.song.discard = [];
        log.push(`|newDeck${deck}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const drawCardForJinn = (G: SongJinnGame, ctx: Ctx) => {
    const player = G.player[SJPlayer.P2];
    const card = G.secret.jinnDeck.pop();
    if (card === undefined) {
        G.secret.jinnDeck = shuffle(ctx, G.song.discard);
        G.jinn.discard = [];
    } else {
        console.log(card + 'jinn');
        player.hand.push(card);
    }
    if (G.secret.jinnDeck.length === 0) {
        G.secret.jinnDeck = shuffle(ctx, G.song.discard);
        G.jinn.discard = [];
    }
}
export const getLeadingPlayer = (G: SongJinnGame): SJPlayer => {
    return G.jinn.civil > G.song.civil ? SJPlayer.P2 : SJPlayer.P1;
}


export const totalDevelop = (G: SongJinnGame, ctx: Ctx, playerId: PlayerID) => {
    const log = [`totalDevelop|p${playerId}`]
    const pub = pid2pub(G, playerId);
    const d = pub.develop.map(c => sjCardById(c).op);
    log.push(`|${d}`);
    let sum = 0
    if (d.length > 0) {
        sum += d.reduce(accumulator);
        log.push(`|cardSum|${sum}`);
        if (pub.develop.includes(JinnBaseCardID.J40)) {
            sum += G.colony * 2 - 2;
            log.push(`|南南北北|${sum}`);
        }
        if (pub.develop.includes(SongBaseCardID.S45)) {
            const uncolonized = G.jinn.cities.filter(c => getCityById(c).colonizeLevel > G.colony).length;
            sum += uncolonized - 3;
            log.push(`|梁兴渡河${uncolonized}|${sum}`);
        }
    }
    if (playerId === SJPlayer.P2 && G.events.includes(ActiveEvents.JinTaiZong)) {
        log.push(`|JinTaiZong`);
        sum += 1;
        log.push(`|${sum}sum`);
    }
    if (playerId === SJPlayer.P2
        && G.events.includes(ActiveEvents.BuJianLaiShi)
        && pub.nations.includes(NationID.GaoLi)
    ) {
        log.push(`|BuJianLaiShi`);
        sum++;

        log.push(`|${sum}sum`);
    }
    const nationCount = pub.nations.length;
    sum += nationCount;
    log.push(`|nations${nationCount}`);
    log.push(`|${sum}sum`);
    log.push(`|corruption`);
    sum -= pub.corruption;
    log.push(`|${sum}sum`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return sum;
}
export const remainDevelop = (G: SongJinnGame, ctx: Ctx, playerId: PlayerID) => {
    return totalDevelop(G, ctx, playerId) - pid2pub(G, playerId).usedDevelop;
}

export function oppoPid(pid: PlayerID) {
    return pid === SJPlayer.P1 ? SJPlayer.P2 : SJPlayer.P1;
}

export function oppoCtr(c: Country) {
    return c === Country.SONG ? Country.JINN : Country.SONG;
}

// troop

export const roundTwo = (G: SongJinnGame, ctx: Ctx) => {
    const ci = G.combat;
    ci.roundTwo = true;
    ci.phase = CombatPhase.YunChou;
    changePlayerStage(G, ctx, 'combatCard', G.order[0]);
}

export const mingJin = (G: SongJinnGame, ctx: Ctx) => {
    G.combat.phase = CombatPhase.MingJin;
    if (canRoundTwo(G)) {
        if (canForceRoundTwo(G)) {
            changePlayerStage(G, ctx, 'confirmRespond', ciDefPid(G));
        } else {
            changePlayerStage(G, ctx, 'confirmRespond', ciAtkPid(G));
        }
    } else {
        endCombat(G, ctx);
    }

}

export const jiaoFeng = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`jiaoFeng`];
    const ci = G.combat;
    ci.phase = CombatPhase.JiaoFeng;
    log.push(`|${ci.type}`);
    let atkD = 0;
    let defD = 0;
    const st = ci.song.troop;
    const jt = ci.jinn.troop;
    const at = ciAtkTroop(G);
    const dt = ciDefTroop(G);
    const atkPid = ctr2pid(ci.atk);
    const defPid = ctr2pid(ciDefCtr(G));
    log.push(`|a${getSimpleTroopText(G, at)}`);
    log.push(`|d${getSimpleTroopText(G, dt)}`);
    log.push(`|${ci.type}`);
    switch (ci.type) {
        case CombatType.SIEGE:
            if (dt.c === null) {
                log.push(`|error`);
                logger.error(`${G.matchID}|${log.join('')}`);
                return;
            }
            if (!G.events.includes(ActiveEvents.LiuJiaShenBing)) {
                log.push(`|normal`);
                atkD = troopSiegeMelee(G, st);
                defD = troopDefendCiyMelee(G, dt);
            } else {
                log.push(`|liuJia`);
                const cityDefence = getCityDefence(G, dt.c, Country.SONG);
                atkD = troopSiegeMelee(G, st);
                defD = troopDefendCiyMelee(G, dt) - (2 * cityDefence);
            }
            break;
        case CombatType.RESCUE:
            atkD = troopMelee(G, at);
            defD = troopMelee(G, dt);
            break;
        case CombatType.FIELD:
            atkD = troopMelee(G, at);
            defD = troopMelee(G, dt);
            break;
        case CombatType.BREAKOUT:
            atkD = troopMelee(G, at);
            defD = troopMelee(G, dt);
            break;
    }
    if (ci.type !== CombatType.SIEGE && ci.atk === Country.SONG) {
        atkD += getPolicy(G);
    }
    log.push(`|${atkD}atkD`);
    log.push(`|${defD}defD`);

    if (ci.atk === Country.JINN && ciJinnGenerals(G).includes(JinnGeneral.WuZhu)) {
        log.push(`|wuZhu+2`);
        atkD += 2;
    }
    // TODO you chan dou li de yuan cheng
    if (defD <= 0) {
        log.push(`|correctAtkDice${defD}To1`);
        defD = 1
    }
    if (atkD <= 0) {
        log.push(`|correctAtkDice${atkD}To1`);
        atkD = 1
    }

    rollDiceByPid(G, ctx, atkPid, atkD);
    rollDiceByPid(G, ctx, defPid, defD);
    changePlayerStage(G, ctx, 'takeDamage', G.order[0]);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const hasRangeStrengthTroop = (G: SongJinnGame, t: Troop) => {

    if (t.g === Country.SONG) {
        return t.u[1] > 0 || t.u[4] > 0 || t.u[5] > 0;
    } else {
        if (G.events.includes(ActiveEvents.JianLiDaQi) && G.jinn.military >= 5) {
            const qian = t.u[5] > 0 || t.u[6] > 0;
        } else {
            return t.u[1] > 0
        }
    }
}
export const countDice = (G: SongJinnGame, ctr: Country): number => {
    const log = [`count${ctr}Dice`];
    const ci = G.combat;
    const terrain = getTerrainTypeByPlace(ciAtkTroop(G));

    const pub = pid2pub(G, ctr2pid(ctr));
    const oppo = pid2pub(G, ctr2pid(oppoCtr(ctr)));
    let d6 = pub.dices.length > 0 ? pub.dices[pub.dices.length - 1] : [];
    let opD6 = oppo.dices.length > 0 ? oppo.dices[oppo.dices.length - 1] : [];
    log.push(`|${JSON.stringify(d6)}`);
    if (ctr === Country.SONG) {
        if (ci.song.combatCard.includes(SongBaseCardID.S41)) {
            log.push(`|yueShuai++`);
            d6 = d6.map(d => d + 1);
            log.push(`|${d6}`);

        }
        if (ci.jinn.combatCard.includes(JinnBaseCardID.J14)) {
            log.push(`|xiJun--`);
            d6 = d6.map(d => d + 1);
            log.push(`|${d6}`);

        }
    } else {
        if (terrain === TerrainType.FLATLAND && ciJinnGenerals(G).includes(JinnGeneral.ZhanHan)) {
            log.push(`|zhanHan|plain|++`);
            d6 = d6.map(d => d + 1);
            log.push(`|${d6}`);
        }
        if (ciJinnGenerals(G).includes(JinnGeneral.YinShuKe)) {
            log.push('yinShuKeJieWei/TuWei');
            d6 = d6.map(d => d + 1);
            log.push(`|${d6}`);
        }
        if (ciSongGenerals(G).includes(SongGeneral.ZongZe)) {
            log.push('zongZe');
            d6 = d6.map(d => d - 1);
            log.push(`|${d6}`);
        }
        if (
            ci.song.combatCard.includes(SongBaseCardID.S39)
            && ci.type === CombatType.SIEGE
            && ci.atk === Country.JINN

        ) {
            log.push(`|shouChengLu--`);
            d6 = d6.map(d => d - 1);
            log.push(`|${d6}`);
        }

    }
    let dmg = d6.filter(d => d >= 5).length;
    log.push(`|${dmg}dmg`);

    if (ctr === Country.SONG) {
        if (terrain === TerrainType.SWAMP && ciSongGenerals(G).includes(SongGeneral.HanShiZhong)) {
            log.push(`|shuiZeHanShiZhong`);
            dmg++;
            log.push(`|${dmg}dmg`);
        }
        if (ci.phase === CombatPhase.JiaoFeng && ciSongGenerals(G).includes(SongGeneral.YueFei)) {
            log.push(`|yueFei++`);
            dmg++;
            log.push(`|${dmg}dmg`);
        }
        if (ciJinnGenerals(G).includes(JinnGeneral.BenZhu)
            && ci.type === CombatType.SIEGE
            && ci.atk === Country.SONG
        ) {
            log.push('benZhuShouCheng');
            const d1Count = opD6.filter(d => d === 1).length;
            log.push(`|${d1Count}d1Count`);
            dmg -= d1Count;
            log.push(`|${dmg}dmg`);
        }
    } else {

    }
    if (oppo.military >= 7 && dmg > 0) {
        dmg--;
    }
    log.push(`|${dmg}dmg`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return dmg;
}

export const yuanCheng = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`yuanCheng`];
    const ci = G.combat;
    ci.phase = CombatPhase.YuanCheng;
    log.push(`|${ci.type}`);
    let atkD = 0;
    let defD = 0;
    const st = ci.song.troop;
    const jt = ci.jinn.troop;
    const at = ciAtkTroop(G);
    const dt = ciDefTroop(G);
    const atkPid = ctr2pid(ci.atk);
    const defPid = ctr2pid(ciDefCtr(G));
    log.push(`|a${getSimpleTroopText(G, at)}`);
    log.push(`|d${getSimpleTroopText(G, dt)}`);
    log.push(`|${ci.type}`);
    switch (ci.type) {
        case CombatType.SIEGE:
            if (dt.c === null) {
                log.push(`|no|def|city|error|endCombat`);
                endCombat(G, ctx);
                logger.error(`${G.matchID}|${log.join('')}`);
                return;
            }
            const cityDef = getCityDefence(G, dt.c, ciDefCtr(G));
            log.push(`|${cityDef}cityDef`);
            if (!G.events.includes(ActiveEvents.LiuJiaShenBing)) {
                log.push(`|normal`);
                atkD = getRangeSiegeStr(G, at) - cityDef;
                defD = troopDefendCiyRange(G, dt);
            } else {
                log.push(`|liuJia`);
                atkD = getRangeSiegeStr(G, at) + cityDef;
                defD = troopDefendCiyRange(G, dt) - (2 * cityDef);
            }
            break;
        case CombatType.RESCUE:
            atkD = getRangeStrength(G, at);
            defD = getRangeStrength(G, dt);
            break;
        case CombatType.FIELD:
            atkD = getRangeStrength(G, at);
            defD = getRangeStrength(G, dt);
            break;
        case CombatType.BREAKOUT:
            atkD = getRangeStrength(G, at);
            defD = getRangeStrength(G, dt);
            break;
    }

    log.push(`|${atkD}atkD`);
    log.push(`|${defD}defD`);
    rollDiceByPid(G, ctx, atkPid, atkD);
    rollDiceByPid(G, ctx, defPid, defD);
    ci.jinn.damageLeft = countDice(G, Country.SONG);
    ci.song.damageLeft = countDice(G, Country.JINN);
    // TODO skip if 0 damage after calculation stable
    if (ci.song.damageLeft === 0 && ci.jinn.damageLeft === 0) {
        // TODO wu jie / zhu dui shi
    } else {
        if (
            (G.order[0] === SJPlayer.P2 && ci.jinn.damageLeft === 0)
            ||
            (G.order[0] === SJPlayer.P1 && ci.song.damageLeft === 0)
        ) {
            changePlayerStage(G, ctx, 'takeDamage', G.order[1]);
        } else {
            changePlayerStage(G, ctx, 'takeDamage', G.order[0]);
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const canRoundTwo = (G: SongJinnGame): boolean => {
    const log = [`canRoundTwo`];
    const ci = G.combat;
    log.push(`|${ci.type}`);
    let atkD = 0;
    let defD = 0;
    const st = ci.song.troop;
    const jt = ci.jinn.troop;
    const at = ciAtkTroop(G);
    const dt = ciDefTroop(G);
    const atkPid = ctr2pid(ci.atk);
    const defPid = ctr2pid(ciDefCtr(G));
    const atkPub = pid2pub(G, atkPid);
    const defPub = pid2pub(G, defPid);
    if (ci.roundTwo) {
        return false;
    }
    if (atkPub.military > defPub.military) {
        log.push(`|${atkPub.military}>${defPub.military}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return true;
    } else {
        log.push(`|${atkPub.military}<=${defPub.military}`);

        if (ci.atk === Country.SONG && ci.song.combatCard.includes(SongBaseCardID.S36)) {
            log.push(`|yueJiaJun`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return true;
        }
        if (ci.atk === Country.SONG && ciAtkGenerals(G).includes(SongGeneral.YueFei)) {
            log.push(`|yuefei`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return true;
        }
        if (ci.atk === Country.JINN && ciAtkGenerals(G).includes(JinnGeneral.WuZhu)) {
            log.push(`|wuzhu`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return true;
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
        return false;
    }
}

export const ciAtkPid = (G: SongJinnGame): PlayerID => ctr2pid(G.combat.atk);
export const ciDefPid = (G: SongJinnGame): PlayerID => ctr2pid(ciDefCtr(G));
export const ciDefCtr = (G: SongJinnGame): Country => {
    const ci = G.combat;
    return ci.atk === Country.SONG ? Country.JINN : Country.SONG;
}

export const ciCtrInfo = (G: SongJinnGame, ctr: Country): CountryCombatInfo => {
    const ci = G.combat;
    return ctr === Country.SONG ? ci.song : ci.jinn;
}
export const ciAtkInfo = (G: SongJinnGame): CountryCombatInfo => {
    const ci = G.combat;
    return ci.atk === Country.SONG ? ci.song : ci.jinn;
}
export const ciDefInfo = (G: SongJinnGame): CountryCombatInfo => {
    const ci = G.combat;
    return ci.atk === Country.SONG ? ci.jinn : ci.song;
}

export const ciSongGenerals = (G: SongJinnGame): General[] => {
    return G.combat.atk === Country.JINN ? ciAtkGenerals(G) : ciDefGenerals(G);
}
export const ciJinnGenerals = (G: SongJinnGame): General[] => {
    return G.combat.atk === Country.SONG ? ciAtkGenerals(G) : ciDefGenerals(G);
}
export const ciAtkGenerals = (G: SongJinnGame): General[] => {
    return getPlaceGeneral(G, ciAtkPid(G), ciAtkTroop(G).p);
}
export const ciDefGenerals = (G: SongJinnGame): General[] => {
    return getPlaceGeneral(G, ciDefPid(G), ciDefTroop(G).p);
}

export const ciDefTroop = (G: SongJinnGame): Troop => {
    const ci = G.combat;
    return ci.atk === Country.SONG ? ci.jinn.troop : ci.song.troop;
}
export const ciAtkTroop = (G: SongJinnGame): Troop => {
    const ci = G.combat;
    return ci.atk === Country.SONG ? ci.song.troop : ci.jinn.troop;
}

export const confirmRespondLogText = (G: SongJinnGame, arg: boolean, ctr: Country) => {
    if (G.combat.phase === CombatPhase.JieYe) {
        return arg ? "选择接野" : "选择不接野";
    }
    if (G.combat.phase === CombatPhase.WeiKun) {
        return arg ? "选择围困" : "选择攻城";
    }
    if (G.combat.phase === CombatPhase.MingJin) {
        const ci = G.combat;
        if (ctr === ci.atk) {
            return arg ? "选择继续作战" : "选择撤退";
        } else {
            if (
                canForceRoundTwo(G)) {
                return arg ? "选择强制第二轮" : "选择不强制第二轮";
            } else {
                return arg ? "选择坚守" : "选择撤退";
            }
        }
    }
    return arg ? "选择是" : "选择否";
}

export const confirmRespondOptions = (G: SongJinnGame, ctx: Ctx, pid: PlayerID) => {

}
export const confirmRespondText = (G: SongJinnGame, ctx: Ctx, pid: PlayerID) => {
    const ctr = pid2ctr(pid);
    if (G.combat.phase === CombatPhase.JieYe) {
        return "是否接野？"
    }
    if (G.combat.phase === CombatPhase.WeiKun) {
        return "对手不接野战 选择是围困 选择否攻城"
    }
    if (G.combat.phase === CombatPhase.MingJin) {
        const ci = G.combat;
        if (ctr === ci.atk) {
            return "是否选择继续作战";
        } else {
            if (
                canForceRoundTwo(G)
            ) {
                return "选择是否强制第二轮";
            } else {
                return "是否选择坚守";
            }
        }
    }
    return "是否确认";
}

export function endCombat(G: SongJinnGame, ctx: Ctx) {
    const log = [`endCombat`];
    const c = G.combat;
    c.ongoing = false;
    log.push(`|${c.song.combatCard}c.song.combatCard`);
    log.push(`|${G.song.discard}G.song.discard`);

    c.song.combatCard.forEach(cid => {
        if (c.song.combatCard.includes(cid)) {
            c.song.combatCard.splice(c.song.combatCard.indexOf(cid), 1);
        }
        G.song.discard.push(cid);
    });


    log.push(`|${c.jinn.combatCard}c.song.combatCard`);
    log.push(`|${G.jinn.discard}G.song.discard`);
    c.jinn.combatCard.forEach(cid => {
        if (c.jinn.combatCard.includes(cid)) {
            c.jinn.combatCard.splice(c.jinn.combatCard.indexOf(cid), 1);
        }
        G.jinn.discard.push(cid);
    })
    log.push(`|${c.jinn.combatCard}combatCard`);
    log.push(`|${G.jinn.discard}G.song.discard`);
    G.combat = emptyCombatInfo();
    log.push(`|${JSON.stringify(c)}`);
    ctx.events?.endStage();
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const isQiXing = (t: Troop) => {
    if (t.g === Country.SONG) {
        return t.u[2] > 0;
    } else {
        return t.u[1] > 0 || t.u[2] > 0;
    }
}

export const heYiCities = (G: SongJinnGame) => {
    const log = [`heYiCities`];
    let minColonizeLevel = 10;
    G.song.cities.forEach(c => {
        const colonizeLevel = getCityById(c).colonizeLevel;
        if (colonizeLevel < minColonizeLevel) {
            minColonizeLevel = colonizeLevel;
            log.push(`|${minColonizeLevel}minColonizeLevel`);
        }
    })
    log.push(`|${minColonizeLevel}minColonizeLevel`);
    const cityIDS = G.song.cities.filter(c => getCityById(c).colonizeLevel === minColonizeLevel);
    log.push(`|${cityIDS}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return cityIDS;
}

export function startCombat(
    G: SongJinnGame, ctx: Ctx,
    attacker: Country, p: TroopPlace
) {
    const log = [`startCombat|${attacker}atk|${placeToStr(p)}`];
    const c = G.combat;
    G.combat.ongoing = true;
    c.atk = attacker;
    const atkId = ctr2pid(attacker);
    const defId = ctr2pid(oppoCtr(attacker));
    let atkTroop = getTroopByCountryPlace(G, c.atk, p);
    let defTroop = getTroopByCountryPlace(G, ciDefCtr(G), p);

    if (isCityID(p)) {
        log.push(`|breakout`);
        // @ts-ignore
        atkTroop = getTroopByCountryCity(G, c.atk, p);
        // @ts-ignore
        defTroop = getTroopByCountryCity(G, ciDefCtr(G), p);
        if (atkTroop === null || defTroop === null) {
            log.push(`|error|one troop missing`);
            endCombat(G, ctx);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return;
        }
        if (atkTroop.p === atkTroop.c) {
            log.push(`|breakout`);
            c.type = CombatType.BREAKOUT;
        } else {
            if (defTroop.p === defTroop.c) {
                log.push(`|siege`);
                c.type = CombatType.SIEGE;
            }
        }
    }
    log.push(`|${JSON.stringify(atkTroop)}atkTroop`);
    log.push(`|${JSON.stringify(defTroop)}defTroop`);
    const st = c.atk === Country.SONG ? atkTroop : defTroop;
    if (st !== null) {
        c.song.troop = st;
        if (isRegionID(st.p)) {
            c.region = st.p;
        }
        c.city = st.c;
    } else {
        log.push(`|error|no song troop`);
        endCombat(G, ctx);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    const jt = c.atk === Country.JINN ? atkTroop : defTroop;
    if (jt !== null) {
        c.jinn.troop = jt;
    } else {
        log.push(`|error|no jinn troop`);
        endCombat(G, ctx);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    // TODO

    log.push(`|${JSON.stringify(atkTroop)}atk`);
    log.push(`|${JSON.stringify(defTroop)}def`);
    log.push(`|${atkId}atkId`);
    log.push(`|${defId}defId`);
    if (isNationID(p)) {
        log.push(`|cannot|combat|in|nation`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    } else {
        if (isRegionID(p)) {
            log.push(`|isRegion`);
            const reg = getRegionById(p);
            if (reg.city === null) {
                log.push(`|noCityField`);
                c.type = CombatType.FIELD;
                // DEBUG remove cc
                // yuanCheng(G, ctx);
                changePlayerStage(G, ctx, 'combatCard', G.order[0]);
            } else {
                log.push(`|city|ask|field`);
                // DEBUG remove cc
                // yuanCheng(G, ctx);
                changePlayerStage(G, ctx, 'confirmRespond', defId);
            }
        } else {
            if (isMountainPassID(p)) {
                log.push(`|mountainPass|cc`);
                c.type = CombatType.SIEGE;
                changePlayerStage(G, ctx, 'combatCard', G.order[0]);
            } else {
                if (isCityID(p)) {
                    log.push(`|cc`);
                    changePlayerStage(G, ctx, 'combatCard', G.order[0]);
                }
            }
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}


export function weiKunTroop(G: SongJinnGame, t: Troop) {
    const log = [`weiKunTroop${JSON.stringify(t)}`];
    const pub = pid2pub(G, ctr2pid(t.g));
    const troops = pub.troops.filter(tr => tr.p === t.p);
    if (troops.length > 0) {
        if (troops.length > 1) {
            log.push(`|more than one error`);
        } else {
            const city = troops[0].c
            if (city !== null) {
                troops[0].p = city;
                log.push(`|${JSON.stringify(troops)}troops`);
            } else {
                if (G.combat.city !== null) {
                    troops[0].p = G.combat.city
                    log.push(`|${JSON.stringify(troops)}troops`);
                } else {
                    log.push(`|no combat city | cannot wei kun|error`);
                }
            }
        }
    } else {
        log.push(`|cannot find troop}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function troopCanSiege(G: SongJinnGame, t: Troop) {
    let b = false;
    oppoPub(G, ctr2pid(t.g));
    const log = [`troopCanSiege|${JSON.stringify(t)}`];
    if (isRegionID(t.p)) {
        const fieldOpTroop = getOpponentPlaceTroopByCtr(G, t.g, t.p);
        if (fieldOpTroop !== null) {
            log.push(`|stalemate|false`);
            b = false;
        } else {
            // @ts-ignore
            const city = getRegionById(t.p).city;
            if (city === null) {
                log.push(`|noCity`);
                b = false;
            } else {
                const cityOpTroop = getTroopByCountryCity(G, oppoCtr(t.g), city);
                if (cityOpTroop !== null) {
                    log.push(`|hasOpTroop`);
                    b = true;
                } else {
                    log.push(`|noOpTroop`);
                    b = false;
                }
            }
        }
    } else {
        log.push(`|notRegion`);
        b = false;
    }
    logger.warn(`${G.matchID}|${log.join('')}`);
    return b;
}

export function troopIsWeiKun(G: SongJinnGame, t: Troop) {
    const b = t.p === t.c;
    logger.warn(`${G.matchID}|troopIsWeiKun${JSON.stringify(t)}|${b}`);
    return b;
}

export function troopIsArmy(G: SongJinnGame, _ctx: Ctx, troop: Troop) {
    return troopEndurance(G, troop) !== 0;
}

export function getRangeStrength(G: SongJinnGame, t: Troop): number {
    const log = [`getRangeStrength`];
    const unitStrength = troopRange(G, t);
    log.push(`|${unitStrength}unitStrength`);
    const genCCModifier = getGeneralCCRange(G, t);
    log.push(`|${genCCModifier}generalStr`);
    let siegeMod = 0;
    if (G.combat.type === CombatType.SIEGE) {

    } else {

    }
    let total = unitStrength + genCCModifier;
    if (unitStrength > 0) {
        if (total <= 0) {
            total = 1;
        }
    } else {
        if (total <= 0) {
            total = 0;
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return total;
}


export function getGeneralCCRange(G: SongJinnGame, t: Troop): number {
    const log = [`getGeneralCCRange`];
    const ci = G.combat;
    let mod = 0;
    const cc = ciCtrInfo(G, t.g).combatCard;
    if (cc.includes(SongBaseCardID.S12)) {
        log.push(`|ZhanChe`);
        mod += t.u[0];
        log.push(`|${mod}mod`);
    }
    const generals = getPlaceCountryGeneral(G, t.g, t.p);
    const unitCount = t.u.reduce(accumulator);
    log.push(`|${unitCount}unitount`);
    if (t.g === Country.JINN) {
        if (generals.includes(JinnGeneral.WuZhu) && ci.atk === Country.JINN) {
            log.push(`|wuZhuAtk`);
            mod += 2;
            log.push(`|${mod}mod`);
        }
    } else {
        if (generals.includes(SongGeneral.LiXianZhong)) {
            log.push(`|LiXianZhong`);
            mod += t.u[2];
            log.push(`|${mod}mod`);
        }
        if (generals.includes(SongGeneral.WuLin) && ci.atk === Country.SONG) {
            log.push(`|wuLinAtk`);
            mod += unitCount;
            log.push(`|${mod}mod`);
        }
        if (generals.includes(SongGeneral.WuJie) && ci.atk === Country.JINN) {
            log.push(`|wuJieDef`);
            mod += unitCount;
            log.push(`|${mod}mod`);
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return mod;
}

export function unitRangeStr(G: SongJinnGame, troop: Troop) {
    const log = [`unitRangeStr`];
    const terrainType = getTerrainTypeByPlace(troop);
    const isSwampRampart = checkSwampRampart(troop.p);
    log.push(`|terrain${terrainType}`);
    log.push(`|${isSwampRampart}isSwampRampart`);
    let unitRanges: number[] = [];
    if (troop.g === Country.SONG) {
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitRanges = [0, 1, 0, 0, 0, 2];
                break;
            case TerrainType.HILLS:
                unitRanges = [0, 1, 0, 0, 0, 2];
                break;
            case TerrainType.MOUNTAINS:
                unitRanges = [0, 1, 0, 0, 0, 2];
                break;
            case TerrainType.SWAMP:
                unitRanges = [0, 2, 0, 2, 0, 2];
                break;
            case TerrainType.RAMPART:
                unitRanges = [0, 2, 0, 0, 3, 2];
                if (isSwampRampart) {
                    unitRanges[4] = 2;
                }
                break;
        }
        if (G.events.includes(ActiveEvents.ShenBiGong)) {
            log.push(`|shenBiGong`);
            unitRanges[1] = 2;
        }
    } else {
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitRanges = [0, 2, 0, 0, 0, 1, 1];
                break;
            case TerrainType.HILLS:
                unitRanges = [0, 2, 0, 0, 0, 0, 0];
                break;
            case TerrainType.MOUNTAINS:
                unitRanges = [0, 1, 0, 0, 0, 0, 0];
                break;
            case TerrainType.SWAMP:
                unitRanges = [0, 2, 0, 2, 0, 0, 0];
                break;
            case TerrainType.RAMPART:
                unitRanges = [0, 2, 0, 0, 0, 0, 0];
                if (isSwampRampart) {
                    unitRanges[3] = 2;
                }
                break;
        }
        if (G.events.includes(ActiveEvents.JianLiDaQi) && G.jinn.military >= 5) {
            log.push(`|qianQiQiRange`);
            unitRanges[5] = 1;
            unitRanges[6] = 1;
        }
    }
    log.push(`|${JSON.stringify(unitRanges)}unitRanges`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return unitRanges;
}

export function checkSwampRampart(place: TroopPlace,): boolean {
    // @ts-ignore
    return isCityID(place) && getRegionById(getCityById(place).region
    ).terrain === TerrainType.SWAMP;
}

export function troopRange(G: SongJinnGame, troop: Troop): number {
    const log = [`troopRange${JSON.stringify(troop)}`];
    let range = 0;

    let unitRanges: number[] = [];
    unitRanges = unitRangeStr(G, troop);
    log.push(`|${unitRanges}unitRanges`);
    troop.u.forEach((i, idx) => {
        range += i * unitRanges[idx]
    });
    log.push(`|range${range}`);
    if (troop.g === Country.JINN && hasGeneral(G, troop, JinnGeneral.WoLiBu)) {
        range += troop.u[1];
        log.push(`|range${range}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return range;
}

export function getCityDefence(G: SongJinnGame, cid: CityID, ctr: Country): number {
    const city = getCityById(cid);
    const log = [`getCityDefence${city.name}`];
    let def = city.capital ? 2 : 1;
    log.push(`|${def}def`);
    if (ctr2pub(G, ctr).emperor === cid) {
        log.push(`|emperor`);
        def++;
        log.push(`|${def}def`);
    }
    logger.warn(`${G.matchID}|${log.join('')}`);
    return def;
}

export function getSiegeRangeUnitStrength(G: SongJinnGame, troop: Troop, terrainType: TerrainType) {
    const log = [`getSiegeRangeUnitStrength`];
    let unitRanges: number[] = [];

    if (troop.g === Country.SONG) {
        log.push(`|song`);
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitRanges = [0, 1, 0, 0, 0, 1];
                break;
            case TerrainType.HILLS:
                unitRanges = [0, 1, 0, 0, 0, 1];
                break;
            case TerrainType.MOUNTAINS:
                unitRanges = [0, 1, 0, 0, 0, 1];
                break;
            case TerrainType.SWAMP:
                unitRanges = [0, 1, 0, 1, 0, 1];
                break;
            case TerrainType.RAMPART:
                unitRanges = [0, 1, 0, 0, 0, 1];
                break;
        }
    } else {
        log.push(`|jinn`);
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitRanges = [0, 1, 0, 0, 1, 0, 0];
                break;
            case TerrainType.HILLS:
                unitRanges = [0, 1, 0, 0, 1, 0, 0];
                break;
            case TerrainType.MOUNTAINS:
                unitRanges = [0, 1, 0, 0, 1, 0, 0];
                break;
            case TerrainType.SWAMP:
                unitRanges = [0, 1, 0, 1, 1, 0, 0];
                break;
            case TerrainType.RAMPART:
                unitRanges = [0, 1, 0, 0, 1, 0, 0];
                break;
        }
        if (G.events.includes(ActiveEvents.JianLiDaQi) && G.jinn.military >= 5) {
            log.push(`|qianQiRange`);
            unitRanges[5] = 1;
            unitRanges[6] = 1;
        }
    }
    log.push(`|${JSON.stringify(unitRanges)}unitRanges`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return unitRanges;
}

function isAtkSong(G: SongJinnGame) {
    return G.combat.atk === Country.SONG;
}

export function getRangeSiegeStr(G: SongJinnGame, t: Troop) {
    const log = [`getRangeSiegeStr`];
    const fromUnit = troopSiegeRange(G, t);
    log.push(`|${fromUnit}fromUnit`);
    const genCCMod = getGeneralCCRange(G, t);
    log.push(`|${genCCMod}genCCMod`);
    let policyMod = 0;
    if (isAtkSong(G)) {
        policyMod = getPolicy(G)
    }
    log.push(`|${policyMod}policyMod`);
    let strength = fromUnit + genCCMod + policyMod;
    const final = fromUnit > 0 ?
        strength <= 1 ? 1 : strength :
        strength <= 0 ? 0 : strength;
    log.push(`|${final}final`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return final
}

export function troopSiegeRange(G: SongJinnGame, troop: Troop): number {
    const log = [`troopSiegeRange`];
    log.push(`|${JSON.stringify(troop)}troop`);
    let range = 0;
    const terrainType = getTerrainTypeByPlace(troop);
    const unitRanges = getSiegeRangeUnitStrength(G, troop, terrainType);
    log.push(`|${JSON.stringify(unitRanges)}unitRanges`);
    troop.u.forEach((i, idx) => {
        range += i * unitRanges[idx]
    });
    log.push(`|${range}range`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return range;
}


export function generalSiegeMelee(G: SongJinnGame, troop: Troop): number {
    return 0;
}

export function troopSiegeMelee(G: SongJinnGame, troop: Troop): number {
    let melee = 0;
    const terrainType = getTerrainTypeByPlace(troop);
    const place = troop.p;
    const isSwampRampart = checkSwampRampart(place);
    let unitMelee: number[] = [];

    if (troop.g === Country.SONG) {
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitMelee = [1, 0, 3, 0, 0, 0];
                break;
            case TerrainType.HILLS:
                unitMelee = [1, 0, 2, 0, 0, 0];
                break;
            case TerrainType.MOUNTAINS:
                unitMelee = [1, 0, 1, 0, 0, 0];
                break;
            case TerrainType.SWAMP:
                unitMelee = [1, 0, 1, 2, 0, 0];
                break;
            case TerrainType.RAMPART:
                unitMelee = [1, 0, 1, 0, 0, 0];
                if (isSwampRampart) {
                    unitMelee[4] = 2;
                }
                break;
        }
    } else {
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitMelee = [1, 1, 1, 0, 1, 1, 1];
                break;
            case TerrainType.HILLS:
                unitMelee = [1, 1, 1, 0, 1, 1, 1];
                break;
            case TerrainType.MOUNTAINS:
                unitMelee = [1, 1, 1, 0, 1, 1, 1];
                break;
            case TerrainType.SWAMP:
                unitMelee = [1, 1, 1, 1, 1, 1, 1];
                break;
            case TerrainType.RAMPART:
                unitMelee = [1, 1, 1, 0, 1, 1, 1];
                break;
        }
    }
    troop.u.forEach((i, idx) => {
        melee += i * unitMelee[idx]
    })
    if (troop.g === Country.JINN && hasGeneral(G, troop, JinnGeneral.WoLiBu)) {
        melee += troop.u[1];
        melee += troop.u[2];
    }
    if (troop.g === Country.SONG) {
        melee += getPolicy(G);
        melee = melee > 0 ? melee : 0;
    }
    return melee;
}

export function troopDefendCiyRange(G: SongJinnGame, troop: Troop): number {
    let range = troopRange(G, troop);
    if (troop.c !== null) {
        range += getCityDefence(G, troop.c, troop.g);
    }
    range += troop.u[1];
    return range;
}

export function troopDefendCiyMelee(G: SongJinnGame, troop: Troop): number {
    return troopMelee(G, troop) + troop.u[1];
}

export function hasGeneral(G: SongJinnGame, t: Troop, gen: General) {
    const pub = ctr2pub(G, t.g);
    return pub.generals[gen] === GeneralStatus.TROOP ? t.p === pub.generalPlace[gen] : false;
}

export function troopMelee(G: SongJinnGame, troop: Troop): number {
    return troopMeleeOnly(G, troop) + troopRange(G, troop);
}

export function troopMeleeOnly(G: SongJinnGame, troop: Troop): number {

    let melee = 0;
    const terrainType = getTerrainTypeByPlace(troop);
    const place = troop.p;

    // @ts-ignore
    const isSwampRampart = isCityID(place) && getRegionById(getCityById(place).region)
        .terrain === TerrainType.SWAMP;


    let unitMelee: number[] = [];

    if (troop.g === Country.SONG) {
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitMelee = [1, 0, 3, 0, 0, 0];
                break;
            case TerrainType.HILLS:
                unitMelee = [1, 0, 2, 0, 0, 0];
                break;
            case TerrainType.MOUNTAINS:
                unitMelee = [1, 0, 1, 0, 0, 0];
                break;
            case TerrainType.SWAMP:
                unitMelee = [1, 0, 1, 2, 0, 0];
                break;
            case TerrainType.RAMPART:
                unitMelee = [1, 0, 1, 0, 0, 0];
                if (isSwampRampart) {
                    unitMelee[4] = 2;
                }
                break;
        }
        if (G.events.includes(ActiveEvents.ShenBiGong)) {
            unitMelee[1] = 2;
        }
    } else {
        switch (terrainType) {
            case TerrainType.FLATLAND:
                unitMelee = [0, 0, 3, 0, 0, 1, 1];
                break;
            case TerrainType.HILLS:
                unitMelee = [0, 0, 2, 0, 0, 1, 1];
                break;
            case TerrainType.MOUNTAINS:
                unitMelee = [0, 0, 1, 0, 0, 1, 1];
                break;
            case TerrainType.SWAMP:
                unitMelee = [0, 0, 1, 2, 0, 1, 1];
                break;
            case TerrainType.RAMPART:
                unitMelee = [0, 0, 2, 0, 0, 0, 0];
                break;
        }
    }
    troop.u.forEach((i, idx) => {
        melee += i * unitMelee[idx]
    })
    if (troop.g === Country.JINN && hasGeneral(G, troop, JinnGeneral.WoLiBu)) {
        melee += troop.u[2];
    }
    return melee;
}


export function getTroopPlaceText(t: Troop): string {
    let text = `${placeToStr(t.p)}`;
    if (t.c !== null) {
        text += t.c;
    }
    return text;
}

export function hasOpponentTroop(G: SongJinnGame, t: Troop) {
    if (t.g === Country.SONG) {
        return getJinnTroopByPlace(G, t.p) !== null;
    } else {
        return getSongTroopByPlace(G, t.p) !== null;
    }
}

export function getSimpleTroopText(G: SongJinnGame, t: Troop) {
    let text = ``;
    const general = getPlaceCountryGeneral(G, t.g, t.p);
    if (general.length > 0) {
        text += getPlaceCountryGeneralNames(G, t.g, t.p);
    }
    text += '\n';
    text += `|${unitsToString(t.u)}`;
    text += `${troopEndurance(G, t)}`
    return text;
}

export function getTroopText(G: SongJinnGame, t: Troop) {
    let text = ``;
    const general = getPlaceCountryGeneral(G, t.g, t.p);
    if (general.length > 0) {
        text += getPlaceCountryGeneralNames(G, t.g, t.p);
    }
    text += '\n';
    text += `|${unitsToString(t.u)}`;
    text += `${troopEndurance(G, t)}|`;
    text += '\n';
    text += `|${troopRange(G, t)}`;
    text += `/${troopSiegeRange(G, t)}`;
    text += `/${troopDefendCiyRange(G, t)}`;
    text += `|${troopMelee(G, t)}`;
    text += `/${troopSiegeMelee(G, t)}`;
    text += `/${troopDefendCiyMelee(G, t)}`;
    return text;
}


export function troopEndurance(G: SongJinnGame, troop: Troop): number {
    const log = [`troopEndurance${JSON.stringify(troop)}`];
    let endurance = 0;
    const terrainType = getTerrainTypeByPlace(troop);
    log.push(`|${terrainType}terrainType`);
    let unitEndurance: number[] = [];
    if (troop.g === Country.SONG) {
        unitEndurance = [2, 1, 1, 0, 0, 2];
        if (G.events.includes(ActiveEvents.ZhongBuBing)) {
            unitEndurance[0] = 3;
        }
    } else {
        unitEndurance = [2, 1, 2, 0, 0, 1, 1]
    }
    if (terrainType === TerrainType.SWAMP) {
        unitEndurance[3] = 2;
    }
    log.push(`|${unitEndurance}unitEndurance`);
    troop.u.forEach((i, idx) => {
        endurance += i * unitEndurance[idx]
    })
    log.push(`|${endurance}endurance`);
    logger.warn(`${G.matchID}|${log.join('')}`);
    return endurance;
}


export const getSongScore = (G: SongJinnGame): number => {
    const log = [`getSongScore`];
    let score = getSongPower(G);
    log.push(`|power${score}`);
    G.song.completedPlan.forEach((pid) => {
        score += getPlanById(pid).vp;
        log.push(`|${pid}|${score}`);
    })
    score += G.song.military;
    log.push(`|${score}score`);
    score += G.song.civil;
    log.push(`|${score}score`);
    score += G.song.specialPlan;
    log.push(`|${score}score`);

    if (G.events.includes(ActiveEvents.YanJingYiNan)) {
        score++;
        log.push(`|${score}score`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return score
}
export const getSongPower = (G: SongJinnGame): number => {
    const log = [`getSongPower`];

    const countedProvince = [...G.song.provinces];
    log.push(`|all|provinces|${countedProvince}`);
    if (countedProvince.includes(ProvinceID.JINGJILU)) {
        countedProvince.splice(countedProvince.indexOf(ProvinceID.JINGJILU), 1);
    }
    log.push(`|remove|jingji|${countedProvince}`);
    if (countedProvince.includes(ProvinceID.YANJINGLU)) {
        countedProvince.splice(countedProvince.indexOf(ProvinceID.YANJINGLU), 1);
    }
    log.push(`|remove|yanjing|${countedProvince}`);
    if (!G.events.includes(ActiveEvents.XiangHaiShangFaZhan) &&
        countedProvince.includes(ProvinceID.FUJIANLU)
    ) {
        countedProvince.splice(countedProvince.indexOf(ProvinceID.FUJIANLU), 1);
        log.push(`|remove|fujian|${countedProvince}`);
    }

    let power = countedProvince.length;
    log.push(`|powerFromProvinces${power}`);

    if (G.song.emperor !== null) {
        log.push(`|emperor${power}`);
        power++;
        log.push(`|p${power}`);

    }
    if (G.events.includes(ActiveEvents.JianYanNanDu)) {
        log.push(`|jianyannandu${power}`);
        power++;
        log.push(`|p${power}`);
    }

    if (G.events.includes(ActiveEvents.JingKangZhiBian)) {
        log.push(`|jingkangzhibian${power}`);
        power--;
        log.push(`|p${power}`);
    }

    if (G.song.civil >= 6) {
        log.push(`|neizheng6${power}`);
        power++;
        log.push(`|p${power}`);
    }
    logger.warn(`${G.matchID}|${log.join('')}`);
    return power;
}
export const getJinnScore = (G: SongJinnGame): number => {
    const log = [`getJinnScore`];
    let score = getJinnPower(G);
    log.push(`|power${score}`);

    G.jinn.completedPlan.forEach((pid) => {
        score += getPlanById(pid).vp;

    })
    score += G.jinn.military;
    log.push(`|${score}score`);
    score += G.jinn.civil;
    log.push(`|${score}score`);
    score += G.jinn.specialPlan;
    log.push(`|${score}score`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return score;
}


export const checkControlCity = (G: SongJinnGame, pid: PlayerID, c: CityID) => {
    const log = [`checkControlCity|p${pid}|${c}`];
    const cityTroop = getTroopByCountryCity(G, pid2ctr(pid), c);
    let result = false;
    if (cityTroop !== null) {
        return true;
    } else {
        const city = getCityById(c);
        const prov = city.province;
        const pub = pid2pub(G, pid);
        if (pub.provinces.includes(prov)) {
            if (pid === SJPlayer.P1) {
                result = true;
            } else {
                result = G.colony >= city.colonizeLevel;
            }
        }
    }
    log.push(`|${result}result`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export const getJinnPower = (G: SongJinnGame): number => {
    const log = [`getJinnPower`];

    const countedProvince = [...G.jinn.provinces];
    log.push(`|all|${countedProvince}`);
    if (countedProvince.includes(ProvinceID.JINGJILU)) {
        countedProvince.splice(countedProvince.indexOf(ProvinceID.JINGJILU), 1);
    }
    log.push(`|remove|jingji|${countedProvince}`);
    if (countedProvince.includes(ProvinceID.YANJINGLU)) {
        countedProvince.splice(countedProvince.indexOf(ProvinceID.YANJINGLU), 1);
    }
    log.push(`|remove|yangjing|${countedProvince}`);

    if (!G.events.includes(ActiveEvents.XiangHaiShangFaZhan) &&
        countedProvince.includes(ProvinceID.FUJIANLU)
    ) {
        countedProvince.splice(countedProvince.indexOf(ProvinceID.FUJIANLU), 1);
        log.push(`|remove|fujian|${countedProvince}`);
    }
    let power = countedProvince.length;
    log.push(`|provinces${power}`);
    if (G.jinn.emperor !== null) {
        log.push(`|emperor${power}`);
        power++;
    }
    if (G.events.includes(ActiveEvents.JingKangZhiBian)) {
        log.push(`|jingkangzhibian${power}`);
        power++;
    }
    if (G.song.civil >= 6) {
        log.push(`|civil6${power}`);
        power++;
    }
    logger.warn(`${G.matchID}|${log.join('')}`);
    return power;
}
export const drawPhaseForSong = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`drawPhaseForSong`]
    const player = G.player[SJPlayer.P1];
    const hand = player.hand;
    const power = G.song.civil >= 7 ? 9 : getSongPower(G);
    log.push(`|${power}power$`);
    const deck = G.secret.jinnDeck;
    const discard = G.jinn.discard;
    let drawCount = power > 9 ? 9 : power;
    log.push(`|drawCount${drawCount}`);
    if (drawCount + hand.length > 9) {
        drawCount = 9 - hand.length;
        log.push(`|drawCount${drawCount}`);
    }
    if (deck.length + hand.length + discard.length < drawCount) {
        player.hand = hand.concat(deck, discard);
        G.secret.songDeck = [];
        G.song.discard = [];
    } else {
        for (let i = 0; i < drawCount; i++) {
            drawCardForSong(G, ctx);
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const drawPhaseForJinn = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`drawPhaseForJinn`]
    const player = G.player[SJPlayer.P2];
    const hand = player.hand;
    const power = G.jinn.civil >= 7 ? 9 : getJinnPower(G);
    log.push(`|power${power}`);
    const deck = G.secret.jinnDeck;
    const discard = G.jinn.discard;
    let drawCount = G.jinn.civil >= 7 ? 9 : power > 9 ? 9 : power;
    log.push(`|drawCount${drawCount}`);
    if (drawCount + hand.length > 9) {
        drawCount = 9 - hand.length;
        log.push(`|drawCount${drawCount}`);
    }
    if (deck.length + hand.length + discard.length < drawCount) {
        player.hand = hand.concat(deck, discard);
        G.secret.jinnDeck = [];
        G.jinn.discard = [];
    } else {
        for (let i = 0; i < drawCount; i++) {
            drawCardForJinn(G, ctx);
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const drawPhaseForPlayer = (G: SongJinnGame, ctx: Ctx, pid: PlayerID) => {
    switch (pid as SJPlayer) {
        case SJPlayer.P1:
            drawPhaseForSong(G, ctx);
            break;
        case SJPlayer.P2:
            drawPhaseForJinn(G, ctx);
            break;
    }
}
export const addLateTermCard = (G: SongJinnGame, ctx: Ctx) => {
    SongLateCardID.forEach(c => G.secret.songDeck.push(c));
    JinnLateCardID.forEach(c => G.secret.jinnDeck.push(c));
    G.secret.songDeck = shuffle(ctx, G.secret.songDeck);
    G.secret.jinnDeck = shuffle(ctx, G.secret.jinnDeck);
    LatePlanID.forEach(p => G.secret.planDeck.push(p));
    G.secret.planDeck = shuffle(ctx, G.secret.planDeck);
}
export const addMidTermCard = (G: SongJinnGame, ctx: Ctx) => {
    SongMidCardID.forEach(c => G.secret.songDeck.push(c));
    JinnMidCardID.forEach(c => G.secret.jinnDeck.push(c));
    G.secret.songDeck = shuffle(ctx, G.secret.songDeck);
    G.secret.jinnDeck = shuffle(ctx, G.secret.jinnDeck);

    MidPlanID.forEach(p => G.secret.planDeck.push(p));
    G.secret.planDeck = shuffle(ctx, G.secret.planDeck);
}
export const troopEmpty = (troop: Troop) => {
    return troop.u.filter(c => c > 0).length === 0
}

export const canChoosePlan = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, plan: PlanID) => {
    if ([PlanID.J23, PlanID.J24].includes(plan)) {
        const ctr = getCountryById(pid);
        if (ctr === Country.JINN && plan === PlanID.J23) {
            return false
        }
        if (ctr === Country.SONG && plan === PlanID.J24) {
            return false
        }
    }
    return pid2pub(G, pid).military >= getPlanById(plan).level;
}

export const checkPlan = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, plan: PlanID) => {
    const planObj = getPlanById(plan);
    const pub = pid2pub(G, pid);
    const filtered = planObj.provinces.filter(prov => pub.provinces.includes(prov));
    if (SpecialPlan.includes(plan)) {
        pub.specialPlan = filtered.length;
    }
    return filtered.length === planObj.provinces.length;
}


export const endTurnCheck = (G: SongJinnGame, ctx: Ctx) => {
    const log = [
        `t${G.turn}endTurnCheck`
    ];
    if (G.turn === 2) {
        addMidTermCard(G, ctx);
    }
    if (G.turn === 6) {
        addLateTermCard(G, ctx);
    }
    if (G.events.includes(ActiveEvents.YueShuaiZhiLai)) {
        log.push(`|RemoveYueShuaiZhiLai|${G.events.toString()}`);
        G.events.splice(G.events.indexOf(ActiveEvents.YueShuaiZhiLai), 1);
        log.push(`|after|${G.events.toString()}`);
    }
    if (G.events.includes((ActiveEvents.LiGang))) {
        log.push(`|RemoveLiGang|${G.events.toString()}`);
        G.events.splice(G.events.indexOf(ActiveEvents.LiGang), 1);
        log.push(`|after|${G.events.toString()}`);
    }
    if (G.turn >= MAX_ROUND) {
        log.push(`|shaoXingHeYi`);
        const songScore = getSongScore(G);
        const jinnScore = getJinnScore(G);
        log.push(`|${songScore}songScore`);
        log.push(`|${jinnScore}jinnScore`);
        const winner = jinnScore > songScore ? SJPlayer.P2 : SJPlayer.P1;
        log.push(`|${winner}winner`);
        ctx.events?.endGame({
            winner: winner,
            reason: VictoryReason.ShaoXingHeYi
        })
    } else {
        log.push(
            `moveTurnMarker`
        );
        G.turn++;
        log.push(`turn|${G.turn}`);
    }
    logger.debug(
        `${G.matchID}|${log.join('')}`
    );
}
export const endRoundCheck = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`t${G.turn}r${G.round}|endRoundCheck`];
    G.op = 0;
    if (G.order[1] === ctx.playerID) {
        log.push(`|second`);
        if (
            // G.round >= 2
            G.round >= MAX_ROUND
        ) {
            log.push(
                `|action|end|resolvePlan`
            );
            ctx.events?.setPhase('resolvePlan')
        } else {
            G.round++;
            log.push(
                `|r${G.round}start`
            );
        }
    } else {
        log.push(
            `|firstPlayer`
        );
    }
    if (G.events.includes(ActiveEvents.LiuJiaShenBing)) {
        log.push(`|rm|LiuJiaShenBing`);
        G.events.splice(G.events.indexOf(ActiveEvents.LiuJiaShenBing), 1);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const returnDevCardCheck = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, cid: SJEventCardID) => {
    const pub = pid2pub(G, pid);
    const card = sjCardById(cid);
    return totalDevelop(G, ctx, pid) - pub.usedDevelop > card.op;
}
export const heYiCheck = (G: SongJinnGame, ctx: Ctx) => {
    return G.policy < 0;
}
export const doGeneralSkill = (G: SongJinnGame, pid: PlayerID, g: General) => {
    const log = [`doGeneralSkill|${pid}|${g}|${getGeneralNameByPid(pid, g)}`]
    const pub = pid2pub(G, pid);
    log.push(`|before${pub.generalSkill}`);
    pub.generalSkill[g] = false;
    if (pid === SJPlayer.P2 && g === JinnGeneral.LouShi) {
        G.op = 2;
    }
    log.push(`|after${pub.generalSkill}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const changeCivil = (G: SongJinnGame, pid: PlayerID, a: number) => {
    const pub = pid2pub(G, pid);
    if (pub.civil + a < 1) {
        pub.civil = 1;
    } else {
        if (pub.civil + a > 7) {
            pub.civil = 7;
        } else {
            pub.civil += a;
        }
    }
    if (pub.civil > pub.maxCivil) {
        if (pub.maxCivil < 4 && pub.civil >= 4) {
            if (pid === SJPlayer.P1) {
                policyUp(G, 1);
            } else {
                colonyUp(G, 1);
            }
        }
        if (pub.maxCivil < 5 && pub.civil >= 5) {
            pub.maxCivil = 5;
        }
        if (pub.maxCivil < 6 && pub.civil >= 6) {

            pub.maxCivil = 6;
        }
        if (pub.maxCivil < 7 && pub.civil >= 7) {
            pub.maxCivil = 7;
        }
    }
}
export const doRemoveNation = (G: SongJinnGame, nation: NationID) => {
    G.removedNation.push(nation);
    if (G.song.nations.includes(nation)) {
        G.song.nations.splice(G.song.nations.indexOf(nation), 1);
    }
    if (G.jinn.nations.includes(nation)) {
        G.jinn.nations.splice(G.jinn.nations.indexOf(nation), 1);
    }
}
export const doControlProvince = (G: SongJinnGame, pid: PlayerID, prov: ProvinceID) => {
    const log = [`doControlProvince`];
    const pub = pid2pub(G, pid);
    const oppo = oppoPub(G, pid);
    if (pub.provinces.includes(prov)) {
        log.push(`|hasProv${prov}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (oppo.provinces.includes(prov)) {
        log.push(`|takeFromOpponent`);
        log.push(`|b|${pub.provinces}`);

        oppo.provinces.splice(oppo.provinces.indexOf(prov), 1);
        log.push(`|b|${pub.provinces}`);

    }
    if (G.qi.includes(prov) && pid === SJPlayer.P1) {
        log.push(`|Qi|remove|b|${G.qi}`);
        G.qi.splice(G.qi.indexOf(prov), 1);
        log.push(`|b|${G.qi}`);
    }
    log.push(`|b|${pub.provinces}`);
    pub.provinces.push(prov);
    log.push(`|b|${pub.provinces}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const doControlCity = (G: SongJinnGame, pid: PlayerID, cid: CityID) => {
    const log = [`doControlCity`];
    const pub = pid2pub(G, pid);
    const oppo = oppoPub(G, pid);
    if (pub.cities.includes(cid)) {
        log.push(`|hasCity`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (oppo.cities.includes(cid)) {
        log.push(`|takeFromOpponent`);
        oppo.cities.splice(oppo.cities.indexOf(cid), 1);
    }
    log.push(`|b|${pub.cities}`);
    pub.cities.push(cid);
    log.push(`|a|${pub.cities}`);
    // TODO control all cities change prov control
    const prov = getCityById(cid).province;
    const province = getProvinceById(prov);
    const all = [...province.capital, ...province.other];
    if (
        all.filter(c => pub.cities.includes(c)).length === all.length
    ) {
        log.push(`|control${prov}`);
        doControlProvince(G, pid, prov);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const doLoseProvince = (G: SongJinnGame, pid: PlayerID, prov: ProvinceID, opponent: boolean) => {
    const pub = pid2pub(G, pid);
    const oppo = oppoPub(G, pid)

    if (pub.provinces.includes(prov)) {
        if (pid === SJPlayer.P1) {
            if (prov === ProvinceID.YANJINGLU || prov === ProvinceID.JINGJILU || prov === ProvinceID.FUJIANLU) {
                if (G.events.includes(ActiveEvents.XiangHaiShangFaZhan) && prov === ProvinceID.FUJIANLU) {
                    policyDown(G, 1);
                    if (pub.corruption > 0) {
                        pub.corruption--;
                    }
                }
            } else {
                policyDown(G, 1);
                if (pub.corruption > 0) {
                    pub.corruption--;
                }
            }
        }
        if (pub.provinces.includes(prov)) {
            pub.provinces.splice(pub.provinces.indexOf(prov), 1);
        }
        if (opponent) {
            oppo.provinces.push(prov);
        }
    }
}
export const changeMilitary = (G: SongJinnGame, pid: PlayerID, a: number) => {
    const pub = pid2pub(G, pid);
    if (pub.military + a < 1) {
        pub.military = 1;
    } else {
        if (pub.military + a > 7) {
            pub.military = 7;
        } else {
            pub.military += a;
        }
    }
    if (pub.military > pub.maxMilitary) {
        if (pub.maxMilitary < 4 && pub.military >= 4) {
            G.op += 2;
            pub.maxMilitary = 4;
        }
        if (pub.maxMilitary < 5 && pub.military >= 5) {
            if (pid === SJPlayer.P1) {

                doRecruit(G, [0, 0, 0, 0, 0, 1], SJPlayer.P1);
            } else {
                doRecruit(G, [0, 0, 0, 1, 0, 0, 0], SJPlayer.P2);
            }
            pub.maxMilitary = 5;
        }
        if (pub.maxMilitary < 6 && pub.military >= 6) {
            if (pid === SJPlayer.P1) {
                doRecruit(G, [0, 0, 0, 0, 1, 0], SJPlayer.P1);
            } else {
                doRecruit(G, [0, 0, 0, 0, 1, 0, 0], SJPlayer.P2);
            }
            pub.maxMilitary = 6;
        }
        if (pub.maxMilitary < 7 && pub.military >= 7) {
            pub.maxMilitary = 7;
        }
    }
}
export const doPlaceUnit = (G: SongJinnGame, units: number[], country: Country, place: TroopPlace) => {
    const log = [
        `doPlaceUnit|${unitsToString(units)}${country}${placeToStr(place)}`
    ];

    const target = ctr2pid(country);
    const pub = pid2pub(G, target);
    pub.standby.forEach((u, idx) => {
        if (u < units[idx]) {
            log.push(
                `${u}<${units[idx]}|INVALID_MOVE`
            );
            logger.debug(
                `${G.matchID}|${log.join('')}`
            );
            return INVALID_MOVE;
        }
    });

    const t = country === Country.SONG ? getSongTroopByPlace(G, place) : getJinnTroopByPlace(G, place);
    if (t === null) {
        log.push(
            `noTroop`
        );
        let city = null;
        if (isRegionID(place)) {

            city = getRegionById(place).city;
            log.push(
                `|${city}`
            );
        }
        pub.troops.push({
            u: units,
            g: country,
            c: city,
            p: place,
        })
        for (let i = 0; i < units.length; i++) {
            pub.standby[i] -= units[i];
        }
    } else {
        log.push(
            `${JSON.stringify(t)}`
        );
        for (let i = 0; i < units.length; i++) {
            t.u[i] += units[i];
            pub.standby[i] -= units[i];
        }
        log.push(
            `|after|${unitsToString(t.u)}${JSON.stringify(t)}`
        );
    }
    logger.debug(
        `${G.matchID}|${log.join('')}`
    );
}

export function getCardLabel(c: SJEventCardID) {
    const cardById = sjCardById(c);
    return cardById.name + '|' + cardById.op + (cardById.remove ? '*' : '');
}

export function canForceRoundTwo(G: SongJinnGame) {
    const ci = G.combat;

    return !ci.roundTwo &&
        ci.atk === Country.SONG &&
        ciDefGenerals(G).includes(SongGeneral.YueFei);
}