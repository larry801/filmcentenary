import {Ctx, LongFormMove} from "boardgame.io";
import {SongJinnGame} from "./constant/setup";
import {
    BaseCardID,
    CardID, CityID,
    Country,
    OtherCountries,
    PlayerPendingEffect,
    RegionID,
    SJPlayer
} from "./constant/general";
import {logger} from "../game/logger";
import {getPlanById, PlanID} from "./constant/plan";
import {getStateById, playerById} from "./util/fetch";
import {INVALID_MOVE} from "boardgame.io/core";
import {shuffle} from "../game/util";
import {drawPlanForPlayer} from "./util/card";
import {getCardById} from "./constant/cards";

export const takeDamage: LongFormMove = {
    move: (G, ctx, args) => {

    }
}

export interface IPlaceUnitsArgs {
    dst: RegionID | CityID,
    units: number[],
    country: Country
}

export const placeUnit: LongFormMove = {
    move: (G, ctx, {dst, units, country}: IPlaceUnitsArgs) => {
        switch (country) {
            case Country.SONG:
                for (let i = 0; i < units.length; i++) {
                    G.song.standby[i] -= units[i];
                }
                break;
            case Country.JINN:
                for (let i = 0; i < units.length; i++) {
                    G.jinn.standby[i] -= units[i];
                }
        }
    }
}

export const cardToDevelop: LongFormMove = {
    move: (G, ctx, args) => {

    }
}

export interface IDevelopArgs {
    military: number,
    civil: number,
    return: [],
    special: number,
    country: Country
}

export interface IDirectRecruitArgs {
    dst: RegionID,
    units: number[]
}

export const directRecruit: LongFormMove = {
    move: (G, ctx, args) => {

    }
}


export const recruitPuppet: LongFormMove = {
    move: (G, ctx, dst: RegionID) => {
        if (ctx.playerID !== SJPlayer.P2) {
            return INVALID_MOVE;
        }

    }
}

export interface IRecruitArgs {
    units: number[],
    op: number,
    country: Country
}

export interface IMoveTroopArgs {
    src: RegionID | OtherCountries,
    dst: RegionID | OtherCountries,
    units: number[],
    country: Country
}

export const moveTroop: LongFormMove = {
    move: (G, ctx, args: IMoveTroopArgs) => {
        const {src, dst, units, country} = args;
    }
}
export const emptyRound: LongFormMove = {
    move: (G, ctx, args) => {

    }
}


export const develop: LongFormMove = {
    move: (G, ctx, args) => {

    }
}
export const eventCard: LongFormMove = {
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
        const card = getCardById(args);
        if (card.remove) {
            pub.remove.push(args);
        } else {
            pub.discard.push(args);
        }
    }
}


export const chooseFirst: LongFormMove = {
    move: (G: SongJinnGame, ctx: Ctx, args: SJPlayer) => {
        const pid = ctx.playerID;
        const log = [`p${pid}.moves.chooseFirst(${args})`];
        G.first = args;
        switch (args) {
            case SJPlayer.P1:
                G.order = [SJPlayer.P1, SJPlayer.P2];
                break
            case SJPlayer.P2:
                G.order = [SJPlayer.P2, SJPlayer.P1];
                break
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
                player.chosenPlans.push(pid);
            } else {
                G.secret.planDeck.push(pid);
            }
        });
        player.plans = [];
        shuffle(ctx, G.secret.planDeck);
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
        if (args) {

        }
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

export const playAsOp = {};
export const adjustStatus = {};