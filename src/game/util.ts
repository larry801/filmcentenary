import {
    AvantGradeAP,
    B04,
	B05,
    BasicCardID,
    BuildingType,
    CardCategory,
    CardID,
    cardsByCond,
    CardType,
    ClassicCardID,
    DEFAULT_COMPANY_SCALE,
    eventCardByEra,
    EventCardID,
    ExtensionMode,
    FilmCardID,
    filmCardsByEra,
    GameMode,
    getCardById,
    getScoreCard,
    IBasicCard,
    IBuildingSlot,
    IBuyInfo,
    ICardSlot,
    ICost,
    IEra,
    INormalOrLegendCard,
    IPubInfo,
    isTechSchool,
    ItrEffects,
    LegendCardCountInUse,
    LES_CHAIERS_DU_CINEMA_COMPANY_SCALE,
    NormalCardCountInUse,
    PersonCardID,
    Region,
    SchoolCardID,
    schoolCardsByEra,
    scoreCardCount,
    ScoreCardID,
    ShareOnBoard,
    SimpleEffectNames,
    SimpleRuleNumPlayers,
    TwoPlayerCardCount,
    valid_regions,
    ValidRegion,
    VictoryType,
} from "../types/core";
import {IG} from "../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {Stage} from "boardgame.io/core";
import {changePlayerStage, changeStage, signalEndStage, signalEndTurn, stopTimingForGameEnd} from "./logFix";
import {getPersonCardsOnBoard} from "./board-util";
import {getCardEffect} from "../constant/effects";
import {logger} from "./logger";
import {appendServerMatchStats} from "./serverStatsStorage";
import {CardRevealReason, recordCardReveal} from "./cardReveal";

export const curPid = (_G: IG, ctx: Ctx): number => {
    return parseInt(ctx.currentPlayer);
}

export const commentBasicCardDepleted = (G: IG): boolean => {
    return G.basicCards["B04"] === 0
        && G.basicCards["B01"] === 0
        && G.basicCards["B02"] === 0
        && G.basicCards["B03"] === 0
}

export const hasUpdatableSlot = (G: IG): boolean => {
    if (G.playerCount > SimpleRuleNumPlayers) {
        return valid_regions.some(r => {
            const reg = G.regions[r];
            if (reg === undefined || reg === null) return false;
            if (reg.legend.card !== null) return true;
            return reg.normal.some(s => s.card !== null);
        });
    } else {
        return G.twoPlayer.film.some(s => s.card !== null)
            || G.twoPlayer.school.some(s => s.card !== null);
    }
}

export const wholeBoardDepleted = (G: IG): boolean => {
    return !hasUpdatableSlot(G);
}

export function activePlayer(ctx: Ctx) {
    if (ctx.activePlayers === null) {
        return ctx.currentPlayer
    } else {
        let players = Object.keys(ctx.activePlayers);
        if (players.length === 1) {
            return players[0];
        }
        players.splice(players.indexOf(ctx.currentPlayer), 1);
        return players[0];
    }
}

export const curPub = (G: IG, ctx: Ctx): IPubInfo => G.pub[curPid(G, ctx)];

export const die = (ctx: Ctx, faces: number): number => {
    return ctx.random?.Die(faces) || faces;
}

export const shuffle = (ctx: Ctx, arg: any[]): any[] => {
    return ctx.random?.Shuffle(arg) || arg;
}

export const actualStage = (_G: any, ctx: Ctx,): string => {
    if (ctx.activePlayers === null) {
        return Stage.NULL;
    } else {
        return ctx.activePlayers[activePlayer(ctx)]
    }
}

export const requireInteraction = (G: IG, eff: any): boolean => {
    switch (eff.e) {
        case "step":
            return eff.e.a.every((e: any): boolean => requireInteraction(G, e));
        default:
            return isSimpleEffect(G, eff);
    }
}

export const isSimpleEffect = (G: IG, eff: any): boolean => {
    const log = [`isSimpleEffect|${eff.e}`];
    switch (eff.e) {
        case "anyRegionShareCentral":
        case "playedCardInTurnEffect":
        case "personCardOnBoardEffect":
        case "alternative":
        case "competition":
        case ItrEffects.loseAnyRegionShare:
        case "anyRegionShare":
        case "noBuildingEE":
        case "vpNotHighestPlayer":
        case "highestVpPlayer":
        case "handToAnyPlayer":
        case "discardToAnyPlayer":
        case "industryAndAestheticsBreakthrough":
        case "industryOrAestheticsBreakthrough":
        case "industryOrAestheticsLevelUp":
        case "industryOrAestheticsLevelDown":
        case "peek":
        case "everyOtherCompany":
        case "everyPlayer":
        case "noStudio":
        case "studio":
        case "step":
        case "refactor":
        case "archive":
        case "discard":
        case "discardBasic":
        case "discardLegend":
        case "discardIndustry":
        case "discardAesthetics":
        case "discardNormalOrLegend":
        case "choice":
        case "update":
        case "comment":
        case "optional":
        case "pay":
        case ItrEffects.archiveToEEBuildingVP:
            log.push(`|false`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return false;
        default:
            log.push(`|true`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return true;
    }
}

export const playerLoseShare = (G: IG, r: ValidRegion, p: PlayerID, num: number) => {
    const log = [`playerLoseShare|p${p}|region${r}|num:${num}`];
    const playerIdNum = parseInt(p);
    const shareCount = G.pub[playerIdNum].shares[r];
    /*
    DEBUG 斯皮 + 作者
    debug|D3YSaUSqEJQ|chooseRegioncanUndo{"r":1,"idx":1,"p":"2"}{"e":"loseAnyRegionShare","a":1,"target":"2"}
    C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\build\src\game\util.js:111
        const shareCount = G.pub[playerIdNum].shares[r];
                                            ^

    TypeError: Cannot read properties of undefined (reading 'shares')
        at playerLoseShare (C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\build\src\game\util.js:111:43)
        at move (C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\build\src\game\moves.js:705:21)
        at C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\boardgame.io\dist\cjs\server.js    
        at Immer.produce (C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\immer\dist\immer
    .cjs.development.js:805:20)
        at C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\boardgame.io\dist\cjs\server.js
    :41:22
        at C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\boardgame.io\dist\cjs\server.js
    :575:24
        at C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\boardgame.io\dist\cjs\server.js
    :510:13
        at Object.processMove (C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\boardgame.i
    o\dist\cjs\server.js:1950:24)
        at C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\boardgame.io\dist\cjs\server.js
    :3212:32
        at dispatch (C:\Users\Administrator\Desktop\muki-new\filmcentenary-master\node_modules\redux\lib\redux.js:29
    6:22)
    */
    const boardShareCount = G.regions[r].share;
    log.push(`|region${r}share${shareCount}`);
    log.push(`|beforeLose|p${p}|${G.pub[playerIdNum].shares[r]}|board|${G.regions[r].share}`);
    if (shareCount >= num) {
        G.pub[playerIdNum].shares[r] = shareCount - num;
        G.regions[r].share = boardShareCount + num;
    } else {
        log.push(`|noEnoughShareToLose`);
        G.pub[playerIdNum].shares[r] = 0;
        G.regions[r].share = boardShareCount + shareCount;
    }
    log.push(`|afterLose|p${p}|${G.pub[playerIdNum].shares[r]}|board|${G.regions[r].share}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

function getShare(G: IG, region: ValidRegion, obj: IPubInfo, num: number) {
    if (G.regions[region].share >= num) {
        obj.shares[region] += num;
        G.regions[region].share -= num;
    } else {
        obj.shares[region] += G.regions[region].share;
        G.regions[region].share = 0
    }
}

export function payCost(G: IG, _ctx: Ctx, p: PlayerID, cost: number): void {
    const pub = G.pub[parseInt(p)];
    const log = [`payCost|p${p}|${cost}`];
    if (pub.resource + pub.deposit < cost) {
        throw Error(`p${p}|cannotPay|${cost}`)
    }
    if (pub.resource >= cost) {
        log.push(`|res:${cost}`);
        pub.resource -= cost;
    } else {
        log.push(`|res:${pub.resource}`);
        const depCost = cost - pub.resource;
        pub.resource = 0
        log.push(`|deposit:${depCost}`);
        deductDeposit(G, _ctx, p, depCost)
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function buyCardEffectPrepare(G: IG, _ctx: Ctx, cardID: CardID, p: PlayerID) {
    const log = [`buyCardEffectPrepare|card|${cardID}|p${p}`];
    const targetCard = getCardById(cardID);
    const cardEff = getCardEffect(targetCard.cardId);
    let hasEffect = false;
    if (cardEff.hasOwnProperty("buy")) {
        const eff = {...cardEff.buy};
        if (eff.e !== "none") {
            log.push(`|buyEffect|${JSON.stringify(eff)}`);
            eff.target = p;
            G.e.stack.push(eff);
            hasEffect = true;
        }
    } else {
        log.push(`|noBuyEff`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return hasEffect;
}

export function simpleEffectExec(G: IG, ctx: Ctx, p: PlayerID): void {
    const eff = G.e.stack.pop();
    const log = [`simpleEffectExec|p${p}|${JSON.stringify(eff)}`];
    let card: INormalOrLegendCard;
    const pub = G.pub[parseInt(p)];
    let hasEffect = false
    switch (eff.e) {
        case "none":
        case "skipBreakthrough":
            return;
        case SimpleEffectNames.LES_CHAIERS_DU_CINEMA:
            if (pub.school !== null) {
                const schoolHandLimit = getSchoolHandLimit(G, p);
                if (schoolHandLimit > 5) {
                    pub.LES_CHAIERS_DU_CINEMA = true;
                }
            }
            pub.LES_CHAIERS_DU_CINEMA = true;
            return;
        case SimpleEffectNames.CompetitionPowerToVp:
            addVp(G, ctx, p, pub.competitionPower);
            return;
        case "shareToVp":
            const shareRegion: ValidRegion = eff.a;
            addVp(G, ctx, p, pub.shares[shareRegion]);
            return;
        case "loseVpForEachHand":
            loseVp(G, ctx, p, G.player[parseInt(p)].hand.length);
            break;
        case "aestheticsToVp":
            addVp(G, ctx, p, pub.aesthetics);
            break;
        case "industryToVp":
            addVp(G, ctx, p, pub.industry);
            break;
        case "resFromIndustry":
            addRes(G, ctx, p, pub.industry);
            break;
        case "enableBollywood":
            G.regions[Region.ASIA].buildings[1].activated = true;
            break;
        case "enableHollywood":
            G.regions[Region.NA].buildings[2].activated = true;
            break;

        case "loseDeposit":
            loseDeposit(G, ctx, p, eff.a);
            break;
        case "loseVp":
            loseVp(G, ctx, p, eff.a);
            break;
        case "loseVpForLevelDiff":
            loseVp(G, ctx, p, Math.abs(pub.industry - pub.aesthetics));
            break;
        case "loseShareNA":
            playerLoseShare(G, Region.NA, p, eff.a);
            break;
        case "shareNA":
            getShare(G, Region.NA, pub, eff.a);
            break;

        case "loseShareWE":
            playerLoseShare(G, Region.WE, p, eff.a);
            break;
        case "shareWE":
            getShare(G, Region.WE, pub, eff.a);
            break;

        case "loseShareEE":
            playerLoseShare(G, Region.EE, p, eff.a);
            break;
        case "shareEE":
            getShare(G, Region.EE, pub, eff.a);
            break;

        case "loseShareASIA":
            playerLoseShare(G, Region.ASIA, p, eff.a);
            break;
        case "shareASIA":
            getShare(G, Region.ASIA, pub, eff.a);
            break;

        case "deposit":
            log.push(`|${pub.deposit}`);
            if (eff.a < 0) {
                deductDeposit(G, ctx, p, -eff.a);
            } else {
                pub.deposit += eff.a;
            }
            log.push(`|${pub.deposit}`);
            break;
        case SimpleEffectNames.addCompetitionPower:
            addCompetitionPower(G, ctx, p, eff.a);
            break;
        case SimpleEffectNames.loseCompetitionPower:
            loseCompetitionPower(G, ctx, p, eff.a);
            break;
        case "res":
            addRes(G, ctx, p, eff.a);
            break;
        case "vp":
        case "addVp":
        case "addExtraVp":
            // 效果可自带来源/归属卡（如「电影院」联动得分），否则回落到当前 vpContext
            addVp(G, ctx, p, eff.a, eff.source, eff.card);
            break;
        case "draw":
            for (let i = 0; i < eff.a; i++) {
                drawCardForPlayer(G, ctx, p);
            }
            break;
        case "aestheticsLevelUp":
            if (pub.aesthetics < 10) {
                log.push(`|${pub.aesthetics}`);
                pub.aesthetics++;
                sync3DFilmCompetitionPower(G, p);
                onAestheticsLevelUp(G, ctx, p);
                log.push(`|${pub.aesthetics}`);
            } else {
                log.push(`|LV10CannotUpgrade`);
            }
            break
        case "industryLevelUp":
            if (pub.industry < 10) {
                log.push(`|${pub.industry}`);
                pub.industry++;
                sync3DFilmCompetitionPower(G, p);
                log.push(`|${pub.industry}`);
            } else {
                log.push(`|LV10CannotUpgrade`);
            }
            break;
        case "aestheticsLevelDown":
            if (pub.aesthetics > 0) {
                log.push(`|${pub.aesthetics}`);
                pub.aesthetics--;
                sync3DFilmCompetitionPower(G, p);
                log.push(`|${pub.aesthetics}`);
            } else {
                log.push(`|LV0CannotDowngrade`);
            }
            break
        case "industryLevelDown":
            if (pub.industry > 0) {
                log.push(`|${pub.industry}`);
                pub.industry--;
                if(pub.competitionPower > pub.industry) pub.competitionPower = pub.industry;
                sync3DFilmCompetitionPower(G, p);
                log.push(`|${pub.industry}`);
            } else {
                log.push(`|LV0CannotDowngrade`);
            }
            break;
        case "industryAward":
            for (let i = 0; i < eff.a; i++) {
                industryAward(G, ctx, p);
            }
            break;
        case "aesAward":
            for (let i = 0; i < eff.a; i++) {
                aesAward(G, ctx, p);
            }
            break;
        case "buyCardToHand":
            card = getCardById(eff.a);
            if (card.category !== CardCategory.BASIC && cardSlotOnBoard(G, ctx, card) === null) {
                log.push(`|cardNotOnBoard|skip`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                break;
            }
            doBuyToHand(G, ctx, card, p);
            const hasEffectHand = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffectHand) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log.join('')}`);
            }
            return;
        case "buyCardToDeckTop":
            card = getCardById(eff.a);
            if (card.category !== CardCategory.BASIC && cardSlotOnBoard(G, ctx, card) === null) {
                log.push(`|cardNotOnBoard|skip`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                break;
            }
            doBuyToDeckTop(G, ctx, card, p);
            const hasEffectDeck = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffectDeck) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log.join('')}`);
            }
            return;
        case "52691_buy":
            // 2026-9 技术：定格电影 - 免费购买一张《商业片》置入牌库顶
            doBuyToDeckTop(G, ctx, getCardById(BasicCardID.B02), p);
            return;
        case "52692_buy":
            // 2026-9 技术：特技电影 - 免费突破1次
            G.e.stack.push({e: "breakthroughResDeduct", a: 1, target: p});
            return;
        case "52693_buy":
            // 2026-9 技术：有声电影 - +2声望（2026-10 由 +5 调整为 +2）
            addVp(G, ctx, p, 2, "卡牌效果", "S52693");
            return;
        case "52694_buy":
            // 2026-9 技术：特艺七彩 - +2存款
            pub.deposit += 2;
            return;
        case "52702_buy":
            // 2026-10 技术：3D电影 - 选择一项：①+1工业等级；②+1美学等级
            G.e.stack.push({e: "choice", a: [
                {e: "industryLevelUp", a: 1},
                {e: "aestheticsLevelUp", a: 1},
            ], target: p});
            return;
        case SimpleEffectNames.competitionLoserBuy:
            card = getCardById(eff.a);
            if (card.category !== CardCategory.BASIC && cardSlotOnBoard(G, ctx, card) === null) {
                log.push(`|cardNotOnBoard|skip`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            doBuy(G, ctx, card, G.competitionInfo.def);
            hasEffect = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffect) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log.join('')}`)
            }
            return;
        case SimpleEffectNames.competitionLoserLoseVp:
            loseVp(G, ctx, G.competitionInfo.def, eff.a);
            return;
        case "buy":
            card = getCardById(eff.a);
            if (card.category !== CardCategory.BASIC) {
                const onBoard = ctx.numPlayers === SimpleRuleNumPlayers
                    ? cardSlotOnBoard2p(G, ctx, card) !== null
                    : cardSlotOnBoard(G, ctx, card) !== null;
                if (!onBoard) {
                    log.push(`|cardNotOnBoard|skip`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    break;
                }
            }
            doBuy(G, ctx, card, p);
            hasEffect = buyCardEffectPrepare(G, ctx, eff.a, p);
            if (hasEffect) {
                log.push(`|hasEffect|CheckNextEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                checkNextEffect(G, ctx);
            } else {
                logger.debug(`${G.matchID}|${log.join('')}`)
            }
            return;
        case "EssayFilm_doArchive":
            // 散文电影: 将打出的牌置入档案馆
            log.push(`|ProseFilm|archiveCard|${eff.a}`);
            pub.playedCardInTurn = pub.playedCardInTurn.filter(c => c !== eff.a);
            pub.archive.push(eff.a as CardID);
            break;
        case "Dawn_Berlin_buy":
            // 柏林学派: 如果等级总和≤4，选择工业或美学升级
            log.push(`|Dawn_Berlin|i${pub.industry}a${pub.aesthetics}`);
            if (pub.industry + pub.aesthetics <= 4) {
                G.e.stack.push({e: "industryOrAestheticsLevelUp", a: 1, target: p});
            }
            break;
        case "addAction":
            // +1行动力
            log.push(`|addAction|before|${pub.action}`);
            pub.action += eff.a;
            log.push(`|after|${pub.action}`);
            break;
        case "6213_naShare2":
            // 威廉·惠勒: 如果你至少有2个北美份额，+1北美份额
            log.push(`|naShares|${pub.shares[Region.NA]}`);
            if (pub.shares[Region.NA] >= 2) {
                getShare(G, Region.NA, pub, 1);
            }
            break;
        default:
            // logger.error("Invalid effect" + JSON.stringify(eff));
            // throw new Error(JSON.stringify(eff));
            break;
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const doBuyToHand = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const playerObj = G.player[parseInt(p)];
    const log = [`p${p}|doBuyToHand|${card.cardId}`];
    checkSocialismRealism(G, ctx, card, p);
    if (card.category === CardCategory.BASIC) {
        log.push(`|basic`);
        // @ts-ignore
        const convertBasicID: BasicCardID = card.cardId;
        const basicCount = G.basicCards[convertBasicID];
        if (basicCount > 0) {
            G.basicCards[convertBasicID] -= 1;
            log.push(`|${G.basicCards[convertBasicID]}|left`);
        } else {
            log.push(`|${card.cardId}|depleted`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return;
        }
        //流派扩：波兰学派
        if (pub.school == SchoolCardID.S4004) {
            addSchoolVp(G, ctx, p, 2);
        }
    } else {
        let slot = cardSlotOnBoard(G, ctx, card);
        if (slot === null) {
            throw new Error("Cannot buy card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                playerObj.hand.push(slot.comment);
                pub.allCards.push(slot.comment);
                slot.comment = null;
            }
            doReturnSlotCard(G, ctx, slot);
        }
    }
    playerObj.hand.push(card.cardId);
    pub.allCards.push(card.cardId)
    checkS5205(G, ctx, card, p);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const doBuyToDeckTop = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const playerObj = G.player[parseInt(p)];
    const log = [`p${p}|doBuyToDeckTop|${card.cardId}`];
    checkSocialismRealism(G, ctx, card, p);
    if (card.category === CardCategory.BASIC) {
        log.push(`|basic`);
        // @ts-ignore
        const convertBasicID: BasicCardID = card.cardId;
        const basicCount = G.basicCards[convertBasicID];
        if (basicCount > 0) {
            G.basicCards[convertBasicID] -= 1;
            log.push(`|${G.basicCards[convertBasicID]}|left`);
        } else {
            log.push(`|${card.cardId}|depleted`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return;
        }
        //流派扩：波兰学派
        if (pub.school == SchoolCardID.S4004) {
            addSchoolVp(G, ctx, p, 2);
        }
    } else {
        let slot = cardSlotOnBoard(G, ctx, card);
        if (slot === null) {
            throw new Error("Cannot buy card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                playerObj.hand.push(slot.comment);
                pub.allCards.push(slot.comment);
                slot.comment = null;
            }
            doReturnSlotCard(G, ctx, slot);
        }
    }
    G.secretInfo.playerDecks[parseInt(p)].push(card.cardId);
    pub.allCards.push(card.cardId)
    checkS5205(G, ctx, card, p);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const checkSocialismRealism = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const log = [`checkSocialismRealism|${card.cardId}|p${p}`];
    const cardRegion = card.region;
    if (pub.school === SchoolCardID.S2301) {
        log.push(`|SocialismRealism`);
        switch (cardRegion) {
            case Region.EE:
                if (card.type === CardType.F) {
                    log.push(`|isEastEurope|1CP|1VP`);
                    addCompetitionPower(G, ctx, p, 1);
                    addSchoolVp(G, ctx, p, 1);
                } else {
                    log.push(`|isEastEurope|notFilm|noEff`);
                }
                break;
            default:
                log.push(`|notEastEurope|noEff`);
                break;
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const checkS5205 = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    if(G.pending.lastRoundOfGame && pub.school == SchoolCardID.S5205){
        if(card.category === CardCategory.BASIC){
            addSchoolVp(G, ctx, p, 6);
        }
        if(card.category === CardCategory.NORMAL){
            addRes(G, ctx, p, 4);
        }
        if(card.category === CardCategory.LEGEND){
            pub.action++;
        }
        if(card.type === CardType.F){
            drawCardForPlayer(G, ctx, p);
        }
        if(card.type === CardType.P){
            addSchoolVp(G, ctx, p, card.cost.industry + card.cost.aesthetics);
        }
    }
}

export const doBuy = (G: IG, ctx: Ctx, card: INormalOrLegendCard | IBasicCard, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const log = [`doBuy|${card.cardId}|p${p}`];
    checkSocialismRealism(G, ctx, card, p);
    if (card.category === CardCategory.BASIC) {
        let count = G.basicCards[card.cardId as BasicCardID];
        if (count > 0) {
            G.basicCards[card.cardId as BasicCardID] -= 1;
            pub.discard.push(card.cardId);
            pub.allCards.push(card.cardId);
        } else {
            log.push(`|${card.cardId}|depleted`);
        }
        //流派扩：波兰学派
        if (pub.school == SchoolCardID.S4004) {
            addSchoolVp(G, ctx, p, 2);
        }
		if (pub.school == SchoolCardID.S5004) {
			if(card.cost.industry > pub.industry || card.cost.aesthetics > pub.aesthetics){
				pub.deposit += 1;
				addSchoolVp(G, ctx, p, 1);
			}
		}
    } else {
        let slot: ICardSlot | null;
        if (ctx.numPlayers === SimpleRuleNumPlayers) {
            slot = cardSlotOnBoard2p(G, ctx, card);
        } else {
            slot = cardSlotOnBoard(G, ctx, card);
        }
        if (slot === null) {
            throw new Error("Cannot buy normal or legend card off board!");
        } else {
            slot.card = null;
            if (slot.comment !== null) {
                pub.discard.push(slot.comment);
                pub.allCards.push(slot.comment);
                slot.comment = null;
            }
            const region = card.region;
            if ([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(region)) {
                let share = 0;
                if (ctx.numPlayers > SimpleRuleNumPlayers) {
                    log.push(`|notSimpleRule`);
                    if (slot.isLegend) {
                        log.push(`|isLegend`);
                        share++;
                    }
                }
                if (card.type === CardType.F) {
                    log.push(`|film`);
                    share++;
                    if(pub.school === SchoolCardID.S5203){
                        share++;
                        // //所在地区每有一个不是你的电影院/制片厂，+1资源/+2声望。
                        // if(region !== Region.NONE){
                        //     if(G.regions[region].buildings[0].building === BuildingType.cinema && G.regions[region].buildings[0].owner !== p){
                        //         addRes(G, ctx, p, 1);
                        //     }
                        //     if(G.regions[region].buildings[0].building === BuildingType.studio && G.regions[region].buildings[0].owner !== p){
                        //         addVp(G, ctx, p, 2);
                        //     }
                        //     if(G.regions[region].buildings[1].building === BuildingType.cinema && G.regions[region].buildings[1].owner !== p){
                        //         addRes(G, ctx, p, 1);
                        //     }
                        //     if(G.regions[region].buildings[1].building === BuildingType.studio && G.regions[region].buildings[1].owner !== p){
                        //         addVp(G, ctx, p, 2);
                        //     }
                        // }
                    }
                }
                log.push(`|share${share}`);
                // @ts-ignore
                if (G.regions[region].share > share) {
                    // @ts-ignore
                    G.regions[region].share -= share;
                    // @ts-ignore
                    pub.shares[region] += share;
                } else {
                    // @ts-ignore
                    pub.shares[region] += G.regions[region].share;
                    // @ts-ignore
                    G.regions[region].share = 0;
                }
            }
        }
		if (card.type === CardType.F) {
			if (pub.school == SchoolCardID.S5004) {
				if(card.cost.industry > pub.industry || card.cost.aesthetics > pub.aesthetics){
					pub.deposit += 1;
					addSchoolVp(G, ctx, p, 1);
				}
			}
		}
        if (card.type === CardType.P) {
			if (pub.school == SchoolCardID.S6004) {
                pub.action += 1;
                pub.deposit += 1;
                addSchoolVp(G, ctx, p, 1);
			}
		}
        if (card.type === CardType.S) {
            log.push(`|buySchool`);
            if (isTechSchool(card.cardId)) {
                // 2026-9 / 2026-10 技术流派牌：购买不替换流派，直接置入档案区
                log.push(`|techSchool|toArchive`);
                pub.archive.push(card.cardId);
                pub.bought_extension = true;
                sync3DFilmCompetitionPower(G, p);
            } else {
            let school = pub.school;
            // switch (card.cardId){
            //     case (SchoolCardID.S4001):
            //         if (G.regions[Region.WE].share >= 1){
            //             pub.shares[Region.WE] += 1;
            //             G.regions[Region.WE].share --;
            //         }
            //         break;
            //     case (SchoolCardID.S4002):
            //         if (G.regions[Region.ASIA].share >= 1){
            //             pub.shares[Region.ASIA] += 1;
            //             G.regions[Region.ASIA].share --;
            //         }
            //         break;
            //     case (SchoolCardID.S4005):
            //         if (G.regions[Region.WE].share >= 1){
            //             pub.shares[Region.WE] += 1;
            //             G.regions[Region.WE].share --;
            //         }
            //         break;
            //     }
            // const kino = schoolPlayer(G, ctx, SchoolCardID.S1303);
            // log.push(`|kinoPlayer|${JSON.stringify(kino)}`);
            // if (kino !== null && p !== kino) {
            //     log.push(`|p${kino}|KinoEyes`);
            //     addVp(G, ctx, kino, 1);
            //     G.pub[parseInt(kino)].deposit++;
            // }
            if (school !== null) {
                log.push(`|hasSchool`);
                if (school === SchoolCardID.S1203) {
                    if (pub.aesthetics < 10) {
                        log.push(`|Expressionism`);
                        pub.aesthetics++;
                        sync3DFilmCompetitionPower(G, p);
                        onAestheticsLevelUp(G, ctx, p);
                    }
                }

			    //Muki - Slient Film
                if (school === SchoolCardID.S5001) {
					log.push(`|Slient`);
					doBuy(G, ctx, B05, p);
                }

                if (school == SchoolCardID.S5004) {
                    if(pub.industry < 10) pub.industry++;
                    pub.deposit += 1;
                    addSchoolVp(G, ctx, p, 1);
                    sync3DFilmCompetitionPower(G, p);
                }

                // 破晓扩 - 太阳族电影: 失去时+1工业等级,+7声望
                if ((school as any) === "S52684") {
                    log.push(`|SunTribe|archive`);
                    if(pub.industry < 10) pub.industry++;
                    addSchoolVp(G, ctx, p, 7);
                    sync3DFilmCompetitionPower(G, p);
                }

                log.push(`|archive|${school}`);
                pub.archive.push(school);
            }
			
            // if (pub.LES_CHAIERS_DU_CINEMA) {
            //     pub.LES_CHAIERS_DU_CINEMA = false
            // }
            pub.school = card.cardId as SchoolCardID;
            if (pub.school === SchoolCardID.S4006) {
                deductDeposit(G, ctx, p, pub.deposit);
                pub.action++;
            }
            // 黑浪潮
            if(pub.school === SchoolCardID.S5208){
                if(G.regions[Region.EE].era === IEra.ONE){
                    // @ts-ignore
                    pub.shares[Region.EE] += G.regions[Region.EE].share;
                    // @ts-ignore
                    G.regions[Region.EE].share = 0;
                }
                if(G.regions[Region.EE].era === IEra.TWO){
                    if(G.regions[Region.EE].share > 0){
                        pub.shares[Region.EE] += 1;
                        G.regions[Region.EE].share -= 1;
                    }
                }
            }
            // 布拉格电影学院: 购买时如果东欧处于1/2时代，获得所有东欧份额
            if(pub.school === SchoolCardID.S5201){
                if(G.regions[Region.EE].era === IEra.ONE || G.regions[Region.EE].era === IEra.TWO){
                    // @ts-ignore
                    pub.shares[Region.EE] += G.regions[Region.EE].share;
                    // @ts-ignore
                    G.regions[Region.EE].share = 0;
                }
            }
            switch (pub.school) {
                case SchoolCardID.S4001:
                case SchoolCardID.S4002:
                case SchoolCardID.S4003:
                case SchoolCardID.S4004:
                case SchoolCardID.S4005:
                case SchoolCardID.S4006:
                case SchoolCardID.S4007:
                case SchoolCardID.S4008:

                case SchoolCardID.S5001:
                case SchoolCardID.S5002:
                case SchoolCardID.S5003:
                case SchoolCardID.S5004:

                case SchoolCardID.S5201:
                case SchoolCardID.S5202:
                case SchoolCardID.S5203:
                case SchoolCardID.S5204:
                case SchoolCardID.S5205:
                case SchoolCardID.S5206:
                case SchoolCardID.S5207:
                case SchoolCardID.S5208:
                case SchoolCardID.S5209:

                case SchoolCardID.S6001:
                case SchoolCardID.S6002:
                case SchoolCardID.S6003:
                case SchoolCardID.S6004:
                // 破晓扩
                case "S52681" as any:
                case "S52682" as any:
                case "S52683" as any:
                case "S52684" as any:
                    pub.bought_extension = true;
            }
            }
        } else {
            log.push(`|pushToDiscard`);
            pub.discard.push(card.cardId);
        }
        pub.allCards.push(card.cardId);
        //checkS5205(G, ctx, card, p);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const cardInDeck = (G: IG, _ctx: Ctx, p: number, cardId: CardID): boolean => {
    return G.secretInfo.playerDecks[p].filter(c => c === cardId).length > 0;
}
export const cardInHand = (G: IG, _ctx: Ctx, p: number, cardId: CardID): boolean => {
    return G.player[p].hand.filter(c => c === cardId).length > 0;
}
export const cardInDiscard = (G: IG, _ctx: Ctx, p: number, cardId: CardID): boolean => {
    return G.pub[p].discard.filter(c => c === cardId).length > 0;
}
export const ownCardPlayers = (G: IG, ctx: Ctx, cardId: CardID): PlayerID[] => {
    let p: PlayerID[] = [];
    G.order.forEach((_i, idx) => {
            if (cardInHand(G, ctx, idx, cardId) || cardInDeck(G, ctx, idx, cardId) || cardInDiscard(G, ctx, idx, cardId)) {
                p.push(idx.toString());
            }
        }
    );
    return p;
}

export const buildingInRegion = (G: IG, ctx: Ctx, r: Region, p: PlayerID): boolean => {
    return studioInRegion(G, ctx, r, p) || cinemaInRegion(G, ctx, r, p);
}
export const studioInRegion = (G: IG, _ctx: Ctx, r: Region, p: PlayerID): boolean => {
    if (r === Region.NONE) return false;
    return G.regions[r].buildings.filter(s => s.building === BuildingType.studio && s.owner === p).length > 0;
}
export const cinemaInRegion = (G: IG, _ctx: Ctx, r: Region, p: PlayerID): boolean => {
    if (r === Region.NONE) return false;
    return G.regions[r].buildings.filter(s => s.building === BuildingType.cinema && s.owner === p).length > 0;
}
export const studioPlayers = (G: IG, ctx: Ctx, r: Region, p = ctx.currentPlayer): PlayerID[] => {
    if (r === Region.NONE) {
        return [];
    } else {
        const pos = posOfPlayer(G, ctx, p);
        const playerList : PlayerID[] = [];
        const seq = seqFromPos(G, ctx, pos);
        for(let pid of seq){
            if(studioInRegion(G, ctx, r, pid)){
                playerList.push(pid);
                let deltaLv = G.pub[parseInt(pid)].aesthetics - G.pub[parseInt(pid)].industry;
                if(deltaLv < 0) deltaLv = -deltaLv;
                if(G.pub[parseInt(pid)].school === SchoolCardID.S6003 && deltaLv <=2){
                    playerList.push(pid);
                }
            }
        }
        return playerList;
    }
}

export const buildingPlayers = (G: IG, ctx: Ctx, r: Region, p = ctx.currentPlayer): PlayerID[] => {
    if (r === Region.NONE) {
        return [];
    } else {
        const pos = posOfPlayer(G, ctx, p);
        return seqFromPos(G, ctx, pos).filter(pid => buildingInRegion(G, ctx, r, pid));
    }
}

export const noBuildingPlayers = (G: IG, ctx: Ctx, r: Region, p: PlayerID): PlayerID[] => {
    const log = [`noBuildingPlayers|${r}`];
    if (r === Region.NONE) {
        logger.debug(`${G.matchID}|${log.join('')}`);
        return [];
    }
    const allPlayers = seqFromPlayer(G, ctx, p);
    log.push(`|all|${JSON.stringify(allPlayers)}`);
    const result = allPlayers.filter(pid => {
        // 跳过无效玩家（如 undefined/null），防止后续崩溃
        if (pid == null) {
            log.push(`|p${pid}|skipNull`);
            return false;
        }
        const hasBuilding = studioInRegion(G, ctx, r, pid) || cinemaInRegion(G, ctx, r, pid);
        log.push(`|p${pid}|${hasBuilding}`);
        return !hasBuilding
    });
    log.push(`|result|${result}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result
}

export const noStudioPlayers = (G: IG, ctx: Ctx, r: Region): PlayerID[] => {
    if (r === Region.NONE) return [];
    const log = [`noStudioPlayers|${r}`];
    const allPlayers = seqFromCurrentPlayer(G, ctx);
    log.push(`|all|${JSON.stringify(allPlayers)}`);
    const result = allPlayers.filter(pid => {
        const hasStudio = studioInRegion(G, ctx, r, pid)
        log.push(`|p${pid}|${hasStudio}`);
        return !hasStudio
    });
    log.push(`|result|${result}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result
}

export const initialPosOfPlayer = (G: IG, _ctx: Ctx, p: PlayerID): number => {
    return G.initialOrder.indexOf(p);
}

export const posOfPlayer = (G: IG, _ctx: Ctx, p: PlayerID): number => {
    return G.order.indexOf(p);
}

export const checkRegionScoring = (G: IG, ctx: Ctx, r: Region): boolean => {
    if (r === Region.NONE) return false;
    return !G.regions[r].completedLastScoring && (regionCardDepleted(G, r) || shareDepleted(G, ctx, r));
}

export const seqFromPos = (G: IG, _ctx: Ctx, pos: number): PlayerID[] => {
    const log = [`seqFromPos`];
    let seq: PlayerID[] = [];
    const remainPlayers = G.order.length;
    if (remainPlayers === 0) {
        log.push(`|emptyOrder`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return seq;
    }
    // 防止 pos 为负数时取到 undefined
    const safePos = ((pos % remainPlayers) + remainPlayers) % remainPlayers;
    for (let i = safePos; i < remainPlayers; i++) {
        log.push(`|push|${i}`);
        seq.push(G.order[i])
    }
    for (let i = 0; i < safePos; i++) {
        log.push(`|push|${i}`);
        seq.push(G.order[i])
    }
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const seqFromActivePlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    const log = [`seqFromActivePlayer`];
    let act = activePlayer(ctx);
    log.push(`|act|p${act}`);
    let pos = posOfPlayer(G, ctx, act);
    let seq = seqFromPos(G, ctx, pos);
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

// export const buildingPlayers = (G: IG, ctx: Ctx, r: Region, p: PlayerID): PlayerID[] => {
//     if (r === Region.NONE) return [];
//     return seqFromPlayer(G, ctx, p).filter(pid => cinemaInRegion(G, ctx, r, pid) || studioInRegion(G, ctx, r, pid));
// }
//
export const isSameTeam = (p: PlayerID, q: PlayerID): boolean => {
    const log = [`isSameTeam|p${p}|p${q}`];
    let result: boolean;
    if (p === '0' || p === '2') {
        result = q === '0' || q === '2'
    } else {
        result = q === '1' || q === '3'
    }
    logger.debug(`${log.join('')}|result:${result}`);
    return result;
}
export const seqFromPlayer = (G: IG, ctx: Ctx, p: PlayerID): PlayerID[] => {
    const log = [`seqFromPlayer|p${p}`];
    let pos = posOfPlayer(G, ctx, p);
    let seq = seqFromPos(G, ctx, pos);
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const seqFromCurrentPlayer = (G: IG, ctx: Ctx): PlayerID[] => {
    const log = [`seqFromCurrentPlayer`];
    log.push(`|cur|p${ctx.currentPlayer}`);
    const seq = seqFromPlayer(G, ctx, ctx.currentPlayer);
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const getCompetitionPowerLessPlayers = (G: IG, ctx: Ctx, p: PlayerID): PlayerID[] => {
    const log = [`getCompetitionPowerLessPlayers`];
    log.push(`|cur|p${ctx.currentPlayer}`);
    const atkCompetitionPowerAfterCompetition = G.pub[parseInt(p)].competitionPower - 3;
    log.push(`|atkCompetitionPowerAfterCompetition|${atkCompetitionPowerAfterCompetition}`);
    if (atkCompetitionPowerAfterCompetition <= 0) {
        log.push(`|atkCompetitionPowerAfterCompetition<=0|return[]`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return [];
    }
    let seq: PlayerID[] = [];
    const remainPlayers = G.order.length;
    const checkAndAdd = (i: number) => {
        const targetPlayer = G.order[i];
        const targetCompetitionPower = G.pub[parseInt(targetPlayer)].competitionPower;
        log.push(`|idx|${i}|p${targetPlayer}|CP:${targetCompetitionPower}`);
        if (targetCompetitionPower < atkCompetitionPowerAfterCompetition) {
            log.push(`|bigger`);
            if (G.mode !== GameMode.TEAM2V2) {
                log.push(`|normalMode|push|p${targetPlayer}`);
                seq.push(targetPlayer);
            } else {
                log.push(`|2v2`);
                if (isSameTeam(p, targetPlayer)) {
                    log.push(`|isSameTeam|doNotPush`)
                } else {
                    log.push(`|push|p${targetPlayer}`);
                    seq.push(targetPlayer);
                }
            }
        } else {
            log.push(`|smaller|skip`);
        }
    }

    const pos = posOfPlayer(G, ctx, p);
    for (let i = pos; i < remainPlayers; i++) {
        checkAndAdd(i);
    }
    for (let i = 0; i < pos; i++) {
        checkAndAdd(i);
    }
    log.push(`|seq:${JSON.stringify(seq)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return seq;
}

export const getExistingLastMovePlayer = (G: IG): PlayerID => {
    const log = ["getExistingLastMovePlayer"];
    if (G.order.length === G.initialOrder.length) {
        log.push(`|noOneConcede|lastMovePlayer`);
        const lastMovePlayer = G.initialOrder[G.playerCount - 1]
        log.push(`|${lastMovePlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return lastMovePlayer
    }
    const secondLastMovePlayer = G.initialOrder[G.playerCount - 2]
    if (G.order.includes(secondLastMovePlayer)) {
        log.push(`|secondLast`);
        log.push(`|${secondLastMovePlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return secondLastMovePlayer
    } else {
        log.push(`|thirdLast`);
        const thirdLastMovePlayer = G.initialOrder[G.playerCount - 3]
        log.push(`|${thirdLastMovePlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return thirdLastMovePlayer
    }
}

export const minHandCountPlayers = (G: IG): PlayerID[] => {
    return lowest(G, (G, i) => G.player[parseInt(i)].hand.length);
}

export const industryHighestPlayer = (G: IG): PlayerID[] => {
    return highestPlayer(G, (G, i) => G.pub[parseInt(i)].industry);
}

export const industryLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, (G, i) => G.pub[parseInt(i)].industry);
}

export const getLevelSum = (G: IG, p: PlayerID): number => {
    const log = [`getLevelSum|p${p}`];
    const pub = G.pub[parseInt(p)];
    logger.debug(`${G.matchID}|${log.join('')}`);
    return pub.aesthetics + pub.industry
}
export const getLevelMarkCount = (G: IG, p: PlayerID): number => {
    const log = [`getLevelMarkCount|p${p}`];
    const pub = G.pub[parseInt(p)];
    let result = pub.aesthetics + pub.industry
    const school = pub.school;
    if (school === null) {
        log.push(`|noSchool|${result}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return result;
    } else {
        log.push(`|school${school}`);
        const schoolCard = getCardById(school);
        result += schoolCard.aesthetics;
        result += schoolCard.industry;
        log.push(`|${result}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result
}

export const levelSumLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, getLevelSum);

}

export const levelAndMarkLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, getLevelMarkCount);
}

export const getSchoolHandLimit = (G: IG, p: PlayerID): number => {
    const school = G.pub[parseInt(p)].school;
    const log = [`getSchoolHandLimit|p${p}|school${school}`];
    const rawLimit = G.pub[parseInt(p)].LES_CHAIERS_DU_CINEMA ? LES_CHAIERS_DU_CINEMA_COMPANY_SCALE : DEFAULT_COMPANY_SCALE;
    if (school === null) {
        log.push(`|finalLimit${rawLimit}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return rawLimit;
    } else {
        const schoolLimit = getCardEffect(school).school.hand;
        log.push(`|schoolLimit${schoolLimit}`);
        const limit = schoolLimit > rawLimit ? schoolLimit : rawLimit;
        log.push(`|finalLimit${limit}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return limit
    }
}

// export const schoolHandLowestPlayer = (G: IG): PlayerID[] => {
//     return lowest(G, getSchoolHandLimit);
// }

export const schoolEraHighestPlayer = (G: IG): PlayerID[] => {
    // @ts-ignore
    return highestPlayer(G, (G, i) => G.pub[parseInt(i)].school === null ? -1 : getCardById(G.pub[parseInt(i)].school).era);
}

export const aesHighestPlayer = (G: IG): PlayerID[] => {
    return highestPlayer(G, (G, i) => G.pub[parseInt(i)].aesthetics);
}
export const aesLowestPlayer = (G: IG): PlayerID[] => {
    return lowest(G, (G, i) => G.pub[parseInt(i)].aesthetics);
}

export function vpNotHighestPlayer(G: IG): PlayerID[] {
    return notHighestPlayer(G, (G, i) => G.pub[parseInt(i)].vp);
}

export function lowest(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    const log = ["lowest"];
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let lowestMetric = func(G, G.order[0]);
    G.order.forEach((i) => {
        const metric = func(G, i);
        if (metric < lowestMetric) {
            log.push(`|p${i}|${metric}`);
            lowestMetric = metric;
        }
        metrics.push(metric);
    })
    log.push(`|lowest|${lowestMetric}`);
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m === lowestMetric) {
            log.push(`|p${i}lowest`);
            result.push(i);
        }
    })
    log.push(`|result|${JSON.stringify(result)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export function notHighestPlayer(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    const log = ["notHighestPlayer"];
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let highestMetric = 0;
    G.order.forEach((i) => {
        const metric = func(G, i);
        log.push(`|p${i}|${metric}`);
        if (metric > highestMetric) {
            highestMetric = metric;
        }
        metrics.push(metric);
    })
    log.push(`|highest|${highestMetric}`);
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m !== highestMetric) {
            log.push(`|p${i}notHighest`);
            result.push(i);
        }
    })
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export function highestPlayer(G: IG, func: (G: IG, p: PlayerID) => number): PlayerID[] {
    const log = ["highestPlayer"];
    const metrics: number[] = [];
    const result: PlayerID[] = [];
    let highestMetric = 0;
    G.order.forEach((i) => {
        const metric = func(G, i);
        log.push(`|p${i}|${metric}`);
        if (metric > highestMetric) {
            highestMetric = metric;
        }
        metrics.push(metric);
    })
    log.push(`|highest|${highestMetric}`);
    G.order.forEach((i, idx) => {
        const m = metrics[idx];
        if (m === highestMetric) {
            log.push(`|p${i}highest`);
            result.push(i);
        }
    })
    logger.debug(`${G.matchID}|${log.join('')}`);
    return result;
}

export function vpHighestPlayer(G: IG): PlayerID[] {
    return highestPlayer(G, (G, p) => G.pub[parseInt(p)].vp);
}

export const breakthroughEffectPrepare = (G: IG, card: CardID): void => {
    const log = ["breakthroughEffectPrepare"];
    let c = getCardById(card);
    let i = c.industry
    let a = c.aesthetics
    log.push(`|${c.cardId}|i${i}|a${a}`);
    if (i === 0 && a === 0) {
        log.push(`|noMarker|return`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (i > 0 && a > 0) {
        log.push(`|industryAndAestheticsBreakthrough`);
        G.e.stack.push({
            e: "industryAndAestheticsBreakthrough", a: {
                industry: c.industry,
                aesthetics: c.aesthetics,
            }
        })
        logger.debug(`${G.matchID}|${log.join('')}`);
    } else {
        if (i === 0) {
            log.push(`|aestheticsBreakthrough`);
            G.e.stack.push({e: "aestheticsBreakthrough", a: c.aesthetics})
            logger.debug(`${G.matchID}|${log.join('')}`);
        } else {
            log.push(`|industryBreakthrough`);
            G.e.stack.push({e: "industryBreakthrough", a: c.industry})
            logger.debug(`${G.matchID}|${log.join('')}`);
        }
    }
}

export const startBreakThrough = (G: IG, ctx: Ctx, pid: PlayerID, card: CardID): void => {
    const c = getCardById(card)
    const pub = G.pub[parseInt(pid)];
    const log = [`startBreakThrough|p${pid}|${card}`];
    if (pub.school === SchoolCardID.S2201) {
        log.push(`|neoRealism`);
        log.push(`|before|${JSON.stringify(G.e.stack)}`);
        G.e.stack.push({
            e: "vp", a: 2, source: "卡牌效果", card: pub.school, target: pid
        });
        G.e.stack.push({
            e: "deposit", a: 1, target: pid
        });
        log.push(`|after|${JSON.stringify(G.e.stack)}`);
    }
    if (pub.school === SchoolCardID.S1204) {
        log.push(`|swedish`);
        log.push(`|before|${JSON.stringify(G.e.stack)}`);
        G.e.stack.push({
            e: "res", a: 1, target: pid
        })
        log.push(`|after|${JSON.stringify(G.e.stack)}`);
    }
    // 巨片: 突破影片时，+1对应地区份额
    if (pub.school === SchoolCardID.S5203 && c.type === CardType.F && c.region !== Region.NONE) {
        log.push(`|EpicFilmBreakthrough|region${c.region}`);
        const r = c.region as ValidRegion;
        // @ts-ignore
        if (G.regions[r].share > 0) {
            // @ts-ignore
            pub.shares[r] += 1;
            // @ts-ignore
            G.regions[r].share -= 1;
        }
    }
    
    if (pub.school === SchoolCardID.S52683 && c.cardId === BasicCardID.B07) {
        // 2026-10 调整：由 [可选] 改为必选
        G.e.stack.push({
            e: "choice",
            a: [
                {e: "buyCardToHand", a: BasicCardID.B02},
                {e: "buyCardToHand", a: BasicCardID.B01},
            ],
            target: pid
        });
    }
    // // 明星制
    // if (pub.school === SchoolCardID.S5206) {
    //     if(c.category === CardCategory.BASIC){
    //         log.push(`|starSystem`);
    //         G.e.stack.push({
    //             e: "pay", a: {
    //                 cost: {e: "vp", a: 1},
    //                 eff: {e: "res", a: 1}
    //             }
    //         });
    //     }
    // }
    if (c.cardId === FilmCardID.F1108) {
        const curDep = pub.deposit;
        if (curDep >= 1) {
            log.push(`hasCash|${curDep}|industryAndAestheticsBreakthrough`);
            G.e.stack.push({
                e: "industryAndAestheticsBreakthrough", a: {
                    industry: 1,
                    aesthetics: 1,
                }
            })
            loseDeposit(G, ctx, pid, 1);
            log.push(`|playerEffExec`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            playerEffExec(G, ctx, pid);
        } else {
            log.push(`|noCash|${curDep}`);
        }
        return
    }
    if (c.cardId === FilmCardID.F1208 || c.cardId === BasicCardID.B05) {
        log.push("|industryOrAestheticsBreakthrough");
        G.e.stack.push({
            e: "industryOrAestheticsBreakthrough", a: {
                industry: 1,
                aesthetics: 1,
            }
        })
        log.push(`|playerEffExec`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        playerEffExec(G, ctx, pid);
        return;
    }
    log.push(`|breakthroughEffectPrepare`);
    breakthroughEffectPrepare(G, card);
    const cardEff = getCardEffect(c.cardId);
    if (cardEff.hasOwnProperty("archive")) {
        const eff = {...cardEff.archive};
        if (eff.e !== "none") {
            //流派扩：法国印象派
            if (pub.school === SchoolCardID.S4001) {
                if (eff.e === SimpleEffectNames.addVp && eff.a >= 3) {
                    pub.resource += 1;
                }
                if (eff.e === ItrEffects.step){
                    for (let sk of eff.a) {
                        if (sk.e == SimpleEffectNames.addVp && sk.a >= 3) {
                            pub.resource += 1;
                        }
                    }
                }
            }
            eff.target = pid;
            log.push(`|pushEffect|${JSON.stringify(eff)}`);
            G.e.stack.push(eff)
        } else {
            log.push(`|noSpecialArchiveEffect`);
        }
    } else {
        log.push(`|missingArchiveEffect`);
    }
    log.push(`|checkNextEffect`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    //流派扩：玛萨拉突破
    if (pub.school === SchoolCardID.S4002 && c.industry === 0 && c.aesthetics === 0
        && !(c.cardId in ScoreCardID) && (c.cardId !== BasicCardID.B07) && !(c.cardId in PersonCardID)) {
        log.push("|industryOrAestheticsBreakthrough");
        G.e.stack.push({
            e: "industryOrAestheticsBreakthrough", a: {
                industry: 1,
                aesthetics: 1,
            }, target: pid,
        })
        log.push(`|playerEffExec`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        // checkNextEffect(G, ctx);
        // playerEffExec(G, ctx, pid);
    }
    // checkNextEffect(G, ctx);
    playerEffExec(G, ctx, pid);
    // return;
}

export const curCard = (G: IG) => {
    if (G.e.card === null) {
        throw Error("No current card")
    }
    return getCardById(G.e.card);
}

export const pushPlayersEffects = (G: IG, players: PlayerID[], eff: any) => {
    const log = [`pushPlayersEffects|players|${JSON.stringify(players)}`];
    const pos = players.length;
    for (let i = pos - 1; i >= 0; i--) {
        const targetEff = {...eff, target: players[i]};
        G.e.stack.push(targetEff);
    }
    log.push(`|${JSON.stringify(G.e.stack)}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const playerEffExec = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const log = [`|playerEffExec|p${p}`];
    let eff = G.e.stack.pop();
    if (eff === undefined) {
        log.push("|StackEmpty|checkNextEffect");
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
        return;
    }
    log.push(`|eff|${JSON.stringify(eff)}`);
    G.e.currentEffect = eff;

    
    // 阻止自动结算导致他人操作结算后撤回
    if (p !== ctx.currentPlayer) {
        const privateOps = [
            "discard", "discardBasic", "discardNormalOrLegend", "discardLegend",
            "discardAesthetics", "discardIndustry", "breakthroughResDeduct",
            "handToAnyPlayer", "discardToAnyPlayer", "playedCardInTurnEffect", "personCardOnBoardEffect",
        ];
        if (privateOps.includes(eff.e)) {
            G.previousMoveUndoable = false;
            log.push(`|noUndo|privateOpOnOtherPlayer`);
        }
    }


    let targetPlayer = p;
    let pub = G.pub[parseInt(p)];
    const playerObj = G.player[parseInt(p)];
    let region: ValidRegion;
    if (G.e.card !== null) {
        const curCardObj = curCard(G);
        region = curCardObj.region as ValidRegion;
    } else {
        region = Region.NA;
    }
    log.push(`|c:${G.e.card}|region:${region}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    let players = [];
    const handLength = playerObj.hand.length;
    let subEffect;
    let extraCost = 0;
    const totalRes = pub.resource + pub.deposit;
    let validCardsToDiscard: CardID[] = [];
    const discardOpsReturn = (): boolean => {
        log.push(`|discardOpsReturn`);
        const validCount = validCardsToDiscard.length;
        const effectCount = eff.a;
        const deltaCount = validCount - effectCount;
        log.push(`|valid${validCount}|effect${effectCount}|delta${deltaCount}`);
        if (deltaCount > 0) {
            G.e.stack.push(eff);
            changePlayerStage(G, ctx, "chooseHand", p);
            log.push(`|p${p}|chooseHand`);
            return true;
        } else {
            if (pub.school === SchoolCardID.S4003) {
                for(let card of validCardsToDiscard) {
                    pub.deposit += 1;
                    addSchoolVp(G, ctx, p, 1);
                }
            }
            /*
            if (pub.school === SchoolCardID.S6342) {
                for(let card of validCardsToDiscard) {
                    for(let i = 0; i < getCardById(card).industry; i++) addRes(G, ctx, p, 1);
                    for(let i = 0; i < getCardById(card).aesthetics; i++) addVp(G, ctx, p, 1);
                }
            }
            */
            log.push(`|prev|${JSON.stringify(playerObj.hand)}|${JSON.stringify(pub.discard)}`);
            playerObj.hand = playerObj.hand.filter((handElm) => validCardsToDiscard.indexOf(handElm) === -1);
            pub.discard = pub.discard.concat(validCardsToDiscard);
            log.push(`|after|${JSON.stringify(playerObj.hand)}|discard|${JSON.stringify(pub.discard)}`);
            if (deltaCount < 0) {
                pub.revealedHand = [...playerObj.hand]
                log.push(`|NoEnoughValidCardsRevealHand|${JSON.stringify(pub.revealedHand)}|next`);
            } else {
                log.push(("|justEnoughDoNotRevealHand|next"));
            }
            return false;
        }
    };
    switch (eff.e) {
        case "playedCardInTurnEffect":
            if (pub.playedCardInTurn.filter(c => getCardById(c).aesthetics > 0 && c !== G.e.card).length > 0) {
                log.push(`|chooseHand`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            log.push(`|noAesMarkCardPlayed`);
            break;
        case "personCardOnBoardEffect":
            if (getPersonCardsOnBoard(G).length > 0) {
                log.push(`|chooseHand`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            }
            log.push(`|noPersonCardOnBoard`);
            break;
        case "aestheticsLevelUpCost":
            extraCost = additionalCostForUpgrade(G, pub.aesthetics);
            log.push(`|extra|${extraCost}`);
            if (
                extraCost < totalRes &&
                extraCost > 0
            ) {
                log.push(`|canChoose|payAdditionalCost`);
                G.e.extraCostToPay = extraCost;
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            } else {
                payCost(G, ctx, p, extraCost);
                if (pub.aesthetics < 10) {
                    log.push(`|upgrade`);
                    pub.aesthetics++;
                    sync3DFilmCompetitionPower(G, p);
                    onAestheticsLevelUp(G, ctx, p);
                }
            }
            break
        case "industryLevelUpCost":
            extraCost = additionalCostForUpgrade(G, pub.industry);
            log.push(`|extra|${extraCost}`);
            if (extraCost < totalRes && extraCost > 0) {
                log.push(`|canChoose|payAdditionalCost`);
                G.e.extraCostToPay = extraCost;
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "payAdditionalCost", p);
                return;
            } else {
                payCost(G, ctx, p, extraCost);
                if (pub.industry < 10) {
                    log.push(`|upgrade`);
                    pub.industry++;
                    sync3DFilmCompetitionPower(G, p);
                }
            }
            break;
        case "searchAndArchive":
            players = ownCardPlayers(G, ctx, eff.a);
            if (players.length === 0) {
                log.push(`noPlayerOwn${eff.a}`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                break;
            } else {
                log.push(`|players${JSON.stringify(players)}`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.currentEffect = eff;
                changePlayerStage(G, ctx, "confirmRespond", players[0]);
                return;
            }
        case "era":
            // 武侠电影
            if (pub.school === SchoolCardID.S5209 && pub.action == 1 && G.e.card !== null) {
                const cardObj = curCard(G);
                const isObsoleteFilm = cardObj.type === CardType.F && cardObj.region !== Region.NONE &&
                    cardObj.era < G.regions[cardObj.region].era;
                if (isObsoleteFilm) {
                    if (pub.deposit >= 1) {
                        deductDeposit(G, ctx, p, 1);
                        let era;
                        for (era = 0; era < 3; era++) {
                            if (eff.a[era].e !== 'none') break;
                        }
                        log.push(`|era|${era}|payDeposit`);
                        subEffect = {...eff.a[era]}
                        if (eff.hasOwnProperty("target")) {
                            subEffect.target = eff.target
                        }
                        G.e.stack.push(subEffect);
                        log.push(`|era|${JSON.stringify(G.e.stack)}`);
                        break;
                    } else {
                        log.push(`|noDeposit|wuxia`);
                        addSchoolVp(G, ctx, p, 1);
                        subEffect = getEraEffectByRegion(G, ctx, eff, region);
                        G.e.stack.push(subEffect);
                        log.push(`|era|${JSON.stringify(G.e.stack)}`);
                        break;
                    }
                }
            }
            subEffect = getEraEffectByRegion(G, ctx, eff, region);
            G.e.stack.push(subEffect);
            log.push(`|era|${JSON.stringify(G.e.stack)}`);
            break;
        case "breakthroughResDeduct":
            if (handLength > 0) {
                log.push(`|chooseHand`);
                G.e.stack.push(eff);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                break;
            }
        case "alternative":
            if (idOnBoard(G, ctx, eff.a.a)) {
                G.e.stack.push(eff)
                G.e.currentEffect = eff;
                log.push(`|confirmRespond`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "confirmRespond", p);
                return;
            } else {
                break;
            }
        case "competition": //{
            // if (pub.school === SchoolCardID.S2101) {
            //     log.push(`|ClassicHollywood|noExtraFee`);
            // } else {
            //     if (
            //         totalRes > 1 &&
            //         pub.resource > 0 &&
            //         pub.deposit > 0
            //     ) {
            //         log.push(`|canChoose|payAdditionalCost`);
            //         G.e.extraCostToPay = 1;
            //         logger.debug(`${G.matchID}|${log.join('')}`);
            //         G.e.stack.push(eff);
            //         changePlayerStage(G, ctx, "payAdditionalCost", p);
            //         return;
            //     } else {
            //         if (totalRes === 0) {
            //             log.push(`|noResOrDeposit|pass`);
            //             break;
            //         } else {
            //             log.push(`|payDirectly`);
            //             if (pub.resource > 0) {
            //                 log.push(`prevRes:|${pub.resource}`);
            //                 pub.resource--;
            //                 log.push(`afterRes|${pub.resource}`);
            //             } else {
            //                 log.push(`prevDeposit:|${pub.deposit}`);
            //                 pub.deposit--;
            //                 log.push(`afterDeposit|${pub.deposit}`);
            //             }
            //         }
            //     }
            // }
            // }
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                players = getCompetitionPowerLessPlayers(G, ctx, p);
                const ownIndex = players.indexOf(p)
                if (ownIndex !== -1) {
                    players.splice(ownIndex, 1);
                }
                log.push(`|competitionPlayers:|${JSON.stringify(players)}|length:${players.length}`);
                // console.log()
                switch (players.length) {
                    case 0: {
                        log.push("|noValidTarget|checkNextEffect");
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        checkNextEffect(G, ctx);
                        break;
                    }
                    default: {
                        log.push("|chooseTarget");
                        G.c.players = players;
                        G.e.stack.push(eff);
                        G.competitionInfo.onWin = eff.a.onWin;
                        log.push(`|chooseTarget`);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        changePlayerStage(G, ctx, "chooseTarget", p);
                        return;
                    }
                }
                break;
            } else {
                // G.competitionInfo.progress = eff.a.bonus;
                G.competitionInfo.onWin = eff.a.onWin;
                log.push(`|startCompetition`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                const opponent2p = p === '0' ? '1' : '0';
                const opponentCompetitionPower = G.pub[parseInt(opponent2p)].competitionPower;
                const playerCompetitionPower = G.pub[parseInt(p)].competitionPower;
                if (playerCompetitionPower > opponentCompetitionPower) {
                    startCompetition(G, ctx, p, opponent2p);
                }
                break;
            }
        case ItrEffects.loseAnyRegionShare:
            G.e.regions = valid_regions.filter(r => pub.shares[r] > 0);
            log.push(`|loseAnyRegionShare`);
            log.push(`|regions|${JSON.stringify(G.e.regions)}`);
            if (G.e.regions.length === 0) {
                log.push(`|NoRegionHasShare`)
                ctx?.events?.endStage?.()
                log.push(`|endStage`);
                break;
            } else {
                if (G.e.regions.length === 1) {
                    const targetRegion = G.e.regions[Region.NA];
                    if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(targetRegion))) {
                        log.push(`|Region|NONE|exit`)
                        break;
                    }
                    // @ts-ignore
                    playerLoseShare(G, targetRegion, p, eff.a);
                    loseCompetitionPower(G, ctx, p, 1);
                    G.e.regions = [];
                    break;
                } else {
                    G.e.stack.push(eff);
                    changePlayerStage(G, ctx, "chooseRegion", p);
                    return;
                }
            }
        case ItrEffects.anyRegionShareCompetition:
            log.push(`|pendingCompetition`);
            const winner = G.competitionInfo.atk;
            const loser = G.competitionInfo.def;
            G.e.regions = valid_regions.filter(r => G.pub[parseInt(loser)].shares[r] > 0)
            if (G.e.regions.length === 0) {
                log.push("|loserNoShare");
                competitionCleanUp(G, ctx);
                break;
            } else {
                log.push(`|p${winner}|chooseRegion`);
                G.e.stack.push(eff)
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseRegion", winner);
                return;
            }
        case ItrEffects.anyRegionShare:
        case ItrEffects.anyRegionShareCentral:
            G.e.regions = valid_regions.filter(r => G.regions[r].share > 0)
            if (G.e.regions.length === 0) {
                log.push("No share on board, cannot obtain from others.");
                break;
            } else {
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseRegion", p);
                return;
            }
        case "handToAnyPlayer":
            log.push(`|handToAnyPlayer`);
            if (playerObj.hand.length > 0) {
                players = seqFromCurrentPlayer(G, ctx);
                G.c.players = players
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseTarget", p);
                return;
            } else {
                log.push(`|noCardInHand|pass`);
                break;
            }
        case "discardToAnyPlayer":
            log.push(`|discardToAnyPlayer`);
            if (pub.discard.length > 0) {
                players = seqFromCurrentPlayer(G, ctx);
                G.c.players = players
                G.e.stack.push(eff)
                changePlayerStage(G, ctx, "chooseTarget", p);
                return;
            } else {
                log.push(`|noCardInDiscard|pass`);
                break;
            }
        case "industryAndAestheticsBreakthrough":
            if (eff.a.industry === 0 && eff.a.aesthetics === 0) {
                break;
            }
            if (eff.a.industry === 0 && eff.a.aesthetics > 0) {
                G.e.stack.push(eff)
                doAestheticsBreakthrough(G, ctx, p);
                return;
            }
            if (eff.a.industry > 0 && eff.a.aesthetics === 0) {
                G.e.stack.push(eff)
                doIndustryBreakthrough(G, ctx, p);
                return;
            }
            G.e.stack.push(eff)
            G.e.choices.push({e: "industryBreakthrough", a: eff.a.industry})
            G.e.choices.push({e: "aestheticsBreakthrough", a: eff.a.aesthetics})
            changePlayerStage(G, ctx, "chooseEffect", p);
            return;
        case "industryOrAestheticsBreakthrough":
            G.e.choices.push({e: "industryBreakthrough", a: eff.a.industry})
            G.e.choices.push({e: "aestheticsBreakthrough", a: eff.a.aesthetics})
            changePlayerStage(G, ctx, "chooseEffect", p);
            return;
        case "peek":
            let peekCount = eff.a.count;
            log.push(`|peek|${peekCount}cards`);
            let deck = G.secretInfo.playerDecks[parseInt(p)];
            log.push(`|deck|${JSON.stringify(deck)}`);
            log.push(`|hand${JSON.stringify(playerObj.hand)}`);
            log.push(`|discard|${JSON.stringify(pub.discard)}`);
            const totalRemainCards = deck.length + pub.discard.length;
            log.push(`|totalRemainCards|${totalRemainCards}`);
            if (totalRemainCards === 0) {
                log.push(`|noCardLeftSkip`);
                break;
            }
            log.push(`|deckAndDiscardSum|${totalRemainCards}`);
            for (let count = 0; count < peekCount; count++) {
                log.push(`|drawPeekCardForPlayer|count|${count}`);
                drawPeekCardForPlayer(G, ctx, p);
            }
            log.push(`|peekCard|${JSON.stringify(playerObj.cardsToPeek)}`);
            log.push(`|afterDeck|${JSON.stringify(deck)}|afterHand${JSON.stringify(playerObj.hand)}|afterDiscard|${JSON.stringify(pub.discard)}`);
            const drawnCard = playerObj.cardsToPeek.length;
            const newEffect = {...eff};
            // if (newEffect.a.filter.e === "choice" && newEffect.a.filter.a > drawnCard) {
            //     log.push(`|noEnoughCardToChoose`);
            //     newEffect.a.filter.a = drawnCard;
            //     log.push(`|${JSON.stringify(newEffect)}`);
            // }
            // console.log(drawnCard);
            // console.log(G.player[parseInt(p)].cardsToPeek);
            // console.log(newEffect.a.filter.a);
            // if (newEffect.a.filter.e === "choice" && newEffect.a.filter.a === drawnCard) {
            //     for (let card of G.player[parseInt(p)].cardsToPeek){
            //         G.player[parseInt(p)].hand.push(card);
            //     }
            //     G.player[parseInt(p)].cardsToPeek = [];
            //     return;
            // }

            if (newEffect.a.filter.e === "choice" && newEffect.a.filter.a > drawnCard) {
                log.push(`|noEnoughCardToChoose`);
                //newEffect.a.filter.a = drawnCard;
                //newEffect.a.filter = {...newEffect.a.filter, a: drawnCard};
                newEffect.a = {...newEffect.a, filter: {...newEffect.a.filter, a: drawnCard}};
                log.push(`|${JSON.stringify(newEffect)}`);
            }

            G.e.stack.push(newEffect)
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "peek", p);
            return;
        case "noBuildingEE":
            players = noBuildingPlayers(G, ctx, Region.EE, G.pending.firstPlayer);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "vpNotHighestPlayer":
            players = vpNotHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "highestVpPlayer":
            players = vpHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "levelSumLowestPlayer":
            players = levelSumLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "levelAndMarkLowestPlayer":
            players = levelAndMarkLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "aesHighest":
            players = aesHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "schoolEraHighestPlayer":
            players = schoolEraHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "aesLowest":
            players = aesLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "industryHighest":
            players = industryHighestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "industryLowest":
            players = industryLowestPlayer(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "studio":
            players = studioPlayers(G, ctx, region, p);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "minHandCountPlayers":
            players = minHandCountPlayers(G);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "noBuildingPlayers":
            players = noBuildingPlayers(G, ctx, eff.region, G.pending.firstPlayer);
            pushPlayersEffects(G, players, eff.a);
            break;
        case "everyOtherCompany":
            players = seqFromCurrentPlayer(G, ctx);
            players.shift()
            pushPlayersEffects(G, players, eff.a);
            break;
        case "everyPlayer":
            const pos = posOfPlayer(G, ctx, G.pending.firstPlayer);
            log.push(`|pos${pos}`);
            players = seqFromPos(G, ctx, pos);
            log.push(`|players${players}`);
            pushPlayersEffects(G, players, eff.a);
            break;
        case ItrEffects.chooseOnePlayer:
            G.c.players = seqFromCurrentPlayer(G, ctx);
            G.e.stack.push(eff.a);
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "noStudio":
            if(pub.school === SchoolCardID.S6004){
                players = noStudioPlayers(G, ctx, region);
                if(players.includes(p)) players.splice(players.indexOf(p), 1);
                pushPlayersEffects(G, players, eff.a);
                checkNextEffect(G, ctx);
                return;
            }
            players = noStudioPlayers(G, ctx, region);
            log.push(`|region:${region}|noStudioPlayers|${JSON.stringify(players)}`);
            if (players.length === 0) {
                log.push(`|everyOneHasStudio`);
                break;
            }
            G.c.players = players;
            log.push(`|${JSON.stringify(G.c.players)}`);
            // console.log(`|${JSON.stringify(G.c.players)}|${JSON.stringify(G.e)}`);
            G.e.stack.push(eff.a);
            logger.debug(`|${JSON.stringify(G.e.stack)}|${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "chooseTarget", p);
            return;
        case "52701_buy":
            // 2026-10 技术：变焦镜头 - 选择一个地区
            // 可选地区：未关闭（未完成3时代结算）且已开放（亚洲需已进入2时代）的地区
            log.push(`|chooseRegion|52701_buy`);
            const visualRegions = valid_regions.filter(r => {
                if (G.regions[r].completedLastScoring) return false;
                if (r === Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE) return false;
                return true;
            });
            log.push(`|regions|${JSON.stringify(visualRegions)}`);
            if (visualRegions.length === 0) {
                log.push(`|noRegion|skip`);
                break;
            }
            G.e.regions = visualRegions;
            G.e.stack.push(eff);
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "chooseRegion", p);
            return;
        case "step":
            log.push(("|step"));
            const effectCount = eff.a.length;
            for (let i = effectCount - 1; i >= 0; i--) {
                subEffect = {...eff.a[i]};
                if (eff.hasOwnProperty("target")) {
                    log.push(`|specifyTarget|${eff.target}`);
                    subEffect.target = eff.target;
                }
                log.push(`|push|${JSON.stringify(subEffect)}`);
                G.e.stack.push(subEffect);
            }
            log.push(`|result|${JSON.stringify(G.e.stack)}`);
            break;
        case "discardBasic":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).category === CardCategory.BASIC
            );
            if (discardOpsReturn()) {
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardNormalOrLegend":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).category !== CardCategory.BASIC &&
                getCardById(i).category !== CardCategory.SCORE
            );
            if (discardOpsReturn()) {
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardLegend":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).category === CardCategory.LEGEND
            );
            if (discardOpsReturn()) {
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardAesthetics":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).aesthetics > 0
            );
            if (discardOpsReturn()) {
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "discardIndustry":
            validCardsToDiscard = playerObj.hand.filter(i =>
                getCardById(i).industry > 0
            );
            if (discardOpsReturn()) {
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
            break;
        case "refactor":
        case "archive":
        case "discard":
            log.push(`|hand|${handLength}|discard|${eff.a}`);
            if (handLength > 0) {
                if (handLength < eff.a) {
                    log.push(`|noEnoughCard`);
                    eff.a = handLength
                }
                log.push(`|chooseHand`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                G.e.stack.push(eff);
                changePlayerStage(G, ctx, "chooseHand", p);
                return;
            } else {
                log.push(("|EmptyHand|next"));
            }
            break;
        case "choice":
            // 2026-10 修复：不再因为某个选项无法执行而自动选择。
            // 保留全部选项供玩家选择；选中无法执行的选项时按「空置执行」处理（效果内部自行跳过）。
            // 例：乡村牧师日记在手牌为空时，玩家仍可选择「免费突破一次」→ 空置执行。
            for (let choice of eff.a) {
                const choiceEff = eff.hasOwnProperty("target") ? {...choice, target: eff.target} : {...choice};
                G.e.choices.push(choiceEff);
            }
            if (G.e.choices.length === 0) {
                log.push(`|noChoiceDefined`);
                break;
            } else {
                if (G.e.choices.length === 1) {
                    // 仅当数据上只定义了一个选项时才自动执行
                    G.e.stack.push(G.e.choices.pop());
                    log.push(`|oneChoiceDefined|Exec`);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    checkNextEffect(G, ctx);
                    return;
                } else {
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    changePlayerStage(G, ctx, "chooseEffect", p);
                    return;
                }
            }
        case "update":
            // 2026-10 修复：所有地区为空时直接跳过，避免进入无法点击的空阶段
            if (!hasUpdatableSlot(G)) {
                log.push(`|noSlotToUpdate`);
                break;
            } else {
                changePlayerStage(G, ctx, "updateSlot", p);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
        case "comment":
            if (
                !hasUpdatableSlot(G) || commentBasicCardDepleted(G)
            ) {
                log.push(`|noTargetOrCommentCard`);
                break;
            } else {
                changePlayerStage(G, ctx, "comment", p);
                logger.debug(`${G.matchID}|${log.join('')}`);
                return;
            }
        case "pay":
            subEffect = {...eff.a.eff};
            if (eff.hasOwnProperty("target")) {
                log.push(`|target|${eff.target}`);
                subEffect.target = eff.target
            }
            switch (eff.a.cost.e) {
                case "res":
                    // if (G.competitionInfo.pending) {
                    //     log.push(`|inCompetition|noDeduct`);
                    //     G.e.stack.push(subEffect);
                    //     break;
                    // }
                    if (pub.resource + pub.deposit < eff.a.cost.a) {
                        break;
                    } else if (pub.resource >= eff.a.cost.a) {
                        pub.resource -= eff.a.cost.a;
                        G.e.stack.push(subEffect);
                        break;
                    } else {
                        const depCost = eff.a.cost.a - pub.resource;
                        pub.resource = 0;
                        deductDeposit(G, ctx, p, depCost);
                        G.e.stack.push(subEffect);
                        break;
                    }
                case "vp":
                case "addVp":
                case "addExtraVp":
                    if (pub.vp < eff.a.cost.a) {
                        break;
                    } else {
                        loseVp(G, ctx, p, eff.a.cost.a);
                        G.e.stack.push(subEffect);
                        break;
                    }
                case "deposit":
                    if (pub.deposit < eff.a.cost.a) {
                        break;
                    } else {
                        loseDeposit(G, ctx, p, eff.a.cost.a);
                        G.e.stack.push(subEffect);
                        break;
                    }
                case "share":
                    playerLoseShare(G, eff.a.cost.region, p, eff.a.cost.a);
                    G.e.stack.push(subEffect);
                    break;
                default:
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    throw new Error();
            }
            break;
        case "optional":
            G.e.stack.push(eff);
            G.e.currentEffect = eff;
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "confirmRespond", p);
            return;
        case "industryOrAestheticsLevelUp":
            if (eff.hasOwnProperty("target") && eff.target !== p) {
                log.push(`|otherPlayerVPAward`);
                targetPlayer = eff.target
                pub = G.pub[parseInt(targetPlayer)];
            }
            log.push(`|i${pub.industry}a${pub.aesthetics}`);
            if (pub.industry < 10 && pub.aesthetics < 10) {
                log.push(`|${JSON.stringify(G.e.choices)}|addChoice`);
                G.e.choices.push({e: "industryLevelUp", a: 1});
                G.e.choices.push({e: "aestheticsLevelUp", a: 1});
                if (eff.a > 1) {
                    log.push(`|moreThanOne|pushBack`);
                    eff.a--;
                    G.e.stack.push(eff);
                }
                log.push(`|${JSON.stringify(G.e)}|chooseEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseEffect", targetPlayer);
                return;
            } else {
                if (pub.industry < 10) {
                    log.push(`|aesthetics10AddIndustry`);
                    pub.industry++;
                    sync3DFilmCompetitionPower(G, targetPlayer);
                    log.push(`|i${pub.industry}`);
                } else {
                    if (pub.aesthetics < 10) {
                        log.push(`|Industry10AddAesthetics`);
                        pub.aesthetics++;
                        sync3DFilmCompetitionPower(G, targetPlayer);
                        onAestheticsLevelUp(G, ctx, targetPlayer);
                        log.push(`|i${pub.aesthetics}`);
                    } else {
                        log.push("|bothLV10|skip");
                    }
                }
                if (eff.a > 1) {
                    eff.a--;
                    G.e.stack.push(eff);
                }
                break;
            }
        case "industryOrAestheticsLevelDown":
            if (eff.hasOwnProperty("target") && eff.target !== p) {
                log.push(`|otherPlayerVPAward`);
                targetPlayer = eff.target
                pub = G.pub[parseInt(targetPlayer)];
            }
            log.push(`|i${pub.industry}a${pub.aesthetics}`);
            if (pub.industry > 0 && pub.aesthetics > 0) {
                log.push(`|${JSON.stringify(G.e.choices)}|addChoice`);
                G.e.choices.push({e: "industryLevelDown", a: 1});
                G.e.choices.push({e: "aestheticsLevelDown", a: 1});
                if (eff.a > 1) {
                    log.push(`|moreThanOne|pushBack`);
                    eff.a--;
                    G.e.stack.push(eff);
                }
                log.push(`|${JSON.stringify(G.e)}|chooseEffect`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                changePlayerStage(G, ctx, "chooseEffect", targetPlayer);
                return;
            } else {
                if (pub.industry > 0) {
                    log.push(`|aesthetics10AddIndustry`);
                    pub.industry--;
                    if(pub.competitionPower > pub.industry) pub.competitionPower = pub.industry;
                    sync3DFilmCompetitionPower(G, targetPlayer);
                    log.push(`|i${pub.industry}`);
                } else {
                    if (pub.aesthetics > 0) {
                        log.push(`|Industry10AddAesthetics`);
                        pub.aesthetics--;
                        sync3DFilmCompetitionPower(G, targetPlayer);
                        log.push(`|i${pub.aesthetics}`);
                    } else {
                        log.push("|bothLV10|skip");
                    }
                }
                if (eff.a > 1) {
                    eff.a--;
                    G.e.stack.push(eff);
                }
                break;
            }
        case "archiveToEEBuildingVP":
            G.e.stack.push(eff);
            log.push(`|chooseHand`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            changePlayerStage(G, ctx, "chooseHand", p);
            return;
        case "industryBreakthrough":
            if (eff.a > 1) {
                log.push(`|multiple`);
                eff.a--;
                G.e.stack.push(eff);
            }
            logger.debug(`${G.matchID}|${log.join('')}`);
            doIndustryBreakthrough(G, ctx, p);
            return;
        case "aestheticsBreakthrough":
            if (eff.a > 1) {
                log.push(`|multiple`);
                eff.a--;
                G.e.stack.push(eff);
            }
            logger.debug(`${G.matchID}|${log.join('')}`);
            doAestheticsBreakthrough(G, ctx, p);
            return;
        case "6311_effect":
        case "6312_effect":
            logger.debug(`${G.matchID}|${log.join('')}`);
            break;
        default:
            log.push(`|simpleEffect`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            G.e.stack.push(eff);
            simpleEffectExec(G, ctx, p);
    }
    log.push("|checkNextEffect");
    logger.debug(`${G.matchID}|${log.join('')}`);
    checkNextEffect(G, ctx);
    return;
}

export const getEraEffectByRegion = (G: IG, ctx: Ctx, effect: any, region: Region): any => {
    const log = [`getCardEraEffect|${JSON.stringify(effect)}|region:${region}`];
    let subEffect;
    if (region !== Region.NONE) {
        let era;
        if (ctx.numPlayers > SimpleRuleNumPlayers) {
            log.push(`|not2p`);
            era = G.regions[region].era;
        } else {
            log.push(`|2p`);
            era = G.twoPlayer.era;
        }
        log.push(`|era|${era}`);
        subEffect = {...effect.a[era]}
        if (effect.hasOwnProperty("target")) {
            subEffect.target = effect.target
        }
    } else {
        subEffect = {};
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    return subEffect;
}

export const aesAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    aesAwardEndTurn(G, ctx, p);
    const pub = G.pub[parseInt(p)];
    const log = [`aesAward|p${p}|${pub.industry}`];
    if (pub.school === SchoolCardID.S3304 && ctx.currentPlayer === p) {
        log.push(`|S3304|aesAwardInTurn|Draw`);
        drawCardForPlayer(G, ctx, p);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const aesAwardEndTurn = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    const log = [`aesAwardEndTurn|p${p}|${pub.aesthetics}`];
    if (pub.aesthetics > 1) {
        log.push(`|>1`);
		
		if (pub.school === SchoolCardID.S5003) {
            addRes(G, ctx, p, 1);
		}else{
			addVp(G, ctx, p, 1, "美学奖励", G.e?.vpContext?.card ?? null);
		}
    }
    if (pub.aesthetics > 4) {
        log.push(`|>4`);
        addVp(G, ctx, p, 2, "美学奖励", G.e?.vpContext?.card ?? null);
        if (pub.school === SchoolCardID.S4001) {
            log.push(`|FrenchImpressionism`)
            addRes(G, ctx, p, 1);
        }
    }
    if (pub.aesthetics > 7) {
        log.push(`|>7`);
        if(pub.school === SchoolCardID.S6002){
            //addRes(G, ctx, p, 1);
        }else{
            addVp(G, ctx, p, 2, "美学奖励", G.e?.vpContext?.card ?? null);
        }
    }

    let deltaLv = pub.aesthetics - pub.industry;
    if(deltaLv < 0) deltaLv = -deltaLv;
    if (pub.school === SchoolCardID.S6002 && deltaLv <= 2) {
        if (pub.aesthetics > 1) {
            log.push(`|>1`);
            addVp(G, ctx, p, 1, "美学奖励", SchoolCardID.S6002);
        }
        if (pub.aesthetics > 4) {
            log.push(`|>4`);
            addVp(G, ctx, p, 2, "美学奖励", SchoolCardID.S6002);
        }
        if (pub.aesthetics > 7) {
            log.push(`|>7`);
            //addRes(G, ctx, p, 1);
        }
    }

    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const industryAwardEndTurn = (G: IG, ctx: Ctx, p: PlayerID): void => {
    // const i = G.competitionInfo;
    const pub = G.pub[parseInt(p)];
    const log = [`industryAward|p${p}|${pub.industry}`];
    if (pub.industry > 1) {
        log.push(`|before|${pub.resource}`);
        addRes(G, ctx, p, 1);
        log.push(`|after|${pub.resource}`);
    }
    // if (i.pending) {
    //     log.push(`|inCompetition|skipNext`);
    //     logger.debug(`${G.matchID}|${log.join('')}`);
    //     return;
    // }
    if (pub.industry > 4) {
        drawCardForPlayer(G, ctx, p);
    }
    if (pub.industry > 7) {
        if(pub.school === SchoolCardID.S6002){
            //addVp(G, ctx, p, 1);
        }else{
            drawCardForPlayer(G, ctx, p);
            addCompetitionPower(G, ctx, p, 1);
        }
    }
    let deltaLv = pub.aesthetics - pub.industry;
    if(deltaLv < 0) deltaLv = -deltaLv;
    if (pub.school === SchoolCardID.S6002 && deltaLv <= 2) {
        if (pub.industry > 1) {
            log.push(`|before|${pub.resource}`);
            addRes(G, ctx, p, 1);
            log.push(`|after|${pub.resource}`);
        }
        if (pub.industry > 4) {
            drawCardForPlayer(G, ctx, p);
        }
        if (pub.industry > 7) {
            //addVp(G, ctx, p, 1);
        }
        if(pub.activeCardInTurn.includes(FilmCardID.F6312)){
            drawCardForPlayer(G, ctx, p);
        }
    }
    if(pub.activeCardInTurn.includes(FilmCardID.F6312)){
        drawCardForPlayer(G, ctx, p);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}
export const industryAward = (G: IG, ctx: Ctx, p: PlayerID): void => {
    industryAwardEndTurn(G, ctx, p);
    const pub = G.pub[parseInt(p)];
    const log = [`industryAward|InTurn|p${p}|${pub.industry}`];
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const cardSlotOnBoard2p = (G: IG, _ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if (card.region === Region.NONE) return null;
    if (card.type === CardType.S) {
        for (let slot of G.twoPlayer.school) {
            if (slot.card === card.cardId) return slot;
        }
        return null;
    } else {
        for (let slot of G.twoPlayer.film) {
            if (slot.card === card.cardId) return slot;
        }
        return null;
    }
}
export const cardSlotOnBoard = (G: IG, _ctx: Ctx, card: INormalOrLegendCard): ICardSlot | null => {
    if (card.region === Region.NONE) return null;
    let r = G.regions[card.region];
    switch (card.cardId) {
        case SchoolCardID.S4001:
        case SchoolCardID.S4002:
        case SchoolCardID.S4003:
        case SchoolCardID.S4004:
        case SchoolCardID.S4005:
        case SchoolCardID.S4006:
        case SchoolCardID.S4007:
        case SchoolCardID.S4008:
            r = G.regions[Region.EXTENSION];
			break;
        case SchoolCardID.S5001:
        case SchoolCardID.S5002:
        case SchoolCardID.S5003:
        case SchoolCardID.S5004:
        case SchoolCardID.S6001:
        case SchoolCardID.S6002:
        case SchoolCardID.S6003:
        case SchoolCardID.S6004:
            if(G.extensionMode === ExtensionMode.FOUR) r = G.regions[Region.EXTENSION];
            else r = G.regions[Region.EXTENSION1];
            break;
        case SchoolCardID.S5201:
        case SchoolCardID.S5202:
        case SchoolCardID.S5203:
        case SchoolCardID.S5204:
        case SchoolCardID.S5205:
        case SchoolCardID.S5206:
        case SchoolCardID.S5207:
        case SchoolCardID.S5208:
        case SchoolCardID.S5209:
            if(G.extensionMode === ExtensionMode.FOUR) r = G.regions[Region.EXTENSION];
            else r = G.regions[Region.EXTENSION2];
            break;
        case SchoolCardID.S52681:
        case SchoolCardID.S52682:
        case SchoolCardID.S52683:
        case SchoolCardID.S52684:
        case SchoolCardID.S52691:
        case SchoolCardID.S52692:
        case SchoolCardID.S52693:
        case SchoolCardID.S52694:
        case SchoolCardID.S52701:
        case SchoolCardID.S52702:
            if(G.extensionMode === ExtensionMode.FOUR) r = G.regions[Region.EXTENSION];
            else r = G.regions[Region.MONTHLY_SCHOOL];
            break;
        default:
            break;
    }

    if (card.category === CardCategory.LEGEND) {
        if (r.legend.card !== null) {
            if (r.legend.card === card.cardId) {
                return r.legend;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } else {
        if(r == G.regions[Region.EXTENSION] || r == G.regions[Region.EXTENSION1] || r == G.regions[Region.EXTENSION2] || r == G.regions[Region.MONTHLY_SCHOOL]){
            for (let slot of [r.legend, ...r.normal]) {
                if (slot.card !== null) {
                    if (slot.card === card.cardId) {
                        return slot;
                    }
                }
            }
        } else {
            for (let slot of r.normal) {
                if (slot.card !== null) {
                    if (slot.card === card.cardId) {
                        return slot;
                    }
                }
            }
        }
        return null;
    }
}

export const cardOnBoard = (G: IG, ctx: Ctx, card: INormalOrLegendCard): boolean => {
    return cardSlotOnBoard(G, ctx, card) !== null;
}

export function idOnBoard(G: IG, ctx: Ctx, id: string): boolean {
    return cardOnBoard(G, ctx, getCardById(id));
}

export function noRegionCardOnBoard(G: IG, region: Region) {
    if (region === Region.NONE) return false;
    const r = G.regions[region];
    return r.legend.card === null &&
        r.normal.filter(value => value.card !== null).length === 0;
}

export function regionCardDepleted(G: IG, region: Region) {
    if (region === Region.NONE) return false;
    const r = G.secretInfo.regions[region];
    return noRegionCardOnBoard(G, region) && r.normalDeck.length === 0 && r.legendDeck.length === 0;
}

export function shareDepleted(G: IG, _ctx: Ctx, region: Region) {
    if (region === Region.NONE) return false;
    return G.regions[region].share === 0;
}

export function resCost(G: IG, _ctx: Ctx, arg: IBuyInfo, showLog: boolean = false): number {
    let targetCard = getCardById(arg.target);
    let cost: ICost = targetCard.cost;
    // The UI evaluates this for every card slot on every render, so the log
    // string is only built when debug logging is switched on.
    const logging = showLog && logger.enabled;
    const log: string[] = [];
    const logPush = (entry: string) => {
        if (logging) log.push(entry);
    };
    logPush(`resCost|${targetCard.name}|Cost:|${cost.res}|${cost.industry}|${cost.aesthetics}`);
    let resRequired = cost.res;
    let pub = G.pub[parseInt(arg.buyer)]
    logPush(`|p${arg.buyer}|industry${pub.industry}|aesthetics${pub.aesthetics}`);
    let aesthetics: number = cost.aesthetics
    let industry: number = cost.industry

    aesthetics -= pub.aesthetics;
    industry -= pub.industry;
    logPush(`|${targetCard.cardId}|i:${industry}|a:${aesthetics}`);
    if (pub.school !== null) {
        let schoolCard = getCardById(pub.school);
        logPush(`|school:${schoolCard.name}|aes:${schoolCard.aesthetics}|ind:${schoolCard.industry}`);
        aesthetics -= schoolCard.aesthetics;
        industry -= schoolCard.industry
        if (targetCard.type === CardType.S) {
            let extraCost: number = schoolCard.era + 1
            logPush(`|oldSchoolExtra:${extraCost}`);
            resRequired += extraCost;
        }
    }
    for (const helperId of arg.helper) {
        let helperCard = getCardById(helperId) as INormalOrLegendCard;
        logPush(`|${helperCard.name}`);
        industry -= helperCard.industry;
        aesthetics -= helperCard.aesthetics;
        logPush(`|i:${industry}|a:${aesthetics}`);
    }
    // 布拉格电影学院: 每个不足的等级需求，仅需额外花费1资源
    if (pub.school === SchoolCardID.S5201) {
        if (aesthetics > 0) {
            logPush(("Lack aesthetics " + aesthetics));
            resRequired += aesthetics;
        }
        if (industry > 0) {
            logPush(("Lack industry " + industry));
            resRequired += industry;
        }
    } else {
        if (aesthetics > 0) {
            logPush(("Lack aesthetics " + aesthetics));
            resRequired += aesthetics * 2;
        }
        if (industry > 0) {
            logPush(("Lack industry " + industry));
            resRequired += industry * 2;
        }
    }
    if (pub.school === SchoolCardID.S2201 && targetCard.type === CardType.F && targetCard.aesthetics > 0) {
        logPush(("|NewRealismDeduct"));
        if (resRequired < 2) {
            resRequired = 0;
        } else {
            resRequired -= 2;
        }
    }
    logPush(`|${resRequired}`);
    if (logging) {
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
    //流派扩购买
    switch (arg.target) {
        case SchoolCardID.S4001:
            if (pub.school !== null || G.regions[Region.WE].era !== IEra.TWO || pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S4002:
            if (G.regions[Region.ASIA].era !== IEra.TWO || pub.bought_extension) {
                resRequired = 1000;
            }
            resRequired += pub.champions.length * 2;
            break;
        case SchoolCardID.S4003:
            if (G.regions[Region.NA].era !== IEra.TWO || (pub.building.cinemaBuilt && pub.building.studioBuilt) || pub.bought_extension) {
                resRequired = 1000;
            } else {
                if (pub.building.cinemaBuilt || pub.building.studioBuilt) {
                    resRequired += 3;
                }
            }
            break;
        case SchoolCardID.S4004:
            if (G.regions[Region.EE].era !== IEra.TWO || pub.bought_extension) {
                resRequired = 1000;
            }
            if (pub.industry >= pub.aesthetics) {
                resRequired += pub.industry - pub.aesthetics;
            } else {
                resRequired += pub.aesthetics - pub.industry;
            }
            break;
        case SchoolCardID.S4005:
            if (G.regions[Region.WE].era !== IEra.THREE || pub.bought_extension) {
                resRequired = 1000;
            }
            resRequired += pub.industry;
            break;
        case SchoolCardID.S4006:
            if ((G.regions[Region.NA].era === IEra.THREE || G.regions[Region.WE].era === IEra.THREE ||
                    G.regions[Region.EE].era === IEra.THREE || G.regions[Region.ASIA].era === IEra.THREE) && G.pub[parseInt(arg.buyer)].resource <= 7
                && G.player[parseInt(arg.buyer)].hand.length === 0 && !pub.actionused && !pub.bought_extension) {
                resRequired = 0;
            } else {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S4007:
            if (G.regions[Region.WE].era !== IEra.THREE || pub.bought_extension) {
                resRequired = 1000;
            }
            resRequired += pub.handsize_startturn;
            break;
        case SchoolCardID.S4008:
            if (G.regions[Region.NA].era !== IEra.THREE || pub.bought_extension) {
                resRequired = 1000;
            }
            resRequired += pub.aesthetics;
            break;
        case SchoolCardID.S6001:
            if (G.regions[Region.ASIA].era !== IEra.TWO && G.regions[Region.ASIA].era !== IEra.THREE){
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S6002:
        case SchoolCardID.S6003:
            if (G.regions[Region.EE].era !== IEra.TWO && G.regions[Region.EE].era !== IEra.THREE){
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S6004:
            if (G.regions[Region.WE].era !== IEra.TWO && G.regions[Region.WE].era !== IEra.THREE){
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5001:
        case SchoolCardID.S5002:
        case SchoolCardID.S5003:
        case SchoolCardID.S5004:
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5201:
            if (G.regions[Region.EE].era !== IEra.THREE &&
                G.regions[Region.WE].era !== IEra.THREE &&
                G.regions[Region.NA].era !== IEra.THREE &&
                G.regions[Region.ASIA].era !== IEra.THREE) {
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5202:
            if(G.regions[Region.WE].era !== IEra.THREE){
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5203:
            if(G.regions[Region.NA].era !== IEra.THREE){
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5204:
            if(G.regions[Region.ASIA].era !== IEra.THREE){
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5205:
            if(G.regions[Region.EE].era === IEra.THREE ||
               G.regions[Region.WE].era === IEra.THREE ||
               G.regions[Region.NA].era === IEra.THREE ||
               G.regions[Region.ASIA].era === IEra.THREE)
            {
                //ok
            }else{
                resRequired = 1000;
            }
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5206:
            if(G.regions[Region.NA].era === IEra.ONE) resRequired = 1000;
            //if(pub.archive.includes(BasicCardID.B07)) resRequired = 1000;
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5207:
            if(G.regions[Region.WE].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5208:
            if(G.regions[Region.EE].era === IEra.ONE &&
               G.regions[Region.WE].era === IEra.ONE &&
               G.regions[Region.NA].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        case SchoolCardID.S5209:
            if(G.regions[Region.ASIA].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) {
                resRequired = 1000;
            }
            break;
        // 破晓扩
        case "S52681" as any: // 散文电影 - 东欧Ⅱ
            if (G.regions[Region.EE].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) resRequired = 1000;
            break;
        case "S52682" as any: // 柏林学派 - 西欧Ⅱ
            if (G.regions[Region.WE].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) resRequired = 1000;
            break;
        case "S52683" as any: // 墨西哥电影 - 北美Ⅱ
            if (G.regions[Region.NA].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) resRequired = 1000;
            break;
        case "S52684" as any: // 太阳族电影 - 亚洲Ⅱ
            if (G.regions[Region.ASIA].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) resRequired = 1000;
            break;
        // 2026-9扩 技术流派（Ⅰ时代）：随时可买，限1
        case "S52691" as any:
        case "S52692" as any:
        case "S52693" as any:
        case "S52694" as any:
            if (pub.bought_extension) resRequired = 1000;
            break;
        // 2026-10扩 技术流派（Ⅱ时代）：对应地区达到2时代后才能购买，限1
        case "S52701" as any: // 技术：变焦镜头 - 西欧Ⅱ
            if (G.regions[Region.WE].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) resRequired = 1000;
            break;
        case "S52702" as any: // 技术：3D电影 - 北美Ⅱ
            if (G.regions[Region.NA].era === IEra.ONE) resRequired = 1000;
            if (pub.bought_extension) resRequired = 1000;
            break;
        default:
            break;
    }
    return resRequired;
}

export function canAfford(G: IG, ctx: Ctx, card: CardID, p: PlayerID) {
    let pub = G.pub[parseInt(p)]
    let res = resCost(G, ctx, {
        buyer: p,
        target: card,
        helper: G.player[parseInt(p)].hand,
        resource: 0,
        deposit: 0
    })
    return pub.deposit + pub.resource >= res;
}

export function canBuyCard(G: IG, ctx: Ctx, arg: IBuyInfo): boolean {
    let pub = G.pub[parseInt(arg.buyer)];
    let resRequired = resCost(G, ctx, arg);
    let resGiven: number = arg.resource + arg.deposit;
    // 基础牌售罄后不可购买
    if (arg.target in BasicCardID) {
        const basicCount = G.basicCards[arg.target as BasicCardID] ?? 0;
        if (basicCount <= 0) {
            return false;
        }
    }
    return resRequired === resGiven && pub.resource >= arg.resource && pub.deposit >= arg.deposit;
}

export const fillTwoPlayerBoard = (G: IG, ctx: Ctx, reason: CardRevealReason): CardID[] => {
    const log = ['fillTwoPlayerBoard'];
    const filledCards = [];
    const s = G.secretInfo.twoPlayer.school;
    for (let slotL of G.twoPlayer.school) {
        if (slotL.card === null) {
            let newCard = s.pop()
            if (newCard === undefined) {
                log.push(`|slotEmpty`);
            } else {
                log.push(`|fillSchool|${newCard}`);
                filledCards.push(newCard);
                slotL.card = newCard;
            }
        }
    }
    let f = G.secretInfo.twoPlayer.film;
    for (let slotL of G.twoPlayer.film) {
        if (slotL.card === null) {
            let newCard = f.pop()
            if (newCard === undefined) {
                log.push(`|slotEmpty`);
            } else {
                log.push(`|fillFilm|${newCard}`);
                filledCards.push(newCard);
                slotL.card = newCard as ClassicCardID;
            }
        }
    }
    log.push(`|filledCards|${filledCards}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    recordCardReveal(ctx, {reason, cards: filledCards});
    return filledCards;
}
export const drawForTwoPlayerEra = (G: IG, ctx: Ctx, e: IEra): void => {
    const log = [`drawForTwoPlayerEra|era${e + 1}`];
    let school = schoolCardsByEra(e).map(c => c.cardId);
    let filmCards = filmCardsByEra(e).map(c => c.cardId);
    const schoolDeckSize: number = TwoPlayerCardCount[e].school;
    const filmDeckSize: number = TwoPlayerCardCount[e].film;
    G.secretInfo.twoPlayer.school = shuffle(ctx, school).slice(0, schoolDeckSize);
    G.secretInfo.twoPlayer.film = shuffle(ctx, filmCards).slice(0, filmDeckSize);
    log.push(`|school|${schoolDeckSize}${JSON.stringify(G.secretInfo.twoPlayer.school)}`);
    log.push(`|film|${filmDeckSize}|${JSON.stringify(G.secretInfo.twoPlayer.film)}`);
    for (let s of G.twoPlayer.film) {
        let c = G.secretInfo.twoPlayer.film.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            log.push(`|pop|${c}`);
            s.card = c;
        }
    }
    for (let s of G.twoPlayer.school) {
        let c = G.secretInfo.twoPlayer.school.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            log.push(`|pop|${c}`);
            s.card = c;
        }
    }
    recordCardReveal(ctx, {
        reason: CardRevealReason.NEW_ERA,
        era: e,
        cards: [...G.twoPlayer.school, ...G.twoPlayer.film]
            .map((s): CardID | null => s.card)
            .filter((c): c is CardID => c !== null),
    });
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const drawForRegion = (G: IG, ctx: Ctx, r: Region, e: IEra): void => {
    if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(r))) return;
    // @ts-ignore
    let legend = cardsByCond(G, r, e, true).map(c => c.cardId);
    let normal = cardsByCond(G, r, e, false).map(c => c.cardId);
    // @ts-ignore
    G.secretInfo.regions[r].legendDeck = shuffle(ctx, legend).slice(0, LegendCardCountInUse[r][e]);
    // @ts-ignore
    G.secretInfo.regions[r].normalDeck = shuffle(ctx, normal).slice(0, NormalCardCountInUse[r][e]);
    // @ts-ignore
    let l: ClassicCardID[] = G.secretInfo.regions[r].legendDeck;
    // @ts-ignore
    let n: ClassicCardID[] = G.secretInfo.regions[r].normalDeck;
    // @ts-ignore
    for (let s of G.regions[r].normal) {
        let c = n.pop();
        if (c === undefined) {
            throw new Error(c);
        } else {
            s.card = c;
        }
    }
    let c = l.pop();
    if (c === undefined) {
        throw new Error(c);
    } else {
        // @ts-ignore
        G.regions[r].legend.card = c;
    }
    recordCardReveal(ctx, {
        reason: CardRevealReason.NEW_ERA,
        // @ts-ignore
        region: r,
        era: e,
        // @ts-ignore
        cards: [G.regions[r].legend, ...G.regions[r].normal]
            .map(s => s.card)
            .filter((c): c is CardID => c !== null),
    });
}

export const drawPeekCardForPlayer = (G: IG, ctx: Ctx, id: PlayerID): void => {
    const pid = parseInt(id);
    const log = [`drawPeekCardForPlayer|p${id}`];
    const p = G.player[pid];
    const pub = G.pub[pid];
    const s = G.secretInfo.playerDecks[pid];
    log.push(`|playerDeck|${JSON.stringify(s)}`);
    if(!G.disableUndo) {
        G.previousMoveUndoable = false;
        log.push(`|disableNextUndo`);
    }
    if (s.length === 0) {
        //S5204
        if(pub.school === SchoolCardID.S5204){
            if(pub.discard.length !== 0){
                addSchoolVp(G, ctx, id, 1);
                addRes(G, ctx, id, 2);
            }
        }
        G.secretInfo.playerDecks[pid] = shuffle(ctx, pub.discard);
        log.push(`|shuffledDeck|${JSON.stringify(s)}`);
        pub.discard = [];
    }
    let card = G.secretInfo.playerDecks[pid].pop();
    if (card === undefined) {
        log.push(`|deckEmpty`);
        log.push(`|${JSON.stringify(s)}`);
    } else {
        log.push(`|${card}`);
        p.cardsToPeek.push(card);
        //S5202
        if(pub.school === SchoolCardID.S5202) addSchoolVp(G, ctx, id, 1);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const drawCardForPlayer = (G: IG, ctx: Ctx, id: PlayerID): void => {
    const log = [`drawCardForPlayer${id}`];
    const i = G.competitionInfo;
    if (i.pending) {
        log.push(`|inCompetition`);
    }
    if(!G.disableUndo) {
        G.previousMoveUndoable = false;
        log.push(`|disableNextUndo`);
    }
    const pid = parseInt(id);
    console.log(id, pid);
    //console.log(G.secretInfo);
    //console.log(G.secretInfo.playerDecks);
    const p = G.player[pid]
    const pub = G.pub[pid]
    let s = G.secretInfo.playerDecks[pid]
    if (s.length === 0) {
        //S5204
        if(pub.school === SchoolCardID.S5204){
            if(pub.discard.length !== 0){
                addSchoolVp(G, ctx, id, 1);
                addRes(G, ctx, id, 2);
            }
        }

        G.secretInfo.playerDecks[pid] = shuffle(ctx, pub.discard);
        log.push(`|shuffledDeck|${JSON.stringify(s)}`);
        pub.discard = [];
    }
    let card = G.secretInfo.playerDecks[pid].pop();
    if (card === undefined) {
        log.push(`|deckEmpty`);
    } else {id
        log.push(`|${card}`);
        p.hand.push(card);

        //S5202
        if(pub.school === SchoolCardID.S5202) addSchoolVp(G, ctx, id, 1);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const fillPlayerHand = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const log = [`p${p}|fillPlayerHand`];
    const limit = getSchoolHandLimit(G, p);
    log.push(`|limit${limit}`);
    let handCount: number = G.player[parseInt(p)].hand.length;
    log.push(`|hand${handCount}`);
    if (handCount < limit) {
        let drawCount: number = limit - handCount;
        log.push(`|draw${drawCount}`);
        for (let t = 0; t < drawCount; t++) {
            drawCardForPlayer(G, ctx, p);
        }
    } else {
        log.push(`|doNotDraw`);
    }
    G.previousMoveUndoable = false;
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const canHelp = (G: IG, _ctx: Ctx, p: PlayerID, target: ClassicCardID | BasicCardID, helper: CardID): boolean => {
    const targetCard = getCardById(target);
    if (targetCard.cost.industry === 0 && targetCard.cost.aesthetics ===0) {
        return false;
    } else {
        const helperCard = getCardById(helper);
        const pub = G.pub[parseInt(p)];
        let aes = pub.aesthetics;
        let ind = pub.industry;
        if (pub.school !== null) {
            aes += getCardById(pub.school).aesthetics;
            ind += getCardById(pub.school).industry;
        }
        const aesMarkNeeded = aes < targetCard.cost.aesthetics && helperCard.aesthetics > 0;
        const industryMarkNeeded = ind < targetCard.cost.industry && helperCard.industry > 0;
        if (targetCard.cost.industry === 0) {
                return aesMarkNeeded;
        } else {
            if (targetCard.cost.aesthetics === 0) {
                return industryMarkNeeded
            } else {
                return industryMarkNeeded || aesMarkNeeded;
            }
        }

    }
}

export const getPossibleHelper = (G: IG, ctx: Ctx, p: PlayerID, card: CardID): CardID[] => {
    return G.player[parseInt(p)].hand.filter((h) => canHelp(G, ctx, p, card as BasicCardID, h))
}

// export const do2pUpdateSchoolSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
//     if (G.twoPlayer.era !== IEra.TWO) {
//         // 2p rule only show 2 school card for Era 1 and 3
//         // do not need to drawNewCard if not era two
//         if (slot.comment !== null) {
//             let commentId: BasicCardID = slot.comment;
//             G.basicCards[commentId]++;
//             slot.comment = null;
//         }
//         return;
//     } else {
//         let d;
//         d = G.secretInfo.twoPlayer.school;
//         if (d.length === 0) {
//             return;
//         } else {
//             let oldCard = slot.card;
//             let c = d.pop();
//             if (c !== undefined) {
//                 slot.card = c;
//             }
//             if (oldCard !== null) {
//                 d.push(oldCard as SchoolCardID);
//             }
//         }
//     }
// }
// export const do2pUpdateFilmSlot = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
//     let d;
//     if (slot.comment !== null) {
//         let commentId: BasicCardID = slot.comment as BasicCardID;
//         G.basicCards[commentId]++;
//         slot.comment = null;
//     }
//     d = G.secretInfo.twoPlayer.school;
//     if (d.length === 0) {
//         return;
//     } else {
//         let oldCard = slot.card;
//         let c = d.pop();
//         if (c !== undefined) {
//             slot.card = c as unknown as ClassicCardID;
//         }
//         if (oldCard !== null) {
//             d.push(oldCard as unknown as SchoolCardID);
//         }
//     }
// }

/**
 * 2026-10 技术：变焦镜头 - 从指定地区当前时代的剩余卡牌中随机抽取，
 * 普通牌放到普通牌购买堆底部、传奇牌放到传奇牌购买堆底部（不会立刻出现在购买区）。
 */
export const addRegionPoolCards = (G: IG, ctx: Ctx, r: ValidRegion, normalCount: number, legendCount: number): CardID[] => {
    const log = [`addRegionPoolCards|${r}|n${normalCount}|l${legendCount}`];
    const added: CardID[] = [];
    const used = new Set<string>();
    const mark = (cards: Array<CardID | null | undefined>) => {
        cards.forEach(c => {
            if (c) used.add(c);
        });
    };
    // 标记场上所有已存在的卡牌：地区牌位 / 购买堆 / 玩家各区域
    valid_regions.forEach(rr => {
        const reg = G.regions[rr];
        mark([reg.legend.card, ...reg.normal.map(s => s.card)]);
        mark(G.secretInfo.regions[rr].legendDeck);
        mark(G.secretInfo.regions[rr].normalDeck);
    });
    G.pub.forEach(pub => {
        mark(pub.allCards);
        mark(pub.discard);
        mark(pub.archive);
        mark(pub.playedCardInTurn);
        mark(pub.activeCardInTurn);
        mark(pub.revealedHand);
    });
    G.player.forEach(p => mark(p.hand));
    G.secretInfo.playerDecks.forEach(deck => mark(deck));

    const era = G.regions[r].era;
    // 只从当前时代的剩余卡牌中抽取（卡池保证够用，不从其他时代补充）
    const pickCards = (isLegend: boolean, count: number): CardID[] => {
        const pool: CardID[] = cardsByCond(G, r, era, isLegend)
            .map(c => c.cardId as CardID)
            .filter(id => !used.has(id));
        return shuffle(ctx, pool).slice(0, count);
    };
    // 传奇牌 → 传奇牌购买堆底部（drawForRegion/fillEmptySlots 从数组尾部 pop，故底部用 unshift）
    pickCards(true, legendCount).forEach(c => {
        used.add(c);
        G.secretInfo.regions[r].legendDeck.unshift(c as any);
        added.push(c);
    });
    // 普通牌 → 普通牌购买堆底部
    pickCards(false, normalCount).forEach(c => {
        used.add(c);
        G.secretInfo.regions[r].normalDeck.unshift(c as any);
        added.push(c);
    });
    log.push(`|added|${added}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return added;
};

export const fillEmptySlots = (G: IG, ctx: Ctx, reason: CardRevealReason): CardID[] => {
    const log = ["fillEmptySlots"];
    const filledCards = [];
    for (let r of valid_regions) {
        log.push(`|fill|${r}`);
        const region = G.regions[r];
        if (region.completedLastScoring) {
            log.push(`|noNotSetUpAfterModernScoring`);
            continue;
        }
        const l = G.secretInfo.regions[r].legendDeck;
        const n = G.secretInfo.regions[r].normalDeck;
        if (region.legend.card === null) {
            if (l.length > 0) {
                const c = l.pop();
                log.push(`|fillLegend|${c}`);
                if (c === undefined) {
                    throw Error("Legend deck empty")
                } else {
                    filledCards.push(c);
                    region.legend.card = c;
                }
            }
        }
        for (let slot of region.normal) {
            if (slot.card === null && n.length > 0) {
                const c = n.pop();
                log.push(`|fillNormal|${c}`);
                if (c !== undefined) {
                    filledCards.push(c);
                    slot.card = c;
                }
            }
        }
    }
    log.push(`|filledCards|${filledCards}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    recordCardReveal(ctx, {reason, cards: filledCards});
    return filledCards;
}

export const doReturnSlotCard = (G: IG, ctx: Ctx, slot: ICardSlot): void => {
    const log = ["doReturnSlotCard"];
    let d: ClassicCardID[];
    if (slot.comment !== null) {
        log.push(`|hasComment|${slot.comment}`);
        let commentId: BasicCardID = slot.comment as BasicCardID;
        log.push(`|returnComment${commentId}`);
        G.basicCards[commentId]++;
        slot.comment = null;
    }
    if (slot.region === Region.EXTENSION) {
        // let oldCard = slot.card;
        return;
    }
    if (slot.region === Region.EXTENSION1 ||
        slot.region === Region.EXTENSION2 ||
        slot.region === Region.MONTHLY_SCHOOL) {
        return;
    }
    log.push(`|comment${slot.comment}`);
    if (slot.card === null) {
        log.push(`|emptySlot`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        if (slot.region === Region.NONE) return;
        if (slot.isLegend) {
            log.push(`|legend`);
            d = G.secretInfo.regions[slot.region].legendDeck;
        } else {
            log.push(`|normal`);
            d = G.secretInfo.regions[slot.region].normalDeck;
        }
        log.push(`${JSON.stringify(d)}`);
    } else {
        log.push(`|simpleRule`);
        if (getCardById(slot.card).type === CardType.S) {
            log.push(`|school`);
            d = G.secretInfo.twoPlayer.school as unknown as ClassicCardID[];
        } else {
            log.push(`|film`);
            d = G.secretInfo.twoPlayer.film;
        }
        log.push(`${JSON.stringify(d)}`);
    }
    let oldCard = slot.card;
    log.push(`|return${oldCard}`);
    if (oldCard !== null) {
        d.unshift(oldCard);
        log.push(`|putToBottom|${JSON.stringify(d)}`);
        slot.card = null;
    } else {
        throw new Error("Updating an empty slot!")
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const additionalCostForUpgrade = (G: IG, level: number): number => {
    const log = [`additionalCostForUpgrade|${level}`];
    if (level <= 2) {
        log.push(`|cost:0`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        return 0;
    } else {
        if (level <= 5) {
            log.push(`|cost:1`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 1;
        } else {
            log.push(`|cost:2`);
            logger.debug(`${G.matchID}|${log.join('')}`);
            return 2;
        }
    }
}

export const legendCount = (G: IG, r: Region, e: IEra, p: PlayerID): number => {
    let count = 0;
    const allCards = G.pub[parseInt(p)].allCards;
    for (let i = 0; i < allCards.length; i++) {
        const card = getCardById(allCards[i]);
        if (card.category === CardCategory.LEGEND && card.region === r && card.era === e) {
            count++;
        }
    }
    return count;
}

/**
 * Legend counts for every region of one player in a single pass over the
 * player's cards (the ranking and the public panels need all of them).
 */
export const legendCountsByRegion = (G: IG, p: PlayerID): number[] => {
    const counts: number[] = [];
    valid_regions.forEach(r => counts[r] = 0);
    const allCards = G.pub[parseInt(p)].allCards;
    for (let i = 0; i < allCards.length; i++) {
        const card = getCardById(allCards[i]);
        if (card.category !== CardCategory.LEGEND) continue;
        const r = card.region as ValidRegion;
        if (counts[r] !== undefined && G.regions[r].era === card.era) {
            counts[r]++;
        }
    }
    return counts;
}


export const do2pRegionScoring = (G: IG, ctx: Ctx, r: ValidRegion): void => {
    let firstPlayer = 1
    if (G.pub[0].shares[r] > G.pub[1].shares[r]) {
        firstPlayer = 0
    }
    if (G.pub[0].shares[r] === G.pub[1].shares[r]) {
        firstPlayer = ctx.currentPlayer === "0" ? 0 : 1;
    }
    const scoreCard = getScoreCard(r, IEra.THREE, 1);
    // scorecard of current region
    // const scoreCard = getScoreCard(r, G.twoPlayer.era, 1);
    G.pub[firstPlayer].discard.push(scoreCard.cardId as ScoreCardID);
    G.pub[firstPlayer].allCards.push(scoreCard.cardId as ScoreCardID);
    G.pub[0].shares[r] = 0;
    G.pub[1].shares[r] = 0;
    // G.regions[r].share = ShareOnBoard[r][IEra.THREE];
    G.regions[r].completedLastScoring = true;
}

export const try2pScoring = (G: IG, ctx: Ctx): void => {
    const log = [`try2pScoring`];
    valid_regions.forEach(r => {
        let regObj = G.regions[r];
        if (regObj.share === 0 && !regObj.completedLastScoring) {
            do2pRegionScoring(G, ctx, r);
        }
    })
    if (
        G.pending.lastRoundOfGame &&
        ctx.currentPlayer === getExistingLastMovePlayer(G)
    ) {
        log.push("|finalScoring");
        logger.debug(`${G.matchID}|${log.join('')}`);
        finalScoring(G, ctx);
        return
    }
    if (
        G.twoPlayer.film.every(c => c.card === null)
        && initialPosOfPlayer(G, ctx, ctx.currentPlayer) === 1
    ) {
        valid_regions.forEach(r => {
            if (G.pub[0].shares[r] > G.pub[1].shares[r]) {
                doBuy(G, ctx, B04, '1')
            }
            if (G.pub[0].shares[r] < G.pub[1].shares[r]) {
                doBuy(G, ctx, B04, '0')
            }
            G.pub[0].shares[r] = 0;
            G.pub[1].shares[r] = 0;
            G.regions[r].share = ShareOnBoard[r][IEra.THREE];
        })
        const era = G.twoPlayer.era;
        let newEra = era;
        if (era === IEra.ONE) {
            newEra = IEra.TWO
        }
        if (era === IEra.TWO) {
            newEra = IEra.THREE
        }
        if (era !== newEra) {
            G.twoPlayer.era = newEra;
            for (let schoolSlot of G.twoPlayer.school) {
                doReturnSlotCard(G, ctx, schoolSlot)
            }
            for (let filmSlot of G.twoPlayer.school) {
                doReturnSlotCard(G, ctx, filmSlot)
            }
            drawForTwoPlayerEra(G, ctx, newEra)
            signalEndTurn(G, ctx);
            return;
        } else {
            // Score remain regions before final scoring
            valid_regions.forEach(r => {
                let regObj = G.regions[r];
                if (!regObj.completedLastScoring) {
                    do2pRegionScoring(G, ctx, r);
                }
            })
            finalScoring(G, ctx);
            return
        }
    } else {
        fillTwoPlayerBoard(G, ctx, CardRevealReason.REFILL);
        signalEndTurn(G, ctx);
        return;
    }
}

export const tryScoring = (G: IG, ctx: Ctx): void => {
    const log = ["tryScoring"];
    if (G.scoringRegions.length > 0) {
        const r = G.scoringRegions.shift();
        G.currentScoreRegion = r as ValidRegion;
        log.push(`|region|${r}`);
        log.push("|regionRank");
        G.pending.nextEraRegions.push(r as ValidRegion);
        log.push(`|nextEraRegions|${JSON.stringify(G.pending.nextEraRegions)}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        regionRank(G, ctx, r as Region);
        return;
    } else {
        log.push("|noRegion");
        if (
            G.pending.lastRoundOfGame &&
            ctx.currentPlayer === getExistingLastMovePlayer(G)
        ) {
            log.push("|finalScoring");
            logger.debug(`${G.matchID}|${log.join('')}`);
            finalScoring(G, ctx);
            return;
        } else {
            log.push(`|setupForNextEra`);
            setupAfterScoring(G, ctx);
            log.push("|fillEmptySlots");
            if (ctx.numPlayers > SimpleRuleNumPlayers) {
                fillEmptySlots(G, ctx, CardRevealReason.REFILL);
            } else {
                fillTwoPlayerBoard(G, ctx, CardRevealReason.REFILL)
            }
            log.push("|signalEndStage&Turn");
            logger.debug(`${G.matchID}|${log.join('')}`);
            signalEndStage(G, ctx);
            signalEndTurn(G, ctx);
            return;
        }
    }
};

export const passCompensateMarker = (G: IG) => {
    const log = [`passCompensateMarker`];
    const markPos = G.order.indexOf(G.regionScoreCompensateMarker);
    log.push(`|p${G.regionScoreCompensateMarker}|markPos|${markPos}`);
    if (markPos > 0) {
        G.regionScoreCompensateMarker = G.order[markPos - 1];
        log.push(`|passTo|p${G.regionScoreCompensateMarker}|${markPos - 1}`);
    } else {
        G.regionScoreCompensateMarker = G.order[G.order.length - 1];
        log.push(`|passTo|p${G.regionScoreCompensateMarker}|${G.order.length - 1}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const regionRanker = (G: IG, ctx: Ctx, r: ValidRegion, era: IEra) => {
    // Legend counts only depend on (player, region, era), not on the pair being
    // compared, so they are computed once for the whole sort (and only if a
    // tie on shares actually needs them).
    let legendCounts: number[] | null = null;
    const getLegendCount = (p: PlayerID): number => {
        if (legendCounts === null) {
            legendCounts = [];
            G.order.forEach(orderP => {
                legendCounts![parseInt(orderP)] = legendCount(G, r, era, orderP);
            });
        }
        return legendCounts[parseInt(p)];
    };
    return (a: PlayerID, b: PlayerID): number => {
        const logging = logger.enabled;
        const log: string[] | null = logging ? [`rank|${a}|${b}`] : null;
        const logPush = (entry: string) => {
            if (log !== null) log.push(entry);
        };
        const flush = () => {
            if (log !== null) logger.debug(`${G.matchID}|${log.join('')}`);
        };
        let p1 = G.pub[parseInt(a)];
        let p2 = G.pub[parseInt(b)];
        const as = p1.shares[r];
        const bs = p2.shares[r];
        logPush(`|share|${as}|${bs}`);
        if (as > bs) {
            logPush(`|share|p${a}win`);
            flush();
            return -1;
        }
        if (as < bs) {
            logPush(`|share|p${b}win`);
            flush();
            return 1;
        }
        logPush(`|sameShare`);
        const legendCountA = getLegendCount(a);
        const legendCountB = getLegendCount(b);
        logPush(`|legendCount|${legendCountA}|${legendCountB}`);
        if (legendCountA > legendCountB) {
            logPush(`|legendCount|p${a}win`);
            flush();
            return -1;
        }
        if (legendCountA < legendCountB) {
            logPush(`|legendCount|p${b}win`);
            flush();
            return 1;
        }
        logPush(`|sameLegendCount`);
        const curPos = seqFromCurrentPlayer(G, ctx);
        const posA = curPos.indexOf(a);
        const posB = curPos.indexOf(b);
        logPush(`|pos|${posA}|${posB}`);
        if (posA > posB) {
            logPush(`|pos|p${b}win`);
            flush();
            return 1;
        } else {
            if (posA < posB) {
                logPush(`|pos|p${a}win`);
                flush();
                return -1;
            } else {
                return a < b ? -1 : 1
            }
        }
    };
}

export const getRegionRank = (G: IG, ctx: Ctx, r: ValidRegion): PlayerID[] => {
    const logging = logger.enabled;
    const log: string[] | null = logging ? ["getRegionRank"] : null;
    const logPush = (entry: string) => {
        if (log !== null) log.push(entry);
    };
    const era = G.regions[r].era;
    const rankingPlayer: PlayerID[] = [];
    G.order.forEach((_i, idx) => {
        logPush(`|p${idx}|share${G.pub[idx].shares[r]}`);
        if (G.pub[idx].shares[r] === 0) {
            logPush("|badFilm");
        } else {
            logPush(`|rank`);
            rankingPlayer.push(idx.toString())
        }
    });
    logPush(`|rankingPlayer|${JSON.stringify(rankingPlayer)}`);
    const result = rankingPlayer.sort(regionRanker(G, ctx, r, era));
    logPush(`|result|${JSON.stringify(result)}`);
    if (log !== null) {
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
    return result;
}

export const getPlayerRegionRank = (G: IG, ctx: Ctx, pid: PlayerID, r: ValidRegion): number => {
    const pub = G.pub[parseInt(pid)]
    if (pub.shares[r] === 0) {
        return -1
    } else {
        // @ts-ignore
        const rankResult = getRegionRank(G, ctx, r);
        return rankResult.indexOf(pid);
    }
}

/** 地区结算的分数来源名：带上具体地区，便于分数统计区分 */
const regionSettlementSource = (r: ValidRegion): string => {
    switch (r) {
        case Region.NA:
            return "地区结算（北美）";
        case Region.WE:
            return "地区结算（西欧）";
        case Region.EE:
            return "地区结算（东欧）";
        case Region.ASIA:
            return "地区结算（亚洲）";
        default:
            return "地区结算";
    }
};

export const regionRank = (G: IG, ctx: Ctx, r: Region): void => {
    if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(r))) return;
    // @ts-ignore
    let era = G.regions[r].era;
    const eraShareReturnVp = era + 1;
    // 分数来源统计：地区结算带上具体地区
    const regionSource = regionSettlementSource(r as ValidRegion);
    // @ts-ignore
    const log = [`regionRank|region${r}|era${era}`];
    G.order.forEach((i, idx) => {
        const playerIdx = parseInt(i);
        // @ts-ignore
        const playerShareCount = G.pub[playerIdx].shares[r];
        log.push(`|orderIdx${idx}|playerIdx${playerIdx}|p${i}|i${i}|share${playerShareCount}`);
        if (playerShareCount === 0) {
            log.push("|badFilm");
            doBuy(G, ctx, B04, i);
        } else {
            addVp(G, ctx, i, playerShareCount * eraShareReturnVp, regionSource);
            //流派扩：法国印象派
            if (G.pub[playerIdx].school === SchoolCardID.S4001)
                if (playerShareCount * eraShareReturnVp >= 3)
                    addRes(G, ctx, i, 1);
            // 巨片: 地区结算时，每个份额多获得1声望
            if (G.pub[playerIdx].school === SchoolCardID.S5203)
                addVp(G, ctx, i, playerShareCount, regionSource, SchoolCardID.S5203);
            log.push(`|rank`);
        }
    });
    // @ts-ignore
    const rankResult = getRegionRank(G, ctx, r);
    log.push(`|rankResult|${rankResult}`);
    const firstPlayer: PlayerID = rankResult[0];
    G.pending.firstPlayer = firstPlayer;
    log.push(`|G.pending.firstPlayer|${G.pending.firstPlayer}`);
    log.push(`|firstPlayer:${firstPlayer}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    G.pub[parseInt(firstPlayer)].champions.push({
        era: era,
        region: r,
    })
    let scoreCount = scoreCardCount(r, era);

    log.push(`|scoreCount:${scoreCount}`);
    let scoreCardPlayerCount = Math.min(rankResult.length, scoreCount)
    if (ctx.numPlayers === 3) {
        if (scoreCardPlayerCount > 2) {
            scoreCardPlayerCount = 2;
        }
    }
    log.push(`|scoreCardPlayerCount:${scoreCardPlayerCount}`);
    for (let i = 0; i < scoreCardPlayerCount; i++) {
        let scoreId = "V" + (era + 1).toString() + (r + 1).toString() + (i + 1).toString()
        log.push(`|p${i}|${scoreId}`);
        G.pub[parseInt(rankResult[i])].discard.push(scoreId as ScoreCardID)
        G.pub[parseInt(rankResult[i])].allCards.push(scoreId as ScoreCardID)
    }
    for (let i = scoreCardPlayerCount; i < rankResult.length; i++) {
        log.push(`|p${i}|bad film`);
        doBuy(G, ctx, B04, rankResult[i])
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
    changePlayerStage(G, ctx, "chooseEvent", firstPlayer);
}

export function canBuildStudioInRegion(G: IG, ctx: Ctx, p: PlayerID, r: Region): boolean {
    if (r === Region.NONE) return false;
    if (G.pub[parseInt(p)].building.studioBuilt || cinemaInRegion(G, ctx, r, p)) {
        return false;
    } else {
        return G.regions[r].buildings.filter(slot => slot.activated && slot.owner === "").length > 0;
    }
}

export function cinemaSlotsAvailable(G: IG, ctx: Ctx, p: PlayerID): Region[] {
    return [Region.NA, Region.WE, Region.EE, Region.ASIA].filter(r => canBuildCinemaInRegion(G, ctx, p, r));
}

export function studioSlotsAvailable(G: IG, ctx: Ctx, p: PlayerID): Region[] {
    return [Region.NA, Region.WE, Region.EE, Region.ASIA].filter(r => canBuildStudioInRegion(G, ctx, p, r));
}

export function canBuildCinemaInRegion(G: IG, ctx: Ctx, p: PlayerID, r: Region): boolean {
    if (r === Region.NONE) return false;
    if (G.pub[parseInt(p)].building.cinemaBuilt || studioInRegion(G, ctx, r, p)) {
        return false;
    } else {
        return G.regions[r].buildings.filter(slot => slot.activated && slot.owner === "").length > 0;
    }
}

export function doFillNewEraEventDeck(G: IG, ctx: Ctx, newEra: IEra) {
    let newEvents = eventCardByEra(newEra).map(c => c.cardId);
    G.secretInfo.events = shuffle(ctx, newEvents);
    for (let i = 0; i < 2; i++) {
        let newEvent = G.secretInfo.events.pop();
        if (newEvent === undefined) {
            throw new Error();
        } else {
            G.events.push(newEvent)
        }
    }
}

export function fillEventCard(G: IG, ctx: Ctx) {
    const log = ["fillEventCard"];
    log.push(`|eventDeck|${JSON.stringify(G.secretInfo.events)}`);
    let newEvent = G.secretInfo.events.pop();
    log.push(`|afterDeck|${JSON.stringify(G.secretInfo.events)}`);
    let era = getCardById(G.events[0]).era;
    log.push(`|events:${JSON.stringify(G.events)}`);

    if (newEvent === undefined) {
        log.push("|emptyEventDeck");
    } else {
        log.push(`|newEvent:${newEvent}`);
        G.events.push(newEvent)
        log.push(`|events:${JSON.stringify(G.events)}`);
    }
    let newEra = era === IEra.THREE ? era : era + 1;
    log.push(`|era${era}|newEra${newEra}`);

    if (G.events.length <= 1) {
        if (G.events[0] === "E03") {
            log.push(`|E03Discarded`);
            G.activeEvents.push(EventCardID.E03);
            G.order.forEach((_i, idx) => {
                if (G.pub[idx].action < 2) G.pub[idx].action = 2
            });
        }
        G.events = [];
        if (newEra !== era) {
            log.push(`|fillNewEraEvents|${newEra}`);
            doFillNewEraEventDeck(G, ctx, newEra);
            log.push(`|newEventDeck|${JSON.stringify(G.secretInfo.events)}`);
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function doIndustryBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    const log = [`doIndustryBreakthrough|p${player}`];
    if (G.e.stack.length > 0) {
        let top = G.e.stack.pop();
        log.push(`|stack|${JSON.stringify(top)}`);
        if (top !== undefined && top.e === "industryAndAestheticsBreakthrough") {
            log.push(`|top:${top.a.industry}`);
            top.a.industry--;
        }
        G.e.stack.push(top);
    }
    const p = G.pub[parseInt(player)];
    const totalResource = p.resource + p.deposit;
    const additionalCost = additionalCostForUpgrade(G, p.industry);
    if (additionalCost <= totalResource && p.industry < 10) {
        log.push(`|${additionalCost}|canUpgrade`);
        G.e.choices.push({e: "industryLevelUpCost", a: 1});
    }
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        if (totalResource >= 3 && studioSlotsAvailable(G, ctx, player).length > 0) {
            log.push(`|studio`);
            G.e.choices.push({e: "buildStudio", a: 1})
        }
        if (totalResource >= 3 && cinemaSlotsAvailable(G, ctx, player).length > 0) {
            log.push(`|cinema`);
            G.e.choices.push({e: "buildCinema", a: 1})
        }
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log.push("chooseEffect");
    logger.debug(`${G.matchID}|${log.join('')}`);
    changeStage(G, ctx, "chooseEffect")
}

export function doAestheticsBreakthrough(G: IG, ctx: Ctx, player: PlayerID) {
    const log = [`doAestheticsBreakthrough|p${player}|`];
    if (G.e.stack.length > 0) {
        let top = G.e.stack.pop();
        log.push(`|stack|${JSON.stringify(top)}`);
        if (top !== undefined && top.e === "industryAndAestheticsBreakthrough") {
            log.push(`|top:${top.a.aesthetics}`);
            top.a.aesthetics--;
        }
        G.e.stack.push(top);
    }
    const p = G.pub[parseInt(player)];
    const playerObj = G.player[parseInt(player)];
    const totalResource = p.resource + p.deposit;
    const additionalCost = additionalCostForUpgrade(G, p.aesthetics);
    if (additionalCost <= totalResource && p.aesthetics < 10) {
        log.push(("|Can upgrade aesthetics"));
        G.e.choices.push({e: "aestheticsLevelUpCost", a: 1})
    }
    if (playerObj.hand.length > 0) {
        log.push(("|Can refactor"));
        G.e.choices.push({e: "refactor", a: 1})
    }
    G.e.choices.push({e: "skipBreakthrough", a: 1})
    log.push("|chooseEffect");
    logger.debug(`${G.matchID}|${log.join('')}`);
    changeStage(G, ctx, "chooseEffect")
}

export const regionEraProgress = (G: IG, ctx: Ctx) => {
    const log = ["regionEraProgress"];
    const r = G.currentScoreRegion;
    log.push(`|region|${r}`);
    if (!([Region.NA, Region.WE, Region.EE, Region.ASIA].includes(r))) {
        logger.error("noScoringRegion");
        logger.debug(`${G.matchID}|${log.join('')}`);
        return;
    }
    // @ts-ignore
    if (!G.pending.nextEraRegions.includes(r)) {
        G.pending.nextEraRegions.push(r as ValidRegion);
    }
    G.currentScoreRegion = Region.NONE;
    log.push(`|nextEraRegions|${JSON.stringify(G.pending.nextEraRegions)}`);
    log.push("|tryScoring");
    logger.debug(`${G.matchID}|${log.join('')}`);
    tryScoring(G, ctx);
    return;
}

export const regionScoringCheck = (G: IG, ctx: Ctx, arg: PlayerID) => {
    const log = [`regionScoringCheck|${arg}`];
    valid_regions.forEach(r => {
        if (r === Region.ASIA && G.regions[Region.ASIA].era === IEra.ONE) {
            log.push(`|asiaNotShown|skip`);
            // return in forEach exit current iteration
            return;
        }
        const canScore = checkRegionScoring(G, ctx, r);
        if (canScore) {
            log.push(`|region${r}|canScore`);
            G.scoringRegions.push(r)
        }
    });
    log.push(`|scoreRegions|${JSON.stringify(G.scoringRegions)}`);
    if (ctx.numPlayers > SimpleRuleNumPlayers) {
        log.push("|tryScoring");
        logger.debug(`${G.matchID}|${log.join('')}`);
        tryScoring(G, ctx);
    } else {
        log.push("|try2pScoring");
        logger.debug(`${G.matchID}|${log.join('')}`);
        try2pScoring(G, ctx);
    }
    log.push(`|noRegionsToScore`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}


export const setupAfterScoring = (G: IG, ctx: Ctx) => {
    const log = [`setupAfterScoring`];
    const regionsToSetup = G.pending.nextEraRegions;
    if (regionsToSetup.length > 0) {
        for (let r of regionsToSetup) {
            log.push(`|setupFor|region|${r}`);
            nextEra(G, ctx, r);
        }
        if (valid_regions.filter(r =>
                G.regions[r].era !== IEra.ONE).length >= 2 &&
            G.regions[Region.ASIA].era === IEra.ONE
        ) {
            log.push("|setUpAsia");
            drawForRegion(G, ctx, Region.ASIA, IEra.TWO);
            G.regions[Region.ASIA].era = IEra.TWO;
            G.regions[Region.ASIA].share = ShareOnBoard[Region.ASIA][IEra.TWO];
            if (ctx.numPlayers === 3) {
                G.regions[Region.ASIA].share--;
            }
        }
    } else {
        log.push(`|noRegionsToSetup`);
    }
    G.pending.nextEraRegions = [];
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const getPlayerAction = (G: IG, arg: PlayerID): number => {
    const log = [`getPlayerAction|p${arg}`];
    const pub = G.pub[parseInt(arg)];
    let act: number;
    if (pub.school !== null) {
        let schoolId = pub.school;
        log.push(`|school|${schoolId}`);
        act = getCardEffect(schoolId).school.action;
    } else {
        act = 1;
    }
    if (G.activeEvents.includes(EventCardID.E03)) {
        log.push(`|Avant-Grade`);
        if (act < AvantGradeAP) {
            log.push(`|${AvantGradeAP}AP`);
            act = AvantGradeAP;
        }
    }
    log.push(`|finalActionPoint|${act}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return act;
}

export const endTurnEffect = (G: IG, ctx: Ctx, arg: PlayerID) => {
    const log = [`endTurnEffect|p${arg}`];
    const pub = G.pub[parseInt(arg)]
    const sunTribeShouldArchive = pub.school === SchoolCardID.S52684 && pub.action === 0;
    const berlinShouldTrigger = pub.school === SchoolCardID.S52682 && G.player[parseInt(arg)].hand.length > 0;
    let p = ctx.currentPlayer;
    if (pub.school === SchoolCardID.S4007) {
        addSchoolVp(G, ctx, p, pub.playedCardInTurn.length);
    }
    if (pub.school === SchoolCardID.S6001) {
        G.e.stack.push({e: "industryOrAestheticsLevelDown", a: 1, target: p})
    }
    // 室内剧电影
    if (pub.school === SchoolCardID.S5207) {
        if(pub.playedCardInTurn.length >= pub.industry){
            pub.deposit++;
            addSchoolVp(G, ctx, p, 1);
        }
    }
    pub.playedCardInTurn.forEach(c => pub.discard.push(c));
    pub.playedCardInTurn = [];
    pub.activeCardInTurn = [];

    pub.revealedHand = [];
    pub.resource = 0;
    if (pub.deposit > 10) {
        log.push(`|depositLimitExceeded|${pub.deposit}`);
        pub.deposit = 10;
    }
    log.push(`|restore`);
    pub.newHollyWoodUsed = false;
    pub.action = getPlayerAction(G, arg);

    fillPlayerHand(G, ctx, ctx.currentPlayer);
    log.push(`| execute development rewards`);
    log.push(`|aesAwardEndTurn`);
    aesAwardEndTurn(G, ctx, ctx.currentPlayer);

    let deltaLv = pub.aesthetics - pub.industry;
    if(deltaLv < 0) deltaLv = -deltaLv;
    if (pub.school === SchoolCardID.S6003 && deltaLv <= 2) {
        if (pub.aesthetics > 1) {
            log.push(`|>1`);
            addSchoolVp(G, ctx, p, 1, "美学奖励");
        }
        if (pub.aesthetics > 4) {
            log.push(`|>4`);
            addSchoolVp(G, ctx, p, 2, "美学奖励");
        }
        if (pub.aesthetics > 7) {
            log.push(`|>7`);
            addSchoolVp(G, ctx, p, 2, "美学奖励");
        }
    }

    log.push(`|industryAwardEndTurn`);
    industryAwardEndTurn(G, ctx, ctx.currentPlayer);

    deltaLv = pub.aesthetics - pub.industry;
    if(deltaLv < 0) deltaLv = -deltaLv;
    if (pub.school === SchoolCardID.S6003 && deltaLv <= 2) {
        if (pub.industry > 1) {
            log.push(`|before|${pub.resource}`);
            addRes(G, ctx, p, 1);
            log.push(`|after|${pub.resource}`);
        }
        if (pub.industry > 4) {
            drawCardForPlayer(G, ctx, p);
        }
        if (pub.industry > 7) {
            drawCardForPlayer(G, ctx, p);
            addCompetitionPower(G, ctx, p, 1);
        }
    }

    /*
    //剧影派
    if(pub.school === SchoolCardID.S5204) {
        for(let otherP in G.pub){
            if(otherP !== p){
                let otherPub = G.pub[parseInt(otherP)];
                let noNormalAndLegendCard = true;
                for(let c of otherPub.discard){
                    if(getCardById(c).category == CardCategory.LEGEND || getCardById(c).category == CardCategory.NORMAL){
                        noNormalAndLegendCard = false;
                        break;
                    }
                }
                if(noNormalAndLegendCard){
                    drawCardForPlayer(G, ctx, p);
                    addVp(G, ctx, p, 1);
                }
            }
        }
    }
    */
    // 明星制
    if (pub.school === SchoolCardID.S5206) {
        for(let otherP of G.order) {
            if(otherP !== p && pub.vp > G.pub[parseInt(otherP)].vp) {
                if(pub.vp >= 1) {
                    loseSchoolVp(G, ctx, p, 1);
                    pub.resource++;
                }
            }
        }
    }

    logger.debug(`${G.matchID}|${log.join('')}`);
    pub.actionused = false;
    
    // 恢复阶段后执行
    if (sunTribeShouldArchive) {
        log.push(`|SunTribe|archiveSchool`);
        pub.archive.push("S52684" as any);
        pub.school = null;
        if(pub.industry < 10) pub.industry++;
        addVp(G, ctx, p, 7, "卡牌效果", SchoolCardID.S52684);
        sync3DFilmCompetitionPower(G, p);
    }
    if (berlinShouldTrigger) {
        log.push(`|BerlinSchool|drawAndVp`);
        drawCardForPlayer(G, ctx, p);
        addSchoolVp(G, ctx, p, 1);
    }
}

/** 2026-9 技术：有声电影 - 每-1存款，+1声望 */
export const deductDeposit = (G: IG, ctx: Ctx, p: PlayerID, amount: number): void => {
    const pub = G.pub[parseInt(p)];
    if (amount <= 0 || pub.deposit <= 0) return;
    const actual = pub.deposit >= amount ? amount : pub.deposit;
    pub.deposit -= actual;
    if (pub.archive.includes("S52693" as any)) {
        addVp(G, ctx, p, actual, "卡牌效果", "S52693");
    }
};

/** 2026-9 技术：特技电影 - 出牌开始时记录 Hand_0（2026-10：仅出牌触发） */
export const techStuntActionStart = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    if (pub.archive.includes("S52692" as any)) {
        pub.techStuntHandSnapshot = G.player[parseInt(p)].hand.length;
    } else {
        pub.techStuntHandSnapshot = -1;
    }
};

/** 2026-9 技术：特技电影 - 整个行动结算结束后，对比手牌变化，Δ≠±1 时 +1声望 */
export const techStuntActionSettle = (G: IG, ctx: Ctx): void => {
    const p = ctx.currentPlayer;
    const pub = G.pub[parseInt(p)];
    const handBefore = pub.techStuntHandSnapshot;
    pub.techStuntHandSnapshot = -1;
    if (handBefore < 0) return;
    if (!pub.archive.includes("S52692" as any)) return;
    const delta = G.player[parseInt(p)].hand.length - handBefore;
    if (delta !== 1 && delta !== -1) {
        addVp(G, ctx, p, 1, "卡牌效果", "S52692");
    }
};

/** 2026-10 技术：变焦镜头 - 每次提升美学等级后，-2声望，按照美学等级获得声望 */
export const onAestheticsLevelUp = (G: IG, ctx: Ctx, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    if (!pub.archive.includes("S52701" as any)) return;
    loseVp(G, ctx, p, 2, "卡牌效果", "S52701");
    addVp(G, ctx, p, pub.aesthetics, "卡牌效果", "S52701");
};

/** 2026-10 技术：3D电影 - 竞争力不会低于美学等级（且不高于工业等级） */
export const sync3DFilmCompetitionPower = (G: IG, p: PlayerID): void => {
    const pub = G.pub[parseInt(p)];
    if (!pub.archive.includes("S52702" as any)) return;
    const floor = Math.min(pub.aesthetics, pub.industry);
    if (pub.competitionPower < floor) {
        pub.competitionPower = floor;
    }
    if (pub.competitionPower > pub.industry) {
        pub.competitionPower = pub.industry;
    }
};

export function checkNextEffect(G: IG, ctx: Ctx) {
    const log = ["checkNextEffect"];
    if (G.e.stack.length === 0) {
        log.push(("|stackEmpty"));
        // 2026-10 分数来源统计：结算链结束后清除归属上下文
        G.e.vpContext = null;
        // 2026-9 技术：特技电影 - 行动完全结算后对比手牌变化
        techStuntActionSettle(G, ctx);
        if (G.currentScoreRegion === Region.NONE) {
            log.push(("|No scoring region"));
            {
                if (G.player[parseInt(ctx.currentPlayer)].endTurnEffectExecuted) {
                    log.push(`|endTurnEffectExecuted`);
                    G.player[parseInt(ctx.currentPlayer)].endTurnEffectExecuted = false
                    regionScoringCheck(G, ctx, ctx.currentPlayer);
                    logger.debug(`${G.matchID}|${log.join('')}`);
                    return
                } else {
                    log.push(`|setup`);
                    setupAfterScoring(G, ctx);
                    if (ctx.activePlayers !== null) {
                        log.push("|signalEndStage");
                        signalEndStage(G, ctx);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    } else {
                        log.push(`|notInStage|doNothing|waitingForPlayerMove`);
                        logger.debug(`${G.matchID}|${log.join('')}`);
                        return;
                    }
                }
            }
        } else {
            log.push("|regionEraProgress");
            logger.debug(`${G.matchID}|${log.join('')}`);
            regionEraProgress(G, ctx);
            return;
        }
    } else {
        const nextEff = G.e.stack.slice(-1)[0];
        log.push(`|stackNotEmpty|Next effect|${JSON.stringify(nextEff)}`);
        let targetPlayer = ctx.currentPlayer
        if (nextEff.hasOwnProperty("target")) {
            targetPlayer = nextEff.target;
        }
        log.push(`|target|${targetPlayer}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        
        // console.log("CheckNextEffect: " , G.secretInfo);

        playerEffExec(G, ctx, targetPlayer);
    }
}

export const addCompetitionPower = (G: IG, _ctx: Ctx, p: PlayerID, num: number) => {
    const log = [`p${p}|addCompetitionPower|${num}`];
    const pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.competitionPower}`);
    const targetCompetitionPower = pub.competitionPower + num;
    if (targetCompetitionPower > pub.industry) {
        log.push(`|TargetCompetitionPower|${targetCompetitionPower}|exceedIndustryLevel|${pub.industry}`);
        pub.competitionPower = pub.industry;
    } else {
        pub.competitionPower += num;
    }
    log.push(`|after|${pub.competitionPower}`);
    sync3DFilmCompetitionPower(G, p);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const loseCompetitionPower = (G: IG, _ctx: Ctx, p: PlayerID, num: number) => {
    const log = [`p${p}|loseCompetitionPower|${num}`];
    let pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.competitionPower}`);
    if (num > pub.competitionPower) {
        log.push(`|CompetitionPower|${pub.competitionPower}|insufficient`);
        pub.competitionPower = 0;
    } else {
        pub.competitionPower -= num;
    }
    sync3DFilmCompetitionPower(G, p);
    log.push(`|after|${pub.competitionPower}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const addRes = (G: IG, _ctx: Ctx, p: PlayerID, res: number) => {
    const log = [`addRes|p${p}`];
    const pub = G.pub[parseInt(p)];
    {
        log.push(`|before|${pub.resource}`);
        pub.resource += res;
        log.push(`|after|${pub.resource}`);
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const recordVpStat = (G: IG, p: PlayerID, amount: number, source: string, cardId?: string | null): void => {
    if (amount === 0) return;
    const pub = G.pub[parseInt(p)];
    if (pub === undefined) return;
    if (!pub.vpStats) pub.vpStats = {source: {}, card: {}};
    const src = source || "其他效果";
    pub.vpStats.source[src] = (pub.vpStats.source[src] || 0) + amount;
    if (cardId) {
        const entry = pub.vpStats.card[cardId] ?? {};
        entry[src] = (entry[src] || 0) + amount;
        pub.vpStats.card[cardId] = entry;
    }
};

export const addVp = (G: IG, _ctx: Ctx, p: PlayerID, vp: number, source?: string, cardId?: string | null) => {
    const log = [`addVp|p${p}|${vp}vp`];
    const pub = G.pub[parseInt(p)];
    log.push(`|prev|${pub.vp}`);
    pub.vp += vp;
    log.push(`|after|${pub.vp}`);
    const vpContext = G.e?.vpContext ?? null;
    recordVpStat(G, p, vp, source ?? vpContext?.source ?? "其他效果", cardId ?? vpContext?.card ?? null);
    // 2026-9 技术：特艺七彩 - 首次到达40/80/120声望时+1存款；首次到达150声望时选择工业/美学升级
    // 使用 vpAward 标志(v60=40/v90=80/v120=120/v150=150)判定，声望下降后不会重复触发
    if (pub.archive.includes("S52694" as any)) {
        if (pub.vp >= 40 && !pub.vpAward.v60) {
            pub.deposit += 1;
            log.push(`|techColor|40|+1deposit`);
        }
        if (pub.vp >= 80 && !pub.vpAward.v90) {
            pub.deposit += 1;
            log.push(`|techColor|80|+1deposit`);
        }
        if (pub.vp >= 120 && !pub.vpAward.v120) {
            pub.deposit += 1;
            log.push(`|techColor|120|+1deposit`);
        }
        if (pub.vp >= 150 && !pub.vpAward.v150) {
            // 2026-10 调整：改回 push，升级选择立即处理
            G.e.stack.push({e: "industryOrAestheticsLevelUp", a: 1, target: p});
            log.push(`|techColor|150|choice`);
        }
    }
    //明星制
    if(pub.school === SchoolCardID.S5206 && _ctx.currentPlayer === p){
        let cnt = 0;
        for(let otherP in G.pub){
            if(otherP !== p){
                let otherPub = G.pub[parseInt(otherP)];
                if(pub.vp - vp < otherPub.vp && pub.vp >= otherPub.vp){
                    cnt++;
                }
            }
        }
        while(cnt > 0){
            drawCardForPlayer(G, _ctx, p);
            cnt--;
        }
    }
    let count = 0;
    if (pub.vp >= 40 && !pub.vpAward.v60) {
        log.push(`|v40`);
        count++;
        pub.vpAward.v60 = true;
    }
    if (pub.vp >= 80 && !pub.vpAward.v90) {
        log.push(`|v80`);
        count++;
        pub.vpAward.v90 = true;
    }
    if (pub.vp >= 120 && !pub.vpAward.v120) {
        log.push(`|v120`);
        count++;
        pub.vpAward.v120 = true;
    }
    if (pub.vp >= 150 && !pub.vpAward.v150) {
        log.push(`|v150`);
        pub.vpAward.v150 = true;
        if (!G.testModeEnd180) {
            G.pending.lastRoundOfGame = true;
        }
    }
    if (G.testModeEnd180 && pub.vp >= 180) {
        log.push(`|v180|testMode`);
        G.pending.lastRoundOfGame = true;
    }
    if (count > 0) {
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        // 2026-10 调整：改回 push —— 40/80/120 的升级选择立即弹出，不再延后到整条结算链末尾。
        // 注意：交互式效果挂起期间（等待 chooseRegion / chooseHand 等）不能再往栈顶压效果，
        // 否则对应 move 盲 pop 栈顶会拿到错误效果；相关位置必须先结算完被动再挂起交互。
        G.e.stack.push({e: "industryOrAestheticsLevelUp", a: count, target: p})
        log.push(`|push|industryOrAestheticsLevelUp|stack|${JSON.stringify(G.e.stack)}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        // playerEffExec(G, ctx, p);
    } else {
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const loseDeposit = (G: IG, _ctx: Ctx, p: PlayerID, deposit: number) => {
    const log = [`p${p}|loseDeposit|${deposit}`];
    let pub = G.pub[parseInt(p)];
    log.push(`|before|${pub.deposit}`);
    deductDeposit(G, _ctx, p, deposit);
    log.push(`|after|${pub.deposit}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const loseVp = (G: IG, ctx: Ctx, p: PlayerID, vp: number, source?: string, cardId?: string | null) => {
    const log = [`p${p}|lose${vp}vp`];
    const pub = G.pub[parseInt(p)];
    log.push(`|beforeVP|${pub.vp}`);
    const realVpLose: number = vp >= pub.vp ? pub.vp : vp;
    const vpContext = G.e?.vpContext ?? null;
    recordVpStat(G, p, -realVpLose, source ?? vpContext?.source ?? "其他效果", cardId ?? vpContext?.card ?? null);
    // if (G.competitionInfo.pending) {
    //     log.push(`|inCompetition|noVpDeduct`);
    // } else {
    // }
    pub.vp -= realVpLose;
    if (realVpLose > 0 && pub.school === SchoolCardID.S2104 && ctx.currentPlayer === p) {
        log.push(`|FilmNoir|beforeRes|${pub.resource}`);
        addRes(G, ctx, p, realVpLose);
        log.push(`|afterRes|${pub.resource}`);
    }
    log.push(`|afterVP|${pub.vp}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
}

/** 流派被动/触发效果产生的分数：来源记为「卡牌效果」，并归属到该流派卡 */
export const addSchoolVp = (G: IG, ctx: Ctx, p: PlayerID, amount: number, source: string = "卡牌效果"): void => {
    addVp(G, ctx, p, amount, source, G.pub[parseInt(p)]?.school ?? null);
};

/** 流派被动/触发效果消耗的分数：归属到该流派卡 */
export const loseSchoolVp = (G: IG, ctx: Ctx, p: PlayerID, amount: number, source: string = "卡牌效果"): void => {
    loseVp(G, ctx, p, amount, source, G.pub[parseInt(p)]?.school ?? null);
};

export const buildBuildingFor = (G: IG, ctx: Ctx, r: ValidRegion, p: PlayerID, building: BuildingType): void => {
    const log = [`buildBuildingFor|p${p}|${r}`];
    const pub = G.pub[parseInt(p)];
    const reg = G.regions[r]
    if (reg.share > 0) {
        pub.shares[r]++
        reg.share--;
    }
	if(pub.school === SchoolCardID.S5002){
		if (reg.share > 0) {
			pub.shares[r]++
			reg.share--;
		}
	}
    let built = false;
    reg.buildings.forEach((slot: IBuildingSlot, idx: number) => {
        if (slot.activated && slot.owner === "" && !built) {
            slot.owner = p;
            if (building === BuildingType.cinema) {
                log.push(`|cinema`);
                pub.building.cinemaBuilt = true;
            } else {
                log.push(`|studio`);
                pub.building.studioBuilt = true;
            }
            slot.building = building;
            log.push(`|built|on|slot${idx}`);
            built = true;
        }
    })
    addVp(G, ctx, p, 3, building === BuildingType.cinema ? "电影院" : "制片厂", G.e?.vpContext?.card ?? null);
    //流派扩：法国印象派
    if (pub.school === SchoolCardID.S4001) {
        pub.resource += 1;
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const competitionCleanUp = (G: IG, _ctx: Ctx) => {
    const log = [`competitionCleanUp`];
    let i = G.competitionInfo;
    const atkSchool = G.pub[parseInt(i.atk)].school;
    log.push(`|atkSchool${atkSchool}`);
    // if (atkSchool == SchoolCardID.S3101) {
    //     log.push(`|p${i.atk}|2res`);
    //     addRes(G, ctx, i.atk, 2);
    // }
    // if (atkSchool == SchoolCardID.S3101) {
    //     log.push(`|p${i.atk}|2res`);
    //     addRes(G, ctx, i.atk, 2);
    // }
    i.pending = false;
    i.region = Region.NONE;
    i.progress = 0;
    i.atkCard = null;
    i.defCard = null;
    i.atkPlayedCard = false;
    i.defShownCards = [];
    i.defPlayedCard = false;
    i.onWin = {e: "none", a: 1};
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export function competitionResultSettle(G: IG, ctx: Ctx) {
    const i = G.competitionInfo;
    const log = [`competitionResultSettle|atk:p${i.atk}|def:p${i.def}`];
    console.log(i.progress);
    if (i.progress > 0) {
        const atkSchoolID = G.pub[parseInt(i.atk)].school;
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        console.log(i.onWin.e);
        if (i.onWin.e !== "none") {
            log.push(`|onWin|${JSON.stringify(i.onWin)}`);
            G.e.stack.push({...i.onWin})
        }
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        log.push(`|getShareFromLoser`);
        G.e.stack.push({
            e: ItrEffects.anyRegionShareCompetition, a: 1
        })
        playerEffExec(G, ctx, i.atk);
        //此处添加流派扩争夺方相关内容
        switch (atkSchoolID) {
            case SchoolCardID.S3101:
                log.push('|3101')
                // G.e.stack.push({e: SimpleEffectNames.res, a: 2});
                addRes(G, ctx, i.atk, 2);
                break;
            case SchoolCardID.S4008:
                log.push('|4008')
                // G.e.stack.push({e: SimpleEffectNames.addCompetitionPower, a: 1});
                // G.e.stack.push({e: SimpleEffectNames.draw, a: 1});
                addCompetitionPower(G, ctx, i.atk, 1);
                drawCardForPlayer(G, ctx, i.atk);
                break;
            default:
                log.push(`|schoolID|${atkSchoolID}`)
                break;
        }
        
        // P6311 Kubrick: after contest, +1 deposit, +1 competition power
        const atkPub = G.pub[parseInt(i.atk)];
        if(atkPub.activeCardInTurn.includes(PersonCardID.P6311)){
            atkPub.deposit += 1;
            addCompetitionPower(G, ctx, i.atk, 1);
        }
        
        //此处添加流派扩防守方相关内容
        const defSchoolID = G.pub[parseInt(i.def)].school;
        switch (defSchoolID) {
            case SchoolCardID.S4006:
                drawCardForPlayer(G, ctx, i.def);
                loseVp(G, ctx, i.atk, 5, "卡牌效果", defSchoolID);
                break;
            case SchoolCardID.S4005:
                aesAward(G, ctx, i.def);
                break;
            default:
                log.push(`|schoolID|${atkSchoolID}`)
                break;
        }
        return;
    } else {
        log.push(`|noWinner|competitionCleanUp|checkNextEffect`);
        log.push(`|stack|${JSON.stringify(G.e.stack)}`);
        competitionCleanUp(G, ctx);
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
        return;
    }
}

export function atkCardSettle(G: IG, ctx: Ctx) {
    let i = G.competitionInfo;
    let cards = G.player[parseInt(i.atk)].competitionCards;
    const log = [`atkCardSettle`];
    if (cards.length > 0) {
        const cardId = cards[0];
        i.atkCard = cardId;
        const pub = G.pub[parseInt(i.atk)];
        pub.playedCardInTurn.push(cardId);
        G.player[parseInt(i.atk)].competitionCards = []
        log.push(`|${cardId}`);
        const card = getCardById(cardId);
        const industryMarkCount = card.industry;
        log.push(`|industryMarkCount:${industryMarkCount}`);
        i.progress += industryMarkCount;
        log.push(`|${i.progress}`);
        if (cinemaInRegion(G, ctx, card.region, i.atk) && card.type === CardType.F) {
            log.push(`|cinemaInRegion|${card.region}|${i.progress}`);
            i.progress++;
            log.push(`|after|${i.progress}`);
        }
        const cardEff = getCardEffect(cardId);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                eff.target = i.atk;
                log.push(`|${JSON.stringify(eff)}`);
                G.e.stack.push(eff)
            } else {
                log.push(`|emptyPlayEffect`);
            }
        } else {
            log.push(`|noPlayEffect`);
        }
        G.e.card = cardId;
        G.e.vpContext = {source: "卡牌效果", card: cardId};
        logger.debug(`${G.matchID}|${log.join('')}`);
        playerEffExec(G, ctx, i.atk);
    } else {
        log.push("|atkNoCard|defCardSettle");
        logger.debug(`${G.matchID}|${log.join('')}`);
        defCardSettle(G, ctx);
    }
}

export const defCardSettle = (G: IG, ctx: Ctx) => {
    const log = ["defCardSettle"];
    const i = G.competitionInfo;
    const cards = G.player[parseInt(i.def)].competitionCards;
    if (cards.length > 0) {
        drawCardForPlayer(G, ctx, i.def);
        const cardId = cards[0];
        i.defCard = cardId;
        log.push(`|${cardId}`);
        const card = getCardById(cardId);
        const industryMarkCount = card.industry;
        log.push(`|industryMarkCount:${industryMarkCount}`);
        i.progress -= industryMarkCount;
        log.push(`|${i.progress}`);
        G.pub[parseInt(i.def)].discard.push(cardId);
        const cardEff = getCardEffect(cardId);
        if (cardEff.hasOwnProperty("play")) {
            const eff = {...cardEff.play};
            if (eff.e !== "none") {
                eff.target = i.def;
                log.push(`|${JSON.stringify(eff)}`);
                G.e.stack.push(eff)
            } else {
                log.push(`|emptyPlayEffect`);
            }
        } else {
            log.push(`|noPlayEffect`);
        }
        G.player[parseInt(i.def)].competitionCards = [];
        if (cinemaInRegion(G, ctx, card.region, i.def) && card.type === CardType.F) {
            log.push(`|cinemaInRegion|${card.region}|${i.progress}`);
            i.progress--;
            log.push(`|after|${i.progress}`);
        }
        G.e.card = cardId;
        G.e.vpContext = {source: "卡牌效果", card: cardId};
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkNextEffect(G, ctx);
    } else {
        log.push(`|defNoCard|showCompetitionResult`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
    }
}

export function nextEra(G: IG, ctx: Ctx, r: ValidRegion) {
    const region = G.regions[r];
    const era = region.era;
    const log = [`nextEra|${r}|era:${era}`];
    let newEra;
    log.push(`|removeCards`);
    doReturnSlotCard(G, ctx, region.legend);
    for (let slot of region.normal) {
        doReturnSlotCard(G, ctx, slot);
    }
    log.push(`|${JSON.stringify(region)}`);
    log.push(`|resetShare`);
    for (let i = 0; i < G.order.length; i++) {
        G.pub[i].shares[r] = 0;
    }
    region.share = 0;
    if (era === IEra.ONE) {
        log.push(`|IEra.TWO`);
        newEra = IEra.TWO;
        region.era = newEra;
        drawForRegion(G, ctx, r, newEra);
        region.share = ShareOnBoard[r][newEra];
        if (ctx.numPlayers === 3) {
            region.share--;
        }
    }
    if (era === IEra.TWO) {
        if (G.mode === GameMode.NEWBIE) {
            log.push(`|NewbieMode`);
            log.push(`|completedERA2Scoring`);
            region.completedLastScoring = true;
        } else {
            log.push(`|goto|IEra.THREE`);
            newEra = IEra.THREE;
            region.share = ShareOnBoard[r][newEra];
            region.era = newEra;
            newEra = IEra.THREE;
            drawForRegion(G, ctx, r, newEra);
            if (ctx.numPlayers === 3) {
                region.share--;
            }
        }
    }
    if (era === IEra.THREE) {
        log.push(`|eraThreeEnd`);
        log.push(`|completedModernScoring`);
        region.completedLastScoring = true;
    }
    if (G.mode === GameMode.NEWBIE) {
        if (valid_regions
            .filter(r => G.regions[r].completedLastScoring)
            .length >= 2) {
            log.push("2orMoreRegion|completedERA2Scoring");
            if (ctx.currentPlayer === getExistingLastMovePlayer(G)) {
                log.push(`|finalScoring`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                finalScoring(G, ctx);
                return;
            } else {
                log.push("|lastRound");
                G.pending.lastRoundOfGame = true
            }
        }
    } else {
        if (valid_regions
            .filter(r => G.regions[r].completedLastScoring)
            .length >= 3) {
            log.push("3orMoreRegion|completedModernScoring");
            if (ctx.currentPlayer === getExistingLastMovePlayer(G)) {
                log.push(`|finalScoring`);
                logger.debug(`${G.matchID}|${log.join('')}`);
                finalScoring(G, ctx);
                return;
            } else {
                log.push("|lastRound");
                G.pending.lastRoundOfGame = true
            }
        }
    }
    logger.debug(`${G.matchID}|${log.join('')}`);
}

export const doNotLoseVpAfterCompetitionSchool = (school: SchoolCardID): boolean => {
    switch (school) {
        case SchoolCardID.S3201:
            return true;
        case SchoolCardID.S3204:
            return true;
        case SchoolCardID.S3304:
            return true;
        case SchoolCardID.S5202:
            return true;
        case SchoolCardID.S6342:
            return true;
        default:
            return false;
    }
}

export const startCompetition = (G: IG, ctx: Ctx, atk: PlayerID, def: PlayerID) => {
    const log = [`startCompetition|atk${atk}|def${def}`];
    let i = G.competitionInfo;
    i.pending = true;
    i.atk = atk;
    i.def = def;
    const atkPub = G.pub[parseInt(i.atk)];
    const defPub = G.pub[parseInt(i.def)];
    const defSchoolID = defPub.school;
    const CompetitionPowerDelta = atkPub.competitionPower - 3 - defPub.competitionPower;
    log.push(`|atkCP${atkPub.competitionPower}|defCP${defPub.competitionPower}|CompetitionPowerDelta:${CompetitionPowerDelta}`);
    i.progress = CompetitionPowerDelta;
    if (defSchoolID !== null && doNotLoseVpAfterCompetitionSchool(defSchoolID)) {
        log.push(`|${defSchoolID}|doNotLoseVP`);
    } else {
        log.push(`|p${i.def}|lose${CompetitionPowerDelta}vp`);
        loseVp(G, ctx, def, CompetitionPowerDelta, "争夺");
    }
    addVp(G, ctx, atk, CompetitionPowerDelta, "争夺");
    loseCompetitionPower(G, ctx, atk, 3);
    addCompetitionPower(G, ctx, def, 1);
    log.push(`|showCompetitionResult`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    competitionResultSettle(G, ctx);
    // changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
}


export const checkCompetitionDefender = (G: IG, ctx: Ctx) => {
    let i = G.competitionInfo;
    const log = [`checkCompetitionDefender|p${i.def}|emptyHand|${JSON.stringify(i)}`];
    if (G.player[parseInt(i.def)].hand.length > 0) {
        log.push(`|hasHand|changePlayerStage|competitionCard`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "competitionCard", i.def);
    } else {
        i.defPlayedCard = true;
        log.push(`|hasHand|changePlayerStage|showCompetitionResult`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "showCompetitionResult", i.atk);
    }
}
export const checkCompetitionAttacker = (G: IG, ctx: Ctx) => {
    const log = ["checkCompetitionAttacker"];
    let i = G.competitionInfo;
    if (G.player[parseInt(i.atk)].hand.length > 0) {
        log.push(`|p${i.atk}|competitionCard`);
        logger.debug(`${G.matchID}|${log.join('')}`);
        changePlayerStage(G, ctx, "competitionCard", i.atk);
    } else {
        log.push(`|p${i.atk}|emptyHand`);
        i.atkPlayedCard = true;
        logger.debug(`${G.matchID}|${log.join('')}`);
        checkCompetitionDefender(G, ctx);
    }
}

const cleanUpScore = (G: IG, _ctx: Ctx, pid: PlayerID) => {
    let i = parseInt(pid);
    let p = G.pub[i];
    let f = p.finalScoring;
    f.card = 0
    f.building = 0
    f.industryAward = 0
    f.aestheticsAward = 0
    f.archive = 0
    f.events = 0
    f.total = 0
    p.vpStatsFinal = {source: {}, card: {}};
}

export const getExtraScoreForFinal = (G: IG, ctx: Ctx, pid: PlayerID, showLog: boolean = false): void => {
    const i = parseInt(pid);
    const p = G.pub[i];
    const s = G.player[i];
    cleanUpScore(G, ctx, pid);
    const f = p.finalScoring;
    // This runs for every player on every state sync, so nothing is recorded
    // unless debug logging is on.
    const logging = showLog && logger.enabled;
    const log: string[] = [];
    const logPush = (entry: string) => {
        if (logging) log.push(entry);
    };
    const validID = [...G.secretInfo.playerDecks[i], ...p.discard, ...s.hand, ...p.playedCardInTurn]
    if (p.school !== null) {
        validID.push(p.school);
    }
    const validCards = validID.map(c => getCardById(c));
    logPush(`|card|before|${f.card}`);
    validCards.forEach(c => {
        f.card += c.vp
    });
    logPush(`|after|${f.card}`);
    if (p.industry === 10) {
        logPush(`|vp|${p.vp}|before|${f.industryAward}`);
        validCards.forEach(eraCard => {
            logPush(`|card:${eraCard.cardId}|era:${eraCard.era}`);
            logPush(`|before|${f.industryAward}`);
            switch (eraCard.era) {
                case IEra.ONE:
                    f.industryAward += 1;
                    break;
                case IEra.TWO:
                    f.industryAward += 2;
                    break;
                case IEra.THREE:
                    f.industryAward += 3;
                    break;
            }
            logPush(`|after|${f.industryAward}`);
        });
        logPush(`|after|${f.industryAward}`);
    }
    if (p.aesthetics === 10) {
        logPush(`|vp|${p.vp}|before|${f.aestheticsAward}`);
        f.aestheticsAward += Math.floor(p.vp / 5);
        logPush(`|after|${f.aestheticsAward}`);
    }
    logPush(`|archive`);
    valid_regions.forEach(r => {
        logPush(`|region|${r}|before|${f.archive}`);
        // const championCount = p.champions.filter(c => c.region === r).length;
        let championModifier = 0;
        p.champions.filter(c => c.region === r).forEach((ch) => {
            switch (ch.era) {
                case IEra.ONE:
                    championModifier = championModifier + 1;
                    break;
                case IEra.TWO:
                    championModifier = championModifier + 2;
                    break;
                case IEra.THREE:
                    championModifier = championModifier + 3;
                    break;
                default:
                    break;
            }
        });
        logPush(`|championModifier:${championModifier}`);
        f.archive += p.archive.filter(card => getCardById(card).region === r).length * championModifier;
        logPush(`|after|${f.archive}`);
    });
    {
        // if (validID.includes(PersonCardID.P3102)) {
        //     logPush(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.industry > 0)
        //         .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
        //         .length * 2;
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3106)) {
        //     logPush(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.NA)
        //         .length * 2
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3107)) {
        //     logPush(`|before|${f.events}`);
        //     f.events += validCards
        //         .filter(c => c.category === CardCategory.BASIC)
        //         .length;
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3202)) {
        //     logPush(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.WE)
        //         .length * 2;
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3302)) {
        //     logPush(`|${p.industry * 2}|before|${f.events}`);
        //     f.events += p.industry * 2;
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3403)) {
        //     logPush(`|3403|before|${f.events}`);
        //     f.events += p.aesthetics;
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3301)) {
        //     logPush(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.EE)
        //         .length * 2
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3203)) {
        //     logPush(`|3203|before|${f.events}`);
        //     f.events += validCards.filter(c => c.aesthetics > 0)
        //         .filter(c => c.category === CardCategory.LEGEND || c.category === CardCategory.NORMAL)
        //         .length * 2
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3401)) {
        //     logPush(`|3401||before|${f.events}`);
        //     // f.events += validCards.filter(c => c.type === CardType.P).length * 4;
        //     f.events += p.industry;
        //     logPush(`|after|${f.events}`);
        // }
        // if (validID.includes(PersonCardID.P3402)) {
        //     logPush(`|before|${f.events}`);
        //     f.events += validCards.filter(c => c.region === Region.ASIA)
        //         .length * 2;
        //     logPush(`|after|${f.events}`);
        // }
    }
    const industryEffIDS: PersonCardID[] = [
        PersonCardID.P3102,
        PersonCardID.P3107,
        PersonCardID.P3302,
        PersonCardID.P3401,

        PersonCardID.P6311,
    ]
    for (let iCard of industryEffIDS) {
        if (validID.includes(iCard)) {
            logPush(`|industry|${iCard}|before|${f.events}`);
            f.events += p.industry;
            logPush(`|after|${f.events}`);
        }
    }
    const aesEffIDS: PersonCardID[] = [
        PersonCardID.P3106,
        PersonCardID.P3202,
        PersonCardID.P3203,
        PersonCardID.P3301,
        PersonCardID.P3402,
        PersonCardID.P3403,

        PersonCardID.P6321,
        PersonCardID.P6341,
    ]
    for (let aCard of aesEffIDS) {
        if (validID.includes(aCard)) {
            logPush(`|aes|${aCard}|before|${f.events}`);
            f.events += p.aesthetics;
            logPush(`|after|${f.events}`);
        }
    }
    // P6331: 按照最高的等级计分
    if (validID.includes(PersonCardID.P6331)) {
        log.push(`|6331highest|before|${f.events}`);
        f.events += Math.max(p.industry, p.aesthetics);
        log.push(`|after|${f.events}`);
    }
    // S6002/S6003 思想电影/新思想电影: +4 / (工业等级 + 美学等级)
    if (p.school === SchoolCardID.S6002 || p.school === SchoolCardID.S6003) {
        log.push(`|thoughtFilm|before|${f.events}`);
        f.events += 4 * Math.min(p.industry, p.aesthetics);
        log.push(`|after|${f.events}`);
    }

    f.total = p.vp + f.card + f.building + f.industryAward + f.aestheticsAward + f.archive + f.events;
    logPush(`|total:${f.total}`);

    // 2026-10 分数来源统计：终局计分归属
    const finalStats = {
        source: {} as { [source: string]: number },
        card: {} as { [cardId: string]: { [source: string]: number } },
    };
    // 来源合计（不带卡牌归属）
    const addFinal = (source: string, amount: number) => {
        if (amount === 0) return;
        finalStats.source[source] = (finalStats.source[source] || 0) + amount;
    };
    // 仅记录「该卡在该来源的贡献」，不再重复累加来源合计（否则来源会被算两遍）
    const addFinalCard = (source: string, amount: number, cardId?: string | null) => {
        if (amount === 0 || !cardId) return;
        const entry = finalStats.card[cardId] ?? {};
        entry[source] = (entry[source] || 0) + amount;
        finalStats.card[cardId] = entry;
    };
    addFinal("牌分", f.card);
    addFinal("工业大奖", f.industryAward);
    // 美学大奖按当前声望折算（每 5 声望 +1），不对应单张牌，只记录来源合计
    addFinal("美学大奖", f.aestheticsAward);
    addFinal("第一名标志物", f.archive);
    addFinal("卡牌效果", f.events);
    addFinal("其他效果", f.building);
    // 按牌归属：牌分
    validCards.forEach(c => addFinalCard("牌分", c.vp, c.cardId));
    // 按牌归属：第一名标志物（档案卡 × 对应地区第一名标志物修正）
    valid_regions.forEach(r => {
        let championModifier = 0;
        p.champions.filter(c => c.region === r).forEach(ch => {
            championModifier += ch.era + 1;
        });
        if (championModifier === 0) return;
        p.archive.filter(card => getCardById(card).region === r).forEach(card => {
            addFinalCard("第一名标志物", championModifier, card);
        });
    });
    // 按牌归属：人物/流派终局效果
    industryEffIDS.forEach(id => {
        if (validID.includes(id)) addFinalCard("卡牌效果", p.industry, id);
    });
    aesEffIDS.forEach(id => {
        if (validID.includes(id)) addFinalCard("卡牌效果", p.aesthetics, id);
    });
    if (validID.includes(PersonCardID.P6331)) {
        addFinalCard("卡牌效果", Math.max(p.industry, p.aesthetics), PersonCardID.P6331);
    }
    if (p.school === SchoolCardID.S6002 || p.school === SchoolCardID.S6003) {
        addFinalCard("卡牌效果", 4 * Math.min(p.industry, p.aesthetics), p.school);
    }
    // 按牌归属：工业大奖
    if (p.industry === 10) {
        validCards.forEach(c => {
            const award = c.era === IEra.ONE ? 1 : (c.era === IEra.TWO ? 2 : (c.era === IEra.THREE ? 3 : 0));
            addFinalCard("工业大奖", award, c.cardId);
        });
    }
    p.vpStatsFinal = finalStats;
    if (logging) {
        logger.debug(`${G.matchID}|${log.join('')}`);
    }
}

export const schoolPlayer = (G: IG, _ctx: Ctx, cardId: CardID): PlayerID | null => {
    const log = [`schoolPlayer|${cardId}`];
    let player = null
    G.order.forEach(p => {
        log.push(`|${p}`);
        if (G.pub[parseInt(p)].school === cardId) {
            log.push(`|kino`);
            player = p;
        } else {
            log.push(`|notKino`);
        }
    })
    log.push(`|result|${player}`);
    logger.debug(`${G.matchID}|${log.join('')}`);
    return player;
}

export const rank = (G: IG, ctx: Ctx, p1: number, p2: number, showLog: boolean = false): number => {
    const log = [`rank|p${p1}|p${p2}`];
    let pub1 = G.pub[p1];
    let pub2 = G.pub[p2];
    const v1 = pub1.finalScoring.total;
    const v2 = pub2.finalScoring.total;
    log.push(`|vp|${v1}|${v2}`);
    if (v1 > v2) {
        log.push(`|p${p1}wins`);
        if (showLog) {
            logger.debug(`${G.matchID}|${log.join('')}`);
        }
        return -1;
    } else {
        if (v1 < v2) {
            log.push(`|p${p2}wins`);
            if (showLog) {
                logger.debug(`${G.matchID}|${log.join('')}`);
            }
            return 1;
        } else {
            const pos1 = initialPosOfPlayer(G, ctx, p1.toString());
            const pos2 = initialPosOfPlayer(G, ctx, p2.toString());
            log.push(`|initialPos|${pos1}|${pos2}`);
            if (showLog) logger.debug(`${G.matchID}|${log.join('')}`);
            if (pos1 < pos2) {
                log.push(`|p${p2}wins`);
                if (showLog) {
                    logger.debug(`${G.matchID}|${log.join('')}`);
                }
                return 1
            } else {
                log.push(`|p${p1}wins`);
                if (showLog) {
                    logger.debug(`${G.matchID}|${log.join('')}`);
                }
                return -1
            }
        }
    }
}

export const finalScoring = (G: IG, ctx: Ctx) => {
    let pid: number[] = [];
    for (let i = 0; i < G.order.length; i++) {
        getExtraScoreForFinal(G, ctx, i.toString(), true);
        pid.push(i);
    }
    const rankFunc = (a: number, b: number) => rank(G, ctx, a, b, true);
    let finalRank = pid.sort(rankFunc);
    appendServerMatchStats(G, ctx, VictoryType.finalScoring, finalRank[0].toString());
    stopTimingForGameEnd(G, ctx);
    ctx?.events?.endGame?.({
        winner: finalRank[0].toString(),
        reason: VictoryType.finalScoring,
    })
}

export default cleanUpScore;
