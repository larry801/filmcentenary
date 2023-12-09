import {Ctx, LongFormMove} from "boardgame.io";
import {SongJinnGame} from "./constant/setup";
import {
    ActiveEvents,
    BaseCardID,
    SJEventCardID,
    CityID,
    Country,
    DevelopChoice, General,
    isRegionID,
    LetterOfCredence,
    PlayerPendingEffect, ProvinceID,
    SJPlayer,
    Troop,
    TroopPlace, RegionID, PlanID
} from "./constant/general";
import {logger} from "../game/logger";
import {getPlanById} from "./constant/plan";
import {
    cardToSearch,
    getCountryById,
    getJinnTroopByCity,
    getJinnTroopByRegion,
    getOpponentStateById,
    getSongTroopByCity,
    getSongTroopByRegion,
    getStateById,
    playerById
} from "./util/fetch";
import {INVALID_MOVE} from "boardgame.io/core";
import {shuffle} from "../game/util";
import {sjCardById} from "./constant/cards";
import {drawPhaseForPlayer, drawPlanForPlayer, rm} from "./util/card";
import {endRoundCheck, endTurnCheck, heYiCheck, returnDevCardCheck, troopEmpty} from "./util/check";
import {getCityById} from "./constant/city";
import {
    addTroop, changeCivil, changeMilitary,
    colonyDown, colonyUp,
    heYiChange,
    mergeTroopTo,
    policyDown, policyUp,
    doRecruit,
    removeUnitOnTroop,
    rollDiceByPid, doLoseProvince, moveGeneralTo
} from "./util/change";
import {getRegionById} from "./constant/regions";
import {changePlayerStage} from "../game/logFix";
import {totalDevelop} from "./util/calc";

interface IMarchArgs {
    src: TroopPlace;
    dst: TroopPlace;
    idx: number;
    country: Country;
    units: number[]
}

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
export const march: LongFormMove = {
    move: (G, ctx, arg: IMarchArgs) => {
        const {dst, idx, units} = arg;
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.march(${JSON.stringify(arg)});`)
        const ctr = getCountryById(ctx.playerID);
        // const player = playerById(G, ctx.playerID);
        const log = [`p${ctx.playerID}|march|src`];
        log.push(`|parsed${JSON.stringify(dst)}`);
        const pub = getStateById(G, ctx.playerID);
        const t = pub.troops[idx];
        log.push(`|${JSON.stringify(t)}`);
        if (t.u.filter((u, i) => units[i] === u).length === units.length) {
            log.push(`|all`);
            const destTroops = pub.troops.filter((t2: Troop) => t2.p === dst);
            if (destTroops.length > 0) {
                const d = destTroops[0];
                const dstIdx = pub.troops.indexOf(d);
                log.push(`|merge|to|${d}|${dstIdx}`);
                mergeTroopTo(G, idx, dstIdx, ctx.playerID);
                log.push(`|result|${JSON.stringify(d)}`);
            } else {
                log.push(`|move`);
                t.p = dst;
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
            const destTroops = pub.troops.filter((t2: Troop) => t2.p === dst);
            if (destTroops.length > 0) {
                const d = destTroops[0];
                const dstIdx = pub.troops.indexOf(d);
                log.push(`|merge|to|${d}|${dstIdx}`);
                mergeTroopTo(G, idx, dstIdx, ctx.playerID);
                log.push(`|result|${JSON.stringify(d)}`);
            } else {
                let city = null;
                if (isRegionID(dst)) {
                    city = getRegionById(dst).city;
                }
                log.push(`|city${city}`);
                const newTroop = {
                    p: dst,
                    c: city,

                    u: units,
                    country: ctr
                };
                log.push(`|new|${JSON.stringify(newTroop)}`);
                pub.troops.push(newTroop);
            }


        }
        logger.debug(log.join(''));
    }
}


export const letter: LongFormMove = {
    move: (G, ctx, arg: LetterOfCredence) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(arg.card)) {
            rm(arg.card, player.hand);
        } else {
            return INVALID_MOVE;
        }
        player.lod.push(arg);
        ctx.events?.endTurn();
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

export interface ITakeDamageArgs {
    c: Country,
    idx: number,
    src: TroopPlace,
    standby: number[],
    ready: number[]
}

export const takeDamage: LongFormMove = {
    move: (G, ctx, arg: ITakeDamageArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        logger.info(`p${ctx.playerID}.takeDamage(${arg})`)
        const pub = getStateById(G, ctx.playerID);
        const log = [`|before|${pub.standby}|${pub.standby}|`];
        const troop = arg.c === Country.JINN ? G.jinn.troops[arg.idx] : G.song.troops[arg.idx];
        for (let i = 0; i < arg.standby.length; i++) {
            troop[i] -= (arg.standby)[i];
            troop[i] -= (arg.ready)[i];
            if (troop[i] < 0) {
                log.push(`|${troop[i]}<0`);
                logger.debug(log.join(''));
                return INVALID_MOVE;
            }
            log.push(JSON.stringify(troop));
            pub.standby[i] += (arg.standby)[i];
            pub.ready[i] += (arg.ready)[i];
            log.push(`|after|${pub.standby}|${arg.standby}`);
        }
        if (troopEmpty(troop)) {
            rm(troop, pub.troops);
        }
        logger.debug(log.join(''));

    }
}

export interface IPlaceUnitsToTroopArgs {
    place: TroopPlace,
    idx: number,
    units: number[],
    country: Country
}

export const placeUnit: LongFormMove = {
    move: (G, ctx, {place, idx, units, country}: IPlaceUnitsToTroopArgs) => {
        const pub = country === Country.SONG ? G.song : G.jinn;
        const t = pub.troops[idx];
        if (t === undefined) {
            return INVALID_MOVE;
        }
        for (let i = 0; i < units.length; i++) {
            if (pub.standby[i] < units[i]) {
                t.u[i] += pub.standby[i];
                pub.standby[i] = 0;
            } else {
                pub.standby[i] -= units[i];
                t.u[i] += units[i];
            }
        }
        if (ctx.phase === 'turnEnd') {
            endTurnCheck(G, ctx);
            ctx.events?.setPhase('draw');
        }
    }
}

interface IDeployGeneral {
    general: General;
    dst: TroopPlace;
}

export const deployGeneral: LongFormMove = {
    move: (G, ctx, arg: IDeployGeneral) => {

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
            country: country
        })
    }
}


export interface IRemoveUnitArgs {
    src: TroopPlace;
    idx: number;
    units: number[];
    c: Country
}

export const removeUnit: LongFormMove = {
    move: (G, ctx, {idx, units}: IRemoveUnitArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        removeUnitOnTroop(G, units, ctx.playerID, idx);
    }
}

export interface IDeployUnitArgs {
    city: CityID;
    units: number[]
}

export const deploy: LongFormMove = {
    move: (G, ctx, {city, units}: IDeployUnitArgs) => {
        const country = ctx.playerID === SJPlayer.P1 ? Country.SONG : Country.JINN;
        let target = null;
        switch (country) {
            case Country.SONG:
                for (let i = 0; i < units.length; i++) {
                    G.song.ready[i] -= units[i];
                }
                target = getSongTroopByCity(G, city);
                if (target === null) {
                    const region = getCityById(city).region;
                    const place = getJinnTroopByRegion(G, region) === null ?
                        region : null;
                    G.song.troops.push({
                        p: place,
                        c: city,
                        u: units,

                        country: country
                    })
                }
                break;
            case Country.JINN:
                for (let i = 0; i < units.length; i++) {
                    G.jinn.ready[i] -= units[i];
                }
                target = getJinnTroopByCity(G, city);
                if (target === null) {
                    const region = getCityById(city).region;
                    const place = getSongTroopByRegion(G, region) === null ?
                        region : null;
                    G.song.troops.push({
                        p: place,
                        c: city,
                        u: units,

                        country: country
                    })
                }
                break;
        }
    }
}


export const discard: LongFormMove = {
    move: (G, ctx, c: BaseCardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(c)) {
            rm(c, player.hand);
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
            rm(args, player.hand);
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
        const jt = getJinnTroopByCity(G, dst);
        if (jt === null) {
            addTroop(G, getCityById(dst).region, [0, 0, 0, 0, 0, 1, 0], Country.JINN);
        } else {
            jt.u[5]++;
        }
    }
}

interface IMoveGeneralArgs {
    dst: TroopPlace,
    general: General,
    country: Country
}

export const movegGeneral: LongFormMove = {
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
        moveGeneralTo(G, ctx.playerID, general, dst);
        logger.debug(`${log.join('')}`);
    }
}

export const moveGeneral: LongFormMove = {
    move: (G, ctx, args: IMoveTroopArgs) => {

    }
}

export interface IMoveTroopArgs {
    idx: number,
    src: Troop,
    dst: TroopPlace,
    country: Country
}

export const moveTroop: LongFormMove = {
    move: (G, ctx, args: IMoveTroopArgs) => {
        if (ctx.playerID === undefined) return INVALID_MOVE;
        const {idx, dst, country} = args;
        const pub = country === Country.SONG ? G.song : G.jinn;
        const t = pub.troops[idx];
        if (t === undefined) {
            return INVALID_MOVE;
        }
        const destTroops = pub.troops.filter((t: Troop) => t.p === dst);
        if (destTroops.length > 0) {
            const d = destTroops[0];
            mergeTroopTo(G, idx, pub.troops.indexOf(d), ctx.playerID);
        } else {
            t.p = dst;
        }
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
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        // const player = playerById(G, ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const country = getCountryById(ctx.playerID);
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
                        case DevelopChoice.POLICY:
                            if (G.policy < 3) {
                                policyUp(G, 1);
                                pub.usedDevelop += 3;
                            } else {
                                return INVALID_MOVE;
                            }
                            break;
                        case DevelopChoice.EMPEROR:
                            ctx.events?.setStage('emperor');
                            break;
                        default:
                            break;
                    }
                }
                break;
            case Country.JINN:
                if (choice === DevelopChoice.POLICY || choice === DevelopChoice.EMPEROR) {
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
        const remainDev = totalDevelop(G, ctx, ctx.playerID) - pub.usedDevelop;
        const canCommon = remainDev < pub.civil + 1 && remainDev <= pub.military + 1;
        const canPolicy = ctx.playerID === SJPlayer.P1 && remainDev < 3 || G.policy === 3;
        const canEmperor = ctx.playerID === SJPlayer.P1 && remainDev < 4 && G.song.emperor !== null;
        const canColony = ctx.playerID === SJPlayer.P2 && remainDev < (2 * G.colony + 2);
        const canSong = ctx.playerID === SJPlayer.P1 && canPolicy && canCommon && canEmperor;
        const canJinn = ctx.playerID === SJPlayer.P2 && canColony && canCommon;
        const noOps = ctx.playerID === SJPlayer.P1 ? canSong : canJinn;
        if (noOps) {
            pub.develop.forEach(c => pub.discard.push(c));
            pub.develop = []
            if (G.order[0] === ctx.playerID) {
                ctx.events?.endTurn();
            } else {
                ctx.events?.endPhase();
            }
        }
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
            rm(args, pub.develop);
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
                rm(c, player.hand);
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
            rm(args, player.hand);
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
            rm(args, player.hand);
        } else {
            return INVALID_MOVE;
        }
        const pub = getStateById(G, ctx.playerID);
        pub.develop.push(args);
    }
}

export const chooseFirst: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: SJPlayer) => {
        const pid = ctx.playerID;
        const log = [`p${pid}.moves.chooseFirst(${args})`];
        G.first = args;
        if (args === SJPlayer.P1) {
            G.order = [SJPlayer.P1, SJPlayer.P2];

        } else {
            G.order = [SJPlayer.P2, SJPlayer.P1];
        }
        ctx.events?.endPhase();
        logger.info(log.join(''));
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


        logger.debug(log.join(''));
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
            rm(cid, deck);
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
            rm(cid, player.hand);
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
            rm(cid, player.hand);
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
                case DevelopChoice.POLICY:
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
                    case DevelopChoice.POLICY:
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
        rm(p, pub.completedPlan);
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
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        if (ctx.phase === 'action') {
            endRoundCheck(G, ctx);
            ctx.events?.endTurn();
        } else {
            if (G.order[1] === ctx.playerID) {
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
            rm(p, G.plans);
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
            rm(province, pub.provinces);
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

export const controlCity: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: CityID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const oppo = getOpponentStateById(G, ctx.playerID);
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
            rm(cityID, pub.cities);
            if (ctr === Country.SONG && G.song.emperor === cityID) {
                G.song.emperor = null;
                policyDown(G, 1);
            }
            const city = getCityById(cityID);
            if (city.capital) {
                doLoseProvince(G, ctx.playerID, city.province, true);
            }
            if (opponent) {
                oppo.cities.push(cityID)
            }
        } else {
            return INVALID_MOVE;
        }
    }
}

