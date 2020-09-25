const en = {
    confirm: "OK",
    cancel: "Cancel",
    card: {
        "B01": "Literary Film",
        "B02": "Commercial Film",
        "B03": "B-Movie",
        "B04": "Bad Film",
        "B05": "Classic Film",
        "B06": "",
        "B07": "Fund",
    },
    effect:{
        comment:"Comment",
        industryBreakthrough:"industryBreakthrough",
        aestheticsBreakthrough:"aestheticsBreakthrough",
        buyCard:"Buy card for free",
        buyCardToHand:"Buy card for free, and add to hand.",
        industryLevelUp:"Upgrade Industry",
        buildCinema:"Build Cinema",
        buildStudio:"Build Studio",
        aestheticsLevelUp:"Upgrade Aesthetics",
        refactor:"Do Refactor",
    },
    hand: {
        title: "Hands"
    },
    setup: "Initial setup",
    region: {
        0: "North America",
        1: "West Europe",
        2: "East Europe",
        3: "Asia",
        4: "None",
    },
    era: {
        0: "Invention",
        1: "Classic",
        2: "Modern",
    },
    dialog: {
        choosePlayer: {
            title: "Please choose target player of current effect.",
            toggleText: "Choose Target Player",
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
        chooseEffect:{
            title:"请选择一项效果执行",
            toggleText:"选择效果",
        },
        confirmRespond:{
            title:"Please choose ",
            toggleText:"Confirm Effect",
            yes:"Yes",
            no:"No"
        },
    },
    action: {
        initialSetup:"Initial setup",
        draw: "Draw additional card",
        play: "Play",
        breakthrough: "Breakthrough",
        studio: "Build Studio",
        cinema: "Build Cinema",
        aestheticsLevelUp: "Upgrade aesthetics",
        industryLevelUp: "Upgrade industry",
        endStage:"End Stage",
        endTurn:"End Turn",
        endPhase:"End Phase",
    },
    playerName: {
        spectator: "Spectator",
        player: "Player",
    },
    pub: {
        res: "Resource:",
        deposit: "Deposit:",
        action: "Action:",
        industry: "Industry:",
        aesthetics: "Aesthetics:",
        vp: "Prestige:",
        share: "Share",
        era: "Era",
    },
    score: {
        first: "Champion of",
        second: "Runner up of",
        third: "Third place of",
        cardName: ['{{rank}} {{region}} {{ear}}',{
            era:undefined,
            rank:undefined,
            region:undefined,
        }],
    },
}
export default en;
export type Locale = typeof en;
