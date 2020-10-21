import {IBuyInfo, IEra, Region, validRegion} from "../../types/core";
import {
    IChooseEventArg, IChooseHandArg, ICommentArg, ICompetitionCardArg,
    IEffectChooseArg, IPayAdditionalCostArgs,
    IPeekArgs,
    IPlayCardInfo,
    IRegionChooseArg,
    IShowBoardStatusProps, IShowCompetitionResultArgs, ITargetChooseArgs
} from "../../game/moves";
import {effName, getCardName} from "../../game/util";

const cards = {
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
    '2409': 'The Human Condition',
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
    '3211': 'The Adventure',
    '3212': 'Persona',
    '3213': 'Kes',
    '3301': 'Andrei Tarkovsky',
    '3302': 'Sergi Bondarchuk',
    '3303': 'Three Colors: Blue',
    '3304': 'War and Peace',
    '3305': 'Underground',
    '3306': 'Most',
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
    '3407': 'Tora-san',
    '3408': 'Red Sorghum',
    '3409': 'Hibiscus Town',
    '3410': 'A Touch of Zen',
    '3411': 'Seopyeonje',
    '3412': 'A Story of the Cruelties of Youth',
    '3413': 'The Boys from Fengkuei',
    '3414': 'Taste of Cherry',
};
const region = {
    0: "North America",
    1: "West Europe",
    2: "East Europe",
    3: "Asia",
    4: "Any Region",
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
    'E01': '【Hollywood】 slot activated every company upgrade industry or aesthetics level once.',
    'E02': 'Every company get 2 deposit *Check response effect of【Thomas Edison】or【Lumière Brothers】',
    'E03': 'Every company get its second action point (Note: Do not add action point if you already have a second one)  * If this event is discarded, also execute its effect.',
    'E04': 'Company with highest prestige buy a 【Commercial Film】and put it into hand, every company buy a 【Classic Film】 for free.',
    'E05': 'Every company get 2 deposit, company with building in north america discard two cards.',
    'E06': 'Company with the highest prestige upgrade industry or aesthetics level once Every company buy【Classic Film】 for free.',
    'E07': 'Every company upgrade industry or aesthetics level once,  company prestige not highest buy a 【Bad Film】 for free.',
    'E08': 'Every company put a card in hand to archive, if that company has building in east europe also get prestige of that card, company with no building in east europe buy a 【Bad Film】, second building slot in east europe is activated.',
    'E09': '【Bollywood】 slot activated, company with the lowest aesthetics level upgrade aesthetics level once, company with the lowest aesthetics level upgrade aesthetics level once.',
    'E10': 'At final scoring：Each company whose prestige is higher than you ,gain 4 extra prestige',
    'E11': 'At final scoring：Every person card in your deck and archive gain 4 extra prestige',
    'E12': 'At final scoring：Gain prestige according to your industry and aesthetics level.',
    'E13': 'At final scoring：If your company have 4/3/2/1 champions form different regions, gain 20/12/6/1 extra prestige',
    'E14': 'At final scoring：Every basic card in your deck give you 1 extra prestige',
};
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
        a.shownCards.forEach(c=>t+=bracketCardName(c));
        if(a.card!==null){
            t+= `and chose ${bracketCardName(a.card)} to add to hand`
        }
        return t;
    }
}
const argShowCompetitionResult = {
    args: (arg: IShowCompetitionResultArgs[]): string => {
        let i = arg[0].info;
        let t = "CompetitionResult:"
        if (i.atkCard === null) {
            t += "Attacker did not play card "
        } else {
            t += `Attacker played ${bracketCardName(i.atkCard)} `
        }
        if (i.defCard === null) {
            t += "Defender did not play card "
        } else {
            t += `Defender played ${bracketCardName(i.defCard)} `
        }
        let progress = i.progress;
        if (progress > 5) progress = 5;
        if (progress < -5) progress = -5;
        t += `Progress:${progress} `
        if (i.progress >= 3) {
            t += "Attacker won"
        } else {
            if (i.progress <= -3) {
                t += "Defender won"
            } else {
                t += "No Winner"
            }
        }
        return t;
    }
}
const argShowBoardStatus = {
    args: (arg: IShowBoardStatusProps[]): string => {
        let t = "Board:";
        if (arg[0].regions.length > 0) {
            arg[0].regions.forEach((r, idx) => {
                t += region[idx as validRegion];
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
            t += "School:"
            arg[0].film.forEach(c => {
                if (c.card !== null) {
                    t += bracketCardName(c.card
                    )
                }
            })
            t += "Film:"
            arg[0].school.forEach(c => {
                if (c.card !== null) {
                    t += bracketCardName(c.card)
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
            t += a.resource.toString() + "resource,"
        }
        if (a.deposit > 0) {
            t += a.deposit.toString() + "deposit,"
        }
        if (a.helper.length > 0) {
            t += " and "
            a.helper.forEach(h => t += bracketCardName(h))
        }
        return t
    }
}
const chose = " chose "
const argChooseEffect = {
    args: (arg: IEffectChooseArg[]): string => {
        let a = arg[0]
        let t = chose
        t += effName(a.effect)
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
    args: (arg: []): string => {
        return " drew one card with action point."
    }
}
const argChooseRegion = {
    args: (arg: IRegionChooseArg[]): string => {
        let a = arg[0]
        let t = chose
        t += region[a.r]
        return t
    }
}
const argChooseTarget = {
    args: (arg: ITargetChooseArgs[]): string => {
        let a = arg[0]
        let t = chose
        t += a.targetName
        return t
    }
}
const argRequestEndTurn = {
    args: (arg: []): string => {
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
    args: (arg: ICompetitionCardArg[]): string => {
        return " played a card for competition"
    }
}
const argUpdateSlot = {
    args: (arg: string[]): string => {
        let a = arg[0]
        let t = " updated "
        t += bracketCardName(a)
        return t
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
            return "选择执行效果"
        } else {
            return "选择不执行效果"
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
const rank = {
    1: "Champion of",
    2: "Runner up of",
    3: "Third place of",
}
const en = {
    drawer: {
        singlePlayer: "Single player vs AI",
        singlePlayer3p: "Single player vs AI(3 person)",
        singlePlayer4p: "Single player vs AI(4 person)",
        twoPlayer: "Local 2 person multiplayer",
        threePlayer: "Local 3 person multiplayer",
        fourPlayer: "Local 4 person multiplayer",
        lobby: "Remote multiplayer lobby",
        cards: "Card list",
    },
    title: "Film Centenary",
    lobby: {
        numPlayers: "Players",
        createPublicMatch: "Create public match",
        createPrivateMatch: "Create private match",
        title: "Lobby",
        join: "Join",
        play: "Play",
        leave: "Leave",
        exitMatch: "Exit match",
        exitLobby: "Exit lobby",
        cannotJoin: "Cannot join this match, you are already in another match",
        shareLink: "Share the following link with your opponent:",
    },
    gameOver: {
        title: "Game Over",
        winner: "Winner:",
        reason: {
            threeNAChampionAutoWin: "Three Champion in North America",
            championCountAutoWin: "Champion count exceeded",
            finalScoring: "Final Scoring",
        },
        table: {
            board: "Board",
            card: "Cards",
            building: "Building",
            iAward: "Industry Award",
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
    moves: {
        showBoardStatus: ["{{args}}", argShowBoardStatus],
        chooseEffect: ["{{args}}", argChooseEffect],
        chooseEvent: ["{{args}}", argChooseEvent],
        chooseHand: ["{{args}}", argChooseHand],
        chooseRegion: ["{{args}}", argChooseRegion],
        chooseTarget: ["{{args}}", argChooseTarget],
        peek: ["{{args}}", argPeek],
        showCompetitionResult: ["{{args}}", argShowCompetitionResult],
        competitionCard: ["{{args}}", argCompetitionCard],
        drawCard: ["{{args}}", argDrawCard],
        buyCard: ["{{args}}", argBuyCard],
        playCard: ["{{args}}", argPlayCard],
        breakthrough: ["{{args}}", argBreakthrough],
        requestEndTurn: ["{{args}}", argRequestEndTurn],
        updateSlot: ["{{args}}", argUpdateSlot],
        comment: ["{{args}}", argComment],
        confirmRespond: ["{{args}}", argConfirmRespond],
        payAdditionalCost: ["{{args}}", argPayAdditionalCost],
    },
    eventName: eventName,
    confirm: "OK",
    cancel: "Cancel",
    effect: {
        archiveToEEBuildingVP:"每个公司将1张手牌置入档案馆，如果该公司在东欧地区有建筑",
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
        atBreakthrough: "After you perform a breakthrough action,",
        playedCardInTurnEffect: "Execute the 【play】 effect another card with aesthetics mark you played in this turn.",
        everyOtherCompany: "Every other company",
        everyPlayer: "Every company",
        onYourComment: "After you perform a comment,",
        onAnyOneComment: "After any one perform a comment,",
        doNotLoseVpAfterCompetition: "Do not lose vp after competition",
        discardInSettle: "When you discard a card in the settlement of any card.",
        threeCards: "Gain 1 extra prestige for every three card ",
        northAmericaFilm: "Gain 2 extra prestige for each of your north america film card.",
        asiaFilm: "Gain 2 extra prestige for each of your asia film card.",
        industryNormalOrLegend: "Gain 2 extra prestige for each of your normal or legend card with industry marker.",
        westEuropeCard: "Gain 2 extra prestige for each of your west europe card.",
        alternative: "You may cancel this breakthrough, do following effect instead",
        eastEuropeFilm: "Gain 2 extra prestige for each of your east europe film card.",
        industryLevel: "Gain 2 extra prestige for each of your industry level",
        aestheticsLevel: "Gain 2 extra prestige for each of your aesthetics level",
        personCard: "Gain 4 extra prestige for each of your person card.",
        aesClassic: "Gain 2 extra prestige for each of your normal or legend card with aesthetics marker.",
        NewYorkSchool: " if your industry level is not less than your aesthetics level,execute your aesthetics level bonus once, if your industry level is not less than your aesthetics level execute your industry level bonus once",
        obtainNormalOrLegendFilm: "When you get a normal or legend film card.",
        none: "",
        breakthroughResDeduct: ["Execute breakthrough action with a deduct of {{a}} resources", argValue],
        handToOthers: ["Give one card in hand to other companies", argValue],
        buyNoneEEFilm: "When buy film card not in east europe,",
        extraVp: ["Pay extra {{a}} prestige", argValue],
        breakthroughPrevent: "Cannot execute breakthrough, if you do not pay.",
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
                        if(e.a > 1){
                            return `choose ${e.a} cards, put them`
                        }else{
                            return `choose ${e.a} card, put them`
                        }
                    case "industry":
                        return "put cards with industry mark"
                    case "eraTwo":
                        return "put classic era cards"
                    case "asia":
                        return "put asia cards"
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
                    if (e.e === "anyRegionShare") {
                        return "get an additional share from any region if you win."
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
        competitionStart: "On competition start,",
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
        loseAnyRegionShare: ["Lose {{a}} share(s) of any region", argValue],
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
        anyRegionShare: ["Get {{a}} share(s) of any region", argValue],
        deductRes: ["deduct {{a}} resource(s) from cost.", argValue],
        extraEffect: "Extra effect:",
        buyAesthetics: "When you buys a card with aesthetics marker,",
        loseVpRespond: "When you lose vp,",
        othersBuySchool: "When another company buys a school card,",
        turnStart: "On the beginning of every turn",
        studio: "All companies with a studio in this region,",
        building: "All companies with a building in this region,，",
        noStudio: "Choose a company without a studio in this region,",
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
            title: "Please choose one card from hand as target of effect",
            toggleText: "Choose card from hand",
        },
        competitionCard: {
            title: "Please choose one card from hand for competition",
            toggleText: "Competition card",
        },
        confirmRespond: {
            title: "Please choose ",
            toggleText: "Confirm Effect",
            yes: "Yes",
            no: "No"
        },
    },
    action: {
        adjustInSlider:"Adjust pay additional cost with deposit or resource in slider",
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
    pub: {
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
        twoToFourPlayer: "2-4 player",
        threeToFourPlayer: "3-4 player",
        fourPlayerOnly: "4 player",
        handSize: "Hand Size:",
        estimatedFinalScore: " Estimated Final Score",
        events: "Event cards:",
        res: "Resource:",
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
        cardName: ['{{rank}} {{region}} {{ear}}', {
            era: (e: IEra): string => era[e],
            rank: (rankNum: 1 | 2 | 3): string => rank[rankNum],
            region: (r: Region): string => region[r],
        }],
    },
    card: cards,
    region: region,
    era: era,
}
export default en;
export type Locale = typeof en;
