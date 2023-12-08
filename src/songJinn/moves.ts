import {Ctx, LongFormMove} from "boardgame.io";
import {SongJinnGame} from "./constant/setup";
import {
    ActiveEvents,
    BaseCardID,
    CardID,
    CityID,
    Country,
    DevelopChoice,
    isRegionID,
    LetterOfCredence,
    NationID,
    PlayerPendingEffect,
    RegionID,
    SJPlayer,
    TroopPlace
} from "./constant/general";
import {logger} from "../game/logger";
import {getPlanById, PlanID} from "./constant/plan";
import {
    cardToSearch,
    getCountryById,
    getJinnTroopByCity,
    getJinnTroopByRegion,
    getSongTroopByCity,
    getSongTroopByRegion,
    getStateById,
    playerById
} from "./util/fetch";
import {INVALID_MOVE} from "boardgame.io/core";
import {shuffle} from "../game/util";
import {sjCardById} from "./constant/cards";
import {drawPhaseForPlayer, drawPlanForPlayer, remove} from "./util/card";
import {endRoundCheck, heYiCheck, returnDevCardCheck} from "./util/check";
import {getCityById} from "./constant/city";
import {addTroop, heYiChange, recruit, removeUnitOnTroop, rollDiceByPid} from "./util/change";
import {getRegionById} from "./constant/regions";

interface IMarchArgs {
    src: TroopPlace;
    dst: TroopPlace;
    idx: number;
    country: Country;
    units: number[]
}

export const march: LongFormMove = {
    move: (G, ctx, {dst, idx, country, units}: IMarchArgs) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        // const player = playerById(G, ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const t = pub.troops[idx];
        if (t.u.filter((u, i) => units[i] === u).length === units.length) {
            t.p = dst;
        } else {
            for (let i = 0; i < units.length; i++) {
                if (t.u[i] < units[i]) {
                    return INVALID_MOVE;
                } else {
                    t.u[i] -= units[i];
                }
            }
            let city = null;
            if (isRegionID(dst)) {
                city = getRegionById(dst).city;
            }
            pub.troops.push({
                p: dst,
                c: city,
                j: [],
                u: units,
                country: ctr
            })
        }
        ctx.events?.endTurn();
    }
}


export const letter: LongFormMove = {
    move: (G, ctx, arg: LetterOfCredence) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(arg.card)) {
            remove(arg.card, player.hand);
        } else {
            return INVALID_MOVE;
        }
        player.lod.push(arg);
        ctx.events?.endTurn();
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
    move: (G, ctx, {c, idx, standby, ready}: ITakeDamageArgs) => {
        const troop = c === Country.JINN ? G.jinn.troops[idx] : G.song.troops[idx];
        for (let i = 0; i < standby.length; i++) {
            troop[i] -= standby[i];
            troop[i] -= ready[i];
            switch (c) {
                case Country.JINN:
                    G.jinn.standby[i] += standby[i];
                    G.jinn.ready[i] += standby[i];
                    break;
                case Country.SONG:
                    G.song.standby[i] += standby[i];
                    G.song.ready[i] += standby[i];
                    break;
            }
        }
    }
}

export interface IPlaceUnitsToTroopArgs {
    idx: number,
    units: number[],
    country: Country
}

export const placeUnit: LongFormMove = {
    move: (G, ctx, {idx, units, country}: IPlaceUnitsToTroopArgs) => {
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
            j: [],
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
    move: (G, ctx, {idx,units}: IRemoveUnitArgs) => {
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
                        j: [],
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
                        j: [],
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
            remove(c, player.hand);
            const pub = getStateById(G, ctx.playerID);
            pub.discard.push(c);
        } else {
            return INVALID_MOVE;
        }
    }
}


export const tieJun: LongFormMove = {
    move: (G, ctx, args: CardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(args)) {
            remove(args, player.hand);
        }
    }
}
export const chooseUnit: LongFormMove = {
    move: (G, ctx, args) => {

    }
}


export const rollDices: LongFormMove = {
    move: (G, ctx, count: number) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        if (count === undefined) {
            rollDiceByPid(G, ctx, ctx.playerID, 5);
        } else {
            rollDiceByPid(G, ctx, ctx.playerID, count);
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


export interface IMoveTroopArgs {
    idx: number,
    dst: TroopPlace,
    units: number[],
    country: Country
}

export const moveTroop: LongFormMove = {
    move: (G, ctx, args: IMoveTroopArgs) => {
        const {idx, dst, units, country} = args;
        const pub = country === Country.SONG ? G.song : G.jinn;
        const t = pub.troops[idx];
        if (t === undefined) {
            return INVALID_MOVE;
        }
        t.p = dst;
    }
}
export const emptyRound: LongFormMove = {
    move: (G, ctx, args) => {

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
    }
}

export const develop: LongFormMove = {
    move: (G, ctx, choice: DevelopChoice) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const player = playerById(G, ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const country = getCountryById(ctx.playerID);
        switch (country) {
            case Country.SONG:
                if (choice === DevelopChoice.COLONY) {
                    return INVALID_MOVE;
                } else {
                    switch (choice) {
                        case DevelopChoice.MILITARY:
                            G.song.military++;
                            pub.usedDevelop += G.song.military;
                            break;
                        case DevelopChoice.CIVIL:
                            G.song.civil++;
                            pub.usedDevelop += G.song.civil;
                            break;
                        case DevelopChoice.POLICY:
                            G.policy++;
                            pub.usedDevelop += 3;

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
                            G.jinn.military++;
                            pub.usedDevelop += G.jinn.military;
                            break;
                        case DevelopChoice.CIVIL:
                            G.jinn.civil++;
                            pub.usedDevelop += G.jinn.military;
                            break;
                        case DevelopChoice.COLONY:
                            G.colony++;
                            pub.usedDevelop += G.colony * 2;
                            break;
                        default:
                            break;
                    }
                }
                break;
            default:
                break;
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
            remove(args, pub.develop);
            player.hand.push(args)
        } else {
            return INVALID_MOVE;
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
            remove(args, player.hand);
        } else {
            return INVALID_MOVE;
        }
        const pub = getStateById(G, ctx.playerID);
        pub.develop.push(args);
        endRoundCheck(G, ctx);
        ctx.events?.endTurn();
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
    move: (G: SongJinnGame, ctx: Ctx, args: CardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE
        }
        const cards = cardToSearch(G, ctx, ctx.playerID);
        switch (ctx.playerID as SJPlayer) {
            case SJPlayer.P1:

                return;
            case SJPlayer.P2:
                return;
        }
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
    move: (G: SongJinnGame, ctx: Ctx, cid: CardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        const card = sjCardById(cid);
        if (player.hand.includes(cid)) {
            remove(cid, player.hand);
            pub.discard.push(cid);
        }
    }
};


export const paiQian: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, cid: CardID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
        if (player.hand.includes(cid)) {
            remove(cid, player.hand);
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
        switch (country) {
            case Country.SONG:
                if (choice === DevelopChoice.COLONY) {
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
                            G.policy--;
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
                            G.jinn.military--;
                            break;
                        case DevelopChoice.CIVIL:
                            G.jinn.civil--;
                            break;
                        case DevelopChoice.COLONY:
                            G.colony--;
                            break;
                        default:
                            break;
                    }
                }
                break;
            default:
                break;
        }
    }
}

export const chooseTop: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, p: PlanID) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        if (!pub.completedPlan.includes(p)) {
            return INVALID_MOVE;
        }
        remove(p, pub.completedPlan);
        pub.completedPlan.push(p);
        if (ctr === Country.SONG && G.events.includes(ActiveEvents.YanJingYiNan)) {

        }
    }
}

export const endRound: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        endRoundCheck(G, ctx);
        ctx.events?.endTurn();
    }
}


export const takePlan: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, arg: PlanID[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        // const pub = getStateById(G, ctx.playerID);
        // const player = playerById(G, ctx.playerID);
        if (ctr === Country.SONG) {
            G.song.completedPlan = G.song.completedPlan.concat(arg);
        } else {
            G.jinn.completedPlan = G.jinn.completedPlan.concat(arg);
        }
    }
}

export const recruitUnit: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, units: number[]) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        recruit(G, units, ctx.playerID);
    }
}

export const empty: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx) => {
        if (ctx.playerID === undefined) {
            return INVALID_MOVE;
        }
        const ctr = getCountryById(ctx.playerID);
        const pub = getStateById(G, ctx.playerID);
        const player = playerById(G, ctx.playerID);
    }
}
