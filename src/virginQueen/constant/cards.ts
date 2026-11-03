import {CardDef, Power} from "./general";
import {OFFICIAL_CARDS} from "../data/cards";

/**
 * Card scans live in public/vq-cards/ (WebP, 376×526) and Vite copies them to
 * the build root. Vite replaces `__VQ_BASE_URL__` with the configured base
 * (see vite.config.mts); the fallback keeps Jest working, since its CommonJS
 * runtime cannot parse `import.meta.env`.
 */
declare const __VQ_BASE_URL__: string | undefined;

const assetBaseUrl = typeof __VQ_BASE_URL__ === "string" ? __VQ_BASE_URL__ : "/";

/** Scanned card image for official cards; legacy deck cards have none. */
export const cardImageUrl = (def: CardDef): string | undefined =>
    def.officialNumber === undefined ? undefined
        : `${assetBaseUrl}vq-cards/vq_${def.officialNumber}.webp`;

/**
 * A compact reconstruction of the Virgin Queen deck.
 *
 * The printed game has 112 unique cards; the rules PDF does not include the
 * card list, so this implementation ships a 74-card deck: the six Home cards
 * plus 68 shared cards (24 named events whose effects are described in the
 * rulebook, and 44 command cards that are played for CP only).
 */

const home = (
    id: string,
    power: Power,
    name: string,
    cp: number,
    text: string,
    effect: CardDef["effect"],
): CardDef => ({id, name, cp, kind: "home", power, text, effect});

export const HOME_CARDS: CardDef[] = [
    home(
        "vq-home-grand-vizier",
        "ottoman",
        "Grand Vizier",
        5,
        "Add 4 regulars/galleys; OR attempt the Suez Canal (5–6 players, roll 6+, +1 per failed attempt, +2 with Excavation); OR cancel an Event card before it resolves.",
        {kind: "suez"},
    ),
    home(
        "vq-home-spanish-armada",
        "spain",
        "Spanish Armada",
        3,
        "Extra CP; OR build/upgrade the Armada in Seville, Corunna or Lisbon.",
        {kind: "armada"},
    ),
    home(
        "vq-home-virgin-queen",
        "england",
        "Virgin Queen",
        3,
        "Extra CP; OR +1 VP if Elizabeth I is still unmarried (Virgin Queen bonus).",
        {kind: "vp", power: "england", amount: 1, condition: "unmarriedElizabeth"},
    ),
    home(
        "vq-home-valois-wedding",
        "france",
        "Valois Wedding",
        3,
        "Extra CP; OR +1 VP for a Valois marriage celebrated this year.",
        {kind: "vp", power: "france", amount: 1},
    ),
    home(
        "vq-home-imperial-diet",
        "hre",
        "Imperial Diet",
        3,
        "Extra CP; OR gain 1 VP (imperial prestige).",
        {kind: "vp", power: "hre", amount: 1},
    ),
    home(
        "vq-home-huguenot-lent",
        "protestant",
        "Huguenot Lent",
        2,
        "Extra CP; OR 4 Protestant conversion attempts in France (first die is a 6).",
        {kind: "conversion", side: "protestant", area: "france", dice: 4, autoSix: true},
    ),
];

const event = (
    id: string,
    name: string,
    cp: number,
    text: string,
    effect: CardDef["effect"],
): CardDef => ({id, name, cp, kind: "event", text, effect});

export const EVENT_CARDS: CardDef[] = [
    event(
        "vq-ev-morisco-revolt",
        "Morisco Revolt",
        3,
        "Place 2 Unrest markers in Spanish home spaces.",
        {kind: "unrestSpanish", count: 2},
    ),
    event(
        "vq-ev-scottish-lords-rebel",
        "Scottish Lords Rebel",
        3,
        "4 Protestant conversion attempts in Scotland; 1 Unrest in Scotland.",
        {kind: "conversion", side: "protestant", area: "scotland", dice: 4, unrest: 1},
    ),
    event(
        "vq-ev-calvinist-zeal",
        "Calvinist Zeal",
        2,
        "6 Protestant conversion attempts in the Netherlands; the first die is a 6.",
        {kind: "conversion", side: "protestant", area: "netherlands", dice: 6, autoSix: true},
    ),
    event(
        "vq-ev-belgic-confession",
        "Belgic Confession",
        3,
        "6 Protestant conversion attempts in the Netherlands.",
        {kind: "conversion", side: "protestant", area: "netherlands", dice: 6},
    ),
    event(
        "vq-ev-iconoclastic-fury",
        "Iconoclastic Fury",
        3,
        "7 Protestant conversion attempts in the Netherlands; 1 Unrest.",
        {kind: "conversion", side: "protestant", area: "netherlands", dice: 7, unrest: 1},
    ),
    event(
        "vq-ev-council-of-troubles",
        "Council of Troubles",
        3,
        "6 Catholic conversion attempts in the Netherlands; the first die is a 6.",
        {kind: "conversion", side: "catholic", area: "netherlands", dice: 6, autoSix: true},
    ),
    event(
        "vq-ev-index-prohibited",
        "Index of Prohibited Books",
        2,
        "5 Catholic conversion attempts in France; the first die is a 6.",
        {kind: "conversion", side: "catholic", area: "france", dice: 5, autoSix: true},
    ),
    event(
        "vq-ev-tridentine-catechism",
        "Tridentine Catechism",
        3,
        "5 Catholic conversion attempts in France; the first die is a 6.",
        {kind: "conversion", side: "catholic", area: "france", dice: 5, autoSix: true},
    ),
    event(
        "vq-ev-english-recusants",
        "English Recusants",
        2,
        "5 Catholic conversion attempts in England; the first die is a 6.",
        {kind: "conversion", side: "catholic", area: "england", dice: 5, autoSix: true},
    ),
    event(
        "vq-ev-rising-of-north",
        "Rising of the North",
        3,
        "4 Catholic conversion attempts in England; 1 Unrest in England.",
        {kind: "conversion", side: "catholic", area: "england", dice: 4, unrest: 1},
    ),
    event(
        "vq-ev-spanish-fury",
        "Spanish Fury",
        2,
        "Place 2 mercenaries in a friendly fortified home space.",
        {kind: "mercs", count: 2},
    ),
    event(
        "vq-ev-grand-tour",
        "Grand Tour",
        2,
        "Draw 2 cards from the deck.",
        {kind: "draw", count: 2},
    ),
    event(
        "vq-ev-holy-league",
        "Holy League",
        3,
        "Gain 1 treasure and 1 VP.",
        [{kind: "treasure", count: 1}, {kind: "vp", amount: 1}],
    ),
    event(
        "vq-ev-papal-bull",
        "Papal Bull",
        4,
        "Elizabeth is excommunicated: the England-Spain war cost drops by 2 CP.",
        {kind: "dowCost", amount: -2},
    ),
    event(
        "vq-ev-war-in-persia",
        "War in Persia",
        3,
        "The active power discards 1 card (foreign war drain).",
        {kind: "discard", count: 1},
    ),
    event(
        "vq-ev-war-with-poland",
        "War with Poland",
        3,
        "The active power discards 1 card (foreign war drain).",
        {kind: "discard", count: 1},
    ),
    event(
        "vq-ev-dutch-revolt",
        "Dutch Revolt",
        3,
        "The Protestant gains 1 VP.",
        {kind: "vp", power: "protestant", amount: 1},
    ),
    event(
        "vq-ev-enterprise-of-england",
        "Enterprise of England",
        4,
        "Spain gains 2 VP if Spain and England are at war.",
        {kind: "vp", power: "spain", amount: 2, condition: "atWarEngland"},
    ),
    event(
        "vq-ev-lord-of-netherlands",
        "Lord of the Netherlands",
        2,
        "Spain gains 1 VP if it controls Amsterdam, Antwerp and Brussels.",
        {kind: "vp", power: "spain", amount: 1, condition: "controlsDutchKeys"},
    ),
    event(
        "vq-ev-paris-worth-mass",
        "Paris is Worth a Mass",
        4,
        "The Protestant gains 2 VP.",
        {kind: "vp", power: "protestant", amount: 2},
    ),
    event(
        "vq-ev-st-bartholomew",
        "St. Bartholomew's Day Massacre",
        4,
        "6 Catholic conversion attempts in France; 1 Unrest in France.",
        {kind: "conversion", side: "catholic", area: "france", dice: 6, unrest: 1},
    ),
    event(
        "vq-ev-new-world-riches",
        "New World Riches",
        2,
        "Gain 2 treasures.",
        {kind: "treasure", count: 2},
    ),
    event(
        "vq-ev-traders-of-the-world",
        "Traders of the World",
        2,
        "Gain 1 treasure and 1 VP.",
        [{kind: "treasure", count: 1}, {kind: "vp", amount: 1}],
    ),
    event(
        "vq-ev-elizabeth-excommunicated",
        "Elizabeth Excommunicated",
        3,
        "The England-Spain war cost drops by 2 CP.",
        {kind: "dowCost", amount: -2},
    ),
];

type CmdSpec = [string, string, number];

const COMMAND_SPECS: CmdSpec[] = [
    ["william-cecil", "William Cecil", 2],
    ["francis-walsingham", "Francis Walsingham", 1],
    ["robert-dudley", "Robert Dudley", 2],
    ["thomas-gresham", "Thomas Gresham", 1],
    ["john-hawkins", "John Hawkins", 3],
    ["francis-drake", "Francis Drake", 4],
    ["martin-frobisher", "Martin Frobisher", 2],
    ["walter-raleigh", "Walter Raleigh", 3],
    ["duke-of-alba", "Duke of Alba", 4],
    ["duke-of-parma", "Duke of Parma", 5],
    ["don-john", "Don John of Austria", 3],
    ["santa-cruz", "Marquis of Santa Cruz", 3],
    ["medina-sidonia", "Duke of Medina Sidonia", 1],
    ["antonio-perez", "Antonio Perez", 2],
    ["duke-of-guise", "Duke of Guise", 4],
    ["montmorency", "Anne de Montmorency", 4],
    ["catherine-de-medici", "Catherine de Medici", 3],
    ["henry-of-navarre", "Henry of Navarre", 5],
    ["coligny", "Gaspard de Coligny", 4],
    ["william-of-orange", "William of Orange", 4],
    ["maurice-of-nassau", "Maurice of Nassau", 3],
    ["sokollu-mehmed", "Sokollu Mehmed", 4],
    ["lala-mustafa", "Lala Mustafa", 2],
    ["sinan-pasha", "Sinan Pasha", 3],
    ["piyale-pasha", "Piyale Pasha", 2],
    ["dragut", "Dragut", 3],
    ["uluch-ali", "Uluch Ali", 4],
    ["schwendi", "Lazarus von Schwendi", 3],
    ["zrinyi", "Nikola Zrinyi", 2],
    ["maximilian-ii", "Maximilian II", 2],
    ["rudolf-ii", "Rudolf II", 1],
    ["tycho-brahe", "Tycho Brahe", 2],
    ["mercator", "Gerardus Mercator", 1],
    ["titian", "Titian", 2],
    ["el-greco", "El Greco", 1],
    ["shakespeare", "William Shakespeare", 3],
    ["montaigne", "Michel de Montaigne", 2],
    ["cervantes", "Miguel de Cervantes", 2],
    ["st-teresa", "St. Teresa of Avila", 1],
    ["john-knox", "John Knox", 2],
    ["mary-of-guise", "Mary of Guise", 2],
    ["cardinal-granvelle", "Cardinal Granvelle", 3],
    ["pope-pius-iv", "Pope Pius IV", 2],
    ["pope-sixtus-v", "Pope Sixtus V", 3],
    ["venetian-senate", "Venetian Senate", 2],
    ["portuguese-cortes", "Portuguese Cortes", 1],
    ["scottish-lords", "Scottish Lords", 2],
    ["irish-chiefs", "Irish Chiefs", 1],
    ["dutch-states", "Dutch States", 3],
    ["huguenot-synod", "Huguenot Synod", 2],
];

export const COMMAND_CARDS: CardDef[] = COMMAND_SPECS.map(([id, name, cp]) => ({
    id: `vq-cmd-${id}`,
    name,
    cp,
    kind: "command" as const,
    text: "Play for command points.",
}));

export const ALL_CARDS: CardDef[] = [...HOME_CARDS, ...EVENT_CARDS, ...COMMAND_CARDS];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
    [
        ...ALL_CARDS,
        ...OFFICIAL_CARDS.map((card): CardDef => ({
            id: card.id,
            // The scans are Chinese, so show the OCR'd name to match them.
            name: card.nameZh,
            cp: card.cp ?? 3,
            kind: card.kind === "home" ? "home" : card.kind === "event" ? "event" : "command",
            power: card.power,
            text: card.textZh,
            officialNumber: card.number,
            officialKind: card.kind,
            officialEffect: card.effect,
            removeOnEvent: card.removeOnEvent,
            removeAfterUse: card.removeAfterUse,
        })),
    ].map((c) => [c.id, c]),
);

/** Cards that make up the shared deck (Home cards are dealt separately). */
export const DECK_CARD_IDS: string[] = [...EVENT_CARDS, ...COMMAND_CARDS].map((c) => c.id);

export const cardById = (id: string): CardDef => {
    const c = CARD_BY_ID[id];
    if (c === undefined) {
        throw new Error(`unknown Virgin Queen card: ${id}`);
    }
    return c;
};

export const officialCardById = (id: string) =>
    OFFICIAL_CARDS.find((card) => card.id === id);

export const cardName = (id: string): string => cardById(id).name;
