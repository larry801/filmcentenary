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
        draw:"摸牌",
        play:"出牌",
        breakthrough:"突破",
        studio:"建造制片厂",
        theater:"建造电影院",
        aestheticsLevelUp:"提升美学等级",
        industryLevelUp:"提升工业等级",
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
        },
        comment: {
            title:"评论",
            removeCommentCard:"移除评论",
        }
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
        cash: "存款：",
        action: "行动力：",
        industry: "工业：",
        aesthetics: "美学：",
        vp: "声望：",
        share: "份额：",
        era: "时代："
    }

};

export default zh_CN;
