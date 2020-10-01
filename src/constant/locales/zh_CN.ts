import {Locale} from './en';
import {BasicCardID, IEra, Region} from "../../types/core";

const era ={
    0:"发明",
    1:"古典",
    2:"现代",
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
    }}
const cards = {
    "B01": "文艺片",
    "B02": "商业片",
    "B03": "B级片",
    "B04": "烂片",
    "B05": "传世经典",
    "B06": "血本无归的影片",
    "B07": "资金",
    'E01':'好菜坞的建立',
    'E02':'摄影机专利案',
    'E03':'先锋派运动',
    'E04':'奥斯卡奖',
    'E05':'派拉蒙判决',
    'E06':'戛纳电影节',
    'E07':'《电影手册》',
    'E08':'解冻时期',
    'E09':'宝菜坞的崛起',
    'E10':'《海斯法典》解体',
    'E11':'电影作者论',
    'E12':'世界电影新浪潮',
    'E13':'全球化',
    'E14':'新煤介',
    '1101':'大卫·格里菲斯',
    '1102':'托马斯·爱迪生',
    '1103':'党同伐异',
    '1104':'火车大劫案',
    '1105':'爵士歌王',
    '1106':'将军号',
    '1107':'淘金记',
    '1108':'北方的纳努克',
    '1109':'金刚',
    '1110':'贪婪',
    '1201':'乔治·梅里爱',
    '1202':'卢米埃尔兄弟',
    '1203':'表现主义',
    '1204':'瑞典学派',
    '1205':'诺斯费拉杜',
    '1206':'贞德蒙 难记',
    '1207':'月球旅行记',
    '1208':'大都会',
    '1209':'幽灵马车',
    '1210':'工厂大门',
    '1211':'吉斯公爵遇剌记',
    '1301':'蒙太奇学派',
    '1302':'谢尔盖·爱森斯坦',
    '1303':'电影眼睛派',
    '1304':'母亲',
    '1305':'战舰波将金',
    '1306':'持摄影机的人',
    '1307':'谢尔盖神父',
    '2101':'古典好莱坞',
    '2102':'约翰·福特',
    '2103':'阿尔弗雷德·希区柯克',
    '2104':'黑色电影',
    '2105':'奥尔逊威尔斯',
    '2106':'乱世佳人',
    '2107':'关山飞度',
    '2108':'雨中曲',
    '2109':'公民凯恩',
    '2110':'白热',
    '2111':'日落大道',
    '2112':'宾虚',
    '2113':'马耳他之鹰',
    '2114':'迷魂记',
    '2201':'新现实主义',
    '2202':'费德里科·费里尼',
    '2203':'大卫·里恩',
    '2204':'诗意现实主义',
    '2205':'让·雷诺阿',
    '2206':'游戏规则',
    '2207':'偷自行车的人',
    '2208':'M就是凶手',
    '2209':'大路',
    '2210':'乡村牧师日记',
    '2211':'拿破仑',
    '2212':'巴黎屋檐下',
    '2213':'恐惧的代价',
    '2214':'阿拉伯的劳伦斯',
    '2301':'社会主义现实主义',
    '2302':'米哈伊尔·卡拉托佐夫',
    '2303':'夏伯阳',
    '2304':'士兵之歌',
    '2305':'雁南飞',
    '2306':'下水道',
    '2307':'被遗忘的祖先的阴影',
    '2308':'静静的顿河',
    '2309':'大地',
    '2401':'黑泽明',
    '2402':'蔡楚生',
    '2403':'小城之春',
    '2404':'—江春水向东流',
    '2405':'东京物语',
    '2406':'七武士',
    '2407':'大地之歌',
    '2408':'神女',
    '2409':'浮云',
    '2410':'我这一辈子',
    '3101':'新好莱坞电影',
    '3102':'史蒂文·斯皮尔伯格',
    '3103':'教父',
    '3104':'星球大战',
    '3105':'纽约派',
    '3106':'马丁·斯科塞斯',
    '3107':'罗杰·科曼',
    '3108':'泰坦尼克号',
    '3109':'2001太空漫游',
    '3110':'驱魔人',
    '3111':'邦尼和克莱德',
    '3112':'出租车司机',
    '3113':'夺宝奇兵',
    '3114':'最长的一码',
    '3115':'虎豹小霸王',
    '3116':'闪灵',
    '3201':'新浪潮',
    '3202':'弗朗索瓦·特吕弗',
    '3203':'英格玛·伯格曼',
    '3204':'左岸派',
    '3205':'独行杀手',
    '3206':'陆上行舟',
    '3207':'去年在马里昂巴德',
    '3208':'八部半',
    '3209':'朱尔与吉姆',
    '3210':'007：黄金眼',
    '3211':'流浪艺人',
    '3212':'假面',
    '3213':'小孩与鹰',
    '3301':'安德烈·塔尔科夫斯基',
    '3302':'尼基塔·米哈尔科夫',
    '3303':'战争与和平',
    '3304':'地下',
    '3305':'西伯利亚理发师',
    '3306':'办公室的故事',
    '3307':'蓝',
    '3308':'红军与白军',
    '3309':'索拉里斯',
    '3310':'普通法西斯',
    '3311':'钻石胳膊',
    '3312':'乱世英豪',
    '3401':'张艺谋',
    '3402':'王家卫',
    '3403':'阿巴斯·基亚罗斯塔米',
    '3404':'悲情城市',
    '3405':'重庆森林',
    '3406':'英雄本色',
    '3407':'寅次郎的故事',
    '3408':'红高粱',
    '3409':'芙蓉镇',
    '3410':'空山灵雨',
    '3411':'太白山脉',
    '3412':'青春残酷物语',
    '3413':'小鞋子',
    '3414':'樱桃的滋味',
};
const eventName = {
    'E01':'【好莱坞】建筑位可以修建建筑 每个公司升级工业等级或美学等级1级',
    'E02':'每个公司获得2存款 每个公司弃掉1张牌 *【托马斯，爰迪生】或【卢米埃尔兄弟】响应',
    'E03':'每个公司立刻获得第2个行动力(注意！并非行动 力+1)  *若这张牌因为过时代而被弃掉，事件立刻触发',
    'E04':'声望最高的公司可以免赛购买1张【商业片】并置入手牌 每个公司免赛购买1张【传世经典】',
    'E05':'每个公司获得3存款 北美有建筑的公司弃掉2张牌',
    'E06':'声望最高的公司升级1级美学等级 每个公司免费购买1张【传世经典】',
    'E07':'每个公司升级工业等级或美学等级1级 声望不是最高的公司免费购买1张【烂片】',
    'E08':'每个公司将1张手牌置入档案馆，如果该公司在东欧地区有建筑，则该公司获得这张牌的声望 东欧地区没有建筑的公司免费购买1张【烂片】',
    'E09':'【宝莱坞】建筑位可以修建建筑 美学等级最低的公司升级1级美学等级 工业等级最低的公司升级1级工业等级',
    'E10':'终局计分时：每有一个声望条数字比你高的公司， 你额外获得4声望',
    'E11':'终局计分时：公司牌库里和档案馆里的每个人物获得4声望',
    'E12':'终局计分时：公司按照工业等级和美字等级的总和获得声望',
    'E13':'终局计分时：若公司获得过4/3/2/1个不同地区的第一，则你得到20/12/6/2声望',
    'E14':'终局计分时：公司档案馆和牌库里的每张基础牌牌获得1声望',
};
const argCardName = {
    a: (value: string = "E02") => {
        return cards[value as BasicCardID]
    }
};
const argValue = {a: (value: number = 1):string => value.toString()};

const zh_CN: Locale = {
    eventName:eventName,
    region: region,
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
        undo:"撤销",
        redo:"恢复",
    },
    lobby:{
        title:"大厅",
        join:"加入",
        play:"开始",
        leave:"离开",
        exitMatch:"退出游戏",
        exitLobby:"退出大厅",
        cannotJoin:"无法加入，已经在其他游戏中。",
    },
    effect:{
        era:{
            0: "1时代：",
            1: "2时代：",
            2: "3时代：",
        },
        optional:"【可选】",
        onYourComment:"你评论后,",
        playedCardInTurnEffect:"执行你本回合打出的另一张带有美学标志的牌的【出牌】效果",
        everyOtherCompany:"每个其他公司",
        doNotLoseVpAfterCompetition:"争夺失败后，不会失去声望",
        discardInSettle:"如果你在一张牌的结算过程中至少弃掉了一张牌",
        onAnyOneComment:"每当发生评论后，",
        industryToVp:"按照你的工业等级获得声望",
        aestheticsToVp:"按照你的美学等级获得声望",
        threeCards:"你的每三张牌额外获得1声望",
        northAmericaFilm:"你的每张东欧影片额外获得2声望",
        asiaFilm:"你的每张亚洲影片额外获得2声望",
        industryNormalOrLegend:"每张有工业标志的普通牌和传奇牌额外获得2声望",
        westEuropeCard:"你的每张西欧卡牌额外获得2声望",
        eastEuropeFilm:"你的每张东欧影片额外获得2声望",
        industryLevel:"你的每个工业等级额外获得2声望",
        aestheticsLevel:"你的每个美学等级额外获得2声望",
        personCard:"你的每张人物牌额外获得4声望",
        aesClassic:"每张有美学标志的普通牌和传奇牌额外获得2声望",
        NewYorkSchool:"若你的美学等级不低于工业等级，美学奖励一次，若你的工业等级不低于美学等级，工业奖励一次",
        obtainNormalOrLegendFilm:"每次获得普通影片或传奇影片时",
        onBreakthrough:"突破时，",
        none:"",
        breakthroughResDeduct:["突破一次，少花费{{a}}资源",argValue],
        handToOthers:["把{{a}}张手牌交给任意公司",argValue],
        buyNoneEEFilm:"购买非东欧地区影片时",
        extraVp:["额外支付{{a}}声望",argValue],
        breakthroughPrevent:"，否则不能执行突破效果",
        alternative:"放弃本次突破改为",
        pay:"支付",
        update:["执行{{a}}次【更新】",argValue],
        noBuildingEE:"东欧地区没有建筑的公司",
        playerVpChampion:"声望最高的公司",
        playerNotVpChampion:"声望不是最高的公司",
        aesLowest:"美学等级最低的公司",
        industryLowest:"工业等级最低的公司",
        peek:["观看牌堆顶{{count}}张牌，{{filter}}{{target}}，然后弃掉其他的",{
            count: (value: number = 1) => {
                return  value.toString()
            },
            target:(e:string)=>{
                if(e === "hand")
                {
                    return "加入手牌"
                }else{
                    return "";
                }
            },
            filter: (e:any)=>{
                switch (e.e) {
                    case "choice":
                        return "选择其中"+ e.a.toString() + "张"
                    case "industry":
                        return "把其中有工业标志的"
                    case "era":
                        return "把其中"+ era[e.a as IEra] +"时代的"
                    case "asia":
                        return "把其中亚洲地区的"
                    case "aesthetics":
                        return "把其中有美学标志的"
                    default:
                        return ""
                }
            }}],
        competition: ["争夺一次{{bonus}}{{onWin}}", {
            // @ts-ignore
            bonus: (value: number = 0) => {
                if(value>0){
                    return "，竞争力+" + value.toString()
                }else {
                    return "";
                }
            },
            onWin: (e:any)=>{
                if(e.e !== "none")
                {
                    return "，若这次争夺获胜你额外获得一个" +  region[e.a as Region] +"地区份额"
                }else{
                    return "";
                }
            }}],
        loseVp:["失去{{a}}声望",argValue],
        loseDeposit:["失去{{a}}存款",argValue],
        competitionStart:"争夺开始时，",
        competitionBonus:["竞争力+{{a}}",argValue],
        archive:["将{{a}}张手牌置入档案馆",argValue],
        resFromIndustry:"按照你的工业等级获得资源",
        resFromAesthetics:"按照你的美学等级获得资源",
        atBreakthrough:"你突破后，",
        aesAward:["执行美学奖励{{a}}次",argValue],
        industryAward:["执行工业奖励{{a}}次",argValue],
        draw:["摸{{a}}张牌",argValue],
        discard:["弃{{a}}张牌",argValue],
        searchAndArchive:"检索此牌并置入档案馆",
        discardNormalOrLegend:["弃掉{{a}}张普通或传奇牌",argValue],
        discardIndustry:["弃掉{{a}}张带有工业标志的手牌",argValue],
        discardAesthetics:["弃掉{{a}}张带有美学标志的手牌",argValue],
        allNoStudioPlayer:["所有{{a}}地区没有制片厂的公司，",argRegion],
        vp:["{{a}}声望",argValue],
        res:["{{a}}资源",argValue],
        deposit:["{{a}}存款",argValue],
        loseAnyRegionShare:["归还{{a}}个任意地区的份额",argValue],
        shareToVp:["按照你当前持有的{{a}}份额获得声望",argRegion],
        share:["获得{{a}}个{{r}}地区的份额",argValue],
        shareNA:["获得{{a}}个北美地区的份额",argValue],
        shareWE:["获得{{a}}个西欧地区的份额",argValue],
        shareEE:["获得{{a}}个东欧地区的份额",argValue],
        shareASIA:["获得{{a}}个亚洲地区的份额",argValue],
        loseShareNA:["失去{{a}}个北美地区的份额",argValue],
        loseShareWE:["失去{{a}}个西欧地区的份额",argValue],
        loseShareEE:["失去{{a}}个东欧地区的份额",argValue],
        loseShareASIA:["失去{{a}}个亚洲地区的份额",argValue],
        anyRegionShare:["获得{{a}}个任意地区的份额",argValue],
        deductRes:["少花费{{a}}资源",argValue],
        buyAesthetics:"购买有美学标志的影片时，",
        extraEffect:"额外效果：",
        loseVpRespond:"失去声望时，",
        othersBuySchool:"其他公司购买【流派】时，",
        turnStart:"每回合开始时，",
        studio:"本地区有制片厂的公司，",
        building:"本地区有建筑的公司，",
        noStudio:"指定一个本地区没有制片厂的公司，",
        noBuilding:"指定一个本地区没有建筑的公司，",
        lose:["失去{{a}}时",argCardName],
        event:["当{{a}}发生后",argCardName],
        school:["手牌上限：{{hand}}行动力：{{action}}",{
            hand:undefined,
            action:undefined
        }],
        scoringHeader:"【计分】",
        continuous:"【持续】",
        playCardHeader:"【出牌】",
        buyCardHeader:"【购买】",
        breakthroughHeader:"【突破】",
        schoolHeader:"【流派】",
        responseHeader:"【响应】",
        choice:"请选择一项执行：",
        // @ts-ignore
        comment:["评论{{a}}次",argValue],
        // @ts-ignore
        industryBreakthrough:["工业突破{{a}}次",argValue],
        // @ts-ignore
        aestheticsBreakthrough:["美学突破{{a}}次",argValue],
        buy:["免费购买【 {{a}} 】",argCardName],
        buyCardToHand:["免费购买【{{a}}】并加入手牌",argCardName],
        industryLevelUp:["提升{{a}}级工业等级", {a: (value: number = 1) => value.toString()}],
        aestheticsLevelUp:["提升{{a}}级美学等级", {a: (value: number = 1) => value.toString()}],
        buildCinema:"建造电影院",
        buildStudioInRegion: ["在{{a}}建造制片厂", argRegion],
        buildCinemaInRegion: ["在{{a}}建造电影院", argRegion],
        buildStudio:"建造制片厂",
        refactor:"重构",
        skipBreakthrough:"跳过本次突破",
    },
    cancel:"取消",
    era:era,
    setup:"补充初始排列",
    dialog: {
        chooseHand:{
            title:"请选择一张手牌执行效果",
            toggleText:"选择手牌",
        },
        peek:{
            title:"查看牌堆顶",
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
            yes:"是",
            no:"否"
        },
    },
    playerName:{
        spectator:"旁观",
        player: "玩家",
    },
    confirm: "确认",
    hand: {
        title: "手牌"
    },
    pub: {
        handSize:"手牌数",
        estimatedFinalScore:"终局分数",
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
        era: "时代：",
        school: "流派：",
        discard: "弃牌",
        allCards: "所有卡牌",
        inferredHands: "推测手牌",
        archive: "档案馆",
        playedCards: "出牌",
    },
    score: {
        first: "第一",
        second: "第二",
        third: "第三",
        cardName: ['{{ear}}{{region}}{{rank}}',{
            era: undefined,
            rank: undefined,
            region: undefined,
        }],
    },
    card: cards,

};

export default zh_CN;
