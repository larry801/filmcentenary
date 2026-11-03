import {RoyalSetup} from "./types";

/**
 * Royal marriage table from the Scenario Book (page 31).
 *
 * `rating` is the printed turn-1 eligibility rating.  The Campaign and
 * Tournament sections give the rating actually available in that scenario,
 * which can be lower because turns 1 and/or 2 have already been played.
 */
export interface RoyalDef extends RoyalSetup {
    /** Printed eligibility rating on the Royal Weddings card. */
    rating: number;
    /** Full marriage-bonus text from the Scenario Book. */
    bonus: string;
}

export const ROYALS: RoyalDef[] = [
    {
        id: "philipII",
        nameEn: "Philip II",
        nameZh: "腓力二世",
        country: "spain",
        turn: 1,
        rating: 3,
        eligibility: 3,
        bonus:
            "-1 card on Turn 2 if he breaks the prearranged marriage to Elisabeth de Valois (including a Last Minute Cancellation).",
    },
    {
        id: "leicester",
        nameEn: "Earl of Leicester",
        nameZh: "莱斯特伯爵",
        country: "england",
        turn: 1,
        rating: 1,
        eligibility: 1,
        bonus: "If unmarried, stays in the pool as a 1 every turn Elizabeth I is in.",
    },
    {
        id: "elizabethI",
        nameEn: "Elizabeth I",
        nameZh: "伊丽莎白一世",
        country: "england",
        turn: 1,
        rating: 5,
        eligibility: 5,
        bonus: "+1 Virgin Queen VP at the end of each turn she remains unmarried (through Turn 5).",
    },
    {
        id: "williamOrange",
        nameEn: "William of Orange",
        nameZh: "奥兰治的威廉",
        country: "protestant",
        turn: 1,
        rating: 2,
        eligibility: 2,
        bonus:
            "If the marriage result does not score VP, William returns to the pool next turn at Eligibility Rating 2.",
    },
    {
        id: "arran",
        nameEn: "Earl of Arran",
        nameZh: "阿兰伯爵",
        country: "protestant",
        turn: 1,
        rating: 1,
        eligibility: 1,
        bonus: "After marriage, the Protestant immediately resolves a Preach Sermon action in Scotland.",
    },
    {
        id: "charlesII",
        nameEn: "Charles II of Austria",
        nameZh: "奥地利的查理二世",
        country: "hre",
        turn: 1,
        rating: 2,
        eligibility: 2,
        bonus: "-1 card on the next turn to England or the Protestant if their royal marries him.",
    },
    {
        id: "elisabethValois",
        nameEn: "Elisabeth de Valois",
        nameZh: "瓦卢瓦的伊丽莎白",
        country: "france",
        turn: 1,
        rating: 2,
        eligibility: 2,
        bonus: "Has a prearranged marriage to Philip II on Turn 1; +1 Valois Marriage VP when she marries.",
    },
    {
        id: "annaSaxony",
        nameEn: "Anna of Saxony",
        nameZh: "萨克森的安娜",
        country: "hre",
        turn: 1,
        rating: 1,
        eligibility: 1,
        bonus: "Husband's power +1 card next turn.",
    },
    {
        id: "donCarlos",
        nameEn: "Don Carlos",
        nameZh: "唐·卡洛斯",
        country: "spain",
        turn: 1,
        rating: 2,
        eligibility: 2,
        bonus: "Must reroll the highest marriage result die.",
    },
    {
        id: "maryQueenOfScots",
        nameEn: "Mary Queen of Scots",
        nameZh: "苏格兰女王玛丽",
        country: "france",
        turn: 2,
        rating: 3,
        eligibility: 3,
        bonus:
            "Husband's power adds 2 influence in Scotland; resolve her wedding immediately in the Diplomacy Phase.",
    },
    {
        id: "darnley",
        nameEn: "Henry, Lord Darnley",
        nameZh: "亨利·达恩利勋爵",
        country: "england",
        turn: 2,
        rating: 1,
        eligibility: 1,
        bonus: "Add 2 French influence in Scotland if he marries Mary Queen of Scots.",
    },
    {
        id: "charlesIX",
        nameEn: "Charles IX",
        nameZh: "查理九世",
        country: "france",
        turn: 2,
        rating: 3,
        eligibility: 3,
        bonus:
            "+1 Valois Marriage VP when he marries (may not marry a French royal other than Mary Queen of Scots).",
    },
    {
        id: "annaAustria",
        nameEn: "Anna of Austria",
        nameZh: "奥地利的安娜",
        country: "hre",
        turn: 3,
        rating: 2,
        eligibility: 2,
        bonus:
            "May reroll the lowest marriage result die if desired (chosen by the HRE, or by the husband's power if the HRE is inactive).",
    },
    {
        id: "henryIII",
        nameEn: "Henry III (Anjou)",
        nameZh: "亨利三世（安茹）",
        country: "france",
        turn: 3,
        rating: 3,
        eligibility: 3,
        bonus:
            "+1 Valois Marriage VP when he marries (may not marry a French royal other than Mary Queen of Scots).",
    },
    {
        id: "margueriteValois",
        nameEn: "Marguerite de Valois",
        nameZh: "瓦卢瓦的玛格丽特",
        country: "france",
        turn: 3,
        rating: 3,
        eligibility: 3,
        bonus: "+1 Valois Marriage VP when she marries (may not marry a French royal).",
    },
    {
        id: "henryIV",
        nameEn: "Henry IV (Navarre)",
        nameZh: "亨利四世（纳瓦拉）",
        country: "protestant",
        turn: 3,
        rating: 3,
        eligibility: 3,
        bonus: "The Protestant +1 card next turn if he marries a French royal.",
    },
    {
        id: "louiseLorraine",
        nameEn: "Louise of Lorraine",
        nameZh: "洛林的路易丝",
        country: "any",
        turn: 3,
        rating: 2,
        eligibility: 2,
        bonus: "Added by event card; not associated with any specific power.",
    },
    {
        id: "elisabethAustria",
        nameEn: "Elisabeth of Austria",
        nameZh: "奥地利的伊丽莎白",
        country: "hre",
        turn: 3,
        rating: 2,
        eligibility: 2,
        bonus:
            "If she marries a French or Spanish royal, that power immediately resolves a Suppress Heresy action.",
    },
    {
        id: "rudolfII",
        nameEn: "Rudolf II",
        nameZh: "鲁道夫二世",
        country: "hre",
        turn: 4,
        rating: 2,
        eligibility: 2,
        bonus: "Loses the patronage Home Card bonus if he marries (place a marker on the HRE power card).",
    },
    {
        id: "louiseColigny",
        nameEn: "Louise de Coligny",
        nameZh: "科利尼的路易丝",
        country: "protestant",
        turn: 4,
        rating: 2,
        eligibility: 2,
        bonus: "If she marries an English or Protestant royal, that power +1 card next turn.",
    },
    {
        id: "alencon",
        nameEn: "Duke of Alencon",
        nameZh: "阿朗松公爵",
        country: "france",
        turn: 4,
        rating: 1,
        eligibility: 1,
        bonus:
            "+1 Valois Marriage VP when he marries (may not marry a French royal other than Mary Queen of Scots).",
    },
    {
        id: "isabellaClaraEugenia",
        nameEn: "Isabella Clara Eugenia",
        nameZh: "伊莎贝拉·克拉拉·尤金妮亚",
        country: "spain",
        turn: 5,
        rating: 2,
        eligibility: 2,
        bonus:
            "Husband's power is +1 on all patronage rolls if her husband is a ruler (place a marker on the husband's power card).",
    },
];

export const ROYAL_BY_ID: Record<string, RoyalDef> = Object.fromEntries(
    ROYALS.map((r) => [r.id, r]),
);

const at = (id: string, eligibility: number, extra: Partial<RoyalSetup> = {}): RoyalSetup => {
    const r = ROYAL_BY_ID[id];
    if (r === undefined) {
        throw new Error(`unknown royal: ${id}`);
    }
    return {...r, eligibility, ...extra};
};

/**
 * Campaign Royal Weddings card (page 7).  Only the royals actually offered by
 * this scenario are listed; Rudolf II and the Turn 2+ royals enter later.
 */
export const CAMPAIGN_ROYALS: RoyalSetup[] = [
    at("elizabethI", 5),
    at("philipII", 3),
    at("donCarlos", 2),
    at("elisabethValois", 2),
    at("charlesII", 2),
    at("williamOrange", 2),
    at("leicester", 1),
    at("annaSaxony", 1),
    at("arran", 1),
];

/**
 * Tournament Royal Weddings card (page 9).  Elizabeth I, Philip II and
 * Charles IX start below their printed ratings after Turns 1-2.
 */
export const TOURNAMENT_ROYALS: RoyalSetup[] = [
    at("elizabethI", 3, {notes: "Started below the printed rating of 5 after Turns 1-2."}),
    at("margueriteValois", 3),
    at("henryIII", 3),
    at("henryIV", 3),
    at("philipII", 2, {notes: "Started below the printed rating of 3 after Turns 1-2."}),
    at("charlesIX", 2, {notes: "Started below the printed rating of 3 after Turns 1-2."}),
    at("annaAustria", 2),
    at("elisabethAustria", 2),
    at("williamOrange", 2),
    at("leicester", 1),
];

export const CAMPAIGN_ROYAL_STATUS: Record<string, RoyalSetup["status"]> = {};

export const TOURNAMENT_ROYAL_STATUS: Record<string, RoyalSetup["status"]> = {
    maryQueenOfScots: "captured",
};
