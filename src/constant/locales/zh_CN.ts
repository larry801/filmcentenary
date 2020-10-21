import {Locale} from './en';
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
    4: "任意"
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
    'E01': '好菜坞的建立',
    'E02': '摄影机专利案',
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
    'E14': '新煤介',
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
    '1208': '大都会',
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
    '2101': '古典好莱坞',
    '2102': '约翰·福特',
    '2103': '阿尔弗雷德·希区柯克',
    '2104': '黑色电影',
    '2105': '奥尔逊威尔斯',
    '2106': '乱世佳人',
    '2107': '关山飞渡',
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
    '2308': '静静的顿河',
    '2309': '大地',
    '2401': '黑泽明',
    '2402': '蔡楚生',
    '2403': '小城之春',
    '2404': '—江春水向东流',
    '2405': '东京物语',
    '2406': '七武士',
    '2407': '大地之歌',
    '2408': '神女',
    '2409': '人间的条件',
    '2410': '我这一辈子',
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
    '3304': '战争与和平',
    '3305': '地下',
    '3306': '桥',
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
    '3407': '寅次郎的故事',
    '3408': '红高粱',
    '3409': '芙蓉镇',
    '3410': '侠女',
    '3411': '西便制',
    '3412': '青春残酷物语',
    '3413': '风柜来的人',
    '3414': '樱桃的滋味',
};
const eventName = {
    'E01': '【好莱坞】建筑位可以修建建筑 每个公司升级工业等级或美学等级1级',
    'E02': '每个公司获得2存款 每个公司弃掉1张牌 *【托马斯·爱迪生】或【卢米埃尔兄弟】响应',
    'E03': '每个公司立刻获得第2个行动力(注意！并非行动力+1)  *若这张牌因为过时代而被弃掉，事件立刻触发',
    'E04': '声望最高的公司可以免费购买1张【商业片】并置入手牌 每个公司免费购买1张【传世经典】',
    'E05': '每个公司获得3存款 北美有建筑的公司弃掉2张牌',
    'E06': '声望最高的公司升级1级美学等级 每个公司免费购买1张【传世经典】',
    'E07': '每个公司升级工业等级或美学等级1级 声望不是最高的公司免费购买1张【烂片】',
    'E08': '每个公司将1张手牌置入档案馆，如果该公司在东欧地区有建筑，则该公司获得这张牌的声望 东欧地区没有建筑的公司免费购买1张【烂片】，东欧地区第二个建筑位可以修建建筑',
    'E09': '【宝莱坞】建筑位可以修建建筑 美学等级最低的公司升级1级美学等级 工业等级最低的公司升级1级工业等级',
    'E10': '终局计分时：每有一个声望条数字比你高的公司， 你额外获得4声望',
    'E11': '终局计分时：公司牌库里和档案馆里的每个人物获得4声望',
    'E12': '终局计分时：公司按照工业等级和美字等级的总和获得声望',
    'E13': '终局计分时：若公司获得过4/3/2/1个不同地区的第一，则你得到20/12/6/2声望',
    'E14': '终局计分时：公司档案馆和牌库里的每张基础牌牌获得1声望',
};



const argCardName = {
    a: (value: string = "E02") => {
        return getCardName(value)
    }
};
const bracketCardName = (id: string = "E02") => {
    return `【${getCardName(id)}】`
};
const argValue = {a: (value: number = 1): string => value.toString()};
const chose = "选择了"
const argShowBoardStatus = {
    args: (arg: IShowBoardStatusProps[]): string => {
        let t = "牌列中有";
        if (arg[0].regions.length > 0) {
            arg[0].regions.forEach((r, idx) => {
                t += region[idx as validRegion];
                t += '：';
                if (r.legend.card !== null) {
                    t += "传奇："
                    t += bracketCardName(r.legend.card)
                }
                if (r.normal.filter(s=>s.card!==null).length > 0) {
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
        if(a==="yes"){
            return "选择执行效果"
        }else{
            return "选择不执行效果"
        }
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
    args:(arg:IShowCompetitionResultArgs[]): string=>{
        let i = arg[0].info;
        let t = "争夺情况："
        if(i.atkCard===null){
            t += "发起方没有出牌，"
        }else {
            t += `发起方打出${bracketCardName(i.atkCard)}，`
        }
        if(i.defCard===null){
            t += "应对方没有出牌，"
        }else {
            t += `应对方打出${bracketCardName(i.defCard)}，`
        }
        let progress = i.progress;
        if (progress > 5) progress = 5;
        if (progress < -5) progress = -5;
        t += `争夺进度：${progress}，`
        if (i.progress >= 3) {
            t += "发起方获胜"
        } else {
            if (i.progress <= -3) {
                t += "应对方获胜"
            } else {
                t += "无人获胜"
            }
        }
        return t;
    }
}
const argPeek = {
    args: (arg: IPeekArgs[]) => {
        const a = arg[0];
        let t = "展示牌堆顶端";
        a.shownCards.forEach(c=>t+=bracketCardName(c));
        if(a.card!==null){
            t+= `选择了${bracketCardName(a.card)}加入手牌`
        }
        return t;
    }
}
const argDrawCard = {
    args: (arg: []): string => {
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
    args: (arg: []): string => {
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
    args:(arg: IPayAdditionalCostArgs[]) =>{
        let t = "用"
        const a= arg[0];
        if(a.res > 0){
            t += `${a.res}资源`
        }
        if(a.deposit > 0){
            t += `${a.deposit}存款`
        }
        t += "支付了额外费用"
        return t
    }
}
const argCompetitionCard = {
    args: (arg: ICompetitionCardArg[]): string => {
        return "打出一张牌用于争夺"
    }
}
const argUpdateSlot = {
    args: (arg: string[]): string => {
        let a = arg[0]
        let t = "更新了"
        t += bracketCardName(a)
        return t
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
    1:"第一",
    2:"第二",
    3:"第三",
}
const zh_CN: Locale = {
    drawer: {
        singlePlayer: "单人对战AI(2玩家)",
        singlePlayer3p: "单人对战AI(3玩家)",
        singlePlayer4p: "单人对战AI(4玩家)",
        twoPlayer: "本地2人",
        threePlayer: "本地3人",
        fourPlayer: "本地4人",
        lobby: "多人大厅",
        cards: "卡表",
    },
    eventName: eventName,
    region: region,
    action: {
        adjustInSlider:"用下面的滑块调整支付额外费用的存款或资源",
        payAdditionalCost:"支付额外花费",
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
        showCompetitionResult:"展示争夺结果",
        endTurn: "结束回合",
        turnEnd: ["第{{a}}回合结束",argValue],
        endPhase: "结束阶段",
        undo: "撤销",
        redo: "恢复",
    },
    title:"电影百年",
    lobby: {
        numPlayers:"玩家数",
        title: "大厅",
        join: "加入",
        play: "开始",
        leave: "离开",
        exitMatch: "退出游戏",
        exitLobby: "退出大厅",
        cannotJoin: "无法加入，已经在其他游戏中",
        createPublicMatch: "创建公开游戏",
        createPrivateMatch: "创建私密游戏",
        shareLink:"其他玩家用下面的链接加入游戏：",
    },
    gameOver: {
        title: "游戏结束",
        winner: "胜利：",
        table:{
            board:"面板",
            card:"卡牌",
            building:"建筑",
            iAward:"工业大奖",
            aesAward:"美学大奖",
            archive:"档案馆",
            events:"计分效果",
            total:"总分",
        },
        reason:{
            threeNAChampionAutoWin:"三个北美第一",
            championCountAutoWin:"满足自动胜利要求的第一数量",
            finalScoring:"终局计分",
        },
        rank: {
            0: "第一:",
            1: "第二:",
            2: "第三",
            3: "第四",
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
        confirmRespond:["{{args}}",argConfirmRespond],
        payAdditionalCost:["{{args}}",argPayAdditionalCost],
    },
    effect: {
        archiveToEEBuildingVP:"每个公司将1张手牌置入档案馆，如果该公司在东欧地区有建筑，则该公司获得这张牌的声望",
        payAdditionalCost :["额外支付{{res}}{{deposit}}",{
            deposit: (value: number = 1): string => {
                if(value>0){
                        return `${value}存款`
                }else {
                    return ""
                }
            },
            res: (value: number = 1): string => {
                if(value>0){
                    return `${value}资源`
                }else {
                    return ""
                }
            },
        }],
        industryAndAestheticsBreakthrough:"选择工业和美学突破",
        industryOrAestheticsLevelUp:"升级工业等级或美学等级1级",
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
        doNotLoseVpAfterCompetition: "争夺失败后，不会失去声望",
        discardInSettle: "如果你在一张牌的结算过程中至少弃掉了一张牌",
        onAnyOneComment: "每当发生评论后，",
        industryToVp: "按照你的工业等级获得声望",
        aestheticsToVp: "按照你的美学等级获得声望",
        threeCards: "你的每3张牌额外获得1声望",
        northAmericaFilm: "你的每张北美影片额外获得2声望",
        asiaFilm: "你的每张亚洲影片额外获得2声望",
        industryNormalOrLegend: "每张有工业标志的普通牌和传奇牌额外获得2声望",
        westEuropeCard: "你的每张西欧卡牌额外获得2声望",
        eastEuropeFilm: "你的每张东欧影片额外获得2声望",
        industryLevel: "你的每个工业等级额外获得2声望",
        aestheticsLevel: "你的每个美学等级额外获得2声望",
        personCard: "你的每张人物牌额外获得4声望",
        aesClassic: "每张有美学标志的普通牌和传奇牌额外获得2声望",
        NewYorkSchool: "若你的美学等级不低于工业等级，美学奖励一次，若你的工业等级不低于美学等级，工业奖励一次",
        obtainNormalOrLegendFilm: "每次获得普通影片或传奇影片时",
        none: "",
        breakthroughResDeduct: ["突破一次，少花费{{a}}资源", argValue],
        handToOthers: ["把{{a}}张手牌交给任意公司", argValue],
        buyNoneEEFilm: "购买非东欧地区影片时",
        extraVp: ["额外支付{{a}}声望", argValue],
        breakthroughPrevent: "，否则不能执行突破效果",
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
                        return `把其中${era[e.a as IEra]}时代的`
                    case "asia":
                        return "把其中亚洲地区的"
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
                    if(e.e === "anyRegionShare"){
                        return "若这次争夺获胜你额外获得一个任意地区份额"
                    }else {
                        return "若这次争夺获胜你额外获得一个" + region[e.r as Region] + "地区份额"
                    }
                } else {
                    return "";
                }
            }
        }],
        loseVp: ["失去{{a}}声望", argValue],
        loseDeposit: ["失去{{a}}存款", argValue],
        competitionStart: "争夺开始时，",
        competitionBonus: ["竞争力+{{a}}", argValue],
        archive: ["将{{a}}张手牌置入档案馆", argValue],
        resFromIndustry: "按照你的工业等级获得资源",
        resFromAesthetics: "按照你的美学等级获得资源",
        atBreakthrough: "你突破后，",
        aesAward: ["执行美学奖励{{a}}次", argValue],
        industryAward: ["执行工业奖励{{a}}次", argValue],
        draw: ["摸{{a}}张牌", argValue],
        discard: ["弃{{a}}张牌", argValue],
        searchAndArchive: ["检索【{{a}}】并置入档案馆",argCardName],
        discardNormalOrLegend: ["弃掉{{a}}张普通或传奇牌", argValue],
        discardIndustry: ["弃掉{{a}}张带有工业标志的手牌", argValue],
        discardAesthetics: ["弃掉{{a}}张带有美学标志的手牌", argValue],
        allNoStudioPlayer: ["所有{{a}}地区没有制片厂的公司，", argRegion],
        vp: ["{{a}}声望", argValue],
        addVp: ["获得{{a}}声望", argValue],
        addExtraVp: ["额外获得{{a}}声望", argValue],
        res: ["{{a}}资源", argValue],
        addRes: ["获得{{a}}资源", argValue],
        deposit: ["{{a}}存款", argValue],
        loseAnyRegionShare: ["归还{{a}}个任意地区的份额", argValue],
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
        deductRes: ["少花费{{a}}资源", argValue],
        buyAesthetics: "购买有美学标志的影片时，",
        extraEffect: "额外效果：",
        loseVpRespond: "任何时候，当你失去1声望时，",
        othersBuySchool: "其他公司购买【流派】时，",
        turnStart: "每回合开始时，",
        studio: "本地区有制片厂的公司，",
        building: "本地区有建筑的公司，",
        noStudio: "指定一个本地区没有制片厂的公司，",
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
    era: era,
    setup: "补充初始排列",
    dialog: {
        competitionCard:{
            title: "请选择一张手牌参与争夺",
            toggleText: "争夺",
        },
        chooseHand: {
            title: "请选择一张手牌执行效果",
            toggleText: "选择手牌",
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
            title: "请选择是否执行效果",
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
    hand: {
        title: "手牌"
    },
    pub: {
        lastRoundOfGame:"最后一轮",
        revealedHand: "展示手牌",
        deck:"牌堆",
        champion: "第一：",
        gameLog: "战报",
        emptyBuildingSlot: "空",
        cinemaORStudio: "电影院/制片厂",
        studio: "制片厂",
        cinema: "电影院",
        bollywood: "宝莱坞",
        hollywood: "好莱坞",
        twoToFourPlayer: "2-4 玩家",
        threeToFourPlayer: "3-4 玩家",
        fourPlayerOnly: "4 玩家",
        handSize: "手牌数",
        estimatedFinalScore: "终局分数",
        events: "事件牌区：",
        res: "资源：",
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
            era: (e:IEra):string=>(era[e] + "时代"),
            rank: (rankNum:1|2|3):string=>rank[rankNum],
            region: (r:Region):string=>region[r],
        }],
    },
    card: cards,

};

export default zh_CN;
