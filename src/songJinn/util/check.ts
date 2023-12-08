import {SongJinnGame} from "../constant/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {addLateTermCard, addMidTermCard, rm} from "./card";
import {ActiveEvents, CardID, Country, ProvinceID, Troop} from "../constant/general";
import {logger} from "../../game/logger";
import {getCountryById, getStateById} from "./fetch";
import {totalDevelop} from "./calc";
import {sjCardById} from "../constant/cards";
import {getPlanById, PlanID} from "../constant/plan";


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
    return getStateById(G, pid).military >= getPlanById(plan).level;
}
export const checkPlan = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, plan: PlanID) => {
    const ctr = getCountryById(pid);
    const planObj = getPlanById(plan);
    if (ctr === Country.SONG) {

    } else {

    }
}


export const endTurnCheck = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`t${G.turn}endTurnCheck`];
    if (G.turn === 2) {
        addMidTermCard(G, ctx);
    }
    if (G.turn === 6) {
        addLateTermCard(G, ctx);
    }
    if (G.events.includes(ActiveEvents.YueShuaiZhiLai)) {
        log.push(`|RemoveYueShuaiZhiLai|${G.events.toString()}`);
        rm(ActiveEvents.YueShuaiZhiLai, G.events);
        log.push(`|after|${G.events.toString()}`);
    }
    rm(ActiveEvents.LiGang, G.events);
    G.turn++;
    logger.debug(log.join(''));
}

export const endRoundCheck = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`t${G.turn}r${G.round}endRoundCheck`];
    if (G.round === 5) {
        ctx.events?.setPhase('resolvePlan')
    }
    if (G.order[1] === ctx.playerID) {
        G.round++;
    }
    logger.debug(log.join(''));
}

export const returnDevCardCheck = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, cid: CardID) => {
    const pub = getStateById(G, pid);
    const card = sjCardById(cid);
    return totalDevelop(G, ctx, pid) - pub.usedDevelop > card.op;
}


export const heYiCheck = (G: SongJinnGame, ctx: Ctx) => {
    return G.policy < 0;
}