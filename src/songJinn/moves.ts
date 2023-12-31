import {Ctx, LongFormMove} from "boardgame.io";
import {
    accumulator,
    ActiveEvents,
    BaseCardID,
    BeatGongChoice,
    CityID,
    CombatPhase,
    CombatType,
    Country,
    DevelopChoice,
    General,
    isCityID,
    isRegionID,
    JinnBaseCardID,
    JinnGeneral,
    LetterOfCredence,
    NationID,
    PendingEvents,
    PlanID,
    PlayerPendingEffect,
    ProvinceID,
    SJEventCardID,
    SJPlayer,
    SongBaseCardID,
    SongJinnGame,
    Troop,
    TroopPlace
} from "./constant/general";
import {logger} from "../game/logger";
import {INVALID_MOVE} from "boardgame.io/core";
import {actualStage, shuffle} from "../game/util";
import {getRegionById} from "./constant/regions";
import {changePlayerStage} from "../game/logFix";
import {merge} from "lodash";

import {
    addTroop,
    canForceRoundTwo,
    canRoundTwo,
    cardToSearch,
    changeCivil,
    changeMilitary,
    checkMoveDst,
    checkRecruitCivil,
    checkSongLoseEmperor,
    ciAtkInfo,
    ciAtkPid,
    ciAtkTroop,
    ciCtrInfo,
    ciDefInfo,
    ciDefPid,
    ciDefTroop,
    ciSongTroop,
    colonyDown,
    colonyUp,
    continueCombat,
    ctr2pid,
    ctr2pub,
    currentProvStatus,
    damageTaken,
    doControlCity,
    doControlProvince,
    doGeneralSkill,
    doLoseProvince,
    doMoveTroopAll,
    doMoveTroopPart,
    doPlaceUnit,
    doRecruit,
    doRemoveNation,
    drawCardForJinn,
    drawCardForSong,
    drawPhaseForPlayer,
    drawPlanForPlayer,
    endCombat, endDraw,
    endRoundCheck,
    getCombatStateById,
    getCountryById,
    getGeneralNameByCountry,
    getJinnTroopByCity,
    getJinnTroopByPlace,
    getOpponentPlaceTroopByCtr,
    getPlanById,
    getSimpleTroopText,
    getSongTroopByCity,
    getSongTroopByPlace,
    getStage,
    getTroopByCountryPlace,
    heYiChange,
    heYiCheck,
    isFast,
    moveGeneralByCountry,
    moveGeneralByPid,
    moveGeneralToReady,
    nationMoveJinn,
    nationMoveSong,
    oppoPid,
    oppoPlayerById,
    oppoPub,
    optionToPlace,
    pid2cci,
    pid2ctr,
    pid2pub,
    placeToStr,
    playerById,
    policyDown,
    policyUp,
    removeGeneral,
    removeReadyUnitByCountry,
    removeUnitByCountryPlace,
    removeZeroTroop,
    rollDiceByPid,
    roundTwo,
    setTroopPlaceByCtr,
    sjCardById,
    songLoseEmperor,
    startCombat,
    totalDevelop,
    troopEmpty,
    troopEndurance,
    unitsToString,
    weiKunTroop,
    zhuDuiShiYuanChengJinn
} from "./util";
import {getCityById} from "./constant/city";

export const opponentMove: LongFormMove = {
    move: (G, ctx) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.opponentMove()`);

        const oppo = pid === SJPlayer.P1 ? SJPlayer.P2 : SJPlayer.P1;
        if (pid === ctx.currentPlayer) {
            if (getStage(ctx) === 'takeDamage') {
                changePlayerStage(G, ctx, 'takeDamage', oppo);
            } else {
                changePlayerStage(G, ctx, 'react', oppo);
            }
        } else {
            if (getStage(ctx) === 'takeDamage') {
                changePlayerStage(G, ctx, 'takeDamage', oppo);
            } else {
                ctx.events?.endStage();
            }
        }
    }

}

interface ICheckProvince {
    prov: ProvinceID,
    text: string
}

export const modifyGameState: LongFormMove = {
    move: (G, ctx, arg: Partial<SongJinnGame>) => {
        const pid = ctx.playerID;
        const log = [`modifyGameState`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        if (arg === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.modifyGameState(${JSON.stringify(arg)})`);
        log.push(`|${JSON.stringify(arg)}|arg\n`);
        log.push(`|${JSON.stringify(G)}|G\n`);
        G = merge(G, arg);
        log.push(`|${JSON.stringify(G)}|G\n`);
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    client: false
}

export const checkProvince: LongFormMove = {
    move: (G: SongJinnGame, ctx, arg: ICheckProvince) => {
        const pid = ctx.playerID;
        const log = [`checkProvince`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.checkProvince(${JSON.stringify(arg)})`);
        const {prov} = arg;
        const provStatus = currentProvStatus(G, prov);
        switch (provStatus) {
            case "金控制":
                doControlProvince(G, ctx, SJPlayer.P2, prov);
                break;
            case "宋控制":
                doControlProvince(G, ctx, SJPlayer.P1, prov);
                break;
            case "战争状态":
                const songProv = G.song.provinces;
                if (songProv.includes(prov)) {
                    doLoseProvince(G, ctx, SJPlayer.P1, prov, false);
                }
                const jinnProv = G.jinn.provinces;
                if (jinnProv.includes(prov)) {
                    doLoseProvince(G, ctx, SJPlayer.P2, prov, false);
                }
                break;
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const controlProvince: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: ProvinceID) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.controlProvince(${JSON.stringify(args)})`);
        const log = [`p${pid}.controlProvince`];
        const pub = pid2pub(G, pid);
        log.push(`|before|${pub.provinces}`);
        doControlProvince(G, ctx, pid, args);
        log.push(`|after|${pub.provinces}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}
export const controlCity: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: CityID) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moves.controlCity(${JSON.stringify(args)})`);
        const log = [`p${pid}.controlCity`];
        // const ctr = getCountryById(ctx.playerID);
        const pub = pid2pub(G, pid);
        // const player = playerById(G, ctx.playerID);
        log.push(`|${pub.cities}`);
        doControlCity(G, ctx, pid, args);
        log.push(`|after|${pub.cities}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IMarchArgs {
    src: TroopPlace;
    mid?: TroopPlace;
    dst: TroopPlace;
    country: Country;
    units: number[];
    generals: General[];
}

export const march: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, arg: IMarchArgs) => {
        const {src, dst, country, generals, units, mid} = arg;
        const pid = ctx.playerID;
        logger.info(`p${pid}.moves.march(${JSON.stringify(arg)})`);
        if (pid === undefined) {
            return INVALID_MOVE;
        }

        const log = [`p${pid}|march|src${placeToStr(src)}|dst${placeToStr(dst)}`];
        if (units.reduce(accumulator) === 0) {
            log.push(`|no|units|cannot|move`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        // @ts-ignore
        if (dst === undefined || dst === "" || dst === null) {
            return INVALID_MOVE;
        }
        const parsedDst = typeof dst === "number" ? dst : parseInt(dst);
        const newDst =
            parsedDst === undefined || parsedDst === null || isNaN(parsedDst)
                ? dst : parsedDst;
        const ctr = getCountryById(pid);
        log.push(`|${typeof dst}typeof dst`);
        log.push(`|${typeof newDst}typeof newDst`);
        // const player = playerById(G, ctx.playerID);
        log.push(`|parsed${JSON.stringify(newDst)}`);
        if (G.op > 0) {
            log.push(`|${G.op}G.op`);
            G.op--;
            log.push(`|${G.op}G.op`);
        }
        const t = getTroopByCountryPlace(G, arg.country, src);
        if (t === null) {
            log.push(`noTroop`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        log.push(`|${country}|country`);
        log.push(`|${t.g}|t.g`);
        generals.forEach(gen => moveGeneralByCountry(G, t.g, gen, newDst));
        log.push(`|${JSON.stringify(t)}`);
        if (t.u.filter((u, i) => units[i] === u).length === units.length) {
            log.push(`|all`);
            doMoveTroopAll(G, ctx, src, newDst, ctr);
        } else {
            log.push(`|part`);
            doMoveTroopPart(G, src, newDst, ctr, units, generals);
        }

        if (mid !== undefined) {
            log.push(`|${placeToStr(mid)}|mid`);
            const oppoMidT = getOpponentPlaceTroopByCtr(G, t.g, mid);
            if (oppoMidT !== null) {
                log.push(`|${getSimpleTroopText(G, oppoMidT)}|oppoMidT`);
                const midEn = troopEndurance(G, oppoMidT);
                if (midEn !== 0) {
                    log.push(`|cannot|combat|on|mid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                } else {
                    removeZeroTroop(G, ctx, oppoMidT);
                }
            } else {
                if (isRegionID(mid)) {
                    const cid = getRegionById(mid).city;
                    log.push(`|${cid}|cid`);
                    if (cid !== null) {
                        const oppoCityTroop = getOpponentPlaceTroopByCtr(G, t.g, cid);
                        if (oppoCityTroop === null) {
                            if (G.jinn.generalPlace[JinnGeneral.YinShuKe] === dst) {
                                log.push(`|yinShuKe`);
                                doPlaceUnit(G, ctx, [1, 0, 0, 0, 0, 0, 0], Country.JINN, mid);
                            }
                        }
                    }
                }
            }
        }
        checkMoveDst(G, ctx, src, newDst, t, mid);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}


export const letter: LongFormMove = {
    move: (G, ctx, arg: LetterOfCredence) => {

        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moves.letter(${JSON.stringify(arg)});`)
        const player = playerById(G, pid);
        const pub = pid2pub(G, pid);
        if (player.hand.includes(arg.card)) {
            player.hand.splice(player.hand.indexOf(arg.card), 1);
            pub.lodNations.push(arg.nation);
        } else {
            return INVALID_MOVE;
        }
        player.lod.push(arg);
        if (isFast(G)) {
            endRoundCheck(G, ctx);
            ctx.events?.endTurn();
        }
    }
}

// export const chooseRegion: LongFormMove = {
//     move: (G: SongJinnGame, ctx: Ctx, args: RegionID) => {
//         if (ctx.playerID === undefined) {
//             return INVALID_MOVE;
//         }
//         logger.info(`p${ctx.playerID}.chooseRegion(${JSON.stringify(args)})`);
//         const log = [`p${ctx.playerID}.chooseRegion`];
//         const ctr = getCountryById(ctx.playerID);
//         const pub = getStateById(G, ctx.playerID);
//         const player = playerById(G, ctx.playerID);
//         const event = G.pending.events.pop()
//         if (event !== undefined) {
//             switch (event) {
//                 case PendingEvents.PlaceUnitsToRegion:
//
//                     break;
//                 case PendingEvents.XiJunQuDuan:
//                     doPlaceUnit(G, [1, 0, 0, 0, 0, 0], Country.SONG, args);
//                     ctx.events?.endStage();
//                     break
//
//
//             }
//         } else {
//             log.push(`|no|events|endStage`);
//             ctx.events?.endStage();
//         }
//
//         logger.debug(`${log.join('')}`);
//     }
// }
//
// export const chooseProvince: LongFormMove = {
//     move: (
//         G: SongJinnGame, ctx,
//         // arg: ProvinceID
//     ) => {
//         const pid = ctx.playerID;
//         if (pid === undefined) {
//             return INVALID_MOVE;
//         }
//         // const ctr = getCountryById(ctx.playerID);
//         // const pub = pid2pub(G, ctx.playerID);
//         // const player = playerById(G, ctx.playerID);
//     }
// }

interface ITakeDamageArgs {
    c: Country,
    city: CityID;
    src: TroopPlace,
    standby: number[],
    ready: number[]
}

export const takeDamage: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx, arg: ITakeDamageArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.takeDamage(${JSON.stringify(arg)})`);
        const {c, src, standby, ready, city} = arg;
        const pub = ctr2pub(G, c);
        const log = [`takeDamage|${src}|${placeToStr(src)}`];
        log.push(`|si${unitsToString(standby)}|kui${unitsToString(ready)}`);

        let troop = c === Country.SONG ? getSongTroopByPlace(G, src) : getJinnTroopByPlace(G, src);
        if (troop === null) {
            log.push(`|noPlaceTroop|checkCity`);
            troop = c === Country.SONG ? getSongTroopByPlace(G, city) : getJinnTroopByPlace(G, city);
            if (troop === null) {
                log.push(`|noCityTroop|invalid`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return INVALID_MOVE;
            }
        }
        const ci = G.combat;
        log.push(`|${JSON.stringify(troop)}|troop`);
        log.push(`|before|${unitsToString(pub.ready)}|${unitsToString(pub.standby)}`);
        for (let i = 0; i < arg.standby.length; i++) {
            troop.u[i] -= standby[i];
            troop.u[i] -= ready[i];
            if (troop.u[i] < 0) {
                log.push(`|${troop.u[i]}<0`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return INVALID_MOVE;
            }
            pub.standby[i] += (arg.standby)[i];
            pub.ready[i] += (arg.ready)[i];
        }
        log.push(`|${JSON.stringify(troop)}|troop`);
        log.push(`|after|${unitsToString(pub.ready)}|${unitsToString(pub.standby)}`);
        if (troop.g === Country.SONG) {
            if (troop.u.length > 6) {
                log.push(`|${JSON.stringify(troop.u)}|troop.u`);
                const extra = troop.u.pop();
                log.push(`|${extra}|extra`);
                log.push(`|${JSON.stringify(troop.u)}|troop.u`);
            }
        }

        const readyEndurance = troopEndurance(G, {
            g: c,
            c: null,
            p: src,
            u: ready
        })
        const standbyEndurance = troopEndurance(G, {
            g: c,
            c: null,
            p: src,
            u: standby
        })
        log.push(`|${readyEndurance}|readyEndurance`);
        log.push(`|${standbyEndurance}|standbyEndurance`);
        const cci = ciCtrInfo(G, c);
        log.push(`|${cci.damageLeft}|cci.damageLeft`);
        cci.damageLeft -= readyEndurance;
        cci.damageLeft -= standbyEndurance;
        log.push(`|${cci.damageLeft}|cci.damageLeft`);
        // TODO check left damage < 0
        // retain empty troop for unitEndurance check in battle
        if (actualStage(G, ctx) === 'takeDamage') {
            const atkEn = troopEndurance(G, ciAtkTroop(G));
            const defT = ciDefTroop(G);
            log.push(`|${JSON.stringify(defT)}|defT`);
            const defEn = troopEndurance(G, defT);
            const curEn = ci.atk === pid ? atkEn : defEn;
            log.push(`|in|stage|combat`);
            log.push(`|${JSON.stringify(atkEn)}|atkEn`);
            log.push(`|${JSON.stringify(defEn)}|defEn`);
            log.push(`|${curEn}|curEn`);
            if (ci.phase === CombatPhase.ZhuDuiShiY) {
                if (pid === SJPlayer.P1) {
                    log.push(`|continueCombat`);
                    continueCombat(G, ctx);
                } else {
                    log.push(`|zhuDuiShiYuanChengJinn`);
                    zhuDuiShiYuanChengJinn(G, ctx);
                }
            } else {
                if (ci.phase === CombatPhase.ZhuDuiShiJFSong) {
                    log.push(`|continueCombat`);
                    continueCombat(G, ctx);
                } else {
                    if (G.order.indexOf(pid as SJPlayer) === 0) {
                        log.push(`|firstPlayer`);
                        const nextPid = G.order[1];
                        const dmg = pid2cci(G, nextPid).damageLeft;
                        log.push(`|${dmg}|dmg`);
                        if (dmg <= 0) {
                            log.push(`|dmg<0|damageTaken`);
                            damageTaken(G, ctx);
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return
                        } else {
                            log.push(`|p${nextPid}takeDamage`);
                            changePlayerStage(G, ctx, 'takeDamage', nextPid);
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return
                        }
                    } else {
                        log.push(`|secondPlayer|damageTaken`);
                        damageTaken(G, ctx);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return
                    }
                }
            }

        } else {
            if (troopEmpty(troop)) {
                log.push(`|rmTroop`);
                if (pub.troops.includes(troop)) {
                    pub.troops.splice(pub.troops.indexOf(troop), 1);
                }
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IPlaceUnitsToTroopArgs {
    place: TroopPlace,
    units: number[],
    country: Country
}

interface IGeneralSkillArgs {
    country: Country,
    general: General
}

export const generalSkill: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IGeneralSkillArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moves.generalSkill(${JSON.stringify(args)})`);
        const log = [`p${pid}.generalSkill${getGeneralNameByCountry(args.country, args.general)}`];
        doGeneralSkill(G, pid, args.general);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const placeUnit: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IPlaceUnitsToTroopArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }

        logger.info(`p${ctx.playerID}.placeUnit(${JSON.stringify(args)})`);
        const log = [`p${ctx.playerID}.placeUnit`];
        const {place, units, country} = args;
        if (units.reduce(accumulator) === 0) {
            log.push(`|0Units|invalid`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        doPlaceUnit(G, ctx, units, country, place);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IDeployGeneral {
    country: Country,
    general: General;
    dst: TroopPlace;
}

export const deployGeneral: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IDeployGeneral) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moves.deployGeneral(${JSON.stringify(args)})`);
        const log = [`p${pid}.deployGeneral`];
        const {general, dst} = args;
        let newDst = dst;
        if (isCityID(dst)) {
            const weiKunTroop = getTroopByCountryPlace(G, pid2ctr(pid), dst);
            if (weiKunTroop === null) {
                log.push(`|hasOwnTroop`);
                // @ts-ignore
                newDst = getCityById(dst).region;
                log.push(`|${newDst}`);
            }
        }
        moveGeneralByPid(G, pid, general, newDst);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IRescueGeneral {
    card: SJEventCardID,
    general: General
}

export const rescueGeneral: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IRescueGeneral) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moves.rescueGeneral(${JSON.stringify(args)})`);
        const log = [`p${pid}.rescueGeneral`];
        const {general, card} = args;
        const pub = pid2pub(G, pid);
        if (pub.develop.includes(card)) {
            pub.develop.splice(pub.develop.indexOf(card), 1);
            pub.discard.push(card)
            log.push(`|discard${pub.discard}`);
        } else {
            return INVALID_MOVE;
        }
        if (G.pending.generals.includes(general)) {
            G.pending.generals.splice(G.pending.generals.indexOf(general), 1);
        }
        moveGeneralToReady(G, pid, general);
        if (G.pending.generals.length === 0) {
            ctx.events?.endStage();
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IPlaceNewTroopArgs {
    dst: TroopPlace,
    units: number[],
    country: Country
}

export const placeTroop: LongFormMove = {
    move: (G, _ctx, {dst, units, country}: IPlaceNewTroopArgs) => {
        const pub = country === Country.SONG ? G.song : G.jinn;
        pub.troops.push({
            p: dst,
            u: units,
            c: null,
            g: country
        })
    }
}


export interface IRemoveReadyUnitArgs {
    units: number[];
    country: Country;
}


export const removeReadyUnit: LongFormMove = {
    move: (G, ctx, arg: IRemoveReadyUnitArgs) => {
        const pid = ctx.playerID;
        const log = [`removeReadyUnit`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.removeReadyUnit(${JSON.stringify(arg)})`);
        // const ctr = getCountryById(pid);
        // const pub = pid2pub(G, pid);
        // const player = playerById(G, pid);
        const {units, country} = arg;
        if (units.reduce(accumulator) === 0) {
            log.push(`|9Units|invalid`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        removeReadyUnitByCountry(G, units, country);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IRemoveUnitArgs {
    src: TroopPlace;
    units: number[];
    country: Country
}

export const removeUnit: LongFormMove = {
    move: (G, ctx, arg: IRemoveUnitArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.removeUnit(${JSON.stringify(arg)})`);
        const {src, units, country} = arg;
        if (units.reduce(accumulator) === 0) {
            return INVALID_MOVE;
        }
        removeUnitByCountryPlace(G, ctx, units, country, src);
    }
}

export interface IDeployUnitArgs {
    city: CityID;
    units: number[],
    country: Country
}

function doDeployUnits(G: SongJinnGame, _ctx: Ctx, country: Country, units: number[], city: CityID) {
    const log = [`${country}`];
    const target = ctr2pid(country);
    const pub = pid2pub(G, target);
    pub.ready.forEach((u, idx) => {
        if (u < units[idx]) {
            log.push(`${u}<${units[idx]}|INVALID_MOVE`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
    })
    const t = country === Country.SONG ? getSongTroopByCity(G, city) : getJinnTroopByCity(G, city);
    if (t === null) {
        log.push(`|noTroop|insertNew`);
        pub.troops.push({
            u: units,
            g: country,
            c: city,
            p: getCityById(city).region,
        });
        for (let i = 0; i < units.length; i++) {
            pub.ready[i] -= units[i];
        }
    } else {
        log.push(`${JSON.stringify(t)}`);
        for (let i = 0; i < units.length; i++) {
            pub.ready[i] -= units[i];
            t.u[i] += units[i];
        }
        log.push(`|after|${unitsToString(t.u)}${JSON.stringify(t)}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const deploy: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IDeployUnitArgs) => {
        logger.info(`p${ctx.playerID}.deploy(${JSON.stringify(args)})`);
        const {city, country, units} = args;
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        if (city === null) {
            return INVALID_MOVE;
        }
        doDeployUnits(G, ctx, country, units, city);
    }
}


export const discard: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, c: BaseCardID) => {
        const log = [`discard|${c}`];
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const pub = pid2pub(G, pid);
        const player = playerById(G, pid);
        if (player.hand.includes(c)) {
            log.push(`|${JSON.stringify(player.hand)}|player.hand`);
            log.push(`|${JSON.stringify(pub.discard)}|pub.discard`);
            player.hand.splice(player.hand.indexOf(c), 1);
            pub.discard.push(c);
            log.push(`|${JSON.stringify(player.hand)}|player.hand`);
            log.push(`|${JSON.stringify(pub.discard)}|pub.discard`);
        } else {
            log.push(`|${JSON.stringify(player.hand)}|player.hand`);
            log.push(`|not|in|hand|invalid`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        if(ctx.phase === 'draw' && getStage(ctx) === 'discard') {
            if(pub.effect.includes(PlayerPendingEffect.SearchCard)){
                log.push(`|anotherSearch`);
                changePlayerStage(G, ctx, 'search', pid);
            } else {
                log.push(`|endPhase`);
                endDraw(G, ctx);
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}


export const tieJun: LongFormMove = {
    move: (G, ctx, args: SJEventCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(args)) {
            player.hand.splice(player.hand.indexOf(args), 1);
        }
    }
}
// export const chooseUnit: LongFormMove = {
//     move: (G, ctx, args) => {
//
//     }
// }
interface IRollDiceArgs {
    count: number,
    idx: number
}

export const rollDices: LongFormMove = {
    client: false,
    move: (G, ctx, args: IRollDiceArgs,) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const {count} = args;
        if (count === undefined) {
            rollDiceByPid(G, ctx, ctx.playerID, 5);
        } else {
            const newCount = count > 25 ? 25 : count;
            rollDiceByPid(G, ctx, ctx.playerID, newCount);

        }
    },
    undoable: false
}

export const removeCompletedPlan: LongFormMove = {
    client: false,
    move: (G, ctx, arg: PlanID) => {
        const pid = ctx.playerID;
        const log = [`removeCompletedPlan`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.removeCompletedPlan(${JSON.stringify(arg)})`);
        if (G.song.completedPlan.includes(arg)) {
            log.push(`|${JSON.stringify(G.song.completedPlan)}G.song.completedPlan`);
            G.song.completedPlan.splice(G.song.completedPlan.indexOf(arg), 1);
            log.push(`|${JSON.stringify(G.song.completedPlan)}G.song.completedPlan`);
        }
        if (G.jinn.completedPlan.includes(arg)) {
            log.push(`|${JSON.stringify(G.jinn.completedPlan)}G.jinn.completedPlan`);
            G.jinn.completedPlan.splice(G.jinn.completedPlan.indexOf(arg), 1);
            log.push(`|${JSON.stringify(G.jinn.completedPlan)}G.jinn.completedPlan`);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const recruitPuppet: LongFormMove = {
    client: false,
    move: (G, ctx, dst: CityID) => {
        const log = [`recruitPuppet|${dst}`];
        if (ctx.playerID !== SJPlayer.P2) {
            return INVALID_MOVE;
        }
        const pub = G.jinn;
        let qi = false;
        if (pub.standby[5] > 0) {
            log.push(`|useQian`);
        } else {
            if (G.events.includes(ActiveEvents.JianLiDaQi)) {
                if (pub.standby[6] > 0) {
                    log.push(`|useQi`);
                } else {
                    log.push(`|noQiJun`);
                    return INVALID_MOVE;
                }
                qi = true;
            } else {
                log.push(`|noDaQi`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return INVALID_MOVE;
            }
        }

        log.push(`|${pub.standby}|pub.standby`);
        const jt = getJinnTroopByCity(G, dst);
        if (jt === null) {
            if (qi) {
                addTroop(G, getCityById(dst).region, [0, 0, 0, 0, 0, 0, 1], Country.JINN);
            } else {
                addTroop(G, getCityById(dst).region, [0, 0, 0, 0, 0, 1, 0], Country.JINN);
            }
        } else {
            if (qi) {
                pub.standby[6]--;
                jt.u[6]++
            } else {
                pub.standby[5]--;
                jt.u[5]++;
            }
            log.push(`|${getSimpleTroopText(G, jt)}|jt`);
        }
        log.push(`|${pub.standby}|pub.standby`);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IMoveGeneralArgs {
    dst: TroopPlace,
    general: General,
    country: Country
}

export const moveGeneral: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IMoveGeneralArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.moveReadyGeneral(${JSON.stringify(args)})`);
        const {dst, general} = args;
        const log = [`p${ctx.playerID}.moveReadyGeneral`];
        moveGeneralByPid(G, ctx.playerID, general, dst);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const retreat: LongFormMove = {
    move: (G, ctx, arg: IMoveTroopArgs) => {
        const pid = ctx.playerID;
        const log = [`retreat`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.retreat(${JSON.stringify(arg)})`);
        const {src, dst, country} = arg;
        doMoveTroopAll(G, ctx, src.p, dst, country);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IMoveTroopArgs {
    src: Troop;
    dst: TroopPlace;
    country: Country;
    units: number[];
    generals: General[];
}

export const moveTroop: LongFormMove = {
    move: (G, ctx, args: IMoveTroopArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moves.moveTroop(${JSON.stringify(args)})`);
        const log = [`moveTroop`];
        const {src, dst, units, generals} = args;
        const srcPlace = src.p;
        const ctr = src.g;
        if (units.reduce(accumulator) === 0) {
            log.push(`|no|units|cannot|move`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        if (src.u.filter((u, i) => units[i] === u).length === units.length) {
            log.push(`|all`);
            doMoveTroopAll(G, ctx, srcPlace, dst, ctr);
        } else {
            log.push(`|part`);
            doMoveTroopPart(G, srcPlace, dst, ctr, units, generals);
        }
        checkMoveDst(G, ctx, srcPlace, dst, src);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IShowLettersArgs {
    letters: LetterOfCredence[],
    nations: NationID[]
}

export const showLetters: LongFormMove = {
    move: (G, ctx, args: IShowLettersArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        if (G.order.indexOf(pid as SJPlayer) === 0) {
            ctx.events?.endTurn();
        } else {
            ctx.events?.endPhase();
        }
        const pub = pid2pub(G, pid);
        const p = playerById(G, pid);
        p.lod.forEach(l => pub.discard.push(l.card));
        p.lod = [];
        pub.lodNations = [];
        logger.info(`p${pid}.moves.showLetters(${JSON.stringify(args)})`);
    }
}
export const jianLiDaQi: LongFormMove = {
    client: false,

    move: (G: SongJinnGame, ctx: Ctx, args: ProvinceID[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.jianLiDaQi(${JSON.stringify(args)})`);
        const log = [`p${ctx.playerID}.jianLiDaQi`];
        // const ctr = getCountryById(ctx.playerID);
        // const pub = pid2pub(G, ctx.playerID);
        // const player = playerById(G, ctx.playerID);
        if (args.length !== 3) {
            log.push(`|not3prov`);
            return INVALID_MOVE;
        } else {
            if (args.filter(prov => !G.jinn.provinces.includes(prov)).length > 0) {
                return INVALID_MOVE;
            }
        }
        G.qi = [...args]
        log.push(`|${G.qi}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        ctx.events?.endStage();
    }
}

export const chooseRegion: LongFormMove = {
    move: (G, ctx, arg) => {
        const pid = ctx.playerID;
        const log = [`chooseRegion`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.chooseRegion(${JSON.stringify(arg)})`);
        // const ctr = getCountryById(pid);
        // const pub = pid2pub(G, pid);
        // const player = playerById(G, pid);
        if (G.pending.regions.includes(arg)) {

        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}
export const emptyRound: LongFormMove = {
    client: false,
    move: (G, ctx) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        G.op += 1;
    }
}


export const emperor: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, city: CityID) => {
        if (ctx.playerID !== SJPlayer.P1 || G.song.emperor !== null) {
            return INVALID_MOVE;
        }
        G.song.emperor = city;
        if (ctx.phase === 'develop') {
            // G.song.develop.forEach(c => G.song.discard.push(c));
            // G.song.develop = []
            G.song.usedDevelop = totalDevelop(G, ctx, ctx.playerID);
        }
        if (ctx.phase === 'action') {
            if (isFast(G)) {
                endRoundCheck(G, ctx);
                ctx.events?.endTurn();
            } else {
                ctx.events?.endStage();
            }
        }
    }
}

interface IDevelopArg {
    choice: DevelopChoice,
    target: number
}

export const develop: LongFormMove = {
    client: false,
    move: (G, ctx, arg: IDevelopArg) => {
        logger.info(`${G.matchID}|p${ctx.playerID}.develop(${JSON.stringify(arg)})`)
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const {choice} = arg;
        const log = [`p${pid}|develop`];
        // const player = playerById(G, ctx.playerID);
        const pub = pid2pub(G, pid);
        const country = getCountryById(pid);
        const total = totalDevelop(G, ctx, pid);
        log.push(`|${total}|total`)
        switch (country) {
            case Country.SONG:
                if (choice === DevelopChoice.COLONY) {
                    return INVALID_MOVE;
                } else {
                    switch (choice) {
                        case DevelopChoice.MILITARY:
                            if (G.song.military < 7) {
                                changeMilitary(G, SJPlayer.P1, 1);
                                pub.usedDevelop += G.song.military;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.CIVIL:
                            if (G.song.civil < 7) {
                                changeCivil(G, SJPlayer.P1, 1);
                                pub.usedDevelop += G.song.civil;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.POLICY_DOWN:
                            if (G.policy > -3) {
                                policyDown(G, 1);
                                pub.usedDevelop += 3;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.POLICY_UP:
                            if (G.policy < 3) {
                                policyUp(G, 1);
                                pub.usedDevelop += 3;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.EMPEROR:
                            if (!G.events.includes(ActiveEvents.JinBingLaiLe)) {
                                pub.usedDevelop = total;
                                ctx.events?.setStage('emperor');
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        default:
                            break;
                    }
                }
                break;
            case Country.JINN:
                if (
                    choice === DevelopChoice.EMPEROR
                    || choice === DevelopChoice.POLICY_DOWN
                    || choice === DevelopChoice.POLICY_UP
                ) {
                    return INVALID_MOVE;
                } else {
                    switch (choice) {
                        case DevelopChoice.MILITARY:
                            if (pub.military < 7) {
                                changeMilitary(G, SJPlayer.P2, 1);
                                pub.usedDevelop += G.jinn.military;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.CIVIL:
                            if (G.jinn.civil < 7) {
                                changeCivil(G, SJPlayer.P2, 1);
                                pub.usedDevelop += G.jinn.civil;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.COLONY:
                            if (G.colony < 4) {
                                colonyUp(G, 1);
                                pub.usedDevelop += G.colony * 2;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        default:
                            break;
                    }
                }
                break;
            default:
                break;
        }
        const remainDev = total - pub.usedDevelop;
        log.push(`|${remainDev}remainDev`);
        const canCommon = remainDev < pub.civil + 1 && remainDev <= pub.military + 1;
        log.push(`|${canCommon}canCommon`);
        const canPolicy = pid === SJPlayer.P1 && remainDev < 3 || G.policy === 3;
        log.push(`|${canPolicy}canPolicy`);
        const canEmperor = pid === SJPlayer.P1 && remainDev < 4 && G.song.emperor !== null;
        log.push(`|${canEmperor}canEmperor`);
        const canColony = pid === SJPlayer.P2 && remainDev < (2 * G.colony + 2);
        log.push(`|${canColony}canColony`);
        const canSong = pid === SJPlayer.P1 && canPolicy && canCommon && canEmperor;
        const canJinn = pid === SJPlayer.P2 && canColony && canCommon;
        const noOps = pid === SJPlayer.P1 ? canSong : canJinn;
        log.push(`|${canSong}canSong`);
        log.push(`|${canJinn}canJinn`);
        log.push(`|${noOps}noOps`);
        if (noOps) {

        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const returnToHand: LongFormMove = {
    client: false,

    move: (G, ctx, args: BaseCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        // if (!returnDevCardCheck(G, ctx, ctx.playerID, args)) {
        //     return INVALID_MOVE;
        // }
        const player = playerById(G, ctx.playerID);
        const pub = pid2pub(G, ctx.playerID);
        if (pub.develop.includes(args)) {
            pub.develop.splice(pub.develop.indexOf(args), 1);
            player.hand.push(args)
        } else {
            return INVALID_MOVE;
        }
    }
}

export const combatCard: LongFormMove = {
    client: false,
    move: (G, ctx, args: BaseCardID[]) => {
        const pid = ctx.playerID;
        logger.info(`${G.matchID}|p${pid}.moves.combatCard(${JSON.stringify(args)})`)
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, pid);
        const log = [`combatCard|${args}`];
        log.push(`|${JSON.stringify(player.hand)}|player.hand`);
        const validCC = args.filter(
            c => player.hand.includes(c) &&
                sjCardById(c).combat
        );
        log.push(`|${JSON.stringify(validCC)}|validCC`);
        if (
            validCC.length === args.length
        ) {
            args.forEach(c => {
                if (player.hand.includes(c)) {
                    player.hand.splice(player.hand.indexOf(c), 1);
                }
                player.combatCard.push(c)
                log.push(`|${player.combatCard}player.combatCard`);
            })
        } else {
            log.push(`|notValid`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }


        if (G.order.indexOf(pid as SJPlayer) === 0) {
            log.push(`|pos0|nextCC`);
            changePlayerStage(G, ctx, 'combatCard', G.order[1]);
        } else {
            log.push(`|pos1`);
            const oppoPlayer = oppoPlayerById(G, pid);
            if (player.combatCard.length === 0 && oppoPlayer.combatCard.length === 0) {
                log.push(`|noCC|continueCombat`);
                continueCombat(G, ctx);
            } else {
                log.push(`|showCC`);
                changePlayerStage(G, ctx, 'showCC', G.order[0]);
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}


export const cardEvent: LongFormMove = {
    client: false,
    move: (G, ctx, args: BaseCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (!player.hand.includes(args)) {
            return INVALID_MOVE;
        }
        const card = sjCardById(args);
        if (card.pre(G, ctx)) {
            const pub = pid2pub(G, ctx.playerID);
            if (card.remove) {
                pub.remove.push(args);
            } else {
                pub.discard.push(args);
            }
            if (player.hand.includes(args)) {
                player.hand.splice(player.hand.indexOf(args), 1);
            }
            card.event(G, ctx);
        } else {
            return INVALID_MOVE;
        }
    }
}

interface IHeYiArgs {
    card: SJEventCardID,
    city: CityID
}


export const heYi: LongFormMove = {
    move: (G, ctx, {city, card}: IHeYiArgs) => {
        if (!heYiCheck(G)) {
            return INVALID_MOVE;
        }
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(card)) {
            player.hand.splice(player.hand.indexOf(card), 1);
        } else {
            return INVALID_MOVE;
        }
        heYiChange(G, ctx, city);
        if (isFast(G)) {
            endRoundCheck(G, ctx);
            ctx.events?.endTurn();
        }
    }
}

export const freeHeYi: LongFormMove = {
    move: (G, ctx, city: CityID) => {
        if (!heYiCheck(G)) {
            return INVALID_MOVE;
        }
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        heYiChange(G, ctx, city);
    }
}

export const developCard: LongFormMove = {
    move: (G, ctx, args: BaseCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(args)) {
            player.hand.splice(player.hand.indexOf(args), 1);
        } else {
            return INVALID_MOVE;
        }
        const pub = pid2pub(G, ctx.playerID);
        pub.develop.push(args);
        if (isFast(G)) {
            endRoundCheck(G, ctx);
            ctx.events?.endTurn();
        }
    }
}

interface IChooseFirst {
    choice: SJPlayer;
    matchID: string;
}

export const chooseFirst: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IChooseFirst) => {
        const pid = ctx.playerID;
        logger.info(`p${pid}.moves.chooseFirst(${JSON.stringify(args)})`)
        const log = [`p${pid}.moves.chooseFirst(${JSON.stringify(args)})`];
        const {choice, matchID} = args;
        G.matchID = matchID
        G.first = choice;
        if (choice === SJPlayer.P1) {
            G.order = [SJPlayer.P1, SJPlayer.P2];
        } else {
            G.order = [SJPlayer.P2, SJPlayer.P1];
        }
        log.push(`|order|${G.order}`);
        ctx.events?.endPhase();
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const choosePlan: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, pid: PlanID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const log = [`p${ctx.playerID}|choosePlan|${pid}`];
        const pub = pid2pub(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        if (!player.plans.includes(pid)) {
            return INVALID_MOVE;
        }
        const plan = getPlanById(pid);
        if (plan.level > pub.military) {
            return INVALID_MOVE;
        }
        if (pub.effect.includes(PlayerPendingEffect.TwoPlan)) {
            player.plans.splice(
                player.plans.indexOf(pid), 1
            );
            player.chosenPlans.push(pid);
            pub.effect.splice(
                pub.effect.indexOf(PlayerPendingEffect.TwoPlan), 1
            );
            return;
        }
        player.plans.forEach((remainPid) => {
            if (pid === remainPid) {
                log.push(`|add${remainPid}`);
                player.chosenPlans.push(remainPid);
            } else {
                log.push(`|return${remainPid}`);
                G.secret.planDeck.push(remainPid);
            }
        });
        player.plans = [];
        G.secret.planDeck = shuffle(ctx, G.secret.planDeck);
        log.push(`|${G.secret.planDeck.toString()}`)
        if (G.order.length === 1) {
            log.push('|only1player can choose plan|endPhase');
            ctx.events?.endPhase();
        } else {
            if (G.order.indexOf(ctx.playerID as SJPlayer) === 0) {
                log.push('|drawForNextPlayer');
                const secondPid = G.order[1];
                drawPlanForPlayer(G, secondPid);
                const secondPlayer = playerById(G, secondPid);
                const secondPub = pid2pub(G, secondPid);
                log.push(`|p${secondPid}|${secondPlayer.plans}`);
                if (secondPlayer.plans.filter((p) => secondPub.military >= getPlanById(p).level).length === 0) {
                    // second player cannot choose plan
                    G.secret.planDeck.concat(secondPlayer.plans);
                    secondPlayer.plans = [];
                    log.push(`|cannot|chose|endPhase`);
                    ctx.events?.endPhase();
                } else {
                    log.push('endTurn');
                    ctx.events?.endTurn();
                }
            } else {
                log.push('endPhase');
                ctx.events?.endPhase();
            }
        }


        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    redact: true
}

export const search: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, cid: SJEventCardID) => {

        const pid = ctx.playerID;
        logger.info(`p${pid}.moves.search(${JSON.stringify(cid)})`);
        const log = [`search`];
        if (pid === undefined) {
            return INVALID_MOVE
        }
        const cards = cardToSearch(G, ctx, pid);
        const pub = pid2pub(G, pid);
        const player = playerById(G, pid);
        const deck = pid as SJPlayer === SJPlayer.P1 ? G.secret.songDeck : G.secret.jinnDeck;
        log.push(`|${JSON.stringify(cards)}|cards`);
        if (deck.includes(cid) && cards.includes(cid)) {

            log.push(`|${player.hand}|player.hand`);
            log.push(`|${JSON.stringify(deck)}|deck`);

            deck.splice(deck.indexOf(cid), 1);
            player.hand.push(cid);

            log.push(`|${player.hand}|player.hand`);
            log.push(`|${JSON.stringify(deck)}|deck`);

        } else {
            log.push(`|invalid`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        if (ctx.phase === 'draw' && getStage(ctx) === 'search'){
            if (pub.effect.includes(PlayerPendingEffect.SearchCard)) {
                pub.effect.splice(pub.effect.indexOf(PlayerPendingEffect.SearchCard), 1);
                log.push(`|${JSON.stringify(pub.effect)}|pub.effect`);
            }
            log.push(`|toDiscard`);
            changePlayerStage(G, ctx, 'discard', pid);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    redact: true
}

export const searchFirst: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, args: boolean) => {
        if (!args) {
            if (ctx.playerID !== undefined) {
                drawPhaseForPlayer(G, ctx, ctx.playerID);
            } else {
                return INVALID_MOVE;
            }
        }
        ctx.events?.setStage('search');
    }
}

export const showPlan: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, args: PlanID[]) => {
        logger.info(`p${ctx.playerID}.moves.showPlan(${JSON.stringify(args)})`);
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const pub = pid2pub(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        pub.plan = [...player.chosenPlans];
        player.chosenPlans = [];
        if (G.order.indexOf(ctx.playerID as SJPlayer) === 0) {
            ctx.events?.endTurn();
        } else {
            ctx.events?.endPhase();
        }
    }
}

export const showCC: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, args: SJEventCardID[]) => {
        const pid = ctx.playerID;
        const log = [`showCC`];
        logger.info(`p${pid}.moves.showCC(${JSON.stringify(args)})`);
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const cci = getCombatStateById(G, pid);
        const player = playerById(G, pid);

        cci.combatCard = [...player.combatCard];
        player.combatCard = [];
        if (G.order.indexOf(pid as SJPlayer) === 0) {
            log.push(`|nextShowCC`);
            changePlayerStage(G, ctx, 'showCC', G.order[1]);
        } else {
            log.push(`|resolveCC`);
            if (G.combat.jinn.combatCard.includes(JinnBaseCardID.J50)) {
                log.push(`|yiBing|endCombat`);
                endCombat(G, ctx);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            } else {
                if (G.combat.song.combatCard.includes(SongBaseCardID.S50)) {
                    log.push(`|LiBao`);
                    doPlaceUnit(G, ctx, [0, 0, 0, 1, 0, 0], Country.SONG, G.combat.song.troop.p);
                }
                if (G.combat.jinn.combatCard.includes(JinnBaseCardID.J32)) {
                    log.push(`|huoGong`);
                    removeUnitByCountryPlace(G, ctx, [0, 0, 0, 1, 0, 0], Country.SONG, G.combat.song.troop.p);
                }
                if (G.combat.jinn.combatCard.includes(JinnBaseCardID.J34)) {
                    log.push(`|huFuXiangBing`);
                    const st = ciSongTroop(G);
                    if (st !== null) {
                        log.push(`|${getSimpleTroopText(G, st)}|st`);
                        if (st.u[0] <= 0) {
                            log.push(`|removeGong`);
                            removeUnitByCountryPlace(G, ctx, [0, 1, 0, 0, 0, 0], Country.SONG, G.combat.song.troop.p);
                        } else {
                            if (st.u[1] <= 0) {
                                log.push(`|removeBu`);
                                removeUnitByCountryPlace(G, ctx, [1, 0, 0, 0, 0, 0], Country.SONG, G.combat.song.troop.p);
                            } else {
                                log.push(`|chooseBuOrGong`);
                                G.pending.events.push(PendingEvents.HuFuXiangBing);
                                changePlayerStage(G, ctx, 'confirmRespond', SJPlayer.P2);
                                logger.debug(`${G.matchID}|${log.join('')}`);
                                return;
                            }
                        }
                    } else {
                        log.push(`|noSongTroop`);
                    }
                }
            }
            log.push(`|continueCombat`);
            continueCombat(G, ctx);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const op: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, cid: SJEventCardID) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const card = sjCardById(cid);
        // const ctr = getCountryById(pid);
        const pub = pid2pub(G, pid);
        const player = playerById(G, pid);
        const log = [`p${pid}op${card.name}|${card.op}`];
        log.push(`|${G.op}G.op`);
        G.op += card.op;
        log.push(`|${G.op}G.op`);
        log.push(`|${pub.discard}pub.discard`);
        log.push(`|${player.hand}player.hand`);
        if (player.hand.includes(cid)) {
            player.hand.splice(player.hand.indexOf(cid), 1);
            pub.discard.push(cid);
        } else {
            return INVALID_MOVE;
        }
        log.push(`|${pub.discard}pub.discard`);
        log.push(`|${player.hand}player.hand`);
        logger.debug(`${G.matchID}|${log.join('')}`);

    }
};


export const paiQian: LongFormMove = {
    client: false,

    move: (G: SongJinnGame, ctx: Ctx, cid: SJEventCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const pub = pid2pub(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(cid)) {
            player.hand.splice(player.hand.indexOf(cid), 1);
            pub.discard.push(cid);
        }
    }
};


// Adjust status moves for semi auto only


export const down: LongFormMove = {
    client: false,
    move: (G, ctx, choice: DevelopChoice) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const country = getCountryById(ctx.playerID);
        if (country === Country.SONG) {
            switch (choice) {
                case DevelopChoice.MILITARY:
                    G.song.military--;
                    break;
                case DevelopChoice.CIVIL:
                    G.song.civil--;
                    break;
                case DevelopChoice.POLICY_UP:
                    policyUp(G, 1);
                    break;
                case DevelopChoice.POLICY_DOWN:
                    policyDown(G, 1);
                    break;
                case DevelopChoice.COLONY:
                    colonyDown(G, 1);
                    break;
                default:
                    break;
            }

        } else if (country === Country.JINN) {
            if (choice === DevelopChoice.EMPEROR) {
                return INVALID_MOVE;
            } else {
                switch (choice) {
                    case DevelopChoice.MILITARY:
                        G.jinn.military--;
                        break;
                    case DevelopChoice.CIVIL:
                        G.jinn.civil--;
                        break;
                    case DevelopChoice.POLICY_UP:
                        policyUp(G, 1);
                        break;
                    case DevelopChoice.POLICY_DOWN:
                        policyDown(G, 1);
                        break;
                    case DevelopChoice.COLONY:
                        colonyDown(G, 1);
                        break;
                    default:
                        break;
                }
            }
        } else {

        }
    }
}

export const chooseTop: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, p: PlanID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const log = [`chooseTop|p${ctx.playerID}`];
        const ctr = getCountryById(ctx.playerID);
        const pub = pid2pub(G, ctx.playerID);
        if (!pub.completedPlan.includes(p)) {
            return INVALID_MOVE;
        }
        pub.completedPlan.splice(pub.completedPlan.indexOf(p), 1);
        pub.completedPlan.push(p);
        if (ctr === Country.SONG && G.events.includes(ActiveEvents.YanJingYiNan)) {

        }
        if (G.order[0] === ctx.playerID) {
            log.push(`|nextPlayer`);
            // ctx.events?.endTurn();
        } else {
            log.push(`|diplomacy`);
            // ctx.events?.endPhase();
        }
        logger.info(`${log.join('')}`);
    }
}

export const endRound: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const log = [`endRound`];

        const pub = pid2pub(G, pid);
        if (ctx.phase === 'action') {
            endRoundCheck(G, ctx);
            ctx.events?.endStage();
            ctx.events?.endTurn();
        } else {
            if (ctx.phase === 'develop') {
                pub.develop.forEach(c => pub.discard.push(c));
                pub.develop = []
                if (pub.effect.includes(PlayerPendingEffect.FourDevelopPoint)) {
                    pub.effect.splice(pub.effect.indexOf(PlayerPendingEffect.FourDevelopPoint), 1);
                }
                pub.usedDevelop = 0;
            }
            if (G.order[1] === pid) {
                if (ctx.phase === 'draw') {
                    endDraw(G, ctx);
                } else {
                    ctx.events?.endPhase();
                }
            } else {
                ctx.events?.endTurn();
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);

    }
}

interface ISiegeArg {
    src: CityID,
    ctr: Country
}

export const siege: LongFormMove = {
    client: false,
    move: (G, ctx, arg: ISiegeArg) => {
        const pid = ctx.playerID;
        const log = [`siege`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.siege(${JSON.stringify(arg)})`);
        const {src, ctr} = arg;
        startCombat(G, ctx, ctr, src);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IBreakoutArg {
    src: TroopPlace,
    ctr: Country
}

export const breakout: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, arg: IBreakoutArg) => {
        const pid = ctx.playerID;
        logger.info(`${G.matchID}|p${pid}.breakout(${JSON.stringify(arg)})`);
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const log = [`breakout`];
        const {src, ctr} = arg;
        if (isCityID(src)) {
            log.push(`|city`);
            // @ts-ignore
            const region = getCityById(src).region;
            log.push(`|${region}|region`);
            const oppoTroop = getOpponentPlaceTroopByCtr(G, ctr, region);
            if (oppoTroop === null) {
                log.push(`|setPlaceToRegion`);
                setTroopPlaceByCtr(G, ctr, src, region);
            } else {
                log.push(`|breakoutCombat`);
                startCombat(G, ctx, arg.ctr, src);
            }
        } else {
            if (isRegionID(src)) {
                log.push(`|fieldCombat`);
                startCombat(G, ctx, arg.ctr, src);
            } else {
                log.push(`|otherPlaceType|error`);
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IConfirmRespondArgs {
    choice: string,
    text: string
}

export const confirmRespond: LongFormMove = {
    client: false,
    move: (G: SongJinnGame, ctx: Ctx, arg: IConfirmRespondArgs) => {
        const pid = ctx.playerID;
        logger.info(`${G.matchID}|p${pid}.confirmRespond(${JSON.stringify(arg)})`);
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const ctr = pid2ctr(pid);
        const pub = pid2pub(G, pid);
        const {choice} = arg;
        const log = [`confirmRespond`]
        const ci = G.combat;
        const atkCCI = ciAtkInfo(G);
        const defCCI = ciDefInfo(G);
        log.push(`|${JSON.stringify(arg)}arg`);
        log.push(`|${ci.phase}ci.phase`);

        function eliminate() {
            if (choice === 'yes' || choice === "archer") {
                removeUnitByCountryPlace(G, ctx, [0, 1, 0, 0, 0, 0], Country.SONG, G.combat.song.troop.p);
            } else {
                removeUnitByCountryPlace(G, ctx, [1, 0, 0, 0, 0, 0], Country.SONG, G.combat.song.troop.p);
            }
        }

        if (ci.ongoing) {
            if (ci.phase === CombatPhase.JieYe) {
                log.push(`|JieYe`);
                if (choice === 'yes') {
                    log.push(`|Field`);
                    ci.type = CombatType.FIELD;
                    ci.phase = CombatPhase.YunChou;
                    changePlayerStage(G, ctx, 'combatCard', G.order[0]);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                } else {
                    log.push(`|NoField|opponentChoose`);
                    changePlayerStage(G, ctx, 'confirmRespond', oppoPid(pid));
                    ci.phase = CombatPhase.WeiKun;
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                }
            }
            if (ci.phase === CombatPhase.WeiKun) {
                const atkPub = ctr2pub(G, ci.atk);
                atkPub.troops.forEach(at => {
                    if (at.p === ciAtkTroop(G).p) {
                        at.c = null;
                    }
                })
                weiKunTroop(G, defCCI.troop);
                log.push(`|${JSON.stringify(atkCCI.troop)}atk`);
                log.push(`|${JSON.stringify(defCCI.troop)}def`);
                if (choice === "围困") {
                    endCombat(G, ctx);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                } else {
                    log.push(`|siege|cc`);
                    ci.type = CombatType.SIEGE;
                    ci.phase = CombatPhase.YunChou;
                    changePlayerStage(G, ctx, 'combatCard', G.order[0]);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                }
            }
            if (ci.phase === CombatPhase.MingJin) {
                if (ctr === ci.atk) {
                    log.push(`|atk`);
                    if (canForceRoundTwo(G) && defCCI.choice !== BeatGongChoice.NO_FORCE_ROUND_TWO) {
                        log.push(`|invalidState|error|manualMove`);
                        endCombat(G, ctx);
                        ctx.events?.endStage();
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    } else {
                        if (choice === BeatGongChoice.CONTINUE) {
                            if (canRoundTwo(G)) {
                                atkCCI.choice = BeatGongChoice.CONTINUE;

                                if (ci.type === CombatType.SIEGE) {
                                    log.push(`|siege|cannot|retreat|roundTwo`);
                                    roundTwo(G, ctx);
                                    logger.debug(`${G.matchID}|${log.join('')}`);
                                    return
                                } else {
                                    log.push(`|ask|def`);
                                    changePlayerStage(G, ctx, 'confirmRespond', ciDefPid(G));
                                    logger.debug(`${G.matchID}|${log.join('')}`);
                                    return;
                                }
                            } else {
                                log.push(`|cannot|roundTwo|chooseAgain`);
                                logger.debug(`${G.matchID}|${log.join('')}`);
                                return;
                            }
                        } else {
                            if (choice === BeatGongChoice.RETREAT) {
                                atkCCI.choice = BeatGongChoice.RETREAT;
                                log.push(`|atkRetreat`);
                                endCombat(G, ctx);
                                ctx.events?.endStage();
                                // changePlayerStage(G, ctx, 'retreat', ciAtkPid(G));
                                if (ciAtkPid(G) !== ctx.currentPlayer) {
                                    changePlayerStage(G, ctx, 'react', ciAtkPid(G));
                                }
                                logger.debug(`${G.matchID}|${log.join('')}`);
                                return;
                            } else {
                                atkCCI.choice = BeatGongChoice.STALEMATE;
                                log.push(`|ask|def`);
                                changePlayerStage(G, ctx, 'confirmRespond', ciDefPid(G));
                                logger.debug(`${G.matchID}|${log.join('')}`);
                                return;
                            }
                        }
                    }
                } else {
                    log.push(`|def`);
                    if (canForceRoundTwo(G) && defCCI.choice !== BeatGongChoice.NO_FORCE_ROUND_TWO) {
                        if (choice === "yes") {
                            log.push(`|forcedRoundTwo`);
                            roundTwo(G, ctx);
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        } else {
                            defCCI.choice = BeatGongChoice.NO_FORCE_ROUND_TWO;
                            changePlayerStage(G, ctx, 'confirmRespond', ciAtkPid(G));
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        }
                    } else {
                        if (choice === BeatGongChoice.STALEMATE) {
                            log.push(`|stalemate`);
                            defCCI.choice = BeatGongChoice.STALEMATE;
                            if (atkCCI.choice === BeatGongChoice.CONTINUE && canRoundTwo(G)) {
                                roundTwo(G, ctx);
                            } else {
                                endCombat(G, ctx);
                                ctx.events?.endStage();
                            }
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        } else {
                            log.push(`|defRetreat`);
                            defCCI.choice = BeatGongChoice.RETREAT;
                            endCombat(G, ctx);
                            ctx.events?.endStage();
                            if (ciDefPid(G) !== ctx.currentPlayer) {
                                changePlayerStage(G, ctx, 'react', ciDefPid(G));
                            }
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        }
                    }
                }
            }
            if (ci.phase === CombatPhase.YunChou) {
                const poppedEvent = G.pending.events.pop()
                log.push(`|${poppedEvent}|poppedEvent`);
                if (poppedEvent === PendingEvents.HuFuXiangBing) {
                    eliminate();
                    log.push(`|continueCombat`);
                    continueCombat(G, ctx);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return;
                }
            }
        } else {
            const poppedEvent = G.pending.events.pop()
            if (poppedEvent !== undefined) {
                switch (poppedEvent) {
                    case PendingEvents.XiJunQuDuan:
                        const place = optionToPlace(choice);
                        if (place === null) {
                            log.push(`|noPlace|doNothing|chooseAgain`);
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        } else {
                            ctx.events?.endStage();
                            doPlaceUnit(G, ctx, [1, 0, 0, 0, 0, 0], Country.SONG, place);
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        }
                    case PendingEvents.MergeORSiege:
                        if (choice !== "围困") {
                            const place = G.pending.places.pop();
                            log.push(`|${place}|place`);
                            if (place !== undefined) {
                                startCombat(G, ctx, pid2ctr(pid), place);
                            }
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        }
                        break;
                    case PendingEvents.MengAnMouKe:
                        if (choice === 'yes') {
                            colonyDown(G, 1);
                            G.op = 6;
                            G.events.push(ActiveEvents.MengAnMouKe);
                        } else {
                            G.op = 3;
                        }
                        break;
                    case PendingEvents.ZhangZhaoZhiZheng:
                        if (choice === '选择降低宋内政' || choice === 'yes') {
                            changeCivil(G, SJPlayer.P1, -1);
                        } else {
                            const gen: General = parseInt(choice);
                            log.push(`|${gen}|gen`);
                            // @ts-ignore
                            log.push(`|${getGeneralNameByCountry(G, SJPlayer.P1, gen)}`);
                            moveGeneralToReady(G, SJPlayer.P1, gen);
                        }
                        break;
                    case PendingEvents.LoseCorruption:
                        log.push(`|losePower`);
                        if (choice === 'yes' || choice === 'corruption') {
                            if (pub.corruption > 0) {
                                log.push(`|${G.song.corruption}|corruption`);
                                pub.corruption--;
                                log.push(`|${G.song.corruption}|corruption`);
                            }
                        }
                        break;
                    case PendingEvents.FuHaiTaoSheng:
                        if (choice === 'yes') {
                            if (G.player['0'].hand.includes(SongBaseCardID.S30)) {
                                G.player['0'].hand.splice(G.player['0'].hand.indexOf(SongBaseCardID.S30), 1);
                            }
                            G.song.remove.push(SongBaseCardID.S30);
                            changePlayerStage(G, ctx, 'emperor', SJPlayer.P1);
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return;
                        } else {
                            songLoseEmperor(G, ctx);
                            ctx.events?.endStage();
                            logger.debug(`${G.matchID}|${log.join('')}`);
                            return
                        }
                    case PendingEvents.HuFuXiangBing:
                        eliminate();
                        log.push(`|continueCombat`);
                        continueCombat(G, ctx);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    case PendingEvents.BingShi:
                        G.pending.events.splice(G.pending.events.indexOf(PendingEvents.BingShi), 1);
                        ctx.events?.endStage();
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    case PendingEvents.WeiQi:
                        const prov = choice as ProvinceID;
                        if (Object.values(ProvinceID).includes(prov)) {
                            if (G.qi.includes(prov)) {
                                G.qi.splice(G.qi.indexOf(prov), 1);
                            } else {
                                log.push(`|error|manual|move`);
                            }
                        } else {
                            log.push(`|error|manual|move`);
                        }
                        ctx.events?.endStage();
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    case PendingEvents.JiaBeng:
                        if (choice == "选择降低金殖民") {
                            colonyDown(G, 1);
                        } else {
                            if (choice === "选择降低金内政") {
                                changeCivil(G, SJPlayer.P2, -1);
                            } else {
                                if (choice === "选择降低金军事") {
                                    changeMilitary(G, SJPlayer.P2, -1)
                                } else {
                                    log.push(`|otherChoice`);
                                    changeCivil(G, SJPlayer.P2, -1);
                                }
                            }
                        }
                        ctx.events?.endStage();
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    case PendingEvents.HanFang:
                        log.push(`|hanFang`);
                        if (choice == "殖民") {
                            colonyUp(G, 1);
                        } else {
                            if (choice === "内政") {
                                changeCivil(G, SJPlayer.P2, 1);
                            } else {
                                log.push(`|not|both`);
                                changeCivil(G, SJPlayer.P2, 1);
                            }
                        }
                        ctx.events?.endStage();
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    default:
                        break;
                }
            }
        }
        log.push(`|error|no|event|hit|endStage`);
        ctx.events?.endStage();
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}


export const removeOwnGeneral: LongFormMove = {
    move: (G, ctx, arg: General) => {
        const pid = ctx.playerID;
        const log = [`removeOwnGeneral`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.removeOwnGeneral(${JSON.stringify(arg)})`);
        removeGeneral(G, pid, arg);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}
export const takePlan: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: PlanID[]) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`[p${pid}.takePlan(${JSON.stringify(arg)})`)
        const ctr = getCountryById(pid);
        if (ctr === Country.SONG) {
            G.song.completedPlan = arg;
        } else {
            G.jinn.completedPlan = arg;
        }
    }
}

export const recruitUnit: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, units: number[]) => {
        const pid = ctx.playerID;
        logger.info(`${G.matchID}|p${pid}.moves.recruitUnit(${JSON.stringify(units)})`);
        const log = [`recruitUnit`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        if (units.reduce(accumulator) === 0) {
            return INVALID_MOVE;
        }
        if (ctx.phase === 'action') {
            if (checkRecruitCivil(G, units, pid)) {
                if (pid === SJPlayer.P1) {
                    doRecruit(G, units.slice(0, 6), pid);
                } else {
                    doRecruit(G, units, pid);
                }
            } else {
                log.push(`|over|limit`);
                if (
                    G.events.includes(ActiveEvents.LiaoGuoJiuBu)
                    || G.events.includes(ActiveEvents.MengAnMouKe)
                ) {
                    log.push(`|events|doRecruit`);

                    if (pid === SJPlayer.P1) {
                        doRecruit(G, units.slice(0, 6), pid);
                    } else {
                        doRecruit(G, units, pid);
                    }
                } else {
                    log.push(`|invalid`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return INVALID_MOVE;
                }
            }
        } else {
            doRecruit(G, units, pid);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface ILoseProv {
    province: ProvinceID,
    opponent: boolean
}

export const drawExtraCard: LongFormMove = {
    move: (G: SongJinnGame, ctx) => {
        const pid = ctx.playerID;
        const log = [`drawExtraCard`];
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`${G.matchID}|p${pid}.moves.drawExtraCard()`);
        if (pid === SJPlayer.P1) {
            log.push(`|song|${JSON.stringify(G.secret.songDeck)}deck`);
            log.push(`|${JSON.stringify(G.player['0'].hand)}hand`);
            drawCardForSong(G, ctx);
            log.push(`|${JSON.stringify(G.player['0'].hand)}hand`);
            log.push(`|${JSON.stringify(G.secret.songDeck)}deck`);
        } else {
            log.push(`|jinn${JSON.stringify(G.secret.jinnDeck)}deck`);
            log.push(`|${JSON.stringify(G.player['1'].hand)}hand`);
            drawCardForJinn(G, ctx);
            log.push(`|${JSON.stringify(G.player['1'].hand)}hand`);
            log.push(`|jinn${JSON.stringify(G.secret.jinnDeck)}deck`);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    },
    client: false,
}

export const loseProvince: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: ILoseProv) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const {province, opponent} = arg;
        // const ctr = getCountryById(ctx.playerID);
        const pub = pid2pub(G, ctx.playerID);
        const oppo = oppoPub(G, ctx.playerID);
        if (ctx.playerID === SJPlayer.P1) {
            policyDown(G, 1);
        }
        if (pub.corruption > 0) {
            pub.corruption--;
        }
        if (pub.provinces.includes(province)) {
            pub.provinces.splice(pub.provinces.indexOf(province), 1);
            if (opponent) {
                oppo.provinces.push(province)
            }
        } else {
            return INVALID_MOVE;
        }
    }
}

// export const message: LongFormMove = {
//     move: (G: SongJinnGame, ctx: Ctx, msg: string) => {
//     }
// }

interface ILoseCity {
    cityID: CityID,
    opponent: boolean
}

export const loseCity: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: ILoseCity) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const {cityID, opponent} = arg;
        const ctr = getCountryById(ctx.playerID);
        const pub = pid2pub(G, ctx.playerID);
        const oppo = oppoPub(G, ctx.playerID);
        if (pub.cities.includes(cityID)) {
            pub.cities.splice(pub.cities.indexOf(cityID), 1);
            if (ctr === Country.SONG && G.song.emperor === cityID) {
                checkSongLoseEmperor(G, ctx);
            }
            const city = getCityById(cityID);
            if (city.capital) {
                doLoseProvince(G, ctx, ctx.playerID, city.province, false);
            }
            if (opponent) {
                oppo.cities.push(cityID)
            }
        } else {
            return INVALID_MOVE;
        }
    }
}


export const removeNation: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: NationID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        doRemoveNation(G, arg);
    }
}
export const adjustNation: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: NationID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        if (ctx.playerID === SJPlayer.P1) {
            nationMoveSong(G, arg);
        } else {
            nationMoveJinn(G, arg);
        }
    }
}

