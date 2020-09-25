import {Locale} from './en';

const zh_CN: Locale = {
    region: {
        0: "北美",
        1: "西欧",
        2: "东欧",
        3: "亚洲",
        4: "无"
    },
    action: {
        initialSetup:"补充初始牌",
        draw:"摸牌",
        play:"出牌",
        breakthrough:"突破",
        studio:"建造制片厂",
        cinema:"建造电影院",
        aestheticsLevelUp:"提升美学等级",
        industryLevelUp:"提升工业等级",
        endStage:"结束行动",
        endTurn:"结束回合",
        endPhase:"结束阶段",
    },
    effect:{
        comment:"评论",
        industryBreakthrough:"工业突破",
        aestheticsBreakthrough:"",
        buyCard:"Buy card for free",
        buyCardToHand:"Buy card for free, and add to hand.",
        industryLevelUp:"Upgrade Industry",
        buildCinema:"Build Cinema",
        buildStudio:"Build Studio",
        aestheticsLevelUp:"Upgrade Aesthetics",
        refactor:"Do Refactor",
    },
    cancel:"取消",
    era:{
        0:"发明",
        1:"古典",
        2:"现代",
    },
    setup:"补充初始排列",
    dialog: {
        choosePlayer: {
            title: "请选择效果目标玩家",
            toggleText: "选择目标"
        },
        buyCard:{
            basic:"购买基础牌",
            board:"购买",
            cost:"费用",
        },
        comment: {
            title:"评论",
            removeCommentCard:"移除评论",
        },
        chooseEffect:{
            title:"请选择一项效果执行",
            toggleText:"选择效果",
        },
        confirmRespond:{
            title:"请选择是否执行效果",
            toggleText:"确认",
            yes:"Yes",
            no:"No"
        },
    },
    playerName:{
        spectator:"旁观",
        player: "玩家",
    },
    confirm: "确认",
    card: {
        "B01": "文艺片",
        "B02": "商业片",
        "B03": "B级片",
        "B04": "烂片",
        "B05": "传世经典",
        "B06": "血本无归的影片",
        "B07": "资金",
    },
    hand: {
        title: "手牌"
    },
    pub: {
        res: "资源：",
        deposit: "存款：",
        action: "行动力：",
        industry: "工业等级：",
        aesthetics: "美学等级：",
        vp: "声望：",
        share: "份额：",
        era: "时代："
    },
    score: {
        first: "第一",
        second: "第二",
        third: "第三",
        cardName: ['{{ear}}{{region}}{{rank}}',{
            era:undefined,
            rank:undefined,
            region:undefined,
        }],
    },

};

export default zh_CN;
