import {Locale} from './en';
import {
    AllClassicCards,
    BasicCardID, EventCardID,
    IBuyInfo,
    IEra, ItrEffects,
    Region, SimpleEffectNames, ValidRegion, NoExecutorEffectNames, CardID
} from "../../types/core";
import {
    IChooseEventArg,
    IChooseHandArg,
    ICommentArg,
    IPayAdditionalCostArgs,
    IPeekArgs,
    IPlayCardInfo,
    IRegionChooseArg,
    IShowBoardStatusProps,
    IShowCompetitionResultArgs,
    ITargetChooseArgs, IUpdateSlotProps
} from "../../game/moves";
import {argChangePlayerSettingHOF, argSetupGameModeHOF, moveHOF} from "./common";

const era = {
    0: "发明",
    1: "古典",
    2: "现代",
};
const region = {
    0: "北美",
    1: "西欧",
    2: "东欧",
    3: "亚洲",
    4: "流派扩",
    5: "任意"
};
const argRegion = {
    a: (value: Region = Region.NONE) => {
        return region[value]
    }
}
const cards = {
    "B01": "文艺片",
    "B02": "商业片",
    "B03": "B级片",
    "B04": "烂片",
    "B05": "传世经典",
    "B06": "血本无归的影片",
    "B07": "资金",
    'E01': '好莱坞的建立',
    'E02': '第一次世界大战',
    'E03': '先锋派运动',
    'E04': '奥斯卡奖',
    'E05': '派拉蒙判决',
    'E06': '戛纳电影节',
    'E07': '《电影手册》',
    'E08': '解冻时期',
    'E09': '宝菜坞的崛起',
    'E10': '《海斯法典》解体',
    'E11': '电影作者论',
    'E12': '世界电影新浪潮',
    'E13': '全球化',
    'E14': '新媒介',
    '1101': '大卫·格里菲斯',
    '1102': '托马斯·爱迪生',
    '1103': '党同伐异',
    '1104': '火车大劫案',
    '1105': '爵士歌王',
    '1106': '将军号',
    '1107': '淘金记',
    '1108': '北方的纳努克',
    '1109': '金刚',
    '1110': '贪婪',
    '1201': '乔治·梅里爱',
    '1202': '卢米埃尔兄弟',
    '1203': '表现主义',
    '1204': '瑞典学派',
    '1205': '诺斯费拉杜',
    '1206': '圣女贞德蒙难记',
    '1207': '月球旅行记',
    '1208': '卡比利亚',
    '1209': '幽灵马车',
    '1210': '工厂大门',
    '1211': '吉斯公爵遇剌记',
    '1301': '蒙太奇学派',
    '1302': '谢尔盖·爱森斯坦',
    '1303': '电影眼睛派',
    '1304': '母亲',
    '1305': '战舰波将金号',
    '1306': '持摄影机的人',
    '1307': '谢尔盖神父',
    '1308': '大地',
    '2101': '古典好莱坞',
    '2102': '约翰·福特',
    '2103': '阿尔弗雷德·希区柯克',
    '2104': '黑色电影',
    '2105': '奥尔逊威尔斯',
    '2106': '乱世佳人',
    '2107': '关山飞度',
    '2108': '雨中曲',
    '2109': '公民凯恩',
    '2110': '白热',
    '2111': '日落大道',
    '2112': '宾虚',
    '2113': '马耳他之鹰',
    '2114': '迷魂记',
    '2201': '新现实主义',
    '2202': '费德里科·费里尼',
    '2203': '大卫·里恩',
    '2204': '诗意现实主义',
    '2205': '让·雷诺阿',
    '2206': '游戏规则',
    '2207': '偷自行车的人',
    '2208': 'M就是凶手',
    '2209': '大路',
    '2210': '乡村牧师日记',
    '2211': '拿破仑',
    '2212': '天色破晓',
    '2213': '恐惧的代价',
    '2214': '阿拉伯的劳伦斯',
    '2301': '社会主义现实主义',
    '2302': '米哈伊尔·卡拉托佐夫',
    '2303': '夏伯阳',
    '2304': '士兵之歌',
    '2305': '雁南飞',
    '2306': '下水道',
    '2307': '被遗忘的祖先的阴影',
    '2308': '青年近卫军',
    '2309': '亚历山大·涅夫斯基',
    '2401': '黑泽明',
    '2402': '萨蒂亚吉特·雷伊',
    '2403': '小城之春',
    '2404': '—江春水向东流',
    '2405': '阿拉姆·阿拉',
    '2406': '七武士',
    '2407': '大地之歌',
    '2408': '神女',
    '2409': '哥斯拉',
    '2410': '我这一辈子',
    '2411': '东京物语',
    '3101': '新好莱坞电影',
    '3102': '史蒂文·斯皮尔伯格',
    '3103': '教父',
    '3104': '星球大战',
    '3105': '纽约派',
    '3106': '马丁·斯科塞斯',
    '3107': '罗杰·科曼',
    '3108': '泰坦尼克号',
    '3109': '2001太空漫游',
    '3110': '驱魔人',
    '3111': '邦尼和克莱德',
    '3112': '出租车司机',
    '3113': '夺宝奇兵',
    '3114': '最长的一码',
    '3115': '虎豹小霸王',
    '3116': '闪灵',
    '3201': '新浪潮',
    '3202': '弗朗索瓦·特吕弗',
    '3203': '英格玛·伯格曼',
    '3204': '左岸派',
    '3205': '独行杀手',
    '3206': '陆上行舟',
    '3207': '去年在马里昂巴德',
    '3208': '八部半',
    '3209': '朱尔与吉姆',
    '3210': '007：黄金眼',
    '3211': '奇遇',
    '3212': '假面',
    '3213': '小孩与鹰',
    '3301': '安德烈·塔尔科夫斯基',
    '3302': '谢尔盖·邦达尔丘克',
    '3303': '蓝',
    '3304': '诗电影',
    '3305': '战争与和平',
    '3306': '地下',
    '3307': '办公室的故事',
    '3308': '红军与白军',
    '3309': '索拉里斯',
    '3310': '普通法西斯',
    '3311': '钻石胳膊',
    '3312': '乱世英豪',
    '3401': '张艺谋',
    '3402': '王家卫',
    '3403': '阿巴斯·基亚罗斯塔米',
    '3404': '霸王别姬',
    '3405': '重庆森林',
    '3406': '英雄本色',
    '3407': '怒焰骄阳',
    '3408': '红高粱',
    '3409': '芙蓉镇',
    '3410': '侠女',
    '3411': '西便制',
    '3412': '青木瓜之味',
    '3413': '风柜来的人',
    '3414': '樱桃的滋味',

    '4001': '法国印象派',
    '4002': '玛萨拉电影',
    '4003': '美国独立电影',
    '4004': '波兰学派',
    '4005': '现代主义电影',
    '4006': '第三电影',
    '4007': '英国厨房水槽电影',
    '4008': '高概念电影',
};
const eventName = {
    'E01': '每个公司升级工业等级或美学等级1级',
    'E02': '工业等级最高的公司弃一张牌，美学等级最高的公司弃一张牌，每个公司获得2存款',
    'E03': '每个公司立刻获得第2个行动力(注意！并非行动力+1)  *若这张牌因为过时代而被弃掉，事件立刻触发',
    'E04': '声望最高的公司可以免费购买1张【商业片】并置入手牌 每个公司免费购买1张【传世经典】',
    'E05': '北美没有建筑的公司摸1张牌，工业等级美学等级总数最少的公司获得3存款',
    'E06': '西欧没有建筑的公司免费购买一张烂片 每个公司免费购买1张【传世经典】',
    'E07': '流派时代最高的公司免费购买1张【烂片】。\n' +
        '所有规模小于5的公司将规模变为5',
    'E08': '"解冻建筑位可以修建建筑，工业等级和美学等级总和最少的公司选择1项：\n' +
        '（1）升级工业等级1级\n' +
        '（2）升级美学等级1级"\n',
    'E09': '【宝莱坞】建筑位可以修建建筑 美学等级最低的公司升级1级美学等级 工业等级最低的公司升级1级工业等级',
    'E10': '每有一个声望条数字比你高的公司 你额外获得5声望',
    'E11': '每个公司牌库里和档案馆里的每个人物获得4声望',
    'E12': '每个公司按照工业等级和美字等级的总和获得声望',
    'E13': '如果获得过4/3/2/1个不同地区的第一，则得到20/12/6/2声望',
    'E14': '你的每个I/II/III第一名标志物分别得到2/4/8声望。',
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
        return `${era[cardEra]}时代${region[cardRegion]}${rank[cardRank]}`
    }
    return `unknown card${cardId}`
}
const setting = {
    mode: "游戏模式",
    team: "2V2组队模式",
    normal: "完整模式",
    newbie: "新手模式",
    enableSchoolExtension: "启用流派扩",
    randomFirst: "随机首位玩家",
    fixedFirst: "固定首位玩家",
    allRandom: "完全随机",
    order: "行动顺序",
    changeSetting: "更改设置",
    disableUndo: "禁止撤回"
};
const classicFilmAutoMoveMode = {
    MODE_NAME: "传世经典:",
    NO_AUTO: "选择效果",
    DRAW_CARD: "自动摸牌",
    AESTHETICS_AWARD: "自动美学奖励",
};
const argDrawnCards = {
    args: (cards:CardID[]): string => {
        return `摸了 ${cards.map(c=>getCardName(c))}`;
    }
}

const argConcede = {
    args: (): string => {
        return `投降`
    }
}


const argCardName = {
    a: (value: string = "E02") => {
        return getCardName(value)
    }
};
const bracketCardName = (id: string = "E02") => {
    return `【${getCardName(id)}】`
};
const argValue = {a: (value: number = 1): string => value.toString()};
const chose = "选择了";
const argSetupGameMode = argSetupGameModeHOF(chose, setting);
const argChangePlayerSetting = argChangePlayerSettingHOF(chose, classicFilmAutoMoveMode);

const argShowBoardStatus = {
    args: (arg: IShowBoardStatusProps[]): string => {
        let t = "牌列中有";
        if (arg[0].regions.length > 0) {
            arg[0].regions.forEach((r, idx) => {
                const cardRegion: ValidRegion = idx;
                t += region[cardRegion];
                t += '：';
                if (r.legend.card !== null) {
                    t += "传奇："
                    t += bracketCardName(r.legend.card)
                }
                if (r.normal.filter(s => s.card !== null).length > 0) {
                    t += "普通："
                    r.normal.forEach(c => {
                        if (c.card !== null) {
                            t += bracketCardName(c.card)
                        }
                    })
                }
            })
        } else {
            t += "流派："
            arg[0].film.forEach(c => {
                if (c.card !== null) {
                    t += bracketCardName(c.card)
                }
            })
            t += "影片："
            arg[0].school.forEach(c => {
                if (c.card !== null) {
                    t += bracketCardName(c.card)
                }
            })
        }
        return t;
    }
}
const argConfirmRespond = {
    args: (arg: string[]): string => {
        let a = arg[0]
        if (a === "yes") {
            return "选择执行可选效果"
        } else {
            return "选择不执行可选效果"
        }
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
const argBuyCard = {
    args: (arg: IBuyInfo[]): string => {
        let a = arg[0]
        let t = "花费";
        if (a.resource > 0) {
            t += a.resource.toString() + "资源,"
        }
        if (a.deposit > 0) {
            t += a.deposit.toString() + "存款,"
        }
        if (a.helper.length > 0) {
            t += "用"
            a.helper.forEach(h => t += bracketCardName(h))
            t += "补标"
        }
        t += "购买了"
        t += bracketCardName(a.target)
        return t
    }
}
const argPlayCard = {
    args: (arg: IPlayCardInfo[]): string => {
        let a = arg[0]
        let t = "打出了"
        t += bracketCardName(a.card)
        return t
    }
}

const argBreakthrough = {
    args: (arg: IPlayCardInfo[]): string => {
        let a = arg[0]
        let t = "花费"
        if (a.res === 2) t += "2资源"
        if (a.res === 1) t += "1资源1存款"
        if (a.res === 0) t += "2存款"
        t += "突破"
        t += bracketCardName(a.card)
        return t
    }
}
const argShowCompetitionResult = {
    args: (arg: IShowCompetitionResultArgs[]): string => {
        let i = arg[0].info;
        let t = "争夺情况："
        // if (i.atkCard === null) {
        //     t += "发起方没有出牌，"
        // } else {
        //     t += `发起方打出${bracketCardName(i.atkCard)}，`
        // }
        // if (i.defCard === null) {
        //     t += "应对方没有出牌，"
        // } else {
        //     t += `应对方打出${bracketCardName(i.defCard)}，`
        // }
        // if (i.defShownCards.length !== 0) {
        //     t += "应对方没有展示手牌"
        // } else {
        //     t += `应对方展示`;
        //     for (const defShownCard of i.defShownCards) {
        //         t += `${bracketCardName(defShownCard)} `
        //     }
        // }
        let progress = i.progress;
        // if (progress > 5) progress = 5;
        // if (progress < -5) progress = -5;
        t += `竞争力差值：${progress}，`
        // if (i.progress >= 3) {
        //     t += "发起方获胜"
        // } else {
        //     t += "无人获胜"
        //     //
        //     // if (i.progress <= -3) {
        //     //     t += "应对方获胜"
        //     // } else {
        //     //     t += "无人获胜"
        //     // }
        // }
        return t;
    }
}
const argPeek = {
    args: (arg: IPeekArgs[]) => {
        const a = arg[0];
        let t = "展示牌堆顶端";
        a.shownCards.forEach(c => t += bracketCardName(c));
        if (a.card !== null) {
            t += `选择了${bracketCardName(a.card)}加入手牌`
        }
        return t;
    }
}
const argDrawCard = {
    args: (): string => {
        return "用行动力额外抽取了一张牌"
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
    args: (): string => {
        return "行动结束"
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
const argPayAdditionalCost = {
    args: (arg: IPayAdditionalCostArgs[]) => {
        let t = "用"
        const a = arg[0];
        if (a.res > 0) {
            t += `${a.res}资源`
        }
        if (a.deposit > 0) {
            t += `${a.deposit}存款`
        }
        t += "支付了额外费用"
        return t
    }
}
const argCompetitionCard = {
    args: (): string => {
        return "打出了一张牌用于争夺"
    }
}
const argUpdateSlot = {
    args: (arg: IUpdateSlotProps[]): string => {
        return `更新了：${bracketCardName(arg[0].cardId)} 翻出：`
    }
}
const argComment = {
    args: (arg: ICommentArg[]): string => {
        let a = arg[0]
        let t = chose
        if (a.comment === null) {
            t += "移除了"
            t += bracketCardName(a.target)
            t += "的评论"
        } else {
            t += "评论"
            t += bracketCardName(a.target)
            t += "为"
            t += bracketCardName(a.comment)
        }
        return t
    }
}
const rank = {
    1: "第一",
    2: "第二",
    3: "第三",
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

const zh_CN: Locale = {
    setting: setting,
    drawer: {
        singlePlayer: "单人对战AI(2玩家)",
        singlePlayer3p: "单人对战AI(3玩家)",
        singlePlayer4p: "单人对战AI(4玩家)",
        twoPlayer: "本地2人",
        threePlayer: "本地3人",
        fourPlayer: "本地4人",
        pleaseTry: "请尝试",
        lobby: "多人大厅",
        cards: "卡表",
        about: "规则和帮助",
    },
    eventName: eventName,
    region: region,
    action: {
        concede: "投降",
        adjustInSlider: "用下面的滑块调整支付额外费用的存款或资源",
        payAdditionalCost: "支付额外花费",
        comment: "评论",
        updateSlot: "更新",
        showBoardStatus: "展示牌列",
        draw: "使用行动力摸牌",
        play: "出牌",
        breakthrough2Res: "花费2资源突破",
        breakthrough1Res: "花费1资源1存款突破",
        breakthrough0Res: "花费2存款突破",
        studio: "建造制片厂",
        cinema: "建造电影院",
        aestheticsLevelUp: "提升美学等级",
        industryLevelUp: "提升工业等级",
        endStage: "结束行动",
        showCompetitionResult: "展示争夺结果",
        endTurn: "结束回合",
        turnEnd: ["第{{a}}回合结束", argValue],
        endPhase: "结束阶段",
        undo: "撤销",
        redo: "恢复",
    },
    title: "电影百年",
    lobby: {
        player: "起手玩家",
        copyPrompt: "复制",
        numPlayers: "玩家数",
        title: "大厅",
        join: "加入",
        play: "开始",
        leave: "离开",
        exitMatch: "退出游戏",
        exitLobby: "退出大厅",
        cannotJoin: "无法加入，已经在其他游戏中",
        createPublicMatch: "创建公开游戏",
        createPrivateMatch: "创建游戏",
        spectate: "旁观",
        shareLink: "其他玩家用下面的链接加入游戏：",
        publicGame: "公开",
        privateGame: "隐藏",
    },
    gameOver: {
        title: "游戏结束",
        winner: "胜利：",
        table: {
            board: "面板",
            card: "牌库分数",
            building: "建筑",
            industryAward: "工业大奖",
            aesAward: "美学大奖",
            archive: "档案馆",
            events: "计分效果",
            total: "总分",
        },
        reason: {
            othersConceded: "其他玩家投降",
            threeNAChampionAutoWin: "三个北美第一",
            championCountAutoWin: "满足自动胜利要求的第一数量",
            finalScoring: "终局计分",
        },
        rank: {
            0: "第一:",
            1: "第二:",
            2: "第三",
            3: "第四",
        },
    },
    classicFilmAutoMove: classicFilmAutoMoveMode,
    moves: movesI18n,
    effect: {
        industryOrAestheticsBreakthrough:"请选择一项执行：（1）只执行工业突破（2）只执行美学突破",
        CompetitionPowerToVp:["按照竞争力获得声望",argValue],
        addCompetitionPower: ["获得{{a}}竞争力（不超过工业等级）", argValue],
        loseCompetitionPower: ["失去{{a}}竞争力", argValue],
        noCompetitionFee: "无需支付【争夺】发起的费用",
        minHandCountPlayers: "当前手牌数最少的公司",
        chose: chose,
        archiveToEEBuildingVP: "每个公司将1张手牌置入档案馆，如果该公司在东欧地区有建筑，则该公司获得这张牌的声望",
        payAdditionalCost: ["额外支付{{res}}{{deposit}}", {
            deposit: (value: number = 1): string => {
                if (value > 0) {
                    return `${value}存款`
                } else {
                    return ""
                }
            },
            res: (value: number = 1): string => {
                if (value > 0) {
                    return `${value}资源`
                } else {
                    return ""
                }
            },
        }],
        industryAndAestheticsBreakthrough: "工业和美学突破",
        industryOrAestheticsLevelUp: "升级工业等级或美学等级1级",
        era: {
            0: " 1时代：",
            1: " 2时代：",
            2: " 3时代：",
        },
        optional: "【可选】",
        loseVpForEachHand: "按照他当前的手牌数失去声望",
        discardLegend: ["弃掉{{a}}张传奇牌", argValue],
        onYourComment: "你评论后,",
        playedCardInTurnEffect: "执行你出牌区的另一张带有美学标志的牌的【出牌】效果",
        everyOtherCompany: "每个其他公司",
        everyPlayer: "每个公司",
        doNotLoseVpAfterCompetition: "。争夺失败后，不会失去声望",
        discardInSettle: "每当你执行了一次【评论】或【更新】之后",
        onAnyOneComment: "每当发生评论后，",
        onAnyInTurnAesAward: "在你的行动阶段内：当你执行1次美学奖励时立即",
        industryToVp: "按照你的工业等级获得声望",
        aestheticsToVp: "按照你的美学等级获得声望",
        threeCards: "你的每张基础额外获得1声望",
        northAmericaFilm: "你的每张北美卡牌额外获得2声望",
        asiaFilm: "你的每张亚洲卡牌额外获得2声望",
        industryNormalOrLegend: "每张有工业标志的普通牌和传奇牌额外获得2声望",
        westEuropeCard: "你的每张西欧卡牌额外获得2声望",
        eastEuropeFilm: ["你的每张东欧卡牌额外获得{{a}}声望", argValue],
        industryLevel: ["你的每个工业等级额外获得{{a}}声望", argValue],
        aestheticsLevel: ["你的每个美学等级额外获得{{a}}声望", argValue],
        personCard: "你的每张人物牌额外获得4声望",
        aesClassic: "每张有美学标志的普通牌和传奇牌额外获得2声望",
        NewYorkSchool: "若你的美学等级不低于工业等级，美学奖励一次，若你的工业等级不低于美学等级，工业奖励一次",
        obtainNormalOrLegendFilm: "每次获得普通影片或传奇影片时",

        French_Imp_buy: "没有流派的公司可以购买",
        Samara_buy: "你每有1个第一名标志物，外花费2资源",
        American_Independent_Film_buy: "若你有1个完成建造的建筑，额外花费3资源。若你有2个完成建造的建筑，不能购买这个流派。",
        Polish_School_buy: "额外支付等于工业等级和美学等级差值绝对值的资源。",
        Modernist_Film_buy: "你每有1级工业等级，外花费1资源",
        Third_Cinema_buy: "符合如下条件时，你可以失去所有存款并免费购买这个流派:你没有手牌，没有已消耗的行动力，且资源小于等于7。",
        kitchen_sink_buy: "额外支付等于你本回合开始时手牌数的资源。",
        High_Concept_Film_buy: "你每有1级美学等级，额外花费1资源。",
        schoolExtNonePre: "",

        French_Imp_turnstart: "若你的工业等级和美学等级相等，+1行动力。每当你在1个行动结算或整个检查阶段至少+3声望后:+1资源。",
        Samara: "你的电影院效果改为:+1牌，+1声望。当你突破1张没有标志的影片时，选择1项:(1)工业突破1次;(2)美学突破1次。",
        American_Independent_Film_turnstart: "你每有1个完成建造的建筑，-1牌。每当你-1牌后:+1存款，+1声望。",
        Polish_School: "每当你将1张牌置入档案馆(包括突破)或其他玩家的手牌时:+1牌。每当你得到1张基础牌后:+2声望。",
        Modernist_Film: "被争夺后:执行1次美学奖励。若你打出的1张牌有X个美学标志:    X=1:+1资源，+2声望  X=2:+1资源，+2声望，+1牌    X=3:+1资源，+4声望，+2牌。",
        Third_Cinema: "被争夺时:+1牌，争夺方-5声望。回合开始时，若你的美学等级高于你的工业等级:+1牌，+2存款。",
        kitchen_sink_turnstart: "你每有1张手牌就-1声望，每有一个手牌数比你多的公司，你就+1牌。回合结束时:你的出牌区每有1张牌，你就+1声望。",
        High_Concept_Film: "你打出的牌每有1个工业标志:+1资源，+1声望。争夺后:+1竞争力，+1牌。",

        none: "",
        breakthroughResDeduct: ["免费突破一次", argValue],
        handToAnyPlayer: ["把{{a}}张手牌交给任意公司", argValue],
        buyNoneEEFilm: "每当你购买东欧影片后，+1竞争力，+1声望。",
        extraVp: ["额外支付{{a}}声望", argValue],
        inventionEraBreakthroughPrevent: "1时代不能突破",
        breakthroughPrevent: "，然后才能执行突破效果",
        alternative: "可以放弃本次突破，改为",
        pay: "支付",
        update: ["执行{{a}}次【更新】", argValue],
        noBuildingEE: "东欧地区没有建筑的公司",
        highestVpPlayer: "声望最高的公司",
        vpNotHighestPlayer: "声望不是最高的公司",
        aesLowest: "美学等级最低的公司",
        industryLowest: "工业等级最低的公司",
        peek: ["展示牌堆顶{{count}}张牌，{{filter}}{{target}}，然后弃掉其他的", {
            count: (value: number = 1) => {
                return value.toString()
            },
            target: (e: string) => {
                if (e === "hand") {
                    return "加入手牌"
                } else {
                    return "";
                }
            },
            filter: (e: any) => {
                switch (e.e) {
                    case "choice":
                        return `选择其中${e.a}张`
                    case "industry":
                        return "把其中有工业标志的"
                    case "era":
                        // @ts-ignore
                        return `把其中${era[e.a]}时代的`
                    case "region":
                        // @ts-ignore
                        return `把其中${region[e.a]}地区的`
                    case "aesthetics":
                        return "把其中有美学标志的"
                    default:
                        return ""
                }
            }
        }],
        competition: ["争夺一次{{bonus}}{{onWin}}", {
            bonus: (value: number = 0) => {
                if (value > 0) {
                    return "，竞争力+" + value.toString()
                } else {
                    return "";
                }
            },
            onWin: (e: any) => {
                if (e.e !== "none") {
                    switch (e.e) {
                        case SimpleEffectNames.industryToVp:
                            return `然后抽按照你的工业等级获得声望`;
                        case SimpleEffectNames.draw:
                            return `然后摸${e.a}张牌`;
                        case ItrEffects.peek:
                            return `然后展示牌堆顶3张牌，把带有工业标志的加入手牌，然后弃掉其他的`;
                        case SimpleEffectNames.competitionLoserBuy:
                            // @ts-ignore
                            return `然后对方免费购买1张${cards[e.a]}`;
                        case SimpleEffectNames.vp:
                        case SimpleEffectNames.addVp:
                            return `然后+${e.a}声望,`;
                        case ItrEffects.anyRegionShareCentral:
                            return "然后额外从中央牌列获得1个任意地区的份额,";
                        case ItrEffects.comment:
                            return `然后评论${e.a}次,`;
                        case ItrEffects.anyRegionShare:
                            return "然后额外获得一个" + region[e.r as Region] + "地区份额,"
                        case SimpleEffectNames.shareNA:
                            return `然后获得${e.a}个北美份额,`
                        case SimpleEffectNames.addCompetitionPower:
                            return `然后获得${e.a}竞争力,`;
                        case ItrEffects.step:
                            let onWin = "然后";
                            // @ts-ignore
                            e.a.forEach((subEff)=>{
                                switch (subEff.e) {
                                    case SimpleEffectNames.shareNA:
                                        onWin += `获得${subEff.a}北美份额,`;
                                        break;
                                    case SimpleEffectNames.addCompetitionPower:
                                        onWin += `获得${subEff.a}竞争力,`;
                                        break;
                                    case SimpleEffectNames.draw:
                                        onWin += `摸${subEff.a}张牌,`;
                                        break;
                                    case ItrEffects.anyRegionShareCentral:
                                        onWin += `从中央牌列获得${subEff.a}个任意地区的份额,`;
                                        break;
                                    case SimpleEffectNames.deposit:
                                        onWin += `获得${subEff.a}存款,`;
                                        break;
                                    case SimpleEffectNames.vp:
                                        onWin += `获得${subEff.a}声望,`;
                                        break;
                                    default:
                                        onWin += JSON.stringify(subEff);
                                        break;
                                }
                            })
                            return onWin;
                        default:
                            return JSON.stringify(e);
                    }


                } else {
                    return "";
                }
            }
        }],
        loseVp: ["失去{{a}}声望", argValue],
        loseDeposit: ["失去{{a}}存款", argValue],
        beforeCompetition: "争夺开始前，",
        competitionStart: "争夺开始时，",
        competitionWon: "。你发起争夺后，",
        competitionBonus: ["竞争力+{{a}}", argValue],
        archive: ["将{{a}}张手牌置入档案馆", argValue],
        resFromIndustry: "按照你的工业等级获得资源",
        resFromAesthetics: "按照你的美学等级获得资源",
        afterBreakthrough: "你突破后，",
        aesAward: ["执行美学奖励{{a}}次", argValue],
        industryAward: ["执行工业奖励{{a}}次", argValue],
        draw: ["摸{{a}}张牌", argValue],
        discard: ["弃{{a}}张牌", argValue],
        searchAndArchive: ["检索【{{a}}】并置入档案馆", argCardName],
        discardNormalOrLegend: ["弃掉{{a}}张普通或传奇牌", argValue],
        discardIndustry: ["弃掉{{a}}张带有工业标志的手牌", argValue],
        discardBasic: ["弃掉{{a}}张基础牌", argValue],
        discardAesthetics: ["弃掉{{a}}张带有美学标志的手牌", argValue],
        allNoStudioPlayer: ["所有{{a}}地区没有制片厂的公司，", argRegion],
        vp: ["{{a}}声望", argValue],
        addVp: ["获得{{a}}声望", argValue],
        addExtraVp: ["额外获得{{a}}声望", argValue],
        res: ["{{a}}资源", argValue],
        addRes: ["获得{{a}}资源", argValue],
        deposit: ["{{a}}存款", argValue],
        loseAnyRegionShare: ["归还{{a}}个任意地区的份额，并失去1竞争力", argValue],
        shareToVp: ["按照你当前持有的{{a}}份额获得声望", argRegion],
        share: ["获得{{a}}个{{r}}地区的份额", argValue],
        shareNA: ["获得{{a}}个北美地区的份额", argValue],
        shareWE: ["获得{{a}}个西欧地区的份额", argValue],
        shareEE: ["获得{{a}}个东欧地区的份额", argValue],
        shareASIA: ["获得{{a}}个亚洲地区的份额", argValue],
        loseShareNA: ["失去{{a}}个北美地区的份额", argValue],
        loseShareWE: ["失去{{a}}个西欧地区的份额", argValue],
        loseShareEE: ["失去{{a}}个东欧地区的份额", argValue],
        loseShareASIA: ["失去{{a}}个亚洲地区的份额", argValue],
        anyRegionShare: ["获得{{a}}个任意地区的份额", argValue],
        anyRegionShareCompetition: ["从争夺失败方获得{{a}}个任意地区的份额", argValue],
        newHollyWoodEff: "每回合仅限一次,获得1个任意地区的份额",
        anyRegionShareCentral: ["从中央牌列获得{{a}}个任意地区的份额", argValue],
        deductRes: ["少花费{{a}}资源", argValue],
        buyAesthetics: "购买有美学标志的影片时，",
        extraEffect: "额外效果：",
        loseVpRespond: "任何时候，当你在你的回合内失去1声望时，",
        othersBuySchool: "其他公司购买【流派】时，",
        turnStart: "每回合开始时，",
        studio: "本地区有制片厂的公司，",
        building: "本地区有建筑的公司，",
        noStudio: "指定一个本地区没有制片厂的公司，",
        LES_CHAIERS_DU_CINEMA: "将公司规模变为5",
        noBuilding: "指定一个本地区没有建筑的公司，",
        lose: ["失去{{a}}时", argCardName],
        event: ["当{{a}}发生后", argCardName],
        school: ["手牌上限：{{hand}}行动力：{{action}}", {
            hand: undefined,
            action: undefined
        }],
        scoringHeader: "【计分】终局计分时，",
        continuous: "【持续】",
        playCardHeader: "【出牌】",
        buyCardHeader: "【购买】",
        breakthroughHeader: "【突破】",
        schoolHeader: "【流派】",
        responseHeader: "【响应】",
        choice: "请选择一项执行：",
        comment: ["评论{{a}}次", argValue],
        industryBreakthrough: ["工业突破{{a}}次", argValue],
        aestheticsBreakthrough: ["美学突破{{a}}次", argValue],
        buy: ["免费购买【 {{a}} 】", argCardName],
        competitionLoserBuy: ["争夺失败方免费购买【 {{a}} 】", argCardName],
        buyCardToHand: ["免费购买【{{a}}】并加入手牌", argCardName],
        industryLevelUp: ["提升{{a}}级工业等级", argValue],
        industryLevelUpCost: ["提升{{a}}级工业等级（根据目标等级支付额外费用）", argValue],
        aestheticsLevelUp: ["提升{{a}}级美学等级", argValue],
        aestheticsLevelUpCost: ["提升{{a}}级美学等级（根据目标等级支付额外费用）", argValue],
        buildCinema: "建造电影院",
        buildStudioInRegion: ["在{{a}}建造制片厂", argRegion],
        buildCinemaInRegion: ["在{{a}}建造电影院", argRegion],
        buildStudio: "建造制片厂",
        refactor: "重构",
        skipBreakthrough: "跳过本次突破",
    },
    cancel: "取消",
    cardTable: {
        cardId: "编号",
        cardName: "名称",
        cost: "费用",
        prestige: "声望",
        effectText: "效果文本",
        effectIcon: "效果图标",
    },
    era: era,
    setup: "补充初始排列",
    dialog: {
        concede: {
            title: "确认投降?",
        },
        competitionCard: {
            title: "请选择一张手牌参与争夺",
            toggleText: "争夺",
        },
        chooseHand: {
            title: "请选择一张牌执行效果",
            toggleText: "选择卡牌",
        },
        peek: {
            choice: "请选择一张加入手牌",
            title: "查看牌堆顶",
        },
        chooseRegion: {
            title: "请选择效果目标区域",
            toggleText: "选择区域",
        },
        chooseTarget: {
            title: "请选择效果目标玩家",
            toggleText: "选择目标"
        },
        chooseEvent: {
            title: "请选择事件牌",
            toggleText: "选择事件牌",
        },
        buyCard: {
            basic: "购买基础牌",
            board: "购买",
            cost: "费用",
            refresh: "刷新",
        },
        comment: {
            title: "评论",
            removeCommentCard: "移除评论",
        },
        chooseEffect: {
            title: "请选择一项效果执行",
            toggleText: "选择效果",
        },
        confirmRespond: {
            title: "请选择是否执行可选效果",
            toggleText: "确认",
            yes: "是",
            no: "否"
        },
    },
    playerName: {
        spectator: "旁观",
        player: "玩家",
    },
    confirm: "确认",
    disconnected: "已掉线请刷新",
    hand: {
        title: "手牌"
    },
    rank: rank,
    pub: {
        region: "地区",
        legend: "传奇",
        lastRoundOfGame: "最后一轮",
        revealedHand: "展示手牌",
        deck: "牌堆",
        champion: "第一：",
        gameLog: "战报",
        emptyBuildingSlot: "空",
        cinemaORStudio: "电影院/制片厂",
        studio: "制片厂",
        cinema: "电影院",
        bollywood: "宝莱坞",
        hollywood: "好莱坞",
        unfreeze: "解冻",
        twoToFourPlayer: "2-4 玩家",
        threeToFourPlayer: "3-4 玩家",
        fourPlayerOnly: "4 玩家",
        handSize: "手牌数",
        estimatedFinalScore: "终局分数",
        events: "事件牌区：",
        res: "资源：",
        competitionPower: "竞争力：",
        deposit: "存款：",
        action: "行动力：",
        industry: "工业等级：",
        industryRequirement: "工业需求：",
        industryMarker: "工业标志：",
        aesthetics: "美学等级：",
        aestheticsRequirement: "美学需求：",
        aestheticsMarker: "美学标志：",
        vp: "声望：",
        share: "份额：",
        shareLegend: "份额/传奇：",
        era: "时代：",
        school: "流派：",
        discard: "查看弃牌",
        allCards: "查看所有卡牌",
        inferredHands: "推测手牌",
        archive: "查看档案馆",
        playedCards: "查看出牌区",
    },
    score: {
        cardName: ['{{era}}{{region}}{{rank}}', {
            era: (e: IEra): string => (era[e] + "时代"),
            rank: (rankNum: 1 | 2 | 3): string => rank[rankNum],
            region: (r: Region): string => region[r],
        }],
    },
    card: cards,
    vq: {
        response: {
            needsResponse: "需要响应",
            youChoose: " · 轮到你选择",
            waiting: " · 等待选择",
            viewResponse: "查看响应",
        },
        header: {
            eyebrow: "A game of diplomacy & empire · 1559–1598",
            title: "Virgin Queen",
            turn: "回合",
            gameOver: "对局结束",
            current: "当前",
            spectator: "旁观模式",
            phase: {
                cardDraw: "Card Draw 阶段",
                diplomacy: "外交阶段",
                spring: "春季部署",
                action: "行动阶段",
            },
        },
        cardTray: {
            hand: "手牌",
            cards: "张",
            treasure: "宝藏",
            cp: "CP",
            collapse: "收起手牌",
            expand: "展开手牌",
            noCards: "暂无手牌。",
            spectator: "旁观模式仅展示公开牌数。",
            viewCard: "查看卡牌",
            homeCard: "本国牌",
            eventCard: "事件牌",
            actionCard: "行动牌",
            viewDetails: "查看详情",
        },
        abjuration: {
            title: "誓绝法案 · 等待新教选择一项提议。",
            desc: "每个提议立即与新教结盟，并从提议方本土控制地区抽调至多 5 个正规军（可随行 1 个陆军将领）。新教只能接受一项。",
            selected: "已选",
            regulars: "正规军",
            noRegulars: "无正规军",
            settle: "；接受后立即结算。",
            accept: "接受",
            proposal: "的提议",
            waiting: "等待新教玩家选择；其他势力此时无法行动。",
        },
        beacon: {
            title: "烽火",
            intercepting: "正在从",
            canPlay: "拦截，可在此次拦截判定前打出 #14。",
            autoSuccess: "本次拦截自动成功，拦截方在随后海战中额外掷 2 个骰子。",
            play: "打出烽火",
            decline: "不打出",
        },
        actionResponse: {
            impulse: "行动轮开始响应",
            response: "行动响应",
            waiting: "等待",
            multi: "你控制多个可响应势力，请选择由哪个势力进行响应。",
            responder: "行动响应势力",
        },
        activation: {
            waiting: "等待",
            activate: "激活",
            activateNoWar: "激活，不追加宣战",
            joinDefense: "协同参战并激活",
            activateWar: "激活并向",
        },
        battle: {
            title: "战斗",
            waiting: "等待",
            choose: "选择",
            retrieve: "童贞女王（#36）：取回弃牌堆中的战斗牌并立即打出",
        },
        cityRebels: {
            title: "城邦起义（#18）",
            waiting: "等待",
            allocate: "分配损失",
            remaining: "还需选择",
            units: "个损失单位，每次一个陆军或海军单位",
            auto: "自动分配剩余",
        },
        intercept: {
            title: "拦截",
            waiting: "等待",
        },
        interceptionOrder: {
            title: "海军拦截顺序",
            choose: "选择先由哪支舰队拦截前往",
            move: "的移动",
            auto: "按引擎顺序自动拦截",
        },
        piracy: {
            title: "海盗行动",
            choose: "选择",
        },
        actionPanel: {
            spectator: "旁观模式：只能查看局势。",
        },
        board: {
            targetRegion: "目标地区",
            armyOwner: "军队所属势力",
            targetPower: "目标势力",
            discard: "弃置手牌或财宝",
            menendezTarget: "梅嫩德斯目标",
            holyLeagueTarget: "神圣同盟目标",
            secondSpace: "第二目标地区（神圣罗马帝国）",
            secondPower: "第二雇佣兵所属势力",
            eventTarget: "事件目标（可选）",
            placeholder: "例如 france、york、spain:return:alba",
            example: "目标参数示例",
            noTarget: "按卡牌文本填写；留空则无目标结算。",
            florida: "佛罗里达殖民地（不指定目标：掷骰 3+ 夺取）",
            escort: "珍宝舰队护航（+1 大帆船）",
            fortress: "要塞",
            hand: "手牌",
            treasure: "财宝",
            total: "共",
            pieces: "件",
            mercOwner: "雇佣兵所属势力",
            noSecondRegion: "不指定第二地区",
            noSecondPower: "不指定第二势力",
            foreignArmySize: "境外军规模",
            independentArmies: "个独立军",
            cardImage: "卡牌图",
            event: "事件",
            homeCard: "本国牌",
            writer: "写作",
            painter: "绘画",
            architect: "建筑",
            anyType: "不限类型",
            offensive: "进攻模式",
            defensive: "防御模式",
            removeAll: "移除本国所有敌方解码书",
            useAbility: "使用能力",
            asEvent: "作为事件",
            asCp: "作为 CP",
            espionageTitle: "⚠ 谍报结算 - 需要响应",
            waiting: "等待",
            choose: "选择",
            germanRecruitment: "德意志裁军目标（募兵受限；选择地区，再选择该地区拥有雇佣兵的势力）",
            germanSecond: "神圣罗马帝国执行时可额外选择第二个地区（两个地区必须不同）",
            staffordTarget: "斯塔福德目标（选择势力，再选择要弃置的手牌或财宝）",
            retrievePlay: "取回并立即打出",
            remainingCp: "剩余 CP",
            playedThisTurn: "本回合已出牌",
            act: "行动",
            rebelCp: "叛乱投入 CP",
            regulars: "正规军",
            noRegulars: "无正规军",
            polishAuto: "自动：最高 CP 手牌，否则最大财宝",
            merc: "雇佣兵",
            cav: "骑兵",
            response: "事件响应",
            vizier: "大维齐尔",
            waitingOttoman: "等待奥斯曼帝国选择",
            notResolved: "尚未结算；可打出大维齐尔取消此事件。",
            canAdd: "还可增加",
            units: "个单位",
            regularsHome: "正规军可放入合法家乡地区或境外战争；桨帆船限爱琴海家乡港口。",
            chooseRecruit: "选择增募单位或尝试建造运河。苏伊士运河仅限 5～6 人局；取消事件在其他事件结算前选择。",
            canalRoll: "运河判定：掷 1 骰，加累计失败",
            excavation: "，再加挖掘奖励 2",
            canalSuccess: "，达到 6 即成功；奖励 2 VP 和永久抽牌 +1。",
            chooseNavalTarget: "选择海战目标顺序",
            defenderChoice: "守军选择",
            reliefFail: "救援失败 · 选择留驻单位",
            retreatFortress: "守军退入要塞",
            armada: "西班牙阿马达",
            strength: "强度",
            moveHint: "选择移动编队，再点击目的地。无将领最多 4 单位；最多两名将领。",
            transportHint: "按顺序选择运输海域，每个海域须有己方舰队，最多运输 5 单位。",
            route: "航线",
            notSelected: "尚未选择",
            defect: "策反",
            spy: "间谍",
            recall: "调回监视",
            ownSpy: "的本国间谍",
            noRemovableLeader: "没有可移除的将领",
            removeGame: "移出游戏",
            retreatInto: "退入要塞",
            fieldBattle: "出城野战",
            withdrawOrField: "的守军可退入要塞，或出城野战",
            maxKeep: "最多",
            unitsStay: "个单位可留在城内，其余回撤",
            keep: "留",
            continueMarch: "可花 1 CP 继续行军到相邻空地区",
            orReturn: "或返回",
            returnOrigin: "返回出发地",
            locatedAt: "位于",
            armadaJoin: "与西班牙舰队同格时自动参战/随行",
            upgradeArmada: "升级阿马达 (3 CP)",
            loadArmy: "装载陆军",
            unloadArmy: "卸载陆军",
            carrying: "搭载",
            max: "上限",
            loadFrom: "从",
            unloadTo: "卸载到",
            spaceDetailLabel: "选中地区详情",
            keyCity: "关键城市",
            openCity: "开放城市",
            port: "港口",
            control: "控制",
            protestant: "新教",
            catholic: "天主教",
            unrest: "动荡",
            besiegedBy: "被围困",
            army: "陆军",
            regular: "正规",
            navy: "海军",
            galley: "桨帆",
            galleon: "大帆",
            racebuilt: "快帆",
            corsair: "海盗",
            jesuits: "耶稣会士",
            leaders: "将领",
            seaDetailLabel: "选中海域详情",
            seaFleets: "海域舰队",
            noFleet: "此海域无舰队。",
            rebelMove: "移动叛军？",
            rebelsIn: "叛军位于",
            moveTo: "移动到",
            declineRebelMove: "放弃",
        },
        map: {
            ariaLabel: "欧洲与地中海游戏地图",
            control: "控制",
            protestant: "新教",
            catholic: "天主教",
            army: "陆军",
            navy: "海军",
            leaders: "将领",
            jesuits: "耶稣会士",
            noEntry: "教学禁入",
            unrest: "动荡",
            siege: "围困中",
            zoomIn: "放大地图",
            zoomOut: "缩小地图",
            reset: "复位地图",
            legend: "■ 关键城市 · ◆ 要塞 · ● 城市 · 虚线圈 动荡 · 金色圈 围困",
            centerHome: "定位到我的首都",
            help: "拖动平移 · 双指缩放 · Made with Natural Earth",
        },
        spring: {
            navalReturn: "海军将领归国：选择港口",
            navalReturnDesc: "从船池返回的海军将领必须先选择一个合法的本土港口，才能继续春季部署。",
            secretPref: "秘密宗教倾向",
            secretPrefDesc: "首回合选择一次；胜利判定时足以取胜或阻止他国支配胜利才会公开。",
            springDeploy: "春季部署",
            springDeployChoice: "先秘密选择本回合保留的本国牌（未选中的面朝下放在势力卡上），然后",
            suleiman: "苏莱曼一世在位：奥斯曼可保留两张本国牌，无需二选一。",
            chooseHomeCard: "选择保留的本国牌",
            chooseHomeCardDesc: "其余本国牌将面朝下放在势力卡上，直到下一年的 Card Draw。",
            keep: "保留",
            faceDown: "面朝下放在势力卡上",
            seaCaptain: "海船长作为海军将领",
            seaCaptainDesc: "可把一名英国海船长放到有英国舰队的英国本土港口，作为本回合海军将领；冬季返回海船长池。",
            port: "港口",
            placeCaptain: "放置海船长",
            treasureFleet: "珍宝舰队护航",
            treasureFleetDesc: "最多 2 艘大帆船；仅春季调整，且本回合只能单向移动。",
            escort: "护航",
            action: "行动",
            inspect: "查看",
            springDeploy2: "春季部署",
            capital: "首都",
            origin: "起点",
            endSpring: "结束春季部署",
        },
        cardDraw: {
            colonies: "殖民地表（每块殖民地 2d6）",
            colonyEliminated: "殖民地消灭",
            colonyNone: "无效果",
            colonyTreasure: "获得宝藏",
            colonyTreasureVp: "获得宝藏 + 1 弗吉尼亚敢死队 VP",
            cardDrawPhase: "Card Draw 阶段",
            turn: "回合",
            winterLosses: "冬季损失：选择或确认失去的单位类型",
            winterLossesDesc: "已自动移除相应数量的单位；普通冬季损失可改选该地现有足够数量的类型，或保留自动结果；莫里斯科人随 #28 离场，只能确认。",
            needLose: "需失去",
            units: "个单位",
            morisco: "莫里斯科人（#28）随牌离场，只能确认移除，不能改为失去其他兵种。",
            changeTo: "改为失去",
            regular: "正规军",
            merc: "雇佣兵",
            cav: "骑兵",
            confirmRemove: "确认移除",
            keepAuto: "保留自动结果",
            winterNavalLosses: "冬季海军损失：确认损失的舰型",
            winterNavalDesc: "无可用返港港口时整支舰队按 20.4 消灭；可为每处损失确认损失的舰型，或保留自动结果（不会因此保留舰船）。",
            lost: "损失",
            ships: "艘舰船",
            confirm: "确认",
            galley: "桨帆船",
            galleon: "大帆船",
            racebuilt: "快帆船",
            corsair: "海盗船",
            pleaseConfirm: "请确认",
            waiting: "等待",
            completeDraw: "完成抽牌",
            claimCaptain: "领取共享船长",
            drawDone: "抽牌完成",
            rules: "抽牌与本国牌规则",
            rule1: "已按本回合可用性发放本国牌与年度手牌。拥有两张可用本国牌的强国，将在春季部署时秘密保留一张。",
            rule2a: "各参战强国依次确认后进入",
            rule2b: "；同一玩家控制的强国也需分别确认。",
            suleiman: "苏莱曼一世在位时，奥斯曼可保留两张本国牌。",
            springPhase: "春季部署阶段",
            diplomacyPhase: "外交阶段",
        },
        tutorial: {
            title: "双人教学模式 · 勒班陀海战",
            step1: "确认手牌",
            step2: "春季部署",
            step3: "轮流行动",
            finished: "教学结束：回顾本局",
            currentOp: "当前操作",
            spectator: "旁观教学：仅查看公开提示。",
            yourTurn: "轮到你操作。",
            waitOther: "等待对方操作；本地热座请切换到",
            tab: "标签页。",
            review: "可结合胜利结果、双方 VP 和日志回顾出牌、移动与战斗；重新开局即可再次练习。",
            collapse: "收起规则说明",
            expand: "展开规则说明",
            p1p2: "P1 控制奥斯曼帝国，P2 控制西班牙；双方各自保留自己的手牌。",
            scope: "学习范围：出牌、CP、陆海军、战斗与海盗。外交、宗教、殖民等系统在教学局关闭；地图 × 标记地区不可进入。奥斯曼军事胜利立即获胜，或在回合结束达到 20 VP；第三回合结束未达成则西班牙获胜。",
            ottomanWin: "",
        },
        tutorialEvent: {
            waiting: "等待",
            choose: "选择",
            roadFormation: "先选择米兰的部队与随军将领，再选择部署目的地；最多跨越一个山口，不能渡海。也可不部署。",
            remaining: "还需分配",
            losses: "次损失，可选择陆军或舰队",
        },
        espionage: {
            title: "谍报结算",
            waiting: "等待",
            choose: "选择",
            responses: "可在掷骰前使用响应牌。",
            offense: "剩余",
            offenseMax: "次情报效果，每种效果最多一次。",
            conversions: "在英格兰分配",
            protestant: "新教",
            catholic: "天主教",
            conversions2: "转化骰；可用 6 点扩展基础，或保留至最后转化有部队的地区。",
            rebelLosses: "英格兰还需分配",
            rebelLosses2: "次损失。",
            massacreConvert: "圣巴托罗缪大屠杀：还可将",
            massacreConvert2: "个法国政治控制的新教地区改为天主教。",
            massacreAssassinate: "法国可免费对科利尼进行一次",
            massacreAssassinate2: "CP 刺杀。",
            northernConvert: "北方崛起：西班牙再选择",
            northernConvert2: "个英格兰地区改为天主教（无新教部队，距事件开始时的天主教地区 2 格内）。",
            northernUnrest: "北方崛起：西班牙未与英格兰交战，再放置",
            northernUnrest2: "个动荡（无人占领或天主教地区）。",
            default: "选择下方合法选项，完成官方结果表的后续结算。",
        },
        gregorian: {
            title: "公历纪年法",
            ended: "的回合已结束",
            waiting: "等待",
            decide: "决定是否响应。",
            chooseNext: "选择一个势力开始下一个行动轮（可以是刚结束回合的势力），并从牌堆抽一张牌（若与教廷结盟）。",
            play: "打出公历纪年法",
            decline: "不打出",
        },
        local: {
            players: "人",
            hotseat: "本地热座",
            scenario: "场景",
            hotseatScenario: "本地热座 · 场景",
            seatPanel: "本地玩家面板",
            shortcut: "快捷键",
            hotseatHelp: "热座帮助",
            vqHotseat: "Virgin Queen · 本地热座",
            tutorial2p: "双人教学：P1 奥斯曼帝国 / P2 西班牙。请按教学提示切换玩家标签页；每个标签页仅显示该玩家的手牌。",
            shortcuts: "快捷键",
            switchSeat: "切换对应玩家面板",
            prev: "上一个",
            next: "下一个",
            cycle: "循环切换",
            noTrigger: "输入或选择菜单时不触发。",
            enterTutorial: "进入双人教学模式",
        },
        intel: {
            overview: "列强概览",
            unactivated: "未激活",
            pendingActivation: "待激活",
            activated: "激活",
            revealed: "已公开",
            secret: "秘密",
            notCounted: "（未计入）",
            secretChosen: "宗教倾向已秘密选择",
            cards: "牌",
            faceDown: "面朝下",
            war: "战",
            myPower: "我的势力",
            keys: "关键城市",
            ruler: "统治者",
            elizabethDead: "伊丽莎白逝世后的继任政府",
            admin: "行政",
            extraCards: "额外牌",
            base: "基础",
            religion: "宗教",
            bonus: "奖励",
            wars: "战争",
            allies: "同盟",
            treasures: "宝藏",
            none: "无",
            secretIntel: "秘密情报",
            handSnapshot: "手牌快照",
            onlyYou: "仅你可见；记录查看时的手牌，不随对方后续行动更新。",
            log: "对局日志",
            lastRolls: "最近掷骰",
            scenario: "场景与胜利条件",
            deck: "牌堆",
            protestantSpaces: "新教地区",
            tutorialOttoman: "奥斯曼：军事胜利立即获胜；回合结束达到 20 VP 获胜。第 3 回合结束未达成则西班牙获胜。",
            tutorialOttoman2: "奥斯曼",
            fortress: "无动荡要塞",
            other: "其他",
            remainingTurns: "剩余回合",
        },
        diplomacy: {
            title: "外交",
            handCp: "手牌总 CP",
            handCpNote: "（宣战/议和使用手牌支付，本国牌不可用于宣战）",
            leagueTitle: "天主教联盟：西班牙选择法国地区",
            leagueRemaining: "还需选择",
            leagueRemainingNote: "个未设防的法国本土地区（不能是休格诺家乡地区）。",
            waitingSpain: "等待西班牙选择…",
            hreTitle: "神圣罗马帝国冬季补员",
            hreDesc: "选择 1 正规军、2 雇佣兵，或将雇佣兵市场标记从 0 移到 4。",
            viennaRegular: "维也纳 +1 正规军",
            viennaMercs: "维也纳 +2 雇佣兵",
            mercMarket: "雇佣兵市场 0→4",
            waitingHre: "等待神圣罗马选择…",
            targetPower: "目标强国",
            declareWar: "宣战",
            makePeace: "议和",
            alliance: "结盟",
            note: "宣战/议和使用手牌支付；同盟只持续本回合。",
            randomGift: "随机赠送一张牌",
            giftMerc: "赠送选中地区 1 雇佣兵",
            giftTreasure: "随机赠送宝藏给",
            randomTreasure: "（从手中随机抽取）",
            value: "价值",
            navalLoan: "海军借调",
            loanFrom: "借出港口",
            loanTo: "接收港口",
            loanLeader: "随借海军将领（可选）",
            noLeader: "不借将领",
            loan: "借出",
            declareWarMinor: "对小国宣战 (2 CP)",
            yieldSpace: "让渡选中地区",
            returnLeader: "归还被俘将领",
            jiltedCp: "弃婚补偿 CP（仅外交影响/雇佣兵）",
            endDiplomacy: "结束外交回合",
        },
        action: {
            inspect: "查看",
            recruit: "征募",
            build: "建造",
            move: "移动",
            military: "军事",
            recruitRegular: "征募正规军 (2 CP)",
            recruitMerc: "征募雇佣兵 (1 CP)",
            recruitCav: "征募骑兵 (1 CP)",
            buildGalley: "建造桨帆船 (2 CP)",
            buildGalleon: "建造大帆船 (2 CP)",
            buildRacebuilt: "建造快帆船 (2 CP)",
            buildCorsair: "建造海盗船 (1 CP)",
            moveLand: "陆军移动 (1/2 CP)",
            moveNaval: "海军移动 (1 CP)",
            navalTransport: "海运陆军 (海域数 + 1 CP)",
            spring: "春季部署 (免费编队)",
            control: "控制/清除动荡 (1 CP)",
            assault: "强攻 (1 CP)",
            buildFortress: "修筑要塞 (2 CP)",
            rebellion: "新教叛乱 (2-5 CP)",
            regular: "正规军",
            merc: "雇佣兵",
            cav: "骑兵",
        },
        turn: {
            pass: "跳过",
            endImpulse: "结束行动轮次",
            confirmPass: "确定跳过本轮？",
            confirmEnd: "确定结束行动轮次？",
            neededCp: "需要 {need} CP",
            notYourTurn: "非你的回合",
            disabled: "不可用",
        },
        step: {
            chooseOrigin: "选择起点",
            chooseUnit: "选择单位",
            chooseTarget: "选择目标",
            unitsHint: "调整部队后点击目的地",
            cancel: "取消",
        },
        shell: {
            map: "地图",
            action: "行动",
            hand: "手牌",
            intel: "局势",
            actionNeeded: "行动 · 待响应",
            turnLabel: "回合",
            spectator: "旁观",
            responseNeeded: "需要响应",
            yourTurn: "轮到你选择",
            waiting: "等待选择",
            viewResponse: "查看响应",
            currentAction: "当前行动",
            responseSettlement: "响应与结算",
            goToMap: "前往地图",
            detailOps: "详情 / 操作",
            gameOver: "对局结束",
            winner: "胜者",
            reason: "原因",
            close: "关闭",
            cardDetail: "卡牌详情",
            handTitle: "手牌",
        },
        log: {
            title: "对局日志",
            recentRolls: "最近掷骰",
            showAll: "显示全部",
            collapse: "收起",
            combat: "战斗",
            diplomacy: "外交",
            religion: "宗教",
            all: "全部",
            mine: "本方",
        },
        legend: {
            title: "图例",
            key: "关键城市",
            fortress: "要塞",
            open: "开放城市",
            jesuits: "J = 耶稣会士",
            unrest: "动荡圈",
            siege: "围困圈",
            closed: "禁入（教学）",
            legal: "合法目标",
        },
        setupLog: {
            scenario: "Virgin Queen: {scenario}（第 {start}-{end} 回合）",
            vpStart: "VP 起始：{values}",
            protestantSpaces: "新教地区起始：{count}",
            spacesPlaced: "已按 Scenario Book 设置 {count} 个地区。",
            scenarioNote: "场景说明：{note}",
            unknownPatrons: "注意：{count} 位赞助人的评级未转录，冬季赞助结算需要手动处理。",
        },
        engine: {
            fight: "迎战",
            retreatIntoFortress: "退入要塞",
            avoidBattleTo: "尝试避战至",
            venetianGalleassesAttacker: "威尼斯桨帆船：给进攻方 +3/+5 骰",
            venetianGalleassesDefender: "威尼斯桨帆船：给防守方 +3/+5 骰",
            playCard: "打出",
            continueResolution: "继续结算",
            removeOne: "移除 1",
            retreatTo: "撤退至",
            neutralizeJesuit: "无效化耶稣会士：{space}",
            neutralizeSpy: "无效化 {owner} 在本国的间谍",
            continueRoll: "继续掷骰",
            walsinghamOffensive: "沃尔辛厄姆：英格兰攻击骰 4–6 命中",
            walsinghamDefensive: "沃尔辛厄姆：攻击英格兰仅 6 命中",
            pistols: "手枪：刺杀攻击 +2 骰",
            maryQueenOfScots: "苏格兰女王玛丽：攻击 +3 骰",
            removeUnits: "移除 {owner} {unit}",
            unitRegular: "正规军",
            unitMerc: "雇佣兵",
            unitCav: "骑兵",
            unitCorsair: "海盗船",
            unitGalley: "桨帆船",
            unitGalleon: "大帆船",
            unitRacebuilt: "快帆船",
            finishConversions: "完成宗教转化",
            conversionPoints: "{points} 点转化：{space}",
            expandCatholicBase: "6 点扩展天主教基础：{space}",
            expandProtestantBase: "6 点扩展新教基础：{space}",
            cancelUnrest: "将一颗 6 降为 5，取消动荡",
            displaceLand: "遣返陆军与将领：{space}",
            displaceNaval: "遣返海军与将领：{space}",
            displaceToPool: "无合法遣返地区，返回人员池",
            playWalsingham: "打出沃尔辛厄姆：先移除人员，再以 +2 骰获取情报",
            allowNeutralize: "允许无效化",
            spareMary: "不处决玛丽",
            executeMary: "处决玛丽（英格兰 −1 VP）",
            allowJesuitNeutralize: "允许耶稣会士无效化",
            priestHoles: "神父藏身所：保留耶稣会士",
            neutralizeEnemyOperative: "无效化敌方情报人员",
            inspectTargetHand: "秘密查看目标手牌",
            forceDiscard: "迫使目标随机弃一张牌或宝藏",
            finishIntelligence: "完成情报行动",
            skipExtraNeutralize: "跳过额外无效化",
            topcliffeDone: "完成耶稣会士无效化，进行新教转化",
            neutralizeAssassinationSpy: "无效化协助本次刺杀的间谍",
            inspectAssassinHand: "秘密查看刺杀方手牌",
            assassinMinusCard: "刺杀方下一回合少抽一张牌",
            placeUnrest: "放置动荡：{space}",
            rebellionTarget: "叛乱目标：{space}",
            noRebellionTarget: "无合法目标，完成叛乱",
            finishRebellion: "完成叛乱",
            expandControl: "扩展控制：{space}",
            placeJesuit: "耶稣会士：{space}",
            finishJesuitEvent: "完成耶稣会士事件",
            northernConvert: "北方崛起：{space} 改为天主教",
            noOtherRegionContinue: "没有其他合法地区，继续结算",
            endConversions: "结束转化",
            massacreConvert: "大屠杀：{space} 改为天主教",
            freeAssassinateColigny: "免费刺杀科利尼（{cp} CP）",
            skipAssassination: "放弃刺杀",
            northernUnrest: "北方崛起：在 {space} 放置动荡",
            noOtherRegionDone: "没有其他合法地区，完成事件",
            moveJesuit: "移动耶稣会士：{space}",
            addRegularTo: "增加 1 正规军：{space}",
            addGalleyTo: "增加 1 桨帆船：{space}",
            addRegularPersia: "增加 1 正规军：波斯境外战争",
            recruitFour: "增募 4 个正规军／桨帆船",
            attemptSuez: "尝试建造苏伊士运河",
            allowEventResolution: "允许事件结算",
            playCatherinePrivateer: "打出凯瑟琳的飞剪船，取消事件",
            playJeanneOfNavarre: "打出纳瓦拉的珍妮，取消事件",
            playGrandVizierCancel: "打出大维齐尔，取消事件",
            removeFleet: "移除舰队：{space} {kind}",
            allowRandomDraw: "允许对方随机抽取 1 张手牌",
            giveOttomanPiracyVp: "给予奥斯曼 1 海盗 VP",
            ottomanPiracyVpMinusOne: "奥斯曼海盗 VP 减少 1",
            noMilanDeployment: "不进行米兰部署",
            selectedUnit: "{owner} {unit}（已选 {count}）",
            addUnit: "增加",
            removeUnit: "减少",
            selectLeader: "选择随军将领：{leader}",
            deselectLeader: "取消随军将领：{leader}",
            deployTo: "部署至 {space}（{count} 陆军）",
            addHomeRegular: "增加 1 名家乡势力正规军",
            noRegular: "不增加正规军",
            refuseTribute: "拒绝进贡",
            offerTribute: "提出进贡 1 张随机手牌",
            acceptTribute: "接受进贡，取消宣战并抽牌",
            rejectTribute: "拒绝进贡，继续宣战",
            noPayment: "不支付，失去正规军",
            payCard: "支付 {card}，保留最多 {count} 正规军",
            discardRandomCard: "随机弃 1 张手牌",
            skipAndRecallLeader: "跳过下次行动轮次并召回一名将领",
            noLeaderMove: "不移动将领",
            noExtraBenefit: "不领取额外奖励",
            playHolyLeague: "取回并立即打出 Holy League",
            resolveTrack: "决议 {track} 的外交状态",
            investInfluence: "向 {track} 投入 1 影响力",
            declareWarOn: "向 {target} 宣战",
            removeInfluence: "移除 {target} 对 {track} 的影响力",
            drawRandomFromOttoman: "从奥斯曼随机抽取 1 张牌",
            powerOttoman: "奥斯曼帝国",
            powerSpain: "西班牙",
            allowAction: "允许行动",
            playStorms: "打出 Storms，中断行动",
            playSultansHarem: "打出 Sultan's Harem，奥斯曼跳过下次行动轮次",
        
            interceptFrom: "从",
            finishInterception: "结束拦截选择",},
        eventTargets: {
            vq030: "spain:return:alba 或 france:skip",
            vq053: "peace:france、give:france:vq-020 或 move:paris",
            vq059: "cut:spain（剪除本国板上的西班牙密探）、upgrade 或留空获得 5CP",
            exampleSeparator: "：",
            abjurationAlliedAt: "：在 ",
            abjurationAlliedSuffix: " 结盟 · ",
            polishBidHint: "选王出价（每个势力可选一张手牌或一件财宝，留空为自动）",
            polishBid: "出价",
            armyMutinyHint: "军队哗变目标（选择地区，再选择该地区陆军堆叠所属势力）",
            parenOpen: "（",
            parenClose: "）",
            listSeparator: "，",
        },
        actionUi: {
            clickCityDetail: "在地图上点击城市查看详情。",
            clickTargetCity: "在地图上点击目标城市执行行动。",
            originSelected: "已选择起点：",
            cancelOrigin: "取消起点",
            maryInfluence: "玛丽：+4 苏格兰影响力",
            dragutFallsRoll: "德拉古特之死：掷骰",
            staffordCancel: "斯塔福德：取消沃尔辛厄姆",
            foreignWarSetup: "境外战争部署",
            foreignWarSetupHint: "选取 3–8 个本国陆军单位；可从多个未被围困的城市调集，并可带一名陆军将领。",
            clear: "清空",
            leaderOptional: "随军将领（可选）",
            noLeader: "不带将领",
            commitForce: "派出部队",
            foreignWarActive: "境外战争进行中",
            ourSide: "我方",
            enemySide: "敌方",
            men: "人",
            leader: "将领",
            fight: "作战 (1 CP)",
            reinforce: "增援",
            religionActions: "宗教行动",
        },
        empire: {
            minorInfluenceDiplomacy: "小国影响力与外交",
            minorInfluenceNote: "购买影响力每枚 1 CP；事件或对小国宣战触发外交决议，同一小国每回合只能决议一次。",
            minorAlly: "盟友",
            influence: "影响力",
            resolvedThisTurn: "本回合已决议",
            espionageTable: "谍报 · 官方 Espionage Table",
            espionageNote: "第 3 回合起开放。情报与派遣人员各 2 CP；刺杀 2–4 CP，天主教叛乱 3–5 CP，两者共用每回合一次标记。",
            spyFromPool: "使用人员池中的间谍",
            moveSpyAt: "调动在",
            moveSpySuffix: "的间谍",
            deploySpy: "派遣／调动间谍 (2 CP)",
            gainIntelligence: "获取情报 (2 CP)",
            assassinationTarget: "刺杀目标",
            targetElizabeth: "伊丽莎白一世",
            targetRudolf: "鲁道夫二世 (布拉格)",
            attemptAssassination: "尝试刺杀",
            jesuitsOnCard: "耶稣会士：势力卡",
            england: "英格兰",
            jesuitsCapNote: "总上限 5。选中英格兰地区后可派遣。",
            deployJesuitTo: "派遣耶稣会士到",
            selectedRegion: "选中地区",
            englishCatholicRebellion: "英格兰天主教叛乱",
            informantSep: "：",
            informantNeutralized: "已无效化，冬季回收",
            informantActive: "+2 攻击骰",
            informantPending: "下次行动轮次起生效",
        },
        worldUi: {
            title: "世界地图 · 探险与殖民",
            intro: "海域按已录入的粗略邻接关系逐区航行；危险航路、贸易风、殖民地与西班牙巡逻/要塞、世界海盗已接入自动结算。",
            damaged: "受损",
            carryingColony: "携带殖民地",
            vacant: "空置",
            controls: "控制",
            fortress: "要塞",
            spanishPatrols: "西班牙巡逻舰",
            buildPatrol: "建造巡逻舰 (2 CP)",
            buildFortress: "建要塞 (2 CP)",
            sailTo: "航行至",
            foundColony: "建立殖民地",
            worldPiracy: "世界海盗 (2 CP)",
            expeditionCaptain: "探险船长",
            buildExpedition: "建立探险队",
            carryColony: "携带殖民地",
            patronageTitle: "赞助（每回合各一位）",
            markersLeft: "剩余 VP 标记",
            artist: "艺术家",
            scientist: "科学家",
            markerCount: " 枚",
            markersTotal: "共",
            artistAwards: "艺术奖励",
            scientistAwards: "科学奖励",
            removedInScenario: "本场景移除",
            investCp: "投入 CP",
            ratingPending: "评级待录",
            rating: "评级",
            seaCaptains: "船长",
            scienceBonusesEarned: "已获得的科学奖励",
            piracyTitle: "海盗 (1 CP)",
            seaZone: "海域",
            target: "目标",
            launchPiracy: "发动海盗",
        },
        diplomacyUi: {
            betrothal: "王室联姻",
            proposal: "提议联姻：",
            accept: "同意",
            reject: "拒绝",
            waitingPrefix: "等待",
            waitingSuffix: "回应联姻提议…",
            domesticRoyal: "本国王室",
            foreignRoyal: "外国王室",
            male: "男",
            female: "女",
            samePowerMarriage: "（同国联姻）",
            louiseNote: "同国联姻：洛林的路易丝（#95）可与本国男性王室成婚。",
            propose: "提议联姻",
            ransom: "赎回被俘将领",
        },
        springUi: {
            deployHint: "春季部署：可从首都免费调动一支陆军编队。",
            deployHintChoice: "春季部署：先秘密选择本回合保留的本国牌（未选中的面朝下放在势力卡上），然后可从首都免费调动一支陆军编队。",
            seaCaptain: "海船长",
            commandLimit: "指挥上限：{count} 个单位",
            overCapacity: "已超过指挥上限",
        },
        religionActions: {
            preachEngland: "布道：英格兰 (2 CP)",
            preachFrance: "布道：法国 (2 CP)",
            preachNetherlands: "布道：尼德兰 (2 CP)",
            preachScotland: "布道：苏格兰 (2 CP)",
            suppressEngland: "镇压：英格兰 (2 CP)",
            suppressFrance: "镇压：法国 (2 CP)",
            suppressNetherlands: "镇压：尼德兰 (2 CP)",
            suppressScotland: "镇压：苏格兰 (2 CP)",
        },
        shellUi: {
            panelsAria: "对局分区",
        },
        punct: {
            period: "。",
            comma: "，",
            colon: "：",
            list: "、",
            semicolon: "；",
            openParen: "（",
            closeParen: "）",
        },},
};

export default zh_CN;
