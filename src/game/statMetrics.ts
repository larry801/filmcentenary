import {IG} from "../types/setup";
import {
    AvantGradeAP,
    BasicCardID,
    BuildingType,
    CardType,
    DEFAULT_COMPANY_SCALE,
    EventCardID,
    IEra,
    LES_CHAIERS_DU_CINEMA_COMPANY_SCALE,
    Region,
    valid_regions,
    getCardById,
} from "../types/core";
import {getCardEffect} from "../constant/effects";

export const calcRoundFromTurn = (turn: number, playerCount: number): number => {
    const n = Number.isFinite(playerCount) && playerCount > 0 ? Math.floor(playerCount) : 1;
    if (!Number.isFinite(turn) || turn <= 0) {
        return 0;
    }
    return Math.floor((turn - 2) / n) + 1;
};

const eraLevel = (era: IEra | undefined): number => {
    if (era === IEra.ONE) {
        return 1;
    }
    if (era === IEra.TWO) {
        return 2;
    }
    if (era === IEra.THREE) {
        return 3;
    }
    return 0;
};

const eraBenchmark = (era: IEra | undefined): number => {
    if (era === IEra.ONE) {
        return 4;
    }
    if (era === IEra.TWO) {
        return 10;
    }
    if (era === IEra.THREE) {
        return 20;
    }
    return 1;
};

const calcCompanyScale = (G: IG, playerIndex: number): number => {
    const pub = G.pub[playerIndex];
    if (!pub) {
        return DEFAULT_COMPANY_SCALE;
    }
    const rawLimit = pub.LES_CHAIERS_DU_CINEMA ? LES_CHAIERS_DU_CINEMA_COMPANY_SCALE : DEFAULT_COMPANY_SCALE;
    if (pub.school === null) {
        return rawLimit;
    }
    const schoolHand = getCardEffect(pub.school).school.hand;
    return schoolHand > rawLimit ? schoolHand : rawLimit;
};

const calcActionPoint = (G: IG, playerIndex: number): number => {
    const pub = G.pub[playerIndex];
    if (!pub) {
        return 1;
    }
    let action = pub.school !== null ? getCardEffect(pub.school).school.action : 1;
    if (G.activeEvents.includes(EventCardID.E03) && action < AvantGradeAP) {
        action = AvantGradeAP;
    }
    return action;
};

const hasCinemaInRegion = (G: IG, playerID: string, region: Region): boolean => {
    if (!valid_regions.includes(region as any)) {
        return false;
    }
    const slots = (G.regions as any)?.[region]?.buildings;
    if (!Array.isArray(slots)) {
        return false;
    }
    return slots.some((s: any) => s?.building === BuildingType.cinema && s?.owner === playerID);
};

export const calcCardEfficiency = (G: IG, playerIndex: number): number => {
    const p = G.pub[playerIndex];
    const ps = G.player[playerIndex];
    if (!p || !ps) {
        return 0;
    }
    const hiddenDeck = Array.isArray(G.secretInfo?.playerDecks?.[playerIndex]) ? G.secretInfo.playerDecks[playerIndex] : [];
    const cards = [...hiddenDeck, ...p.discard, ...ps.hand, ...p.playedCardInTurn];
    const normalizedCards = cards
        .map((cardID) => `${cardID || ""}`.trim().toUpperCase())
        .filter((id) => !!id);
    const classicCount = normalizedCards.filter((id) => id === BasicCardID.B05 || id === "B06").length;
    const denominator = normalizedCards.length - classicCount;
    if (denominator <= 0) {
        return 0;
    }

    const companyScale = calcCompanyScale(G, playerIndex);
    const action = calcActionPoint(G, playerIndex);
    const leftPart = (companyScale / 4 + (1 + (action - 1) * 0.5)) / 2;

    let regionEraTerm = 0;
    let bMovieCount = 0;
    let cinemaBoostCount = 0;
    let eraRegionFirstCardCount = 0;
    let eraRegionSecondThirdCardCount = 0;
    const champions = Array.isArray(p.champions) ? p.champions : [];
    const scoreRankByEraRegion = new Map<string, number>();

    normalizedCards.forEach((cardID) => {
        try {
            const card = getCardById(cardID as any) as any;
            if (typeof card?.rank === "number" && valid_regions.includes(card?.region as any) && typeof card?.era === "number") {
                const key = `${card.region}-${card.era}`;
                const cur = scoreRankByEraRegion.get(key);
                if (cur === undefined || card.rank < cur) {
                    scoreRankByEraRegion.set(key, card.rank);
                }
            }
        } catch {
            // ignore unsupported card ids
        }
    });

    normalizedCards.forEach((cardID) => {
        try {
            const card = getCardById(cardID as any);
            if (card?.cardId === BasicCardID.B03 || cardID === BasicCardID.B03) {
                bMovieCount += 1;
            }
            const region = card?.region as Region;
            if (!valid_regions.includes(region as any)) {
                return;
            }
            if (card?.type === CardType.F && hasCinemaInRegion(G, playerIndex.toString(), region)) {
                cinemaBoostCount += 1;
            }
            const cardEra = eraLevel(card?.era as IEra | undefined);
            const regionEra = eraLevel((G.regions as any)?.[region]?.era as IEra | undefined);
            if (cardEra > 0 && regionEra > 0) {
                const needIndustry = Number(card?.cost?.industry || 0);
                const needAesthetics = Number(card?.cost?.aesthetics || 0);
                const needRes = Number(card?.cost?.res || 0);
                const p = 2 * Math.sqrt(needIndustry * needIndustry + needAesthetics * needAesthetics) + needRes;
                const rx = eraBenchmark(card?.era as IEra | undefined);
                regionEraTerm += (cardEra / regionEra) * (p / rx);
            }
            const key = `${region}-${card?.era}`;
            const rankByScore = scoreRankByEraRegion.get(key);
            const hasEraRegionChampion = champions.some((c: any) => c?.region === region && c?.era === card?.era) || rankByScore === 1;
            if (hasEraRegionChampion) {
                eraRegionFirstCardCount += 1;
            } else if (rankByScore === 2 || rankByScore === 3) {
                eraRegionSecondThirdCardCount += 1;
            }
        } catch {
            // ignore unsupported card ids
        }
    });

    const fundCardCount = normalizedCards.filter((id) => id === BasicCardID.B07).length;
    const middlePart = regionEraTerm + bMovieCount * 0.5 + fundCardCount / 3 + eraRegionFirstCardCount * 0.5 + eraRegionSecondThirdCardCount / 3 + cinemaBoostCount / 3;
    return (leftPart * middlePart) / denominator;
};
