import {Ctx, LongFormMove} from "boardgame.io";
import {
    ActiveEvents,
    BaseCardID,
    CityID,
    Country,
    DevelopChoice,
    General, isCityID,
    isRegionID,
    LetterOfCredence, NationID,
    PlanID,
    PlayerPendingEffect,
    ProvinceID,
    RegionID,
    SJEventCardID,
    SJPlayer, SongJinnGame,
    Troop,
    TroopPlace
} from "./constant/general";
import {logger} from "../game/logger";
import {getPlanById} from "./constant/plan";
import {INVALID_MOVE} from "boardgame.io/core";
import {shuffle} from "../game/util";
import {getRegionById, Region} from "./constant/regions";
import {changePlayerStage} from "../game/logFix";

import {
    addTroop,
    cardToSearch, changeCivil, changeMilitary,
    colonyDown,
    colonyUp,
    ctr2pid,
    ctr2pub, doControlCity, doControlProvince, doGeneralSkill, doLoseProvince, doPlaceUnit, doRecruit,
    drawPhaseForPlayer,
    drawPlanForPlayer,
    endRoundCheck, getCountryById, getGeneralNameByCountry,
    getGeneralNameByPid,
    getJinnTroopByCity,
    getJinnTroopByPlace,
    getJinnTroopByRegion,
    getOpponentStateById,
    getPlaceGeneral,
    getSongTroopByCity,
    getSongTroopByPlace,
    getStateById,
    getTroopByCountryPlace,
    getTroopByRegion,
    heYiChange,
    heYiCheck,
    mergeTroopTo,
    moveGeneralByCountry,
    moveGeneralByPid,
    moveGeneralToReady,
    pid2ctr,
    placeToStr,
    playerById,
    policyDown,
    policyUp, removeUnitByCountryPlace, removeUnitByPlace,
    returnDevCardCheck,
    rollDiceByPid, sjCardById,
    totalDevelop,
    troopEmpty,
    unitsToString
} from "./util";
import {getCityById} from "./constant/city";

export const opponentMove: LongFormMove = {
    move: (G, ctx) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const oppo = ctx.playerID === SJPlayer.P1 ? SJPlayer.P2 : SJPlayer.P1;
        if (ctx.playerID === ctx.currentPlayer) {
            changePlayerStage(G, ctx, 'react', oppo);
        } else {
            ctx.events?.endStage();
        }
    }

}
export const controlProvince: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: ProvinceID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.controlProvince(${JSON.stringify(args)})`);
        const log = [`p${ctx.playerID}.controlProvince`];
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        log.push(`|before|${pub.provinces}`);
        doControlProvince(G, ctx.playerID, args);
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
        logger.info(`p${pid}.controlCity(${JSON.stringify(args)})`);
        const log = [`p${pid}.controlCity`];
        // const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, pid);
        // const player = playerById(G, ctx.playerID);
        log.push(`|${pub.cities}`);
        doControlCity(G, pid, args);
        log.push(`|after|${pub.cities}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

interface IMarchArgs {
    src: TroopPlace;
    dst: TroopPlace;
    country: Country;
    units: number[];
    generals: General[];
}

export const march: LongFormMove = {
    move: (G, ctx, arg: IMarchArgs) => {
        const {src, dst, country, generals, units} = arg;
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.march(${JSON.stringify(arg)});`)
        const ctr = getCountryById(pid);
        // const player = playerById(G, ctx.playerID);
        const log = [`p${pid}|march|src${placeToStr(src)}`];
        log.push(`|parsed${JSON.stringify(dst)}`);

        const pub = ctr2pub(G, country);
        generals.forEach(gen => moveGeneralByCountry(G, country, gen, dst));
        const t = getTroopByCountryPlace(G, arg.country, src);
        if (t === null) {
            log.push(`noTroop`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        const srcIdx = pub.troops.indexOf(t);
        let region: Region;
        log.push(`|${JSON.stringify(t)}`);
        if (t.u.filter((u, i) => units[i] === u).length === units.length) {
            log.push(`|all`);
            const destTroops = pub.troops.filter((t2: Troop) => t2.p === dst);
            log.push(`|destTroops${JSON.stringify(destTroops)}`);
            if (destTroops.length > 0) {
                const d = destTroops[0];
                const dstIdx = pub.troops.indexOf(d);
                log.push(`|before|dst${JSON.stringify(d)}|src${JSON.stringify(t)}`);
                mergeTroopTo(G, srcIdx, dstIdx, ctr2pid(t.g));
                log.push(`|after|dst${JSON.stringify(d)}|src${JSON.stringify(t)}`);

            } else {
                log.push(`|move`);
                t.p = dst;
                if (isRegionID(dst)) {
                    region = getRegionById(dst);
                    t.c = region.city;
                }
                log.push(`${JSON.stringify(t)}`);
            }
        } else {
            log.push(`|part`);
            for (let i = 0; i < units.length; i++) {
                if (t.u[i] < units[i]) {
                    return INVALID_MOVE;
                } else {
                    t.u[i] -= units[i];
                }
            }
            log.push(`|after|src|${JSON.stringify(t)}|${unitsToString(t.u)}`);

            const destTroops = pub.troops.filter((t2: Troop) => t2.p === dst);
            log.push(`|destTroops${JSON.stringify(destTroops)}`);
            if (destTroops.length > 0) {
                const d = destTroops[0];
                const dstIdx = pub.troops.indexOf(d);
                for (let i = 0; i < d.u.length; i++) {
                    d.u[i] += units[i];
                }
                log.push(`|result|${JSON.stringify(d)}|${unitsToString(t.u)}`);
            } else {
                let city = null;
                if (isRegionID(dst)) {
                    region = getRegionById(dst);
                    city = region.city;
                }
                log.push(`|city${city}`);
                const newTroop = {
                    p: dst,
                    c: city,
                    u: units,
                    g: ctr
                };
                log.push(`|new|${JSON.stringify(newTroop)}`);
                pub.troops.push(newTroop);
            }
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}


export const letter: LongFormMove = {
    move: (G, ctx, arg: LetterOfCredence) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(arg.card)) {
            player.hand.splice(player.hand.indexOf(arg.card), 1);
        } else {
            return INVALID_MOVE;
        }
        player.lod.push(arg);
        // endRoundCheck(G, ctx);
        // ctx.events?.endTurn();
    }
}

export const chooseRegion: LongFormMove = {
    move: (G, ctx, arg: RegionID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
    }
}
export const chooseProvince: LongFormMove = {
    move: (G, ctx, arg: ProvinceID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
    }
}

interface ITakeDamageArgs {
    c: Country,
    src: TroopPlace,
    standby: number[],
    ready: number[]
}

export const takeDamage: LongFormMove = {
    move: (G, ctx, arg: ITakeDamageArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.takeDamage(${arg})`);
        const {c, src, standby, ready} = arg;
        const pub = ctr2pub(G, c);
        const log = [`|before|${pub.standby}|${pub.standby}|`];
        const troop = c === Country.SONG ? getSongTroopByPlace(G, src) : getJinnTroopByPlace(G, src);
        if (troop === null) {
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
        for (let i = 0; i < arg.standby.length; i++) {
            troop.u[i] -= (arg.standby)[i];
            troop.u[i] -= (arg.ready)[i];
            if (troop.u[i] < 0) {
                log.push(`|${troop.u[i]}<0`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return INVALID_MOVE;
            }
            log.push(JSON.stringify(troop));
            pub.standby[i] += (arg.standby)[i];
            pub.ready[i] += (arg.ready)[i];
            log.push(`|after|${pub.standby}|${arg.standby}`);
        }
        if (troopEmpty(troop)) {
            pub.troops.splice(pub.troops.indexOf(troop), 1);
        }
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IPlaceUnitsToTroopArgs {
    place: TroopPlace,
    units: number[],
    country: Country
}

interface  IGeneralSkillArgs{
    country:Country,
    general:General
}

export const generalSkill: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IGeneralSkillArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.generalSkill(${JSON.stringify(args)})`);
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

        doPlaceUnit(G, units, country, place);
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
        logger.info(`p${pid}.deployGeneral(${JSON.stringify(args)})`);
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
        logger.info(`p${pid}.rescueGeneral(${JSON.stringify(args)})`);
        const log = [`p${pid}.rescueGeneral`];
        const {general, card} = args;
        const pub = getStateById(G, pid);
        if (pub.develop.includes(card)) {
            pub.develop.splice(pub.develop.indexOf(card), 1);
            pub.discard.push(card)
            log.push(`|discard${pub.discard}`);
        } else {
            return INVALID_MOVE;
        }
        moveGeneralToReady(G, pid, general);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export interface IPlaceNewTroopArgs {
    dst: TroopPlace,
    units: number[],
    country: Country
}

export const placeTroop: LongFormMove = {
    move: (G, ctx, {dst, units, country}: IPlaceNewTroopArgs) => {
        const pub = country === Country.SONG ? G.song : G.jinn;
        pub.troops.push({
            p: dst,
            u: units,
            c: null,
            g: country
        })
    }
}


export interface IRemoveUnitArgs {
    src: TroopPlace;
    units: number[];
    country: Country
}

export const removeUnit: LongFormMove = {
    move: (G, ctx, {src, units, country}: IRemoveUnitArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        removeUnitByCountryPlace(G, units, country, src)
    }
}

export interface IDeployUnitArgs {
    city: CityID;
    units: number[],
    country: Country
}

function doDeployUnits(G: SongJinnGame, ctx: Ctx, country: Country, units: number[], city: CityID) {
    const log = [`${country}`];
    const target = ctr2pid(country);
    const pub = getStateById(G, target);
    pub.ready.forEach((u, idx) => {
        if (u < units[idx]) {
            log.push(`${u}<${units[idx]}|INVALID_MOVE`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return INVALID_MOVE;
        }
    })
    const t = country === Country.SONG ? getSongTroopByCity(G, city) : getJinnTroopByCity(G, city);
    if (t === null) {
        log.push(`noTroop`);
        pub.troops.push({
            u: units,
            g: country,
            c: city,
            // 围困城市不能补充 ？？？
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
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.deploy(${JSON.stringify(args)})`);
        const {city, country, units} = args;
        doDeployUnits(G, ctx, country, units, city);
    }
}


export const discard: LongFormMove = {
    move: (G, ctx, c: BaseCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(c)) {
            player.hand.splice(player.hand.indexOf(c), 1);
            const pub = getStateById(G, ctx.playerID);
            pub.discard.push(c);
        } else {
            return INVALID_MOVE;
        }
    }
}


export const tieJun: LongFormMove = {
    move: (G, ctx, args: SJEventCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        // const ctr = getCountryById(ctx.playerID);
        // const pub = getStateById(G, ctx.playerID);
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


export const rollDices: LongFormMove = {
    move: (G, ctx, count: number) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        if (count === undefined) {
            rollDiceByPid(G, ctx, ctx.playerID, 5);
        } else {
            const newCount = count > 25 ? 25 : count;
            rollDiceByPid(G, ctx, ctx.playerID, newCount);

        }
    }
}

export const recruitPuppet: LongFormMove = {
    move: (G, ctx, dst: CityID) => {
        if (ctx.playerID !== SJPlayer.P2) {
            return INVALID_MOVE;
        }
        const pub = G.jinn;
        let qi = false;
        if (pub.standby[5] > 0) {
            pub.standby[5]--
        } else {

            if (G.events.includes(ActiveEvents.JianLiDaQi)) {
                if (pub.standby[6] > 0) {
                    pub.standby[6]--;
                }
                qi = true;
            }
        }

        const jt = getJinnTroopByCity(G, dst);
        if (jt === null) {
            if (qi) {
                addTroop(G, getCityById(dst).region, [0, 0, 0, 0, 0, 0, 1], Country.JINN);

            } else {
                addTroop(G, getCityById(dst).region, [0, 0, 0, 0, 0, 1, 0], Country.JINN);

            }
        } else {
            if (qi) {
                jt.u[6]++
            } else {
                jt.u[5]++;
            }
        }
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
        const {dst, general, country} = args;
        const log = [`p${ctx.playerID}.moveReadyGeneral`];
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        moveGeneralByPid(G, ctx.playerID, general, dst);
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}


export interface IMoveTroopArgs {
    src: Troop,
    dst: TroopPlace,
    country: Country
}

export const moveTroop: LongFormMove = {
    move: (G, ctx, args: IMoveTroopArgs) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${pid}.moveTroop(${JSON.stringify(args)})`);
        const log = [`moveTroop`];
        const {src, dst, country} = args;
        log.push(`|${placeToStr(src.p)}`);
        const pub = country === Country.SONG ? G.song : G.jinn;
        const idx = pub.troops.indexOf(src);
        const t = pub.troops[idx];
        if (t === undefined) {
            return INVALID_MOVE;
        }
        const destTroops = pub.troops.filter((t: Troop) => t.p === dst);
        if (destTroops.length > 0) {
            const d = destTroops[0];
            mergeTroopTo(G, idx, pub.troops.indexOf(d), pid);
        } else {
            t.p = dst;
            if (isRegionID(dst)) {
                const region = getRegionById(dst);
                t.c = region.city;
            }
            const g = getPlaceGeneral(G, pid, t.p);
            if (g.length > 0) {
                g.forEach(gen => moveGeneralByPid(G, pid, gen, dst));
            }
        }
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
        const pub = getStateById(G, pid);
        const p = playerById(G, pid);
        p.lod.forEach(l => pub.discard.push(l.card));
        p.lod = [];
        logger.info(`p${pid}.showLetters(${JSON.stringify(args)})`);
    }
}
export const jianLiDaQi: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: ProvinceID[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.jianLiDaQi(${JSON.stringify(args)})`);
        const log = [`p${ctx.playerID}.jianLiDaQi`];
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
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
export const emptyRound: LongFormMove = {
    move: (G, ctx) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        // const ctr = getCountryById(ctx.playerID);
        // const pub = getStateById(G, ctx.playerID);
        // const player = playerById(G, ctx.playerID);
        G.op = 1;
    }
}


export const emperor: LongFormMove = {
    move: (G, ctx, city: CityID) => {
        if (ctx.playerID !== SJPlayer.P1 || G.song.emperor !== null) {
            return INVALID_MOVE;
        }
        G.song.emperor = city;
        if (ctx.phase === 'develop') {
            ctx.events?.endTurn();
        }
        if (ctx.phase === 'action') {
            ctx.events?.endStage();
        }
    }
}

export const develop: LongFormMove = {
    move: (G, ctx, choice: DevelopChoice) => {
        logger.info(`${G.matchID}|p${ctx.playerID}.develop(${choice})`)
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const log = [`p${pid}|develop`];
        // const player = playerById(G, ctx.playerID);
        const pub = getStateById(G, pid);
        const country = getCountryById(pid);
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
                                pub.usedDevelop += G.jinn.military;
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
        const remainDev = totalDevelop(G, ctx, pid) - pub.usedDevelop;
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
    move: (G, ctx, args: BaseCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        if (!returnDevCardCheck(G, ctx, ctx.playerID, args)) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        if (pub.develop.includes(args)) {
            pub.develop.splice(pub.develop.indexOf(args), 1);
            player.hand.push(args)
        } else {
            return INVALID_MOVE;
        }
    }
}

export const combatCard: LongFormMove = {
    move: (G, ctx, args: BaseCardID[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (
            args.filter(
                c => player.hand.includes(c) &&
                    sjCardById(c).combat).length === args.length
        ) {
            args.forEach(c => {
                const card = sjCardById(c);
                // @ts-ignore
                const pub = getStateById(G, ctx.playerID);
                if (card.remove) {
                    pub.remove.push(c);
                } else {
                    pub.discard.push(c);
                }
                player.hand.splice(player.hand.indexOf(c), 1);
            })
        }


    }
}
export const cardEvent: LongFormMove = {
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
            const pub = getStateById(G, ctx.playerID);
            if (card.remove) {
                pub.remove.push(args);
            } else {
                pub.discard.push(args);
            }
            player.hand.splice(player.hand.indexOf(args), 1);
            card.event(G, ctx);
        } else {
            return INVALID_MOVE;
        }
    }
}

export const heYi: LongFormMove = {
    move: (G, ctx, c: CityID) => {
        if (!heYiCheck(G, ctx)) {
            return INVALID_MOVE;
        }
        heYiChange(G, c);
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
        const pub = getStateById(G, ctx.playerID);
        pub.develop.push(args);
    }
}

interface IChooseFirst {
    choice: SJPlayer;
    matchID: string;
}

export const chooseFirst: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: IChooseFirst) => {
        const pid = ctx.playerID;
        logger.info(`p${pid}.moves.chooseFirst(${args})`)
        const log = [`p${pid}.moves.chooseFirst(${args})`];
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
        const pub = getStateById(G, ctx.playerID);
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
                const secondPub = getStateById(G, secondPid);
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
        if (ctx.playerID === undefined) {
            return INVALID_MOVE
        }
        const cards = cardToSearch(G, ctx, ctx.playerID);
        // const ctr = getCountryById(ctx.playerID);
        // const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        const deck = ctx.playerID as SJPlayer === SJPlayer.P1 ? G.secret.songDeck : G.secret.jinnDeck;
        if (deck.includes(cid) && cards.includes(cid)) {
            deck.splice(deck.indexOf(cid), 1);
            player.hand.push(cid);
        } else {
            return INVALID_MOVE;
        }
        ctx.events?.setStage('discard');
    }
}

export const searchFirst: LongFormMove = {
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
    move: (G: SongJinnGame, ctx: Ctx, args: PlanID[]) => {
        logger.info(`p${ctx.playerID}.moves.showPlan(${args.toString()})`);
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const pub = getStateById(G, ctx.playerID);
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

export const op: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, cid: SJEventCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        // const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        const card = sjCardById(cid);
        G.op = card.op;
        if (player.hand.includes(cid)) {
            player.hand.splice(player.hand.indexOf(cid), 1);
            pub.discard.push(cid);
        }
    }
};


export const paiQian: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, cid: SJEventCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(cid)) {
            player.hand.splice(player.hand.indexOf(cid), 1);
            pub.discard.push(cid);
        }
    }
};


// Adjust status moves for semi auto only


export const down: LongFormMove = {
    move: (G, ctx, choice: DevelopChoice) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const country = getCountryById(ctx.playerID);
        if (country === Country.SONG) {
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
        const pub = getStateById(G, ctx.playerID);
        if (!pub.completedPlan.includes(p)) {
            return INVALID_MOVE;
        }
        pub.completedPlan.splice(pub.completedPlan.indexOf(p), 1);
        pub.completedPlan.push(p);
        if (ctr === Country.SONG && G.events.includes(ActiveEvents.YanJingYiNan)) {

        }
        if (G.order[0] === ctx.playerID) {
            log.push(`|nextPlayer`);
            ctx.events?.endTurn();
        } else {
            log.push(`|develop`);
            ctx.events?.setPhase('develop');
        }
        logger.info(`${log.join('')}`);
    }
}

export const endRound: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: number) => {
        const pid = ctx.playerID;
        if (pid === undefined) {
            return INVALID_MOVE;
        }
        const pub = getStateById(G, pid);
        if (ctx.phase === 'action') {
            endRoundCheck(G, ctx);
            ctx.events?.endTurn();
        } else {
            if (ctx.phase === 'develop') {
                pub.develop.forEach(c => pub.discard.push(c));
                pub.develop = []
                pub.usedDevelop = 0;
            }
            if (G.order[1] === pid) {
                ctx.events?.endPhase();
            } else {
                ctx.events?.endTurn();
            }
        }
    }
}


export const takePlan: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: PlanID[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`[p${ctx.playerID}.takePlan(${JSON.stringify(arg)})`)
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        // const player = playerById(G, ctx.playerID);
        arg.forEach((p) => {
            if (!G.plans.includes(p)) {
                return INVALID_MOVE;
            }
        })
        if (ctr === Country.SONG) {
            G.song.completedPlan = G.song.completedPlan.concat(arg);
        } else {
            G.jinn.completedPlan = G.jinn.completedPlan.concat(arg);
        }
        arg.forEach((p) => {
            G.plans.splice(G.plans.indexOf(p), 1);
        })
        if (pub.completedPlan.length === 0) {
            ctx.events?.endTurn();
        }
    }
}

export const recruitUnit: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, units: number[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        doRecruit(G, units, ctx.playerID);
    }
}

interface ILoseProv {
    province: ProvinceID,
    opponent: boolean
}


export const loseProvince: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: ILoseProv) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const {province, opponent} = arg;
        // const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const oppo = getOpponentStateById(G, ctx.playerID);
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

export const message: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, msg: string) => {
    }
}

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
        const pub = getStateById(G, ctx.playerID);
        const oppo = getOpponentStateById(G, ctx.playerID);
        if (pub.cities.includes(cityID)) {
            pub.cities.splice(pub.cities.indexOf(cityID), 1);
            if (ctr === Country.SONG && G.song.emperor === cityID) {
                G.song.emperor = null;
                policyDown(G, 1);
            }
            const city = getCityById(cityID);
            if (city.capital) {
                doLoseProvince(G, ctx.playerID, city.province, false);
            }
            if (opponent) {
                oppo.cities.push(cityID)
            }
        } else {
            return INVALID_MOVE;
        }
    }
}

