import {
    AllClassicCards,
    BasicCardID, CardID,
    EventCardID,
    IBuyInfo,
    IEra,
    Region,
    ValidRegion,
} from "../../types/core";
import {
    IChooseEventArg, IChooseHandArg, ICommentArg,
    IPayAdditionalCostArgs,
    IPeekArgs,
    IPlayCardInfo,
    IShowBoardStatusProps, IShowCompetitionResultArgs, ITargetChooseArgs, IUpdateSlotProps
} from "../../game/moves";
import {argChangePlayerSettingHOF, argChooseRegionHOF, argSetupGameModeHOF, LocaleSettings, moveHOF} from "./common";

const chose = " chose "
const cards = {
    "B01": "Literary Film",
    "B02": "Commercial Film",
    "B03": "B-Movie",
    "B04": "Bad Film",
    "B05": "Classic Film",
    "B06": "Deficit Film",
    "B07": "Fund",
    'E01': 'Establishment of Hollywood',
    'E02': 'World War I',
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
    '1103': 'Intolerance, 1916',
    '1104': 'The Great Train Robbery, 1903',
    '1105': 'The Jazz Singer, 1927',
    '1106': 'The General, 1926',
    '1107': 'The Gold Rush, 1925',
    '1108': 'Nanook of the North, 1922',
    '1109': 'King Kong, 1933',
    '1110': 'Greed, 1924',
    '1201': 'Georges Méliès',
    '1202': 'Lumière Brothers',
    '1203': 'Expressionism',
    '1204': 'Swedish School',
    '1205': 'Nosferatu',
    '1206': 'The Passion of the Joan of Arc,1928',
    '1207': 'A Trip to the Moon, 1902',
    '1208': 'Fantomas, 1913',
    '1209': 'The Phantom Carriage, 1921',
    '1210': 'Employees Leaving the Lumière Factory, 1885',
    '1211': 'The Assassination of the Duke of Guise, 1908',
    '1301': 'Montage School',
    '1302': 'Sergei M. Eisenstein',
    '1303': 'Kino Eye',
    '1304': 'Mother, 1926',
    '1305': 'Battleship Potemkin, 1925',
    '1306': 'Man with a Movie Camera1929',
    '1307': 'Father Sergius, 1918',
    '1308': 'Earth, 1930',
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
    '2212': 'Daybreak',
    '2213': 'The Wages of Fear',
    '2214': 'Lawrence of Arabia',
    '2301': 'Socialist Realism',
    '2302': 'Mikhail Kalatozov',
    '2303': 'Chapaev',
    '2304': 'Ballad of a Solider',
    '2305': 'The Cranes are Flying',
    '2306': 'Canal',
    '2307': 'Shadows of Forgotten Ancestors',
    '2308': 'The Young Guard',
    '2309': 'Alexander Nevsky, 1938',
    '2401': 'Akira Kurosawa',
    '2402': 'Chusheng Cai',
    '2403': 'Spring in a small town',
    '2404': 'The Spring River Flows East',
    '2405': 'Alam Ara',
    '2406': 'Seven Samurai',
    '2407': 'Pather Panchali',
    '2408': 'The Goddess',
    '2409': 'Godzilla',
    '2410': 'This Life of Mine',
    '2411': 'Tokyo Story',
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
    '3211': 'The Adventure',
    '3212': 'Persona',
    '3213': 'Kes',
    '3301': 'Andrei Tarkovsky',
    '3302': 'Sergi Bondarchuk',
    '3303': 'Three Colors: Blue',
    '3304': 'Poem movie',
    '3305': 'War and peace',
    '3306': 'Underground',
    '3307': 'Office Romance',
    '3308': 'The Red and the White',
    '3309': 'Solaris',
    '3310': 'Triumph Over Violence',
    '3311': 'The Diamond Arm',
    '3312': 'Marketa Lazarova',
    '3401': 'Zhang Yimou',
    '3402': 'Kar Wai Wong',
    '3403': 'Abbas Kiarostami',
    '3404': 'Farwell My Concubine',
    '3405': 'Chungking Express',
    '3406': 'A Better Tomorrow',
    '3407': 'Sholay',
    '3408': 'Red Sorghum',
    '3409': 'Hibiscus Town',
    '3410': 'A Touch of Zen',
    '3411': 'Seopyeonje',
    '3412': 'The Scent of Green Papaya',
    '3413': 'The Boys from Fengkuei',
    '3414': 'Taste of Cherry',
    '4001': 'French Impressionism',
    '4002': 'Masala Film',
    '4003': 'American Independent Film',
    '4004': 'Polish School',
    '4005': 'Modernist Film',
    '4006': 'Third Cinema',
    '4007': 'Kitchen Sink Film',
    '4008': 'High-Concept Film',
};
const region = {
    0: "North America",
    1: "West Europe",
    2: "East Europe",
    3: "Asia",
    4: "School Extension",
    5: "Any Region",
};
const numToValue = (value: number = 1): string => value.toString();

const argValue = {a: numToValue};

const argRegion = {
    a: (value: Region = Region.NONE): string => {
        return region[value]
    }
}
const bracketCardName = (id: string = "E02") => {
    return `【${getCardName(id)}】`
};
const era = {
    0: "Invention",
    1: "Classic",
    2: "Modern",
};
const eventName = {
    'E01': 'Every company upgrade industry or aesthetics level once',
    'E02': 'Company with highest industry level discard 1 card, Company with highest aesthetics level discard 1 card, every company get 2 deposit',
    'E03': 'Every company get its second action point (Note: Do not add action point if you already have a second one)  * If this event is discarded, also execute its effect.',
    'E04': 'Company with highest prestige buy a 【Commercial Film】and put it into hand, every company buy a 【Classic Film】 for free.',
    'E05': 'Company with no building in north america draw one card, calculate the sum of industry level, aesthetics level, industry and aesthetics marks of current school of every company, lowest company gain 3 deposits',
    'E06': 'Company with no building in west europe buy a 【Bad Film】 for free, every company buy a【Classic Film】 for free.',
    'E07': 'Every company choose one company buy a [Bad film], Any company size smaller than 5 change to 5.',
    'E08': '【Unfreeze】 slot is activated, calculate the sum of industry level, aesthetics level, industry and aesthetics marks of current school of every company, lowest company upgrade aesthetics level once',
    'E09': '【Bollywood】 slot activated, company with the lowest aesthetics level upgrade aesthetics level once, company with the lowest aesthetics level upgrade aesthetics level once.',
    'E10': 'Each company whose prestige is higher than you ,gain 4 extra prestige',
    'E11': 'Every person card in your deck and archive gain 4 extra prestige',
    'E12': 'Gain prestige according to your industry and aesthetics level.',
    'E13': 'If your company have 4/3/2/1 champions form different regions, gain 20/12/6/1 extra prestige',
    'E14': 'Every champion and share give you 1 extra prestige',
};

const getCardName = (cardId: string): string => {
    if (cardId in BasicCardID) {
        // @ts-ignore
        return cards[cardId];
    }
    if (cardId in AllClassicCards) {
        // @ts-ignore
        return cards[cardId.slice(1)]
    }
    if (cardId in EventCardID) {
        // @ts-ignore
        return eventName[cardId]
    }
    if (cardId.startsWith('V')) {
        const cardEra = parseInt(cardId.slice(1, 2)) - 1;
        const cardRegion = parseInt(cardId.slice(2, 3)) - 1;
        const cardRank = parseInt(cardId.slice(3, 4));
        // @ts-ignore
        return `${rank[cardRank]} ${region[cardRegion]} in ${era[cardEra]} Era`
    }
    return `unknown card${cardId}`
}
const setting: LocaleSettings = {
    mode: "Game Mode",
    team: "2V2 Team Mode",
    normal: "Complete Mode",
    newbie: "Newbie Mode",
    enableSchoolExtension: "Enable school extension",
    randomFirst: "Random First Player",
    fixedFirst: "Fixed First Player",
    allRandom: "Random Order",
    order: "Turn Order",
    changeSetting: "Change Game Setting",
    disableUndo: "Disable Undo"
};
const argSetupGameMode = argSetupGameModeHOF(chose, setting);

const argDrawnCards = {
    args: (cards:CardID[]): string => {
        return `drew ${cards.map(c=>getCardName(c))}`;
    }
}
const argConcede = {
    args: (): string => {
        return ` conceded from the game`
    }
}
const argCardName = {
    a: (value: string = "E02"): string => {
        return `${getCardName(value)}`
    }
};
const argTimes = {
    a: (value: number = 1): string => {
        if (value <= 1) {
            return `once`;
        } else {
            if (value === 2) {
                return `twice`;
            } else {
                return `${value} times`;
            }
        }
    },
}
const argPeek = {
    args: (arg: IPeekArgs[]) => {
        const a = arg[0]
        let t = "Peeked cards on top of the deck"
        a.shownCards.forEach(c => t += bracketCardName(c));
        if (a.card !== null) {
            t += `and chose ${bracketCardName(a.card)} to add to hand`
        }
        return t;
    }
}
const argShowCompetitionResult = {
    args: (arg: IShowCompetitionResultArgs[]): string => {
        let i = arg[0].info;
        let t = "CompetitionResult:"
        let progress = i.progress;
        t += `delta VP:${progress} `
        return t;
    }
}
const argShowBoardStatus = {
    args: (arg: IShowBoardStatusProps[]): string => {
        let t = "Board:";
        if (arg[0].regions.length > 0) {
            arg[0].regions.forEach((r, idx) => {
                const cardRegion: ValidRegion = idx;
                t += region[cardRegion];
                t += ':';
                if (r.legend.card !== null) {
                    t += "legend:"
                    t += bracketCardName(r.legend.card)
                }
                if (r.normal.filter(s => s.card !== null).length > 0) {
                    t += "normal:"
                    r.normal.forEach(c => {
                        if (c.card !== null) {
                            t += bracketCardName(c.card
                            )
                        }
                    })
                }
            })
        } else {
            t += "School: "
            arg[0].school.forEach(c => {
                if (c.card !== null) {
                    t += bracketCardName(c.card)
                }
            })
            t += "Film: "
            arg[0].film.forEach(c => {
                if (c.card !== null) {
                    t += bracketCardName(c.card
                    )
                }
            })
        }
        return t;
    }
}
const argBreakthrough = {
    args: (arg: IPlayCardInfo[]): string => {
        let a = arg[0]
        let t = " spent "
        if (a.res === 2) t += " 2 resources"
        if (a.res === 1) t += " 1 resource 1 deposit"
        if (a.res === 0) t += " 2 deposits"
        t += " for breakthrough"
        t += bracketCardName(a.card)
        return t
    }
}
const argPlayCard = {
    args: (arg: IPlayCardInfo[]): string => {
        let a = arg[0]
        let t = " played "
        t += bracketCardName(a.card)
        return t
    }
}
const argBuyCard = {
    args: (arg: IBuyInfo[]): string => {
        let a = arg[0]
        let t = " bought "
        t += bracketCardName(a.target);
        t += " with ";
        if (a.resource > 0) {
            if (a.resource > 1) {
                t += `${a.resource} resource`
            } else {
                t += `${a.resource} resources`
            }
        }
        if (a.deposit > 0) {
            if (a.deposit > 1) {
                t += `${a.deposit} deposits`
            } else {
                t += `${a.deposit} deposit`
            }
        }
        if (a.helper.length > 0) {
            t += " and "
            a.helper.forEach(h => t += bracketCardName(h))
        }
        return t
    }
}

const argChooseEvent = {
    args: (arg: IChooseEventArg[]): string => {
        let a = arg[0]
        let t = chose
        t += cards[a.event]
        t += eventName[a.event]
        return t
    }
}
const argDrawCard = {
    args: (): string => {
        return " drew one card with action point."
    }
}
const argChooseRegion =argChooseRegionHOF(chose,region);
const argChooseTarget = {
    args: (arg: ITargetChooseArgs[]): string => {
        let a = arg[0]
        let t = chose
        t += a.targetName
        return t
    }
}
const argRequestEndTurn = {
    args: (): string => {
        return " requested end turn."
    }
}
const argChooseHand = {
    args: (arg: IChooseHandArg[]): string => {
        let a = arg[0]
        let t = chose
        t += bracketCardName(a.hand)
        return t
    }
}
const argCompetitionCard = {
    args: (): string => {
        return " played a card for competition"
    }
}
const argUpdateSlot = {
    args: (arg: IUpdateSlotProps[]): string => {
        return ` updated ${bracketCardName(arg[0].cardId)} to`
    }
}
const argComment = {
    args: (arg: ICommentArg[]): string => {
        let a = arg[0]
        let t = chose
        if (a.comment === null) {
            t += " removed comment on"
            t += bracketCardName(a.target)
        } else {
            t += " commented "
            t += bracketCardName(a.target)
            t += " as "
            t += bracketCardName(a.comment)
        }
        return t
    }
}
const argConfirmRespond = {
    args: (arg: string[]): string => {
        let a = arg[0]
        if (a === "yes") {
            return " chose to execute optional effect."
        } else {
            return " chose to not execute optional effect"
        }
    }
}
const argPayAdditionalCost = {
    args: (arg: IPayAdditionalCostArgs[]) => {
        let t = " paid an extra fee of "
        const a = arg[0];
        if (a.res > 0) {
            t += `${a.res} resource(s)`
        }
        if (a.deposit > 0) {
            t += `${a.deposit} deposit`
        }
        return t
    }
}
const classicFilmAutoMoveMode = {
    MODE_NAME: "Classic Film:",
    NO_AUTO: "Choose Effect",
    DRAW_CARD: "Auto Draw Card",
    AESTHETICS_AWARD: "Auto Aesthetics Award",
};
const argChangePlayerSetting = argChangePlayerSettingHOF(chose,classicFilmAutoMoveMode);
const rank = {
    1: "Champion of",
    2: "Runner up of",
    3: "Third place of",
}
const movesI18n = moveHOF(
    argBreakthrough,
    argBuyCard,
    argChangePlayerSetting,
    argChooseEvent,
    argChooseHand,
    argChooseRegion,
    argChooseTarget,
    argComment,
    argCompetitionCard,
    argConcede,
    argConfirmRespond,
    argDrawCard,
    argPayAdditionalCost,
    argPeek,
    argPlayCard,
    argRequestEndTurn,
    argSetupGameMode,
    argShowBoardStatus,
    argShowCompetitionResult,
    argUpdateSlot
)
const en = {
    rank: rank,
    setting: setting,
    drawer: {
        singlePlayer: "Single player vs AI",
        singlePlayer3p: "Single player vs AI(3 person)",
        singlePlayer4p: "Single player vs AI(4 person)",
        twoPlayer: "Local 2 person multiplayer",
        threePlayer: "Local 3 person multiplayer",
        fourPlayer: "Local 4 person multiplayer",
        pleaseTry: "Please try ",
        lobby: "Remote multiplayer lobby",
        cards: "Card list",
        about: "Rules & Help",
        navigation: "Navigation",
        globalLobby: "Multiplayer lobby (global)",
        section: {
            general: "General",
            film: "Film Centenary",
            songJinn: "SongJinn",
            imperialElegy: "Imperial Elegy",
            virginQueen: "Virgin Queen",
        },
        film: {
            multiplayer: "Multiplayer / create match",
            local2p: "Local 2 players",
            local3p: "Local 3 players",
            local4p: "Local 4 players",
        },
        songJinn: {
            multiplayer: "Multiplayer / create match",
            local: "Local game",
        },
        imperialElegy: {
            multiplayer: "Multiplayer / create match",
            local: "Local hotseat",
            solo: "Solo vs bot (Rule 34)",
        },
        virginQueen: {
            multiplayer: "Multiplayer / create match",
            local: "Local hotseat",
            tutorial: "Two-player tutorial",
        },
    },
    title: "Film Centenary",
    lobby: {
        copyPrompt: "Copied to clipboard",
        numPlayers: "Players",
        player:"Start as player",
        createPublicMatch: "Create public match",
        createPrivateMatch: "Create match",
        title: "Lobby",
        join: "Join",
        play: "Play",
        leave: "Leave",
        spectate: "Spectate",
        publicGame: "Public",
        privateGame: "Private",
        exitMatch: "Exit match",
        exitLobby: "Exit lobby",
        cannotJoin: "Cannot join this match, you are already in another match",
        shareLink: "Share the following link with your opponent:",
    },
    gameOver: {
        title: "Game Over",
        winner: "Winner:",
        reason: {
            othersConceded: "All other players conceded",
            threeNAChampionAutoWin: "Three Champion in North America",
            championCountAutoWin: "Champion count exceeded",
            finalScoring: "Final Scoring",
        },
        table: {
            board: "Board",
            card: "Cards",
            building: "Building",
            industryAward: "Industry Award",
            aesAward: "Aesthetics Award",
            archive: "Archive",
            events: "Event&Card Scoring",
            total: "Total",
        },
        rank: {
            0: "Champion:",
            1: "Runner up:",
            2: "Third place",
            3: "Fourth place",
        },
    },
    classicFilmAutoMove: classicFilmAutoMoveMode,
    moves: movesI18n,
    eventName: eventName,
    confirm: "OK",
    cancel: "Cancel",
    cardTable: {
        cardId: "Card ID",
        cardName: "Name",
        cost: "Cost",
        prestige: "Prestige",
        effectText: "Effect Text",
        effectIcon: "Effect Icon",
    },
    effect: {
        industryOrAestheticsBreakthrough:"Choose from one breakthrough only industry or aesthetics",
        CompetitionPowerToVp:["Get prestige according to Competition Power",argValue],
        addCompetitionPower: ["Add {{a}} Competition Power", argValue],
        loseCompetitionPower: ["Lose {{a}} Competition Power", argValue],
        noCompetitionFee: "no extra fee for 【competition】",
        minHandCountPlayers: "Company with the fewest card in hand",
        chose: " chose ",
        archiveToEEBuildingVP: "",
        payAdditionalCost: ["Pay {{res}} {{deposit]}.", {
            deposit: (value: number = 1): string => {
                if (value > 0) {
                    if (value > 1) {
                        return `${value} resources`
                    } else {
                        return `${value} resource`
                    }
                } else {
                    return ""
                }
            },
            res: (value: number = 1): string => {
                if (value > 0) {
                    return `${value} deposit`
                } else {
                    return ""
                }
            },
        }],
        industryAndAestheticsBreakthrough: "Do industry and aesthetics breakthrough",
        industryOrAestheticsLevelUp: "Upgrade industry or aesthetics level",
        era: {
            0: " Invention:",
            1: " Classic:",
            2: " Modern:",
        },
        event: ["After {{a}}", argCardName],
        optional: "【optional】",
        loseVpForEachHand: "Lose prestige according to its hand.",
        discardLegend: ["Discard {{a}} legend card(s)", argValue],
        afterBreakthrough: "After you perform a breakthrough action,",
        playedCardInTurnEffect: "Execute the 【play】 effect another card with aesthetics mark you played in this turn.",
        everyOtherCompany: "Every other company",
        everyPlayer: "Every company",
        onYourComment: "After you perform a comment,",
        onAnyOneComment: "After any one perform a comment,",
        onAnyInTurnAesAward: "In your turn, after every aesthetics level award",
        doNotLoseVpAfterCompetition: "Do not lose vp after competition",
        discardInSettle: "When you comment or update,",
        threeCards: "Gain 1 extra prestige for every basic card ",
        northAmericaFilm: "Gain 2 extra prestige for each of your north america card.",
        asiaFilm: "Gain 2 extra prestige for each of your asia card.",
        industryNormalOrLegend: "Gain 2 extra prestige for each of your normal or legend card with industry marker.",
        westEuropeCard: "Gain 2 extra prestige for each of your west europe card.",
        alternative: "You may cancel this breakthrough, do following effect instead",
        eastEuropeFilm: ["Gain {{a}} extra prestige for each of your east europe card.", argValue],
        industryLevel: ["Gain {{a}} extra prestige for each of your industry level", argValue],
        aestheticsLevel: ["Gain 2 extra prestige for each of your aesthetics level", argValue],
        personCard: "Gain 4 extra prestige for each of your person card.",
        aesClassic: "Gain 2 extra prestige for each of your normal or legend card with aesthetics marker.",
        NewYorkSchool: " if your industry level is not less than your aesthetics level,execute your aesthetics level bonus once, if your industry level is not less than your aesthetics level execute your industry level bonus once",
        
        French_Imp_buy: "Companies with no school can buy.",
        Samara_buy: "For every champion marker you have, you spend 2 extra resources.",
        American_Independent_Film_buy: "If you have 1 completed building, it costs additional 3 resources. You can't buy this school if you have 2 completed buildings.",
        Polish_School_buy: "The additional payment of resources equal to the absolute value of the difference between industrial level and aesthetic level.",
        Modernist_Film_buy: "Pay 1 extra resource for each industry level you have.",
        Third_Cinema_buy: "You can lose all your deposit and buy this school for free if you have no cards in your hand, no spent action, and possess 7 resources or less.",
        kitchen_sink_buy: "Extra payout resources equal to the number of cards in your hand at the start of the turn.",
        High_Concept_Film_buy: "Pay 1 extra resource for each aesthetics level you have.",
        French_Imp_turnstart: "If your industrial level is equal to your aesthetic level, +1 action. Each time you get at least +3 vp after an action settlement or the entire check phase: +1 resource.",
        Samara: "Your cinema effect has been changed to +1 card, +2 vp. When you breakthrough 1 unmarked film, select 1 item :(1) Industrial breakthrough once; (2) Aesthetic breakthrough once.",
        American_Independent_Film_turnstart: "For each 1 completed building you have, -1 card. Each time you -1 card :+1 deposit, +1 vp.",
        Polish_School: "Each time you put 1 card into the archive (including breakthroughs) or another player's hand :+1 card. Each time you get a base card :+2 vp.",
        Modernist_Film: "After being competed: 1 aesthetic bonus. If you play a card with X aesthetic tokens: X=1: +1 resource, +2 vp  X=2: +1 resource, +2 vp, +1 card X=3:+1 resource, +4 vp, +2 cards.",
        Third_Cinema: "When competed :+1 card, -5 vp for competitor. At the start of the turn, if your aesthetic level is higher than your industry level :+1 cards, +2 deposits.",
        kitchen_sink_turnstart: "-1 vp for each 1 hand you have, and +1 card for every company that has more cards than you. End of Turn: You gain +1 vp for each card played in this turn.",
        High_Concept_Film: "Each industrial symbol for your played card: +1 resource, +1 vp. After competition :+1 competition power, +1 card.",
        schoolExtNonePre: "",

        obtainNormalOrLegendFilm: "When you get a normal or legend film card.",
        none: "",
        breakthroughResDeduct: ["Execute a free breakthrough action", argValue],
        handToAnyPlayer: ["Give one card in hand to other companies", argValue],
        buyNoneEEFilm: "When buy film card in east europe, 1CP 1VP。",
        extraVp: ["Pay extra {{a}} prestige", argValue],
        inventionEraBreakthroughPrevent: "Cannot breakthrough if it is invention era",
        breakthroughPrevent: "or you cannot execute breakthrough effect of this card",
        pay: "Pay ",
        update: ["Update {{a}}", argTimes],
        noBuildingEE: "All companies without a building in east europe",
        highestVpPlayer: "Company with highest prestige",
        vpNotHighestPlayer: "Companies do not have highest prestige",
        aesLowest: "Company with the lowest aesthetics level,",
        industryLowest: "Company with the lowest industry level",
        peek: ["Show {{count}} cards from top of your deck，{{filter}}{{target}},then discard others", {
            count: (value: number = 1): string => {
                return value.toString()
            },
            target: (e: string): string => {
                if (e === "hand") {
                    return " into hand"
                } else {
                    return "";
                }
            },
            filter: (e: any): string => {
                switch (e.e) {
                    case "choice":
                        if (e.a > 1) {
                            return `choose ${e.a} cards, put them`
                        } else {
                            return `choose ${e.a} card, put them`
                        }
                    case "industry":
                        return "put cards with industry mark"
                    case "era":
                        // @ts-ignore
                        return `put ${era[e.a]} era cards`
                    case "region":
                        // @ts-ignore
                        return `put ${region[e.a]} cards`
                    case "aesthetics":
                        return "put cards with aesthetics mark"
                    default:
                        return ""
                }
            }
        }],
        competition: ["Start a competition {{bonus}}{{onWin}}", {
            bonus: (value: number = 0): string => {
                if (value > 0) {
                    return " with a bonus progress of " + value.toString()
                } else {
                    return "";
                }
            },
            onWin: (e: any): string => {
                if (e.e !== "none") {
                    if (e.e === "anyRegionShareCentral") {
                        return "get an additional share from any region on board if you win."
                    } else {
                        return "get an additional share from " + region[e.r as Region] + " if you win."
                    }
                } else {
                    return "";
                }
            }
        }],
        loseVp: ["Lose {{a}} prestige", argValue],
        loseDeposit: ["Lose {{a}} deposit", argValue],
        beforeCompetition: "Before launching competition,",
        competitionStart: "On competition start,",
        competitionWon: "After you launch competition",
        competitionBonus: ["Competition progress +{{a}} bonus", argValue],
        archive: ["Put {{a}} card(s) into your archive.", argValue],
        industryToVp: "Get prestige according to your industry level",
        aestheticsToVp: "Get prestige according to your aesthetics level",
        resFromIndustry: "Get resource according to your industry level",
        resFromAesthetics: "Get resource according to your aesthetics level",
        aesAward: ["Execute your aesthetics level award {{a}}", argTimes],
        industryAward: ["Execute your industry level award {{a}}", argTimes],
        searchAndArchive: ["Search and archive {{a}}", argCardName],
        draw: ["Draw {{a}} card(s)", argValue],
        discard: ["Discard {{a}} card(s)", argValue],
        discardBasic: ["Discard {{a}} basic card(s)", argValue],
        discardNormalOrLegend: ["Discard {{a}} normal or legend card(s)", argValue],
        discardIndustry: ["Discard {{a}} card(s) with industry mark", argValue],
        discardAesthetics: ["Discard {{a}} card(s) with aesthetics mark", argValue],
        allNoStudioPlayer: ["All company with no studio in {{a}},", argRegion],
        vp: ["{{a}} prestige", argValue],
        addVp: ["Get {{a}} prestige", argValue],
        addExtraVp: ["Get additional {{a}} prestige", argValue],
        res: ["{{a}} resource(s)", argValue],
        addRes: ["get {{a}} resource(s)", argValue],
        deposit: ["{{a}} deposit(s)", argValue],
        loseAnyRegionShare: ["Lose {{a}} share(s) of any region, lose 1 competition power", argValue],
        share: ["Get {{a}} share from {{r}}", argValue],
        shareNA: ["Get {{a}} share from north america", argValue],
        shareWE: ["Get {{a}} share from west europe", argValue],
        shareEE: ["Get {{a}} share from east europe", argValue],
        shareASIA: ["Get {{a}} ", argValue],
        loseShareNA: ["Return {{a}} share of north america", argValue],
        loseShareWE: ["Return {{a}} share of west europe", argValue],
        loseShareEE: ["Return {{a}} share(s) of east europe", argValue],
        loseShareASIA: ["Return {{a}} share(s) of asia", argValue],
        shareToVp: ["Gain prestige according to your share in {{a}} region.", argRegion],
        anyRegionShare: ["Get {{a}} share(s) of any region from board", argValue],
        anyRegionShareCompetition: ["Get {{a}} share(s) of any region from competition opponent", argValue],
        newHollyWoodEff: "Get a share of any region from board (only once per turn)",
        anyRegionShareCentral: ["Get {{a}} share(s) of any region from board,", argValue],
        deductRes: ["deduct {{a}} resource(s) from cost.", argValue],
        extraEffect: " Extra effect:",
        buyAesthetics: "When you buys a card with aesthetics marker,",
        loseVpRespond: "When you lose vp in your turn,",
        othersBuySchool: "When another company buys a school card,",
        turnStart: "On the beginning of every turn",
        studio: "All companies with a studio in this region,",
        building: "All companies with a building in this region,，",
        noStudio: "Choose a company without a studio in this region,",
        LES_CHAIERS_DU_CINEMA: "Change company size to 5",
        noBuilding: "Choose a company without a building in this region",
        lose: ["When you lose {{a}},", argCardName],
        school: ["Hand size：{{hand}} action：{{action}}", {
            hand: undefined,
            action: undefined
        }],
        continuous: "【Continuous】",
        scoringHeader: "【Scoring】 At final scoring,",
        playCardHeader: "【Play】",
        buyCardHeader: "【Buy】",
        breakthroughHeader: "【Archive】",
        schoolHeader: "【School】",
        responseHeader: "【Response】： ",
        choice: "Please choose a following effect to execute:",
        comment: ["Comment {{a}}", argTimes],
        industryBreakthrough: ["Industry breakthrough {{a}}", argTimes],
        aestheticsBreakthrough: ["Aesthetics breakthrough{{a}}", argTimes],
        buy: ["Buy 【{{a}}】 for free", argCardName],
        competitionLoserBuy: ["The loser buy [{{a}} ]", argCardName],
        buyCardToHand: ["Buy 【{{a}}】 for free, and add to hand.", argCardName],
        industryLevelUp: ["Upgrade industry level {{a}}", argTimes],
        industryLevelUpCost: ["Upgrade industry level {{a}} with possible extra cost", argTimes],
        aestheticsLevelUp: ["Upgrade aesthetics level {{a}}", argTimes],
        aestheticsLevelUpCost: ["Upgrade aesthetics level {{a}} with possible extra cost", argTimes],
        buildCinema: "Build Cinema",
        buildCinemaInRegion: ["Build cinema in {{a}}", argRegion],
        buildStudio: "Build Studio",
        buildStudioInRegion: ["Build studio in {{a}}", argRegion],
        refactor: "Do Refactor",
        skipBreakthrough: "Skip Breakthrough",
    },
    hand: {
        title: "Hands"
    },
    setup: "Initial setup",
    dialog: {
        concede: {
            title: "Do you really want to concede?",
        },
        chooseTarget: {
            title: "Please choose target player of current effect.",
            toggleText: "Choose Target Player",
        },
        peek: {
            choice: "Please choose one card to hand.",
            title: "Peek cards on the top of the deck",
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
            board: "Buy ",
            cost: " Cost:",
            refresh: "Refresh",
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
            title: "Please choose one card as target of the current effect",
            toggleText: "Choose card for effect",
        },
        competitionCard: {
            title: "Please choose one card from hand for competition",
            toggleText: "Competition card",
        },
        confirmRespond: {
            title: "Please choose whether or not execute optional effect",
            toggleText: "Confirm Effect",
            yes: "Yes",
            no: "No"
        },
    },
    action: {
        concede: "Concede",
        adjustInSlider: "Adjust pay additional cost with deposit or resource in slider",
        payAdditionalCost: "Pay extra cost",
        comment: "Comment",
        updateSlot: "Update",
        showBoardStatus: "Initial setup",
        draw: "Draw additional card",
        play: "Play",
        breakthrough2Res: "Spend 2 resources for breakthrough",
        breakthrough1Res: "Spend 1 resource 1 deposit for breakthrough",
        breakthrough0Res: "Spend 2 deposits for breakthrough",
        studio: "Build Studio",
        cinema: "Build Cinema",
        aestheticsLevelUp: "Upgrade aesthetics",
        industryLevelUp: "Upgrade industry",
        endStage: "End Stage",
        showCompetitionResult: "Show Competition Result",
        endTurn: "End Turn",
        turnEnd: ["Turn {{a}} ended", argValue],
        endPhase: "End Phase",
        undo: "Undo",
        redo: "Redo",
    },
    playerName: {
        spectator: "Spectator",
        player: "Player",
    },
    disconnected: "Disconnected Please refresh",
    pub: {
        legend: "Legend",
        lastRoundOfGame: "Last Round",
        revealedHand: "Revealed Hand",
        champion: "Champion:",
        gameLog: "Report",
        emptyBuildingSlot: "Empty",
        cinemaORStudio: "Cinema/Studio",
        studio: "Studio",
        cinema: "Cinema",
        bollywood: "Bollywood",
        hollywood: "Hollywood",
        unfreeze: "Unfreeze",
        twoToFourPlayer: "2-4 player",
        threeToFourPlayer: "3-4 player",
        fourPlayerOnly: "4 player",
        handSize: "Hand Size:",
        estimatedFinalScore: " Estimated Final Score",
        events: "Event cards:",
        res: "Resource:",
        competitionPower: "CP:",
        deposit: "Deposit:",
        action: "Action:",
        industry: "Industry level:",
        industryMarker: "Industry:",
        industryRequirement: "Industry requirement:",
        aesthetics: "Aesthetics level:",
        aestheticsMarker: "Aesthetics:",
        aestheticsRequirement: "Aesthetics requirement:",
        vp: "Prestige:",
        share: "Share",
        shareLegend: "Share/Legend Card:",
        region: "Region:",
        era: "Era:",
        school: "School:",
        discard: "Discard",
        allCards: "All cards",
        inferredHands: "Inferred hands",
        deck: "Your deck",
        archive: "Archive",
        playedCards: "Played Cards",
    },
    score: {
        cardName: ['{{rank}} {{region}} in {{era}} Era', {
            era: (e: IEra): string => era[e],
            rank: (rankNum: 1 | 2 | 3): string => rank[rankNum],
            region: (r: Region): string => region[r],
        }],
    },
    card: cards,
    region: region,
    era: era,
    vq: {
        response: {
            needsResponse: "Response needed",
            youChoose: " · your turn to choose",
            waiting: " · waiting for choice",
            viewResponse: "View response",
        },
        header: {
            turn: "Turn",
            gameOver: "Game over",
            current: "Current",
            spectator: "Spectator mode",
            viewing: "Viewing",
            expandStatus: "Show game status",
            collapseStatus: "Hide game status",
            phase: {
                cardDraw: "Card Draw phase",
                diplomacy: "Diplomacy phase",
                spring: "Spring Deployment",
                action: "Action phase",
                winter: "Winter",
            },
        },
        cardTray: {
            hand: "Hand",
            cards: "cards",
            treasure: "Treasure",
            cp: "CP",
            collapse: "Collapse hand",
            expand: "Expand hand",
            noCards: "No cards in hand.",
            spectator: "Spectator mode shows public card counts only.",
            viewCard: "View card",
            homeCard: "Home card",
            eventCard: "Event card",
            mandatoryCard: "Mandatory event",
            responseCard: "Response card",
            combatCard: "Combat card",
            actionCard: "Action card",
            viewDetails: "View details",
        },
        abjuration: {
            title: "Abjuration · waiting for Protestant choice.",
            desc: "Each proposal allies immediately with the Protestants and transfers up to 5 regulars from the proposer's home-controlled spaces (plus 1 army leader). The Protestants may accept only one.",
            selected: "Selected",
            regulars: "regulars",
            noRegulars: "no regulars",
            settle: "; resolves immediately on acceptance.",
            accept: "Accept",
            proposal: "proposal",
            waiting: "Waiting for the Protestant player to choose; other powers cannot act now.",
        },
        beacon: {
            title: "Beacon Fires",
            intercepting: "is intercepting from",
            canPlay: "can play #14 before this interception resolves.",
            autoSuccess: "This interception succeeds automatically; the interceptor rolls 2 extra dice in the subsequent naval battle.",
            play: "Play Beacon Fires",
            decline: "Decline",
        },
        actionResponse: {
            impulse: "Impulse-start response",
            response: "Action response",
            waiting: "Waiting",
            multi: "You control several responding powers; choose which responds.",
            responder: "Responding power",
        },
        activation: {
            waiting: "Waiting for",
            activate: "to activate",
            activateNoWar: "Activate without declaring war",
            joinDefense: "Join defense and activate",
            activateWar: "Activate and declare war on",
        },
        battle: {
            title: "Battle",
            waiting: "waiting for",
            choose: "to choose",
            retrieve: "Virgin Queen (#36): retrieve a combat card from the discard pile and play it immediately",
        },
        cityRebels: {
            title: "City State Rebels (#18)",
            waiting: "waiting for",
            allocate: "to allocate losses",
            remaining: "still need to choose",
            units: "loss units, one army or naval unit each",
            auto: "Auto-allocate remaining",
        },
        intercept: {
            title: "Intercept",
            waiting: "waiting for",
        },
        interceptionOrder: {
            title: "Naval interception order",
            choose: "to choose which fleet intercepts first toward",
            move: "movement",
            auto: "Auto-intercept in engine order",
        },
        piracy: {
            title: "Piracy action",
            choose: "to choose",
        },
        actionPanel: {
            spectator: "Spectator mode: view only.",
        },
        board: {
            targetRegion: "Target region",
            armyOwner: "Army owner",
            targetPower: "Target power",
            discard: "Discard hand card or treasure",
            menendezTarget: "Menendez target",
            holyLeagueTarget: "Holy League target",
            secondSpace: "Second target region (Holy Roman Empire)",
            secondPower: "Second mercenary owner",
            eventTarget: "Event target (optional)",
            eventTargetChoice: "Event target",
            eventTargetAuto: "Automatic",
            placeholder: "e.g. france, york, spain:return:alba",
            example: "Target parameter example",
            noTarget: "Fill per card text; leave blank for no target.",
            florida: "Florida colony (no target: roll 3+ to seize)",
            escort: "Treasure Fleet escort (+1 galleon)",
            fortress: "Fortress",
            hand: "hand",
            treasure: "treasure",
            total: "total",
            pieces: "pieces",
            mercOwner: "Mercenary owner",
            noSecondRegion: "No second region",
            noSecondPower: "No second power",
            foreignArmySize: "Foreign army size",
            independentArmies: "independent armies",
            cardImage: "card image",
            event: "Event",
            homeCard: "Home card",
            writer: "Writing",
            painter: "Painting",
            architect: "Architecture",
            anyType: "Any type",
            offensive: "Offensive mode",
            defensive: "Defensive mode",
            removeAll: "Remove all enemy codebooks from own card",
            useAbility: "Use ability",
            asEvent: "As event",
            asCp: "As CP",
            espionageTitle: "Espionage resolution - response needed",
            waiting: "Waiting",
            choose: "to choose",
            germanRecruitment: "German recruitment target (recruitment limited; choose region, then the power owning mercenaries there)",
            germanSecond: "When the Holy Roman Empire acts, may also choose a second region (the two must differ)",
            staffordTarget: "Stafford target (choose a power, then a hand card or treasure to discard)",
            retrievePlay: "Retrieve and play immediately",
            remainingCp: "Remaining CP",
            playedThisTurn: "Played this turn",
            act: "to act",
            rebelCp: "Rebellion CP invested",
            regulars: "regulars",
            noRegulars: "no regulars",
            polishAuto: "Auto: highest CP hand card, else largest treasure",
            polishElectionTitle: "Polish Royal Election · Bids",
            polishElectionCurrent: "Now bidding: {power}",
            polishElectionWaiting: "Waiting for {power} to bid.",
            polishElectionSubmit: "Submit bid",
            merc: "mercenaries",
            cav: "cavalry",
            response: "Event response",
            vizier: "Grand Vizier",
            waitingOttoman: "waiting for the Ottoman Empire to choose",
            notResolved: "not yet resolved; can play Grand Vizier to cancel this event.",
            canAdd: "Can still add",
            units: "units",
            regularsHome: "Regulars may be placed in legal home regions or the foreign war; galleys only in Aegean home ports.",
            chooseRecruit: "Choose recruited units or attempt to build the canal. Suez Canal only in 5-6 player games; cancel event chosen before other events resolve.",
            canalRoll: "Canal roll: 1 die plus accumulated failures",
            excavation: ", plus excavation bonus 2",
            canalSuccess: ", reach 6 to succeed; reward 2 VP and permanent card draw +1.",
            chooseNavalTarget: "Choose naval battle target order",
            defenderChoice: "Defender choice",
            reliefFail: "Relief failed · choose units to stay",
            retreatFortress: "Defender retreats into fortress",
            armada: "Spanish Armada",
            strength: "strength",
            moveHint: "Select a moving stack, then click destination. Max 4 units without a leader; at most two leaders.",
            transportHint: "Select transport sea zones in order; each must have own fleet; max 5 units.",
            route: "Route",
            notSelected: "not yet selected",
            defect: "Defect",
            spy: "spy",
            recall: "recall monitoring",
            ownSpy: "own spy",
            noRemovableLeader: "No removable leader",
            removeGame: "Remove from game",
            retreatInto: "Retreat into fortress",
            fieldBattle: "Field battle",
            withdrawOrField: "defenders may retreat into the fortress or fight in the field",
            maxKeep: "at most",
            unitsStay: "units may stay in the city, the rest withdraw",
            keep: "Keep",
            continueMarch: "May spend 1 CP to continue marching to an adjacent empty region",
            orReturn: "or return to",
            returnOrigin: "Return to origin",
            locatedAt: "Located at",
            armadaJoin: "joins/follows when in the same space as Spanish fleet",
            upgradeArmada: "Upgrade Armada (3 CP)",
            loadArmy: "Load army",
            unloadArmy: "Unload army",
            carrying: "Carrying",
            max: "max",
            loadFrom: "Load from",
            unloadTo: "Unload to",
            spaceDetailLabel: "Selected region details",
            keyCity: "Key city",
            openCity: "Open city",
            port: "Port",
            control: "Control",
            protestant: "Protestant",
            catholic: "Catholic",
            unrest: "unrest",
            besiegedBy: "Besieged by",
            army: "Army",
            regular: "regulars",
            navy: "Navy",
            galley: "galley",
            galleon: "galleon",
            racebuilt: "race-built",
            corsair: "corsair",
            jesuits: "Jesuits",
            leaders: "leaders",
            seaDetailLabel: "Selected sea zone details",
            seaFleets: "Sea zone fleets",
            noFleet: "No fleet in this sea zone.",
            rebelMove: "Move rebels?",
            rebelsIn: "rebels in",
            moveTo: "Move to",
            declineRebelMove: "Decline",
        },
        map: {
            ariaLabel: "Europe and Mediterranean game map",
            control: "Control",
            protestant: "Protestant",
            catholic: "Catholic",
            army: "Army",
            navy: "Navy",
            leaders: "leaders",
            jesuits: "Jesuits",
            noEntry: "no entry (tutorial)",
            unrest: "unrest",
            siege: "besieged",
            zoomIn: "Zoom in",
            zoomOut: "Zoom out",
            reset: "Reset map",
            legend: "■ Key city · ✸ Fortress · ● City · dashed circle unrest · golden circle besieged",
            centerHome: "Centre on my capital",
            help: "Drag to pan · pinch to zoom · Made with Natural Earth",
            switchToWorld: "Switch to world map",
            switchToEurope: "Switch to Europe map",
            europeInset: "Europe map (inset)",
            switchToBoardMap: "Switch to printed-board map",
            switchToGeographicMap: "Switch to geographic map",
            boardAriaLabel: "Full game board redrawn from the printed map (with the world-map triangle strip)",
            boardHelp: "Drag to pan · pinch to zoom · vector redraw of the printed board",
            boardCaption: "Board layout · fills show historical homes, rings show control · triangle strips are colonies",
            boardColonies: "▲ Colonies (world-map triangles)",
            boardOceanLabels: {
                atlantic: "N. ATLANTIC",
                southAtlantic: "S. ATLANTIC",
                indian: "INDIAN OCEAN",
            },
        },
        spring: {
            navalReturn: "Naval leader returns: choose port",
            navalReturnDesc: "Naval leaders returning from the pool must first choose a legal home port before continuing Spring Deployment.",
            secretPref: "Secret religious preference",
            secretPrefDesc: "Chosen once in the first turn; revealed when it would win or prevent another's domination victory.",
            springDeploy: "Spring Deployment",
            springDeployChoice: "first secretly choose the home card to keep this turn (the unchosen one placed face down on the power card), then",
            suleiman: "While Suleiman I reigns: the Ottomans keep both home cards, no choice needed.",
            chooseHomeCard: "Choose home card to keep",
            chooseHomeCardDesc: "The other home cards are placed face down on the power card until next year's Card Draw.",
            keep: "Keep",
            faceDown: "Face down on power card",
            seaCaptain: "Sea captain as naval leader",
            seaCaptainDesc: "May place a British sea captain at a British home port with a British fleet as this turn's naval leader; returns to the pool in winter.",
            port: "Port",
            placeCaptain: "Place sea captain",
            treasureFleet: "Treasure Fleet escort",
            treasureFleetDesc: "At most 2 galleons; adjusted only in Spring, one-way movement this turn.",
            escort: "Escort",
            action: "Action",
            inspect: "Inspect",
            springDeploy2: "Spring Deployment",
            capital: "Capital",
            origin: "origin",
            endSpring: "End Spring Deployment",
        },
        cardDraw: {
            colonies: "Colony Table (2d6 per colony)",
            colonyEliminated: "eliminated",
            colonyNone: "no effect",
            colonyTreasure: "treasure",
            colonyTreasureVp: "treasure + 1 Virginia Dare VP",
            cardDrawPhase: "Card Draw phase",
            turn: "Turn",
            winterLosses: "Winter losses: choose or confirm lost unit types",
            winterLossesDesc: "The corresponding units have already been removed automatically; normal winter losses may be swapped for an available type in that space, or keep the automatic result; Moriscos leave with #28 and can only be confirmed.",
            needLose: "need to lose",
            units: "units",
            morisco: "Moriscos (#28) leave with the card and can only be confirmed, not swapped.",
            changeTo: "Change to lose",
            regular: "regulars",
            merc: "mercenaries",
            cav: "cavalry",
            confirmRemove: "Confirm removal",
            keepAuto: "Keep automatic result",
            winterNavalLosses: "Winter naval losses: confirm lost ship types",
            winterNavalDesc: "When no port can receive them the whole squadron is eliminated per 20.4; confirm the lost ship types for each, or keep the automatic result (ships are not saved).",
            lost: "lost",
            ships: "ships",
            confirm: "Confirm",
            galley: "galley",
            galleon: "galleon",
            racebuilt: "race-built",
            corsair: "corsair",
            pleaseConfirm: "Please confirm",
            waiting: "Waiting",
            completeDraw: "complete card draw",
            claimCaptain: "Claim shared captain",
            drawDone: "card draw complete",
            rules: "Card draw & home card rules",
            rule1: "Home cards and annual hand dealt according to this turn's availability. Powers with two available home cards secretly keep one during Spring Deployment.",
            rule2a: "Each participating power confirms in turn, then proceeds to",
            rule2b: "; powers controlled by the same player also confirm separately.",
            suleiman: "While Suleiman I reigns, the Ottomans keep both home cards.",
            springPhase: "Spring Deployment phase",
            diplomacyPhase: "Diplomacy phase",
        },
        tutorial: {
            title: "Two-player tutorial · Battle of Lepanto",
            step1: "Confirm hand",
            step2: "Spring deployment",
            step3: "Take turns acting",
            finished: "Tutorial over: review this game",
            currentOp: "Current action",
            spectator: "Spectating tutorial: public hints only.",
            yourTurn: "Your turn to act.",
            waitOther: "Waiting for the opponent; switch to",
            tab: "tab.",
            review: "Review moves, combat and play using the victory result, both sides' VP and the log; start a new game to practice again.",
            collapse: "Collapse rules",
            expand: "Expand rules",
            p1p2: "P1 controls the Ottoman Empire, P2 controls Spain; each keeps their own hand.",
            scope: "Scope: play, CP, land and naval forces, combat and piracy. Diplomacy, religion and colonization are off in the tutorial; map × marks no-entry regions. Ottoman military victory wins immediately, or reaching 20 VP at turn end; if not achieved by end of turn 3, Spain wins.",
            ottomanWin: "",
        },
        tutorialEvent: {
            waiting: "waiting for",
            choose: "to choose",
            roadFormation: "First choose Milan's troops and accompanying leader, then the destination; at most one mountain pass, no sea crossing. May also not deploy.",
            remaining: "still need to allocate",
            losses: "losses, army or fleet",
        },
        espionage: {
            title: "Espionage resolution",
            waiting: "waiting for",
            choose: "to choose",
            responses: "Response cards may be played before the roll.",
            offense: "Remaining",
            offenseMax: "intelligence effects, each at most once.",
            conversions: "Allocate",
            protestant: "Protestant",
            catholic: "Catholic",
            conversions2: "conversion dice in England; may use 6 points to extend the base, or save until the last conversion in an occupied region.",
            rebelLosses: "England still needs to allocate",
            rebelLosses2: "losses.",
            massacreConvert: "St. Bartholomew's Massacre: can still convert",
            massacreConvert2: "French politically-controlled Protestant regions to Catholic.",
            massacreAssassinate: "France may make one free",
            massacreAssassinate2: "CP assassination attempt on Coligny.",
            northernConvert: "Rise of the North: Spain chooses",
            northernConvert2: "more English regions to convert to Catholic (no Protestant troops, within 2 spaces of Catholic regions at event start).",
            northernUnrest: "Rise of the North: Spain (not at war with England) places",
            northernUnrest2: "more unrest (unoccupied or Catholic regions).",
            default: "Choose a legal option below to complete the official result table.",
            yourChoice: "Choose an option below.",
        },
        gregorian: {
            title: "Gregorian Calendar",
            ended: "'s turn has ended",
            waiting: "waiting for",
            decide: "to decide whether to respond.",
            chooseNext: "Choose a power to start the next action round (may be the one that just ended), and draw a card if allied with the Papacy.",
            play: "Play Gregorian Calendar",
            decline: "Decline",
        },
        local: {
            players: "players",
            hotseat: "Local hotseat",
            scenario: "Scenario",
            hotseatScenario: "Local hotseat · scenario",
            seatPanel: "Local player panels",
            shortcut: "Shortcut",
            hotseatHelp: "Hotseat help",
            vqHotseat: "Virgin Queen · local hotseat",
            tutorial2p: "Two-player tutorial: P1 Ottoman Empire / P2 Spain. Switch player tabs per tutorial prompts; each tab shows only that player's hand.",
            shortcuts: "Shortcuts",
            switchSeat: "switch to the corresponding player panel",
            prev: "previous",
            next: "next",
            cycle: "cycle",
            noTrigger: "Not triggered while typing or in menus.",
            enterTutorial: "Enter two-player tutorial mode",
        },
        intel: {
            overview: "Powers overview",
            leaderEntries: "Leader entries",
            leadersNextTurn: "Leaders entering next turn",
            leadersLaterTurn: "Leaders entering on turn {turn}",
            leaderEntriesHint: "Only leaders still in the pool with a future arrival this scenario; off-map leaders need an event or special rule to enter.",
            vpHistory: "VP history",
            vpHistoryHint: "VP at the end of each turn (bold = leader). Ties for victory are broken by the previous turn's VP, stepping back until the tie breaks; unrevealed HRE religious VP are not recorded.",
            turnColumn: "Turn",
            turnLong: "Turn {turn}",
            unactivated: "unactivated",
            pendingActivation: "pending activation",
            activated: "activated",
            revealed: "revealed",
            secret: "secret",
            notCounted: " (not counted)",
            secretChosen: "religious preference secretly chosen",
            cards: " cards",
            faceDown: "face down",
            war: "war",
            myPower: "My power",
            keys: "keys",
            militaryGoal: "{count} / {goal} keys",
            militaryGoalHint: "Military victory: control {goal} keys, none in unrest, to win immediately.",
            militaryGoalSummary: "Military victory targets (keys): {targets}; the Protestant counts only keys outside the Netherlands, and keys in unrest never count.",
            militaryGoalSummaryHint: "Control the listed number of keys with no unrest among them to win a military victory immediately.",
            vpVictoryGoal: "VP victories: Standard at 25 VP or more; Domination from Turn 4 with under 25 VP and at least 5 VP ahead of every opponent.",
            vpVictoryGoalHint: "Domination is checked only in the Victory Determination Phase of Turn 4 or later; reaching 25 VP makes it a Standard Victory instead. If two powers tie for the highest VP, the previous turn's recorded VP decides (see VP history); an unbreakable tie falls back to Impulse Order.",
            ruler: "Ruler",
            elizabethDead: "Successor government after Elizabeth's death",
            admin: "admin",
            extraCards: "extra cards",
            base: "base",
            religion: "religion",
            bonus: "bonus",
            wars: "Wars",
            allies: "Allies",
            treasures: "Treasures",
            none: "none",
            secretIntel: "Secret intelligence",
            handSnapshot: " hand snapshot",
            onlyYou: "Only you can see; records the hand at viewing time, not updated later.",
            log: "Game log",
            lastRolls: "Last rolls",
            scenario: "Scenario & victory",
            deck: "deck",
            protestantSpaces: "Protestant spaces",
            protestantSpacesGoal: "Protestant spaces {count} / 51",
            protestantSpacesGoalHint: "Over 50 Protestant spaces wins a Protestant religious victory immediately; 9 or fewer wins a Catholic religious victory immediately.",
            catholicReligiousGoal: "Catholic religious victory: 9 or fewer Protestant spaces",
            protestantOffMap: "{count} not drawn",
            protestantOffMapHint: "Printed Protestant spaces omitted by the reduced map; Catholic conversions can remove them once an area has only its final space.",
            tutorialOttoman: "Ottoman: military victory wins immediately; reaching 20 VP at turn end wins. If not achieved by end of turn 3, Spain wins.",
            tutorialOttoman2: "Ottoman",
            fortress: "fortress VP (no unrest)",
            other: "other",
            remainingTurns: "Remaining turns",
        },
        diplomacy: {
            title: "Diplomacy",
            handCp: "Hand CP",
            handCpNote: "Declare war / make peace pays with hand cards; Home cards cannot be used for war.",
            leagueTitle: "Catholic League: Spain chooses French regions",
            leagueRemaining: "still to choose",
            leagueRemainingNote: "undefended French home regions (not Huguenot home regions).",
            waitingSpain: "Waiting for Spain to choose…",
            hreTitle: "Holy Roman Empire winter reinforcements",
            hreDesc: "Choose 1 regular, 2 mercenaries, or move the mercenary market marker from 0 to 4.",
            viennaRegular: "Vienna +1 regular",
            viennaMercs: "Vienna +2 mercenaries",
            mercMarket: "Mercenary market 0→4",
            waitingHre: "The Holy Roman Empire chooses during its diplomacy turn…",
            targetPower: "Target power",
            declareWar: "Declare war",
            makePeace: "Make peace",
            alliance: "Form alliance",
            blocks: {
                samePower: "That power is controlled by the same player",
                alreadyAtWar: "Already at war with that power",
                notAtWar: "Not at war with that power",
                alreadyAllied: "Already allied with that power",
                spainEnglandNeverPeace: "Spain and England may never agree to peace",
                spainEnglandAllianceCost: "Spain-England DOW cost is ≤3 CP, so they cannot ally",
                spainProtestantNeverAlliance: "Spain and the Protestant may never ally",
                franceBothAlliances: "France may ally Spain or the Protestant, not both in one turn",
                catholicLeague: "After the Catholic League forms, Spain may make no deals with France/the Protestant this year",
                peaceThisPhase: "Already made peace this diplomacy phase",
                cannotAfford: "Not enough cards and treasures to pay the DOW cost",
            },
            giftBlocks: {
                alreadyAtWar: "Cannot give gifts while at war with that power",
                limit: "Already reached this turn's gift limit for that power",
                reciprocal: "That power already gave this kind of gift this turn",
                unavailable: "Nothing available to give",
                ottomanMercs: "The Ottoman may not give mercenaries",
            },
            note: "Declare war / make peace pays with hand cards; alliances last only this turn.",
            randomGift: "Give a random card",
            giftMerc: "Give 1 mercenary in selected region",
            giftTreasure: "Give a random treasure to",
            randomTreasure: "(drawn at random from your hand)",
            value: "Value",
            navalLoan: "Naval loan",
            loanFrom: "Loan-out port",
            loanTo: "Receiving port",
            loanLeader: "Loaned naval leader (optional)",
            noLeader: "No leader lent",
            loan: "Loan",
            declareWarMinor: "Declare war on minor (2 CP)",
            yieldSpace: "Yield selected space",
            returnLeader: "Return captured leader",
            jiltedCp: "Jilted compensation CP (influence/mercenaries only)",
            endDiplomacy: "End diplomacy turn",
        },
        action: {
            inspect: "Inspect",
            recruit: "Recruit",
            build: "Build",
            move: "Move",
            military: "Military",
            recruitRegular: "Recruit regulars (2 CP)",
            recruitMerc: "Recruit mercenaries (1 CP)",
            recruitCav: "Recruit cavalry (1 CP)",
            buildGalley: "Build galley (2 CP)",
            buildGalleon: "Build galleon (2 CP)",
            buildRacebuilt: "Build race-built (2 CP)",
            buildCorsair: "Build corsair (1 CP)",
            moveLand: "Land move (1/2 CP)",
            moveNaval: "Naval move (1 CP)",
            navalTransport: "Naval transport (zones + 1 CP)",
            spring: "Spring deployment (free stack)",
            control: "Control/clear unrest (1 CP)",
            assault: "Assault (1 CP)",
            buildFortress: "Build fortress (2 CP)",
            rebellion: "Protestant rebellion (2-5 CP)",
            regular: "Regular",
            merc: "Merc",
            cav: "Cavalry",
        },
        turn: {
            pass: "Pass",
            endImpulse: "End impulse",
            confirmPass: "Pass this turn?",
            confirmEnd: "End this impulse?",
            neededCp: "Need {need} CP",
            notYourTurn: "Not your turn",
            disabled: "Unavailable",
            passAlreadyPlayed: "You already played a card this impulse; use End impulse.",
            mustPlayMandatory: "Play the mandatory event first: {card}",
            mustPlayHome: "Play your home card first: {card}",
            handOverAdmin: "Your hand has {hand} cards, above the administrative rating of {admin}; play a card first.",
            resolveFirst: "Resolve the pending {what} first",
            blocked: {
                battle: "battle",
                espionage: "espionage",
                interception: "interception",
                cardEvent: "card event",
                piracy: "piracy",
                election: "Polish election",
                rebels: "rebels",
                foreignWar: "foreign war",
                activation: "activation",
                other: "response",
            },
            waitingFor: "Waiting for {power}",
        },
        step: {
            chooseOrigin: "Choose origin",
            chooseUnit: "Choose units",
            chooseTarget: "Choose target",
            unitsHint: "Adjust units, then choose the destination",
            clickHighlighted: "Click a highlighted space",
            hint: {
                recruitRegular: "Click a highlighted space to recruit a regular there.",
                recruitMerc: "Click a highlighted space to recruit a mercenary there.",
                recruitCav: "Click a highlighted space to recruit cavalry there.",
                buildGalley: "Click a highlighted port to build a galley.",
                buildGalleon: "Click a highlighted port to build a galleon.",
                buildRacebuilt: "Click a highlighted port to build a race-built galleon.",
                buildCorsair: "Click a highlighted port to build a corsair.",
                control: "Click a highlighted space to take control of it.",
                assault: "Click a highlighted space to assault it.",
                buildFortress: "Click a highlighted space to build a fortress.",
                rebellion: "Choose the CP to spend, then click a highlighted space.",
                moveLand: "Click a highlighted stack, adjust units, then click the destination.",
                moveNaval: "Click a highlighted fleet, then click the destination.",
                navalTransport: "Click a highlighted stack, add sea zones to the route, then click the destination port.",
            },
            cancel: "Cancel",
        },
        shell: {
            map: "Map",
            skipToActions: "Skip to actions",
            action: "Action",
            hand: "Hand",
            intel: "Intel",
            viewing: "Viewing",
            actionNeeded: "Action · response needed",
            turnLabel: "Turn",
            spectator: "Spectator",
            responseNeeded: "Response needed",
            yourTurn: "your turn to choose",
            waiting: "waiting for choice",
            viewResponse: "View response",
            currentAction: "Current action",
            responseSettlement: "Response & settlement",
            goToMap: "Go to map",
            detailOps: "Details / actions",
            switchToTab: "Switch to the P{tab} tab",
            gameOver: "Game over",
            winner: "Winner",
            reason: "Reason",
            catholicReligiousRule: "France wins if France and Scotland have 3 or fewer Protestant spaces between them; otherwise Spain wins.",
            vpTieIntro: "{powers} tied for the highest VP, so the previous turn's recorded score decides: ",
            vpTieEarlierTurn: "turn {turn} had {history}, giving the win to {winner}.",
            vpTieImpulseOrder: "no earlier turn breaks the tie, so Impulse Order gives the win to {winner}.",
            close: "Close",
            cardDetail: "Card detail",
            handTitle: "Hand",
        },
        log: {
            title: "Game log",
            recentRolls: "Recent rolls",
            showAll: "Show all",
            collapse: "Collapse",
            combat: "Combat",
            diplomacy: "Diplomacy",
            religion: "Religion",
            all: "All",
            mine: "mine",
        },
        legend: {
            title: "Legend",
            key: "Key city",
            fortress: "Fortress",
            open: "Open city",
            jesuits: "J = Jesuits",
            unrest: "Unrest ring",
            siege: "Siege ring",
            closed: "Closed (tutorial)",
            legal: "Legal target",
        },
        setupLog: {
            scenario: "Virgin Queen: {scenario} (turns {start}-{end})",
            vpStart: "Starting VP: {values}",
            protestantSpaces: "Protestant spaces start at {count}.",
            spacesPlaced: "Placed {count} spaces from the Scenario Book.",
            scenarioNote: "Scenario note: {note}",
            unknownPatrons: "Note: {count} patron ratings are not transcribed; resolve winter patronage manually.",
        },
        engine: {
            fight: "Fight",
            retreatIntoFortress: "Retreat into fortress",
            avoidBattleTo: "Attempt to avoid battle to",
            venetianGalleassesAttacker: "Venetian galleasses: +3/+5 dice for the attacker",
            venetianGalleassesDefender: "Venetian galleasses: +3/+5 dice for the defender",
            playCard: "Play",
            continueResolution: "Continue resolution",
            removeOne: "Remove 1",
            retreatTo: "Retreat to",
            neutralizeJesuit: "Neutralize Jesuit: {space}",
            neutralizeSpy: "Neutralize {owner}'s spy in your country",
            continueRoll: "Continue rolling",
            walsinghamOffensive: "Walsingham: England hits on 4–6 when attacking",
            walsinghamDefensive: "Walsingham: only 6 hits against England",
            pistols: "Pistols: +2 dice to the assassination attack",
            maryQueenOfScots: "Mary Queen of Scots: +3 attack dice",
            removeUnits: "Remove {owner} {unit}",
            unitRegular: "regulars",
            unitMerc: "mercenaries",
            unitCav: "cavalry",
            unitCorsair: "corsairs",
            unitGalley: "galleys",
            unitGalleon: "galleons",
            unitRacebuilt: "race-built ships",
            finishConversions: "Finish conversions",
            conversionPoints: "{points} conversion points: {space}",
            expandCatholicBase: "Expand the Catholic base with 6 points: {space}",
            expandProtestantBase: "Expand the Protestant base with 6 points: {space}",
            cancelUnrest: "Lower one 6 to a 5 to cancel unrest",
            displaceLand: "Return army and leaders: {space}",
            displaceNaval: "Return navy and leaders: {space}",
            displaceToPool: "No legal return space; return to the force pool",
            playWalsingham: "Play Walsingham: first remove an operative, then gain intelligence with +2 dice",
            allowNeutralize: "Allow neutralization",
            spareMary: "Spare Mary",
            executeMary: "Execute Mary (England −1 VP)",
            allowJesuitNeutralize: "Allow the Jesuit to be neutralized",
            priestHoles: "Priest Holes: keep the Jesuit",
            neutralizeEnemyOperative: "Neutralize an enemy operative",
            inspectTargetHand: "Secretly inspect the target's hand",
            forceDiscard: "Force the target to discard a random card or treasure",
            finishIntelligence: "Finish the intelligence action",
            skipExtraNeutralize: "Skip the extra neutralization",
            topcliffeDone: "Finish Jesuit neutralization and attempt Protestant conversions",
            neutralizeAssassinationSpy: "Neutralize the spy assisting this assassination",
            inspectAssassinHand: "Secretly inspect the assassin's hand",
            assassinMinusCard: "The assassin draws one fewer card next turn",
            placeUnrest: "Place unrest: {space}",
            rebellionTarget: "Rebellion target: {space}",
            noRebellionTarget: "No legal target; finish the rebellion",
            finishRebellion: "Finish the rebellion",
            expandControl: "Expand control: {space}",
            placeJesuit: "Jesuit: {space}",
            finishJesuitEvent: "Finish the Jesuit event",
            northernConvert: "Northern Rising: {space} becomes Catholic",
            noOtherRegionContinue: "No other legal region; continue resolution",
            endConversions: "End conversions",
            massacreConvert: "Massacre: {space} becomes Catholic",
            freeAssassinateColigny: "Free assassination of Coligny ({cp} CP)",
            skipAssassination: "Skip the assassination",
            northernUnrest: "Northern Rising: place unrest in {space}",
            noOtherRegionDone: "No other legal region; finish the event",
            moveJesuit: "Move Jesuit: {space}",
            addRegularTo: "Add 1 regular: {space}",
            addGalleyTo: "Add 1 galley: {space}",
            addRegularPersia: "Add 1 regular: Persia foreign war",
            recruitFour: "Recruit 4 regulars/galleys",
            attemptSuez: "Attempt to build the Suez Canal",
            allowEventResolution: "Allow the event to resolve",
            playCatherinePrivateer: "Play Catherine's Privateers to cancel the event",
            playJeanneOfNavarre: "Play Jeanne of Navarre to cancel the event",
            playGrandVizierCancel: "Play Grand Vizier to cancel the event",
            removeFleet: "Remove fleet: {space} {kind}",
            allowRandomDraw: "Allow the opponent to draw 1 random hand card",
            giveOttomanPiracyVp: "Give the Ottoman 1 piracy VP",
            awardPiracyVp: "Award the opponent 1 piracy VP",
            ottomanPiracyVpMinusOne: "Reduce Ottoman piracy VP by 1",
            noMilanDeployment: "Do not deploy from Milan",
            selectedUnit: "{owner} {unit} (selected {count})",
            addUnit: "Add",
            removeUnit: "Remove",
            selectLeader: "Select accompanying leader: {leader}",
            deselectLeader: "Deselect accompanying leader: {leader}",
            deployTo: "Deploy to {space} ({count} land units)",
            addHomeRegular: "Add 1 home-power regular",
            noRegular: "Do not add a regular",
            refuseTribute: "Refuse tribute",
            offerTribute: "Offer 1 random hand card as tribute",
            acceptTribute: "Accept tribute, cancel the war, and draw a card",
            rejectTribute: "Reject tribute and continue the war",
            noPayment: "Pay nothing and lose regulars",
            payCard: "Pay {card}; keep up to {count} regulars",
            discardRandomCard: "Discard 1 random hand card",
            skipAndRecallLeader: "Skip the next action round and recall one leader",
            noLeaderMove: "Do not move a leader",
            noExtraBenefit: "Take no extra benefit",
            playHolyLeague: "Retrieve and play Holy League immediately",
            resolveTrack: "Resolve {track} diplomacy",
            investInfluence: "Invest 1 influence in {track}",
            declareWarOn: "Declare war on {target}",
            removeInfluence: "Remove {target}'s influence from {track}",
            drawRandomFromOttoman: "Draw 1 random card from the Ottoman",
            powerOttoman: "Ottoman Empire",
            powerSpain: "Spain",
            allowAction: "Allow the action",
            playStorms: "Play Storms to interrupt the action",
            playSultansHarem: "Play Sultan's Harem; the Ottoman skips its next action round",
        
            interceptFrom: "Intercept from",
            finishInterception: "Finish interception choice",},
        eventTargets: {
            vq030: "spain:return:alba or france:skip",
            vq053: "peace:france, give:france:vq-020 or move:paris",
            vq059: "cut:spain (remove Spain's spy from your own card), upgrade or leave blank for 5 CP",
            exampleSeparator: ": ",
            abjurationAlliedAt: ": allied in ",
            abjurationAlliedSuffix: " · ",
            polishBidHint: "Royal election bid: each power may bid one hand card or one treasure; leave blank for auto.",
            polishBid: "bid",
            armyMutinyHint: "Army mutiny target (choose a region, then the power owning the army stack there)",
            parenOpen: " (",
            parenClose: ")",
            listSeparator: ", ",
        },
        actionUi: {
            clickCityDetail: "Click a city on the map to view details.",
            illegalTarget: "That space is not a legal target for this action.",
            notEnoughCp: "Not enough CP; the action mode was closed.",
            clickTargetCity: "Click a target city on the map to take the action.",
            availableCount: "{count} available now",
            foreignWarEnemy: {
                Persia: "Persia",
                Poland: "Poland",
            },
            originSelected: "Origin selected:",
            cancelOrigin: "Cancel origin",
            maryInfluence: "Mary: +4 Scottish influence",
            dragutFallsRoll: "Dragut's death: roll",
            staffordCancel: "Stafford: cancel Walsingham",
            foreignWarSetup: "Foreign war deployment",
            foreignWarSetupHint: "Choose 3-8 of your army units; they may be drawn from several unbesieged cities, and may include one army leader.",
            clear: "Clear",
            leaderOptional: "Accompanying leader (optional)",
            noLeader: "No leader",
            commitForce: "Send force",
            foreignWarActive: "Foreign war in progress",
            ourSide: "Our side",
            enemySide: "Enemy",
            men: "men",
            leader: "leader",
            fight: "Fight (1 CP)",
            reinforce: "Reinforce",
            religionActions: "Religious actions",
        },
        empire: {
            minorInfluenceDiplomacy: "Minor power influence & diplomacy",
            minorInfluenceNote: "Buying influence costs 1 CP per point; events or declaring war on a minor power trigger a diplomacy resolution, and the same minor power can be resolved only once per turn.",
            minorAlly: " ally",
            influence: "Influence",
            resolvedThisTurn: "Resolved this turn",
            espionageTable: "Espionage · Official Espionage Table",
            espionageNote: "Available from turn 3. Intelligence and deploying agents cost 2 CP each; assassination 2–4 CP, Catholic rebellion 3–5 CP; both share one marker per turn.",
            spyFromPool: "Use a spy from the personnel pool",
            moveSpyAt: "Move spy at ",
            moveSpySuffix: "",
            deploySpy: "Deploy / move spy (2 CP)",
            gainIntelligence: "Gain intelligence (2 CP)",
            assassinationTarget: "Assassination target",
            targetElizabeth: "Elizabeth I",
            targetRudolf: "Rudolf II (Prague)",
            attemptAssassination: "Attempt assassination",
            jesuitsOnCard: "Jesuits: on power card",
            england: "England",
            jesuitsCapNote: "max 5 total. Select an English region to deploy.",
            deployJesuitTo: "Deploy Jesuit to",
            selectedRegion: "selected region",
            englishCatholicRebellion: "English Catholic rebellion",
            informantSep: ": ",
            informantNeutralized: "neutralized, recovered in winter",
            informantActive: "+2 attack dice",
            informantPending: "in effect from the next impulse",
        },
        worldUi: {
            title: "World map · Exploration & colonization",
            intro: "Expeditions sail zone by zone along the recorded coarse adjacencies; hazardous routes, trade winds, colonies, Spanish patrols and fortresses, and world piracy all resolve automatically.",
            worldMap: "World map",
            coloniesShort: "colonies",
            worldMapAria: "World map and colony locations",
            colony: "colony",
            spanishHome: "Spanish settlement",
            portugueseHome: "Portuguese settlement",
            unoccupiedSpace: "Open settlement",
            damaged: "damaged",
            carryingColony: "carrying colony",
            vacant: "vacant",
            controls: "controls",
            fortress: "fortress",
            spanishPatrols: "Spanish patrols",
            buildPatrol: "Build patrol ship (2 CP)",
            buildFortress: "build fortress (2 CP)",
            sailTo: "Sail to",
            foundColony: "found colony",
            worldPiracy: "World piracy (2 CP)",
            expeditionCaptain: "Expedition captain",
            buildExpedition: "Build expedition",
            carryColony: "Carry colony",
            patronageTitle: "Patronage (one of each per turn)",
            markersLeft: "Remaining VP markers",
            artist: "artist",
            scientist: "scientist",
            markerCount: "",
            markersTotal: "of",
            artistAwards: "Artist awards",
            scientistAwards: "Scientist awards",
            removedInScenario: "Removed in this scenario",
            investCp: "Invest CP",
            ratingPending: "rating not recorded",
            rating: "rating",
            seaCaptains: "Sea captains",
            scienceBonusesEarned: "Science bonuses earned",
            piracyTitle: "Piracy (1 CP)",
            seaZone: "Sea zone",
            target: "Target",
            launchPiracy: "Launch piracy",
        },
        diplomacyUi: {
            betrothal: "Royal marriage",
            proposal: "proposes a royal marriage:",
            accept: "Accept",
            reject: "Decline",
            waitingPrefix: "Waiting for",
            waitingSuffix: "to respond to the marriage proposal…",
            domesticRoyal: "Domestic royals",
            foreignRoyal: "Foreign royals",
            male: "Male",
            female: "Female",
            samePowerMarriage: " (same power)",
            louiseNote: "Same-power marriage: Louise of Lorraine (#95) may marry a male royal of this power.",
            propose: "Propose marriage",
            ransom: "Ransom captured leaders",
        },
        springUi: {
            deployHint: "Spring deployment: you may move one army stack from your capital for free.",
            deployHintChoice: "Spring deployment: first secretly choose the home card to keep this turn (the unchosen one goes face down on your power card), then you may move one army stack from your capital for free.",
            seaCaptain: "Sea captain",
            commandLimit: "Command limit: {count} units",
            overCapacity: "Over the command limit",
            adjustFormation: "Adjust formation",
        },
        religionActions: {
            preachEngland: "Preach: England (2 CP)",
            preachFrance: "Preach: France (2 CP)",
            preachNetherlands: "Preach: Netherlands (2 CP)",
            preachScotland: "Preach: Scotland (2 CP)",
            suppressEngland: "Suppress: England (2 CP)",
            suppressFrance: "Suppress: France (2 CP)",
            suppressNetherlands: "Suppress: Netherlands (2 CP)",
            suppressScotland: "Suppress: Scotland (2 CP)",
        },
        shellUi: {
            panelsAria: "Game board sections",
        },
        punct: {
            period: ".",
            comma: ", ",
            colon: ": ",
            list: ", ",
            semicolon: "; ",
            openParen: " (",
            closeParen: ")",
        },},
}
export default en;
export type Locale = typeof en;
