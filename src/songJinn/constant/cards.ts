import {CardID, Country, EventDuration, IEra,JinnBasicCardID, SongBasicCardID} from "./general";
import {SongJinnGame} from "./setup";
import {Ctx} from "boardgame.io";

export const getFullDesc = (card: Cards): string => {

    let effText = "效果：" + card.effectText;
    if (card.precondition !== null) {
        effText = `${card.precondition} ${effText}`
    }
    if (card.ban !== null) {
        effText += `撤销：${card.ban}`
    }
    if (card.block !== null) {
        effText += `禁止：${card.ban}`
    }
    return effText;
}

export interface Cards {
    id: CardID,
    block: string | null
    name: string,
    country: Country,
    op: number,
    remove: boolean,
    era: IEra,
    duration: EventDuration,
    effectText: string,
    ban: string | null,
    precondition: string | null,
    combat: boolean,
    unlock: string | null
}

export const getCardById: (cid: SongBasicCardID) =>
    Cards = (cid: SongBasicCardID) => {
    return idToCard[cid];
}

export const idToCard ={
    [SongBasicCardID.S01]:{id:SongBasicCardID.S01,name:"建炎南渡",op:4,country:Country.SONG,era:IEra.E,remove:false,precondition:"宋国未控制开封",ban:null,block:null,unlock:"【苗刘兵变】",duration:EventDuration.CONTINUOUS,combat:false,effectText:"在两浙路或江南两路免费拥立。宋国获得1国力禁止金国以事件方式在两浙路放置部队。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S02]:{id:SongBasicCardID.S02,name:"李纲",op:3,country:Country.SONG,era:IEra.E,remove:false,precondition:"第7回合前",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"腐败值减1。本回合余下的时间内，政策倾向视为提升2级的状态（最高为主战3）。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S03]:{id:SongBasicCardID.S03,name:"靖康学生运动",op:3,country:Country.SONG,era:IEra.E,remove:false,precondition:"政策倾向为和议",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"腐败值变为0 ,每因此减少1点腐败值就提升1级政策倾向。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S04]:{id:SongBasicCardID.S04,name:"西军曲端",op:3,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"【三年之约】作为事件打出时行动点数减1。每当回合结束阶段时，宋国在陕西六路放置1个步兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S05]:{id:SongBasicCardID.S05,name:"天下兵马大元帅",op:3,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移动1个宋国军团到所在路内或相邻路内1座没有被围困的宋国城市。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S06]:{id:SongBasicCardID.S06,name:"霹雳炮",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个宋国控制的城市，放置1个霹雳炮。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S07]:{id:SongBasicCardID.S07,name:"一盆凉水",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:"夏季",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除斡离不。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S08]:{id:SongBasicCardID.S08,name:"张邦昌还政",op:3,country:Country.SONG,era:IEra.E,remove:false,precondition:"【靖康之变】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"金国在开封的军团移动到大同府或大定府，宋国在开封放置1个步兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S09]:{id:SongBasicCardID.S09,name:"耶律大石",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"西辽成为宋国的盟国。若西辽已经是宋国的盟国，消灭金国1个部队。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S10]:{id:SongBasicCardID.S10,name:"李彦仙",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1座被围困的城市放置1个步兵，或者消灭围城军团的1个部队。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S11]:{id:SongBasicCardID.S11,name:"勤王诏令",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:"宋国皇帝在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"宋国按照补充规则，在宋国控制且殖民难度大于金国殖民能力的城市，放置预备兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S12]:{id:SongBasicCardID.S12,name:"战车",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:"宗泽在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌在平原，宋国每个步兵战斗力加1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S13]:{id:SongBasicCardID.S13,name:"红巾军",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"金国每控制1个尚未殖民的城市，宋国就在隆德府放置1个步兵〔上限为宋国军事等级〕。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S14]:{id:SongBasicCardID.S14,name:"大理矮脚马",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"若大理中立，则征募1个骑兵。若大理是宋国的盟国，则效果翻倍且不受内政等级限制。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S15]:{id:SongBasicCardID.S15,name:"八字军",op:3,country:Country.SONG,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"在河北两路的1个区域，放置2个步兵。【刘錡】伤害加1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S16]:{id:SongBasicCardID.S16,name:"赵榛",op:2,country:Country.SONG,era:IEra.E,remove:false,precondition:"【靖康之变】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个未完成殖民的金国城市，放置2个步兵，这个城市所在的路结算控制权。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S17]:{id:SongBasicCardID.S17,name:"金太宗驾崩",op:4,country:Country.SONG,era:IEra.M,remove:false,precondition:"第5回合开始之后",ban:"【金太宗】",block:"【金太宗】",unlock:"【完颜昌主和】【天眷新政】",duration:EventDuration.CONTINUOUS,combat:false,effectText:"移除粘罕，选择金国内政等级、军事等级或殖民能力降低1级。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S18]:{id:SongBasicCardID.S18,name:"废黜伪齐",op:4,country:Country.SONG,era:IEra.M,remove:false,precondition:"【建立大齐】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除1个齐状态标志物，结算这个路的控制权，消灭2个齐军。若此时齐控制的城市不多于4个，则金国失去齐军征募许可。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S19]:{id:SongBasicCardID.S19,name:"岳飞登场",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国军事等级不低于4",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除宗泽，在准南两路或荆湖两路放置岳飞。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S20]:{id:SongBasicCardID.S20,name:"吴玠登场",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:"【西军曲端】",block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在陕西六路或川峡四路内的1个城市放置吴玠。若这座城市没有部队，则放置2个弓兵到该城市",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S21]:{id:SongBasicCardID.S21,name:"韩世忠登场",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国皇帝在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在宋国皇帝所在的区域放置韩世忠。若相邻区域有金国部队，则放置2个步兵到该城市。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S22]:{id:SongBasicCardID.S22,name:"无路可退",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国国力不大于7时",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"每当金国失去1点国力，宋国政策倾向提升1级。若事件发生时宋国国力不大于6 ,则立即在3个宋国控制的核心城市各放置1个步兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S23]:{id:SongBasicCardID.S23,name:"完顔昌主和",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:"【金太宗驾崩】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"降低金国1级军事等级。若兀术在场，则放置到预备兵区。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S24]:{id:SongBasicCardID.S24,name:"向海上发展",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国内政等级不低于5",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"福建路提供1国力。宋国可以从平江府向高丽进行外交。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S25]:{id:SongBasicCardID.S25,name:"背嵬军",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"征募2个背嵬军。若岳飞在场，则可以在岳飞所在区域，直接放置这2个背嵬军。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S26]:{id:SongBasicCardID.S26,name:"伪齐良马",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"齐每控制1个路，宋国就征募1个骑兵（不受内政等级限制〕。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S27]:{id:SongBasicCardID.S27,name:"任用赵鼎 张浚",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"腐败值减1。若腐败值已经为0 ,则提升1级政策倾向。发展阶段时，提供4点发展力。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S28]:{id:SongBasicCardID.S28,name:"锁江困敌",op:3,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"征募2个战船。若韩世忠在场，则可以在韩世忠所在区域，直接放置这2个战船。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S29]:{id:SongBasicCardID.S29,name:"招降",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌每消灭或击溃1个签军，就征募1个步兵，不受内政等级限制。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S30]:{id:SongBasicCardID.S30,name:"浮海逃生",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:"【搜山检海】",unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"当宋国失去皇帝时，可以移除这张牌，移动宋国皇帝到任意宋国控制的城市。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S31]:{id:SongBasicCardID.S31,name:"改进神臂弓",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国军事等级不低于5",ban:null,block:"【普及重步兵】",unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"宋国弓兵在全部地形战斗力变为2 ,征募消变为2。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S32]:{id:SongBasicCardID.S32,name:"普及重步兵",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国军事等级不低于5",ban:null,block:"【改进神臂弓】",unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"宋国步兵耐久度加1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S33]:{id:SongBasicCardID.S33,name:"杨沂中",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在宋国皇帝所在的区域放置1个步兵和1个弓兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S34]:{id:SongBasicCardID.S34,name:"金夏边境冲突",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"若西夏是宋国的盟国，则消灭总共2耐久的部队若西夏中立，则消灭总共1耐久的部队。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S35]:{id:SongBasicCardID.S35,name:"水浒赛",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在泰州地区放置1个战船，在准南两路消灭1个金国部队。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S36]:{id:SongBasicCardID.S36,name:"岳家军",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:"岳飞在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌参战军团中视为增加1个岳飞。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S37]:{id:SongBasicCardID.S37,name:"驻队矢",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌宋国远程部队在远程阶段和交锋阶段优先结算。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S38]:{id:SongBasicCardID.S38,name:"王庶",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:"【曲端之死】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在陕西六路和川峡四路每个宋国控制的城市，各放置1个【步兵】〔上限为宋国军事等级〕。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S39]:{id:SongBasicCardID.S39,name:"《守城录》",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:"宋国军团在城墙时",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌金国战斗骰点数减1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S40]:{id:SongBasicCardID.S40,name:"刘光世",op:2,country:Country.SONG,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"腐败值加1。使用这张牌的行动力执行征募和进军，若没有触发任何战斗，则用此牌执行发展。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S41]:{id:SongBasicCardID.S41,name:"岳帅之来此间震恐",op:4,country:Country.SONG,era:IEra.L,remove:false,precondition:"岳飞在场且宋国军事等级不低于6",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"宋国作战计划替换为【还我河山】。本回合内宋国所有战斗骰点数加1。当岳飞被移除时，此事件被撤销。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S42]:{id:SongBasicCardID.S42,name:"李显忠登场",op:3,country:Country.SONG,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"西夏向金国方向调整1级。在1个宋国控制的区域放置李显忠和2个骑兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S43]:{id:SongBasicCardID.S43,name:"刘錡",op:3,country:Country.SONG,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"掷骰1次，对1个围城军团造成等于掷骰点数的伤害。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S44]:{id:SongBasicCardID.S44,name:"吴璘登场",op:3,country:Country.SONG,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在陕西六路或川峡四路放置吴璘。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S45]:{id:SongBasicCardID.S45,name:"梁兴渡河",op:3,country:Country.SONG,era:IEra.L,remove:false,precondition:"岳飞在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"降低金国1级殖民能力，用此牌执行发展。发展阶段，此牌提供发展力等于金国占领但没有完成殖民的城市数量。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S46]:{id:SongBasicCardID.S46,name:"定都临安",op:2,country:Country.SONG,era:IEra.L,remove:false,precondition:"宋国皇帝在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移动宋国皇帝到钱塘，用此牌执行派遣。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S47]:{id:SongBasicCardID.S47,name:"告老迁乡",op:2,country:Country.SONG,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除银术可。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S48]:{id:SongBasicCardID.S48,name:"北谒宋陵",op:2,country:Country.SONG,era:IEra.L,remove:false,precondition:"宋国控制洛阳",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"用此牌执行发展，宋国摸1张牌。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S49]:{id:SongBasicCardID.S49,name:"燕京以南 号令不行",op:2,country:Country.SONG,era:IEra.L,remove:false,precondition:"宋国控制析津",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"放在宋国完成的作战计划堆最上面。绍兴和议时，宋国额外获得1胜利分数。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [SongBasicCardID.S50]:{id:SongBasicCardID.S50,name:"李宝",op:2,country:Country.SONG,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌 在宋国参战军团，放置1个战船。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J01]:{id:JinnBasicCardID.J01,name:"靖康之变",op:4,country:Country.JINN,era:IEra.E,remove:false,precondition:"宋国未控制开封",ban:null,block:null,unlock:"【金兵来了】【张邦昌还政】【赵榛】",duration:EventDuration.CONTINUOUS,combat:false,effectText:"宋国失去1国力。金国获得1国力，并提升1级内政等级。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J02]:{id:JinnBasicCardID.J02,name:"折可求献三州",op:3,country:Country.JINN,era:IEra.E,remove:false,precondition:"金国控制肤施",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在陕西六路消灭2个部队，并结算路控制权。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J03]:{id:JinnBasicCardID.J03,name:"韩昉",op:3,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"提升金国1级内政等级或殖民能力。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J04]:{id:JinnBasicCardID.J04,name:"杜充降金",op:3,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"消灭1个宋国部队，征募1个签军〔不能消灭皇帝或将领所在区域的部队〕。若【宗泽】不在场，则效果翻倍。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J05]:{id:JinnBasicCardID.J05,name:"金太宗",op:3,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"在补充阶段开始时可以使用1行动力征募。在发展阶段提供额外1发展力。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J06]:{id:JinnBasicCardID.J06,name:"苗刘兵变",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:"【建炎南渡】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"宋国选择以下一项执行：弃掉1张手牌，并移动1个和宋国皇帝相邻的军团到宋国皇帝所在区域；或者宋国失去皇帝。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J07]:{id:JinnBasicCardID.J07,name:"渡河！渡河！渡河！",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:"第2回合开始之后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除 宗泽",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J08]:{id:JinnBasicCardID.J08,name:"追亡逐北",op:3,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:"【耶律大石】",unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"移除西辽。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J09]:{id:JinnBasicCardID.J09,name:"济南知府刘豫",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:"【建立大齐】",duration:EventDuration.CONTINUOUS,combat:false,effectText:"在历城消灭灭全部宋国部队，放置2个签军。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J10]:{id:JinnBasicCardID.J10,name:"猛安谋克",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"使用3行动力征募。若降低1级殖民能力，则可以使用6行动力征募，且无视内政等级限制。不能征募签军。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J11]:{id:JinnBasicCardID.J11,name:"辽国旧部",op:3,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"金国每控制西京路、北京路、燕京路或东京路中的1个，就可以使用1行动力征募〔不受内政等级限制",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J12]:{id:JinnBasicCardID.J12,name:"六甲神兵",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个被围困的城市发动进攻，在远程阶段城防的作用改为：攻城方增加等于城防的战斗力，守城方减少等于城防的战斗力。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J13]:{id:JinnBasicCardID.J13,name:"金兵来了",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:"【靖康之变】发生后且金国军团与宋国皇帝处在相邻区域",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"禁止拥立。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J14]:{id:JinnBasicCardID.J14,name:"西军内斗",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:"吴玠或吴璘未参战，且战斗在陕西六路或川峡四路",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌宋国战斗骰点数减1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J15]:{id:JinnBasicCardID.J15,name:"河面封冻",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:"冬季",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"使用1行动力进军，不受河流边界限制。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J16]:{id:JinnBasicCardID.J16,name:"掠夺",op:2,country:Country.JINN,era:IEra.E,remove:false,precondition:"夏季或秋季",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"使用1行动力进军，不受补给限制。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J17]:{id:JinnBasicCardID.J17,name:"张赵之争",op:4,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:"【任用赵鼎张浚】",unlock:"【秦桧独相】【淮西军变】",duration:EventDuration.CONTINUOUS,combat:false,effectText:"放置1个在场的宋国将领到预备兵区或者宋国内政等级降低1级。【莫须有】结算时，金国内政等级视为提升1级的状态。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J18]:{id:JinnBasicCardID.J18,name:"建立大齐",op:4,country:Country.JINN,era:IEra.M,remove:false,precondition:"【济南知府刘豫】发生后",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"在3个金国控制的路，放置齐控制标志，齐控制的城市视为完成了殖民。金国获得齐军征募许可，齐军在任何结算时都同时视为签军。若金国军事等级不小于5 ,签军获得远程属性。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J19]:{id:JinnBasicCardID.J19,name:"兀朮登场",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除斡离不。在1个金国控制的区域放置兀术。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J20]:{id:JinnBasicCardID.J20,name:"银术可登场",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个金国控制的区域放置银术可。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J21]:{id:JinnBasicCardID.J21,name:"秦桧独相",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:"【张赵之争】发生后",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"宋国每回合开始时腐败值加1。【莫须有】结算时，金国内政等级视为再提升1级的状态。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J22]:{id:JinnBasicCardID.J22,name:"重点进攻",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移动1个金国军团到所在路内或相邻路内1座没有被围困的金国城市。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J23]:{id:JinnBasicCardID.J23,name:"三年之约",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:"夏季或秋季",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在陕西六路，使用本卡牌的行动力对任意没有宋国将领的军团执行进军。移除娄室。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J24]:{id:JinnBasicCardID.J24,name:"淮西军变",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:"【张赵之争】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在准南两路，消灭2个部队。征募2个步兵和1个战船（不受内政等级限制〕。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J25]:{id:JinnBasicCardID.J25,name:"烽火扬州路",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:"金国控制杨州地区",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"与另1张牌一起打出，行动点数合并计算。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J26]:{id:JinnBasicCardID.J26,name:"搜山检海",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:"宋国皇帝被围困",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"宋国失去皇帝。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J27]:{id:JinnBasicCardID.J27,name:"孤注一掷",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:"齐只控制1个路",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"降低1级殖民能力，在所有齐控制的城市，各放置1个签军和1个拐子马。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J28]:{id:JinnBasicCardID.J28,name:"唃厮啰入侵",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"若吐蕃中立，在川峡四路，放置1个步兵；若吐蕃是金国的盟国，则效果翻倍。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J29]:{id:JinnBasicCardID.J29,name:"天眷新政",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:"【金太宗驾崩】发生后",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"弃掉数是最多等于内政等级的手牌，然后从金国牌库摸取相等数畺的牌。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J30]:{id:JinnBasicCardID.J30,name:"不见来使",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"禁止宋国对高丽执行外交。若高丽是金国的盟国，则在发展阶段额外提供1发展力。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J31]:{id:JinnBasicCardID.J31,name:"曲端之死",op:3,country:Country.JINN,era:IEra.M,remove:false,precondition:"金国控制河东路或陕西六路",ban:"【西军曲端】",block:"【西军曲端】",unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"在陕西六路，消灭2个部队。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J32]:{id:JinnBasicCardID.J32,name:"火攻",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:"兀术在场",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌消灭1个参战的宋国战船。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J33]:{id:JinnBasicCardID.J33,name:"江淮流宼",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个宋国控制的路内，没有宋国军团的区域，放置1个签军和1个战船。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J34]:{id:JinnBasicCardID.J34,name:"胡服乡兵",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:"有签军参战",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌消灭1个参战的宋国步兵或弓兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J35]:{id:JinnBasicCardID.J35,name:"李成",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个有签军的军团内，放置2个步兵。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J36]:{id:JinnBasicCardID.J36,name:"徐州冶铁",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:"内政等级不低于5且控制京东两路",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"铁浮屠征募消耗变为1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J37]:{id:JinnBasicCardID.J37,name:"孔彦舟",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个有签军的军团内，放置1个战船。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J38]:{id:JinnBasicCardID.J38,name:"杀马为粮",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"替换1个金国骑行部队为步兵，这个步兵所在的军团立即进军，不受补给限制。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J39]:{id:JinnBasicCardID.J39,name:"徽宗病逝",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"若【靖康之变】已经发生，免费和议。若【靖康之变】没有发生，宋国随机弃掉1张手牌",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J40]:{id:JinnBasicCardID.J40,name:"南人归南 北人归北",op:2,country:Country.JINN,era:IEra.M,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"用此牌发展，提供发展力等于实时殖民能力的2倍",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J41]:{id:JinnBasicCardID.J41,name:"莫須有",op:4,country:Country.JINN,era:IEra.L,remove:false,precondition:"金国内政等级不低于7",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"降低2级政策倾向，消灭宋国总共4个部队。若此时政策倾向为和议，则移除岳飞。否则，放置岳飞到预备兵区。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J42]:{id:JinnBasicCardID.J42,name:"奔睹登场",op:3,country:Country.JINN,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"在1个金国控制的区域放置奔睹。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J43]:{id:JinnBasicCardID.J43,name:"天眷政变",op:3,country:Country.JINN,era:IEra.L,remove:false,precondition:"金国军事等级不低于5",ban:null,block:"【完颜昌主和】",unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"提升金国1级军事等级，本回合作战计划替换为【吴山立马】。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J44]:{id:JinnBasicCardID.J44,name:"十二道金牌",op:3,country:Country.JINN,era:IEra.L,remove:false,precondition:"政策倾向为和议",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"使用该卡牌的行动点数，对宋国军团执行进军，不能触发战斗，不能移动到缺乏补给的区域。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J45]:{id:JinnBasicCardID.J45,name:"败盟南下",op:3,country:Country.JINN,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"降低1级政策倾向，使用这张牌的行动力执行征募和进军。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J46]:{id:JinnBasicCardID.J46,name:"解除兵权",op:2,country:Country.JINN,era:IEra.L,remove:false,precondition:"政策倾向为和议",ban:null,block:null,unlock:null,duration:EventDuration.CONTINUOUS,combat:false,effectText:"若宋国皇帝在场，则将韩世忠移动到皇帝所在区域，韩世忠之后只能随宋国皇帝移动。否则，移除韩世忠。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J47]:{id:JinnBasicCardID.J47,name:"臣构言",op:2,country:Country.JINN,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"若政策倾向为和议，提升1级殖民能力。若政策倾向为主战或中立，降低1级政策倾向。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J48]:{id:JinnBasicCardID.J48,name:"吴玠病逝",op:2,country:Country.JINN,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"移除吴玠",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J49]:{id:JinnBasicCardID.J49,name:"钱眼将军张俊",op:2,country:Country.JINN,era:IEra.L,remove:false,precondition:null,ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:false,effectText:"宋国腐败值加1。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},
    [JinnBasicCardID.J50]:{id:JinnBasicCardID.J50,name:"疑兵",op:2,country:Country.JINN,era:IEra.L,remove:false,precondition:"奔睹在场，且金国守城",ban:null,block:null,unlock:null,duration:EventDuration.INSTANT,combat:true,effectText:"战斗牌先于任何战斗卡结算，宋国军团立即撤退，全部战斗结算结束。",pre:(G: SongJinnGame, ctx:Ctx)=>true,event:(G: SongJinnGame, ctx:Ctx)=>G},

};