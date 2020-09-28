import {Region} from "../../types/core";

const cards ={
    "B01": "Literary Film",
    "B02": "Commercial Film",
    "B03": "B-Movie",
    "B04": "Bad Film",
    "B05": "Classic Film",
    "B06": "Deficit Film",
    "B07": "Fund",
    'E01': 'Establishment of Hollywood',
    'E02': 'Edison Litigation',
    'E03': 'Avant-garde',
    'E04': 'Academy Award',
    'E05': 'Paramount Judgement',
    'E06': 'Cannes International Film  Festival',
    'E07': 'LES CHAIERS DU CINEMA',
    'E08': 'Khrushchev\'s "unfreeze"',
    'E09': 'Rising of Bollywood',
    'E10': 'Dismantling of HAYS CODE',
    'E11': 'Film Authorship',
    'E12': 'New Wave of Film',
    'E13': 'Globalization',
    'E14': 'New Media',
    '1101': 'D.W.Griffith',
    '1102': 'Thomas Edison',
    '1103': 'Intolerance',
    '1104': 'The Great Train Robbery',
    '1105': 'The Jazz Singer',
    '1106': 'The General',
    '1107': 'The Gold Rush',
    '1108': 'Nanook of the North',
    '1109': 'King Kong',
    '1110': 'Greed',
    '1201': 'Georges Méliès',
    '1202': 'Lumière Brothers',
    '1203': 'Expressionism',
    '1204': 'Swedish School',
    '1205': 'Nosferatu',
    '1206': 'The Passion of the Joan of Arc',
    '1207': 'A Trip to the Moon',
    '1208': 'Metropolis',
    '1209': 'The Phantom Carriage',
    '1210': 'Existing the Factory',
    '1211': 'The Assassination of the Duke of Guise',
    '1301': 'Montage School',
    '1302': 'Sergei M. Eisenstein',
    '1303': 'Kino Eye',
    '1304': 'Mother',
    '1305': 'Battleship Potemkin',
    '1306': 'Man with a Movie Camera',
    '1307': 'Father Sergius',
    '2101': 'Classic Hollywood',
    '2102': 'John Ford',
    '2103': 'Alfred Hitchcock',
    '2104': 'Film Noir',
    '2105': 'Orson Welles',
    '2106': 'Gone With the Wind',
    '2107': 'Stagecoach',
    '2108': 'Singin\' in the Rain',
    '2109': 'Citizen Kane',
    '2110': 'White Heat',
    '2111': 'Sunset Blvid',
    '2112': 'Ben-hur',
    '2113': 'The Maltese Falcon',
    '2114': 'Vertigo',
    '2201': 'Neorealism',
    '2202': 'Federico Fellini',
    '2203': 'David Lean',
    '2204': 'Poetic Realism',
    '2205': 'Jean Renoir',
    '2206': 'The Rules of the Game',
    '2207': 'The Bicycle Thieves',
    '2208': 'M',
    '2209': 'The Road',
    '2210': 'Diary of a Country Priest',
    '2211': 'Napoleon',
    '2212': 'Under the Roofs of Pairs',
    '2213': 'The Wages of Fear',
    '2214': 'Lawrence of Arabia',
    '2301': 'Socialist Realism',
    '2302': 'Mikhail Kalatozov',
    '2303': 'Chapaev',
    '2304': 'Ballad of a Solider',
    '2305': 'The Cranes are Flying',
    '2306': 'Canal',
    '2307': 'Shadows of Forgotten Ancestors',
    '2308': 'Quiet Flows the Don',
    '2309': 'Earth',
    '2401': 'Akira Kurosawa',
    '2402': 'Chusheng Cai',
    '2403': 'Spring in a small town',
    '2404': 'The Spring River Flows East',
    '2405': 'Tokyo Story',
    '2406': 'Seven Samurai',
    '2407': 'Pather Panchali',
    '2408': 'The Goddess',
    '2409': 'Floating Clouds',
    '2410': 'This Life of Mine',
    '3101': 'New Hollywood',
    '3102': 'Steven Spielberg',
    '3103': 'The Godfather',
    '3104': 'Star War',
    '3105': 'New York School',
    '3106': 'Martin Scorsese',
    '3107': 'Roger Corman',
    '3108': 'Titanic',
    '3109': '2001: A Space Odyssey',
    '3110': 'The Exorcist',
    '3111': 'Bonnie and Clyde',
    '3112': 'Taxi Driver',
    '3113': 'Raiders of the Lost Ark',
    '3114': 'The Longest Yard',
    '3115': 'Butch Cassidy and the Sundance Kid',
    '3116': 'The Shining',
    '3201': 'New Wave',
    '3202': 'Francois Truffaut',
    '3203': 'Ingmar Bergman',
    '3204': 'Left Bank Group',
    '3205': 'The Godsun',
    '3206': 'Fitzcarraldo',
    '3207': 'Last Year at Marienbad',
    '3208': 'Eight and a Half',
    '3209': 'Jules and Jim',
    '3210': 'Golden Eye',
    '3211': 'The Travelling Players',
    '3212': 'Persona',
    '3213': 'Kes',
    '3301': 'Andrei Tarkovsky',
    '3302': 'Nikita Mikhalkov',
    '3303': 'War and Peace',
    '3304': 'Underground',
    '3305': 'The Barber of  Siberia',
    '3306': 'Office Romance',
    '3307': 'Three Colors: Blue',
    '3308': 'The Red and the White',
    '3309': 'Solaris',
    '3310': 'Triumph Over Violence',
    '3311': 'The Diamond Arm',
    '3312': 'Marketa Lazarova',
    '3401': 'Zhang Yimou',
    '3402': 'Kar Wai Wong',
    '3403': 'Abbas Kiarostami',
    '3404': 'A City of Sadness',
    '3405': 'Chungking Express',
    '3406': 'A Better Tomorrow',
    '3407': 'Tora-san',
    '3408': 'Red Sorghum',
    '3409': 'Hibiscus Town',
    '3410': 'Raining in the Mountain',
    '3411': 'The Taebaek Mountains',
    '3412': 'A Story of the Cruelties of Youth',
    '3413': 'Children of the Heaven',
    '3414': 'Taste of Cherry',
};

const region = {
    0: "North America",
        1: "West Europe",
        2: "East Europe",
        3: "Asia",
        4: "None",
};
const era = {
    0: "Invention",
    1: "Classic",
    2: "Modern",
};
const en = {
    confirm: "OK",
    cancel: "Cancel",
    effect: {
        comment: ["Comment {{a}}", {
            a: (value: number = 1) => {
                if (value <= 1) {
                    return `once`;
                } else {
                    if(value ===2){
                        return `twice`;
                    }else {
                        return `${value} times`;
                    }
                }
            },
        }],
        industryBreakthrough: "Industry breakthrough",
        aestheticsBreakthrough: "Aesthetics breakthrough",
        buyCard: ["Buy card {{a}} for free",{
            a: (value: string = "B01") => {
                // @ts-ignore
                return cards[value]
        }}],
        buyCardToHand: ["Buy card {{a}} for free, and add to hand.",{
            a: (value: string = "B01") => {
                // @ts-ignore
                return cards[value]
            }}],
        industryLevelUp: ["Upgrade industry level {{a}}",{
            a: (value: number = 1) => {
                if (value <= 1) {
                    return `once`;
                } else {
                    if(value ===2){
                        return `twice`;
                    }else {
                        return `${value} times`;
                    }
                }
            },
        }],
        aestheticsLevelUp: ["Upgrade Aesthetics",{
            a: (value: number = 1) => {
                if (value <= 1) {
                    return `once`;
                } else {
                    if(value ===2){
                        return `twice`;
                    }else {
                        return `${value} times`;
                    }
                }
            },
        }],
        buildCinema: "Build Cinema",
        buildCinemaInRegion: ["Build cinema in {{a}}", {a: (r:Region)=>region[r],}],
        buildStudio: "Build Studio",
        buildStudioInRegion: ["Build studio in {{a}}", {a: (r:Region)=>region[r],}],
        refactor: "Do Refactor",
        discard: "Discard hand",
        discardIndustry: "Discard hand with industry mark",
        discardAesthetics: "Discard hand with aesthetics mark",
        skipBreakthrough: "Skip Breakthrough",
    },
    hand: {
        title: "Hands"
    },
    setup: "Initial setup",
    dialog: {
        chooseTarget: {
            title: "Please choose target player of current effect.",
            toggleText: "Choose Target Player",
        },
        chooseRegion: {
            title: "Please choose target region of current effect.",
            toggleText: "Choose Region",
        },
        chooseEvent: {
            title: "Please choose event card.",
            toggleText: "Choose Event Card",
        },
        buyCard: {
            basic: "Buy basic card",
            board: "Buy card",
            cost: "Cost:",
        },
        comment: {
            title: "Comment",
            removeCommentCard: "Remove Comment Card",
        },
        chooseEffect: {
            title: "Please choose which effect to execute",
            toggleText: "Choose effect",
        },
        chooseHand: {
            title: "Please choose one card from hand as target of effect",
            toggleText: "Choose card from hand",
        },
        confirmRespond: {
            title: "Please choose ",
            toggleText: "Confirm Effect",
            yes: "Yes",
            no: "No"
        },
    },
    action: {
        initialSetup: "Initial setup",
        draw: "Draw additional card",
        play: "Play",
        breakthrough: "Breakthrough",
        studio: "Build Studio",
        cinema: "Build Cinema",
        aestheticsLevelUp: "Upgrade aesthetics",
        industryLevelUp: "Upgrade industry",
        endStage: "End Stage",
        endTurn: "End Turn",
        endPhase: "End Phase",
        undo: "Undo",
        redo: "Redo",
    },
    playerName: {
        spectator: "Spectator",
        player: "Player",
    },
    pub: {
        events: "Event cards:",
        res: "Resource:",
        deposit: "Deposit:",
        action: "Action:",
        industry: "Industry:",
        aesthetics: "Aesthetics:",
        vp: "Prestige:",
        share: "Share:",
        era: "Era:",
        school: "School:",
        discard: "Discard",
        allCards: "All cards",
        inferredHands: "Inferred hands",
        archive: "Archive",
        playedCards: "Turn cards",
    },
    score: {
        first: "Champion of",
        second: "Runner up of",
        third: "Third place of",
        cardName: ['{{rank}} {{region}} {{ear}}', {
            era: undefined,
            rank: undefined,
            region: undefined,
        }],
    },
    card: cards,
    region: region,
    era: era,
}
export default en;
export type Locale = typeof en;
