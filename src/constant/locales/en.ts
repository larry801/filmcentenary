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
        },
        comment: {
            title: "Comment",
            removeCommentCard: "Remove Comment Card",

        }
    },
    action: {
        draw:"Draw additional card",
        play:"Play",
        breakthrough:"Breakthrough",
        studio:"建造制片厂",
        theater:"建造电影院",
        aestheticsLevelUp:"提升美学等级",
        industryLevelUp:"提升工业等级",
    },
    playerName: {
        spectator: "Spectator",
        player: "Player",
    },
    pub: {
        res: "Resource:",
        cash: "Reserve:",
        action: "Action:",
        industry: "Industry:",
        aesthetics: "Aesthetics:",
        vp: "Prestige:",
        share: "Share",
        era: "Era",
    }
}
export default en;
export type Locale = typeof en;
