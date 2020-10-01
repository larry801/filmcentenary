import {Region} from "../../types/core";

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
    4: "Any Region",
};
const argValue = {a: (value: number = 1): string => value.toString()};

const argRegion = {
    a: (value: Region = Region.NONE) :string=> {
        return region[value]
    }
}
const era = {
    0: "Invention",
    1: "Classic",
    2: "Modern",
};
const argCardName = {
    a: (value: string = "E02"):string => {
        // @ts-ignore
        return cards[value]
    }
};
const argTimes = {
    a: (value: number = 1):string => {
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
const en = {
    confirm: "OK",
    cancel: "Cancel",
    lobby:{
        title:"大厅",
        join:"加入",
        play:"开始",
        leave:"离开",
        exitMatch:"退出游戏",
        exitLobby:"退出大厅",
        cannotJoin:"无法加入，已经在其他游戏中。",
    },
    effect: {
        era: {
            0: "Era 1",
            1: "Era 2",
            2: "Era 3",
        },
        event: ["After {{a}}", argCardName],
        optional: "【optional】",
        onAnyOneComment:"After any one perform a comment,",
        doNotLoseVpAfterCompetition:"",
        discardInSettle:"",
        threeCards:"你的每三张牌额外获得1声望",
        northAmericaFilm:"你的每张东欧影片额外获得2声望",
        asiaFilm:"你的每张亚洲影片额外获得2声望",
        industryNormalOrLegend:"每张有工业标志的普通牌和传奇牌额外获得2声望",
        westEuropeCard:"你的每张西欧卡牌",
        eastEuropeFilm:"你的每张东欧影片",
        industryLevel:"你的每个工业等级额外获得2声望",
        aestheticsLevel:"你的每个美学等级额外获得2声望",
        personCard:"你的每张人物牌额外获得4声望",
        aesClassic:"每张有美学标志的普通牌和传奇牌额外获得2声望",
        obtainNormalOrLegendFilm:"每次获得普通影片或传奇影片时",
        onBreakthrough:"When you do breakthrough,",
        none:"",
        breakthroughResDeduct:["突破一次，少花费{{a}}资源",argValue],
        handToOthers:["Give one card in hand to other companies",argValue],
        breakthroughPrevent:"Cannot execute breakthrough, if you do not pay.",
        pay:"支付",
        undefined:"Undefined",
        update:["Update {{a}}",argTimes],
        noBuildingEE:"东欧地区没有建筑的公司",
        playerVpChampion:"声望最高的公司",
        playerNotVpChampion:"声望不是最高的公司",
        aesLowest:"美学等级最低的公司",
        industryLowest:"工业等级最低的公司",
        peek:["观看牌堆顶{{count}}张牌，{{filter}}{{target}}，然后弃掉其他的",{
            count: (value: number = 1):string => {
                return  value.toString()
            },
            target:(e:string):string=>{
                if(e === "hand")
                {
                    return "加入手牌"
                }else{
                    return "";
                }
            },
            filter: (e:string):string=>{
                switch (e) {
                    case "choice":
                        return "选择其中张"
                    case "industry":
                        return "把其中有美学标志的"
                    case "eraTwo":
                        return "把其中古典时代的"
                    case "asia":
                        return "把其中亚洲地区的"
                    case "aesthetics":
                        return "把其中有工业标志的"
                    default:
                        return ""
                }
            }}],
        competition: ["争夺一次{{bonus}}{{onWin}}", {
            bonus: (value: number = 0):string => {
                if(value>0){
                    return "竞争力+" + value.toString()
                }else {
                    return "";
                }
            },
            onWin: (e:any):string=>{
                if(e.e !== "none")
                {
                    return "若这次争夺获胜你额外获得一个" +  region[e.a as Region] +"地区份额"
                }else{
                    return "";
                }
        }}],
        loseVp: ["Lose {{a}} prestige", argValue],
        loseDeposit: ["Lose {{a}} deposit", argValue],
        competitionStart: "On competition start,",
        competitionBonus: ["competition progress +{{a}}", argValue],
        archive: ["Put {{a}} card(s) into your archive.", argValue],
        industryToVp:"按照你的工业等级获得声望",
        aestheticsToVp:"按照你的美学等级获得声望",
        resFromIndustry: "按照你的工业等级获得资源",
        resFromAesthetics: "按照你的美学等级获得资源",
        aesAward: ["执行美学奖励{{a}}次", argValue],
        industryAward: ["执行工业奖励{{a}}次", argValue],
        searchAndArchive: "检索此牌并置入档案馆",
        draw: ["Draw {{a}} card(s)", argValue],
        discard: ["Discard {{a}} card(s)", argValue],
        discardNormalOrLegend: ["弃{{a}}张普通或传奇牌", argValue],
        discardIndustry: ["Discard {{a}} card(s) with industry mark", argValue],
        discardAesthetics: ["Discard {{a}} card(s) with aesthetics mark", argValue],
        allNoStudioPlayer: ["All company with no studio in {{a}},", argRegion],
        vp: ["{{a}}声望", argValue],
        res: ["{{a}}资源", argValue],
        deposit: ["{{a}}存款", argValue],
        loseAnyRegionShare: ["Lose {{a}} share(s) of any region", argValue],
        share: ["获得{{a}}个{{r}}地区的份额", argValue],
        shareNA: ["获得{{a}}个西欧地区的份额", argValue],
        shareWE: ["获得{{a}}个西欧地区的份额", argValue],
        shareEE: ["获得{{a}}个西欧地区的份额", argValue],
        shareASIA: ["获得{{a}}个西欧地区的份额", argValue],
        shareToVp: ["按照你当前持有的{{a}}份额获得声望", argRegion],
        anyRegionShare: ["获得{{a}}个任意地区的份额", argValue],
        deductRes: ["deduct {{a}} resource(s) from cost.", argValue],
        extraEffect: "Extra effect:",
        buyAesthetics: "When you buys a card with aesthetics marker,",
        loseVpRespond: "When you lose vp,",
        othersBuySchool: "When another company buys a school card,",
        turnStart: "On every turn start",
        studio: "本地区有制片厂的公司，",
        building: "本地区有建筑的公司，",
        noStudio: "本地区没有制片厂的公司，",
        noBuilding: "本地区没有建筑的公司，",
        lose: ["When you lose {{a}},", argCardName],
        school: ["手牌上限：{{hand}}行动力：{{action}}", {
            hand: undefined,
            action: undefined
        }],
        continuous: "[Continuous:]",
        scoringHeader: "【Scoring】",
        playCardHeader: "【出牌】",
        buyCardHeader: "【购买】",
        breakthroughHeader: "【突破】",
        schoolHeader: "【流派】",
        responseHeader: "【响应】： ",
        choice: "Please choose a effect to execute:",
        comment: ["Comment {{a}}",],
        industryBreakthrough: ["Industry breakthrough"],
        aestheticsBreakthrough: ["Aesthetics breakthrough"],
        buy: ["Buy card {{a}} for free", argCardName],
        buyCardToHand: ["Buy card {{a}} for free, and add to hand.", argCardName],
        industryLevelUp: ["Upgrade industry level {{a}}", argTimes],
        aestheticsLevelUp: ["Upgrade Aesthetics", argTimes],
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
        handSize: "Hand Size",
        estimatedFinalScore: " Estimated Final Score",
        events: "Event cards:",
        res: "Resource:",
        deposit: "Deposit:",
        action: "Action:",
        industry: "Industry level:",
        industryMarker: "Industry:",
        industryRequirement: "工业需求：",
        aesthetics: "Aesthetics level:",
        aestheticsMarker: "Aesthetics:",
        aestheticsRequirement: "美学需求：",
        vp: "Prestige:",
        share: "Share:",
        era: "Era:",
        school: "School:",
        discard: "Discard",
        allCards: "All cards",
        inferredHands: "Inferred hands",
        archive: "Archive",
        playedCards: "Played Cards",
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
