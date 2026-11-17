import React from "react";
import {
    AllClassicCards,
    BasicCardID,
    CardCategory,
    CardID, CardType,
    EventCardID,
    getCardById,
    getScoreCardByID,
    IEra, isTechSchool, ItrEffects,
    Region,
    ScoreCardID, SimpleEffectNames
} from "../types/core";
import PrestigeIcon from '@mui/icons-material/EmojiEvents';
import {
    ActionPointIcon, AestheticsCardIcon, BasicCardIcon, BuyCardForFreeIcon,
    CardIcon,
    CardToArchiveIcon,
    ChampionIcon,
    DevelopmentAwardBadge,
    DiscardIconHelper,
    DrawnShareIcon,
    FreeBreakthroughIcon, getColor, IndustryCardIcon, LegendCardIcon,
    LoseShareIcon, NormalCardIcon
} from "./icons"
import InsertCommentIcon from '@mui/icons-material/RateReview';
import DepositIcon from '@mui/icons-material/LocalAtm';
import Typography from "@mui/material/Typography";
import ContinuousHeaderIcon from '@mui/icons-material/RepeatOne';
import ArchiveHeaderIcon from '@mui/icons-material/Archive';
import BuyCardHeaderIcon from '@mui/icons-material/ShoppingCart';
import AestheticsIcon from '@mui/icons-material/ImportContacts';
import IndustryIcon from '@mui/icons-material/Settings';
import { nanoid } from "nanoid";
import CompetitionIcon from '@mui/icons-material/SportsKabaddi';
import AnyPlayerIcon from '@mui/icons-material/People';
import PlayCardIcon from '@mui/icons-material/PlayCircleFilledWhiteOutlined';
import {getCardEffect} from "../constant/effects";
import i18n from "../constant/i18n";
import {RecentCardAdjustments} from "../constant/card-adjustments";
import HandIcon from "@mui/icons-material/PanTool";
import ResIcon from '@mui/icons-material/MonetizationOn';
import UpgradeBadgeIcon from '@mui/icons-material/PublishRounded';
import Badge from "@mui/material/Badge";
import OptionalIcon from '@mui/icons-material/Help';
import PickIcon from '@mui/icons-material/Colorize';
import UpdateSlotIcon from '@mui/icons-material/Loop';
import StudioIcon from '@mui/icons-material/Business';
import PayIcon from '@mui/icons-material/Remove';
import SearchIcon from '@mui/icons-material/Search';
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import "./card.css";
import "./card-view-table.css";

export interface ICardEffectProps {
    cid: CardID,
}

const verticalAlign = {verticalAlign: "-0.125em"};


export const getCardName = (cardId: string): string => {
    if (cardId in i18n.chain.card) {
        // @ts-ignore
        return i18n.chain.card[cardId];
    } else {
        if (cardId in AllClassicCards) {
            let trimmedID = cardId.slice(1)
            // @ts-ignore
            return i18n.chain.card[trimmedID];
        } else {
            if (cardId in EventCardID) {
                // @ts-ignore
                return i18n.chain.card[cardId]
            } else {
                if (cardId in ScoreCardID) {
                    const scoreCard = getScoreCardByID(cardId);
                    return i18n.chain.score.cardName({
                        era: scoreCard.era,
                        region: scoreCard.region,
                        rank: scoreCard.rank,
                    })
                } else {
                    return `Unknown id ${cardId}`
                }
            }
        }
    }
}
/** 按卡名查找卡牌 ID（用于公告文本中的【卡牌名】悬停展示） */
const cardIdByName = (name: string): string | null => {
    for (const id of Object.keys(AllClassicCards)) {
        if (getCardName(id) === name) return id;
    }
    for (const id of Object.keys(BasicCardID)) {
        if (getCardName(id) === name) return id;
    }
    return null;
};

/** 卡牌「近期调整」角标：地区颜色的齿轮 + 黑边，悬停显示调整对照表 */
export const CardAdjustBadge = ({cardId, size = 20, style}: {
    cardId: string,
    size?: number,
    style?: React.CSSProperties,
}) => {
    const adjustment = RecentCardAdjustments[cardId];
    if (!adjustment) return null;
    const region = getCardById(cardId).region;
    return <Tooltip
        {...CardHoverTooltipProps}
        placement="top"
        title={<div className="card-adjust-content">
            <Typography variant="subtitle2" className="card-adjust-title">{adjustment.title ?? "近期调整"}</Typography>
            <Typography component="div" className="card-adjust-summary">
                {adjustment.date}　{adjustment.summary}
            </Typography>
            <table className="card-adjust-table">
                <thead>
                <tr>
                    <th>项目</th>
                    <th>调整前</th>
                    <th>调整后</th>
                </tr>
                </thead>
                <tbody>
                {adjustment.changes.map((change, idx) => <tr key={idx}>
                    <td>{change.label}</td>
                    <td>{change.before}</td>
                    <td>{change.after}</td>
                </tr>)}
                </tbody>
            </table>
        </div>}
    >
        <span
            className="card-adjust-badge"
            style={{width: size, height: size, ...style}}
            onMouseOver={e => e.stopPropagation()}
            onMouseEnter={e => e.stopPropagation()}
        >
            <IndustryIcon style={{fontSize: Math.round(size * 0.72), color: getColor(region)}}/>
        </span>
    </Tooltip>;
};

/** 公告文本渲染：将【卡牌名】替换为悬停显示卡牌的片段 */
export const CardNameText = ({text}: {text: string}) => {
    const parts = text.split(/【([^】]*)】/);
    return <React.Fragment>
        {parts.map((part, idx) => {
            if (idx % 2 === 0) {
                return <React.Fragment key={idx}>{part}</React.Fragment>;
            }
            const cardId = cardIdByName(part);
            if (cardId) {
                return <Tooltip key={idx} {...CardHoverTooltipProps} title={<CardPanel cardId={cardId as CardID} width={440}/>}>
                    <span style={{color: "#0b77ba", cursor: "default", borderBottom: "1px dotted #9fb6cc"}}>【{part}】</span>
                </Tooltip>;
            }
            return <React.Fragment key={idx}>【{part}】</React.Fragment>;
        })}
    </React.Fragment>;
};

export const playCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("play") && effObj.play.e !== "none") {
        r.push(i18n.chain.effect.playCardHeader);
        r.push(effName(effObj.play));
    }
    return r.join(" ");
}
export const buyCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    try{
        if (effObj.hasOwnProperty("buy") && effObj.buy.e !== "none") {
            r.push(i18n.chain.effect.buyCardHeader);
            r.push(effName(effObj.buy));
        }
    }catch (e) {
        console.error(`${e}|${effObj}|${cardId}`);
    }
    return r.join(" ");
}
export const schoolEffectText = (cardId: CardID): string => {
    const effObj = getCardEffect(cardId);
    let r: string[] = [];
    try {
        if (effObj.hasOwnProperty("school")) {
            if (effObj.hasOwnProperty("response") && effObj.response.hasOwnProperty("pre") && effObj.response.pre.e !== "none") {
                if (effObj.response.pre.e === "multiple") {
                    effObj.response.effect.forEach((singleEff: any) => {
                        r.push(effName(singleEff.pre));
                        r.push(effName(singleEff.effect));
                    })
                } else {
                    r.push(effName(effObj.response.pre));
                    r.push(effName(effObj.response.effect));
                }
                return i18n.chain.effect.extraEffect + r.join("。");
            }
            return "";
        } else if (effObj.hasOwnProperty("response") && effObj.response.hasOwnProperty("pre") && effObj.response.pre.e !== "none") {
            r.push(i18n.chain.effect.responseHeader);
            r.push(effName(effObj.response.pre));
            r.push(effName(effObj.response.effect));
        }
    } catch (e) {
        console.error(`${e}|${JSON.stringify(effObj)}|${cardId}`);
    }
    return r.join(" ");
}
export const archiveCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("archive") && effObj.archive.e !== "none") {
        r.push(i18n.chain.effect.breakthroughHeader);
        r.push(effName(effObj.archive));
    }
    return r.join(" ");
}
export const scoreEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("scoring")) {
        r.push(i18n.chain.effect.scoringHeader);
        r.push(effName(effObj.scoring));
    }
    return r.join(" ");
}

export const effIcon = (eff: any): React.JSX.Element => {
    switch (eff.e) {
        case SimpleEffectNames.CompetitionPowerToVp:
            return <React.Fragment key={eff.e}>
                竞争力<PrestigeIcon/>
            </React.Fragment>
        case "discardAesthetics":
            return <React.Fragment key={eff.e}>
                <DiscardIconHelper elem={<AestheticsCardIcon/>}/>X{eff.a}
            </React.Fragment>
        case "discardIndustry":
            return <React.Fragment key={nanoid()}>
                <DiscardIconHelper elem={<IndustryCardIcon/>}/>X{eff.a}
            </React.Fragment>
        case "discardBasic":
            return <React.Fragment key={nanoid()}>
                <DiscardIconHelper elem={<BasicCardIcon/>}/>X{eff.a}
            </React.Fragment>
        case "discardNormalOrLegend":
            return <React.Fragment key={nanoid()}>
                <DiscardIconHelper elem={<LegendCardIcon/>}/>X{eff.a}
                /
                <DiscardIconHelper elem={<NormalCardIcon/>}/>X{eff.a}
            </React.Fragment>
        case "handToAnyPlayer":
            return <React.Fragment key={nanoid()}>
                <CardIcon/><HandIcon/><AnyPlayerIcon/>
            </React.Fragment>
        case "optional":
            return <Typography key={nanoid()}>
                <OptionalIcon/>
                {effIcon(eff.a)}
            </Typography>
        case "competition":
            if (eff.a.bonus > 0) {
                return <React.Fragment
                    key={nanoid()}
                >
                    <Badge
                        anchorOrigin={{
                            vertical: 'bottom',
                            horizontal: 'right',
                        }}
                        badgeContent={`+${eff.a.bonus}`}
                        color="primary"
                    >
                        <CompetitionIcon/>
                    </Badge>
                    {effIcon(eff.a.onWin)}
                </React.Fragment>
            } else {
                return <React.Fragment key={nanoid()}>
                    <CompetitionIcon/>
                    {effIcon(eff.a.onWin)}
                </React.Fragment>
            }
        case "aesAward":
            return <React.Fragment key={nanoid()}>
                <Typography>
                    <Badge
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'left',
                        }}
                        badgeContent={<DevelopmentAwardBadge/>}
                    >
                        <AestheticsIcon/>
                    </Badge>
                    X{eff.a}
                </Typography>
            </React.Fragment>
        case "industryAward":
            return <React.Fragment key={nanoid()}>
                <Badge
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    badgeContent={<DevelopmentAwardBadge/>}
                >
                    <IndustryIcon/>
                </Badge>X{eff.a}
            </React.Fragment>
        case "noStudio":
            return <React.Fragment key={nanoid()}>
                <div>
                    <Badge
                        badgeContent={'-'}
                        color="primary"
                        overlap="rectangular"
                    >
                        <StudioIcon/>
                    </Badge>
                </div>
                {effIcon(eff.a)}
            </React.Fragment>
        case "studio":
            return <React.Fragment key={nanoid()}>
                <div>
                    <StudioIcon/>
                </div>
                {effIcon(eff.a)}
            </React.Fragment>
        case "loseShareNA":
            return <React.Fragment key={nanoid()}>
                <LoseShareIcon
                    r={Region.NA}
                    key={nanoid()}
                />
            </React.Fragment>
        case "loseShareWE":
            return <React.Fragment key={nanoid()}><
                LoseShareIcon
                r={Region.WE}
                key={nanoid()}/>
            </React.Fragment>
        case "loseShareEE":
            return <React.Fragment key={nanoid()}><LoseShareIcon
                key={nanoid()}
                r={Region.EE}/></React.Fragment>
        case "loseShareASIA":
            return <React.Fragment key={nanoid()}><LoseShareIcon
                r={Region.ASIA}
                key={nanoid()}/></React.Fragment>
        case ItrEffects.loseAnyRegionShare:
            return <React.Fragment key={nanoid()}><LoseShareIcon
                r={Region.NONE} key={nanoid()}/> CP -1</React.Fragment>
        case "loseShare":
            return <React.Fragment key={nanoid()}><LoseShareIcon
                key={nanoid()}
                r={eff.a}/></React.Fragment>
        case "shareASIA":
            return <React.Fragment key={nanoid()}><DrawnShareIcon r={Region.ASIA} key={nanoid()}/></React.Fragment>
        case "shareEE":
            return <React.Fragment key={nanoid()}><DrawnShareIcon r={Region.EE} key={nanoid()}/></React.Fragment>
        case "shareWE":
            return <React.Fragment key={nanoid()}><DrawnShareIcon r={Region.WE} key={nanoid()}/></React.Fragment>
        case "anyRegionShare":
            return <React.Fragment key={nanoid()}>
                <DrawnShareIcon r={Region.NONE} key={nanoid()}/>
            </React.Fragment>
        case "pay":
            switch (eff.a.cost.e) {
                case "vp":
                    return <React.Fragment key={nanoid()}>
                        <Badge
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'left',
                            }}
                            badgeContent={'-'}
                            color="primary"
                            overlap="rectangular"
                        >
                            <PrestigeIcon/>
                        </Badge>
                        X{eff.a.cost.a}:{effIcon(eff.a.eff)}
                    </React.Fragment>
                case "deposit":
                    return <React.Fragment key={nanoid()}>
                        <Badge
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'left',
                            }}
                            badgeContent={'-'}
                            color="primary"
                            overlap="rectangular"
                        >
                            <DepositIcon/>
                        </Badge>
                        X{eff.a.cost.a}:{effIcon(eff.a.eff)}
                    </React.Fragment>
                case "res":
                    return <React.Fragment key={nanoid()}>
                        <Badge
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'left',
                            }}
                            badgeContent={'-'}
                            color="primary"
                            overlap="rectangular"
                        >
                            <ResIcon/>
                        </Badge>
                        X{eff.a.cost.a}:{effIcon(eff.a.eff)}
                    </React.Fragment>
                case "share":
                    return <React.Fragment key={nanoid()}>
                        <Badge
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'left',
                            }}
                            badgeContent={'-'}
                            color="primary"
                            overlap="rectangular"
                        >
                            <DrawnShareIcon r={eff.a.cost.region}/>
                        </Badge>
                        X{eff.a.cost.a}:{effIcon(eff.a.eff)}
                    </React.Fragment>
            }
            return <React.Fragment key={nanoid()}>
                <PayIcon key={nanoid()}/>
                {effIcon(eff.a.cost)}:{effIcon(eff.a.eff)}|
            </React.Fragment>
        case "update":
            return <React.Fragment key={nanoid()}><UpdateSlotIcon key={nanoid()}/></React.Fragment>
        case "choice":
            return <React.Fragment key={nanoid()}>
                {i18n.chain.effect.choice}
                {eff.a.map((i: any, idx: number) =>
                    <React.Fragment key={nanoid()}> ({idx + 1}) {effIcon(i)}</React.Fragment>
                )}
            </React.Fragment>
        case "aestheticsLevelUp":
            return <Badge
                key={nanoid()}
                badgeContent={<
                    UpgradeBadgeIcon
                    key={nanoid()}
                />}>
                <AestheticsIcon key={nanoid()}/>
            </Badge>
        case "industryLevelUp":
            return <Badge
                badgeContent={<
                    UpgradeBadgeIcon
                    key={nanoid()}/>}>
                <IndustryIcon key={nanoid()}/>
            </Badge>
        case "shareNA":
            return <React.Fragment key={nanoid()}>
                <DrawnShareIcon
                    r={Region.NA}
                    key={nanoid()}
                />X{eff.a}
            </React.Fragment>
        case "aestheticsToVp":
            return <React.Fragment key={nanoid()}>
                <PrestigeIcon
                    key={nanoid()}
                />
                X
                <AestheticsIcon
                    key={nanoid()}/>
            </React.Fragment>
        case "industryToVp":
            return <React.Fragment key={nanoid()}>
                <PrestigeIcon/>X<IndustryIcon key={nanoid()}/>
            </React.Fragment>
        case "resFromIndustry":
            return <React.Fragment key={nanoid()}>
                <ResIcon key={nanoid()}/>X<IndustryIcon key={nanoid()}/>
            </React.Fragment>
        case "shareToVp":
            return <React.Fragment key={nanoid()}>
                <PrestigeIcon key={nanoid()}/>X<DrawnShareIcon r={eff.a}/>
            </React.Fragment>
        case "breakthroughResDeduct":
            return <React.Fragment key={nanoid()}> <FreeBreakthroughIcon key={nanoid()}/> </React.Fragment>
        case "archive":
            return <React.Fragment key={nanoid()}>
                <CardToArchiveIcon key={nanoid()}/>X{eff.a}
            </React.Fragment>
        case "discard":
            return <React.Fragment key={nanoid()}>
                <DiscardIconHelper elem={<CardIcon/>}/>X{eff.a}
            </React.Fragment>
        case "draw":
            return <React.Fragment key={nanoid()}>
                <CardIcon key={nanoid()}/>X{eff.a}
            </React.Fragment>
        case "loseVp":
            return <React.Fragment key={nanoid()}><PrestigeIcon key={nanoid()}/>-{eff.a}</React.Fragment>
        case "vp":
        case "addVp":
        case "addExtraVp":
            return <React.Fragment key={nanoid()}><PrestigeIcon key={nanoid()}/>+{eff.a}</React.Fragment>
        case SimpleEffectNames.addCompetitionPower:
            return <React.Fragment key={nanoid()}>CP+{eff.a}</React.Fragment>
        case SimpleEffectNames.loseCompetitionPower:
            return <React.Fragment key={nanoid()}>CP-{eff.a}</React.Fragment>
        case "loseDeposit":
            return <React.Fragment key={nanoid()}><DepositIcon key={nanoid()}/>-{eff.a}</React.Fragment>
        case "deposit":
            return <React.Fragment key={nanoid()}><DepositIcon key={nanoid()}/>+{eff.a}</React.Fragment>
        case "res":
        case "addRes":
            return <React.Fragment key={nanoid()}><ResIcon key={nanoid()}/>+{eff.a}</React.Fragment>
        case "comment":
            if (eff.a === 1) {
                return <InsertCommentIcon key={nanoid()}/>
            } else {
                return <React.Fragment key={nanoid()}><InsertCommentIcon key={nanoid()}/>X{eff.a}</React.Fragment>
            }
        case "buy":
            return <React.Fragment key={nanoid()}>
                <BuyCardForFreeIcon/>
                {getCardName(eff.a)}
            </React.Fragment>
        case "buyCardToHand":
            return <React.Fragment key={nanoid()}>
                <BuyCardForFreeIcon/>
                {getCardName(eff.a)}
                <HandIcon/>
            </React.Fragment>
        case "peek":
            let filter;
            switch (eff.a.filter.e) {
                case "aesthetics":
                    filter = <AestheticsIcon/>
                    break;
                case "industry":
                    filter = <IndustryIcon/>
                    break;
                case "era":
                    filter = <ChampionIcon champion={{
                        region: Region.NONE,
                        era: eff.a.filter.a,
                    }}/>
                    break;
                case "region":
                    filter = <DrawnShareIcon r={eff.a.filter.a}/>
                    break;
                case "choice":
                    filter = <React.Fragment key={nanoid()}><PickIcon/>X{eff.a.filter.a}</React.Fragment>
                    break;
            }
            return <React.Fragment key={nanoid()}>
                <SearchIcon/>X{eff.a.count}
                {filter}
                <HandIcon/>
            </React.Fragment>
        case "step":
            return <React.Fragment key={nanoid()}>
                {eff.a.map((i: any) => effIcon(i))}
            </React.Fragment>
        case "era":
            return <React.Fragment key={nanoid()}>
                {eff.a[0].e !== "none" ? <Typography key={nanoid()}>
                    <ChampionIcon champion={{region: Region.NONE, era: IEra.ONE}} key={nanoid()}/>{effIcon(eff.a[0])}
                </Typography> : <React.Fragment key={nanoid()}/>}
                {eff.a[1].e !== "none" ? <React.Fragment key={nanoid()}>
                    <ChampionIcon champion={{region: Region.NONE, era: IEra.TWO}} key={nanoid()}/>{effIcon(eff.a[1])}
                </React.Fragment> : <React.Fragment key={nanoid()}/>}
                {eff.a[2].e !== "none" ? <React.Fragment key={nanoid()}>
                    <ChampionIcon champion={{region: Region.NONE, era: IEra.THREE}}
                                  key={nanoid()}/>{effIcon(eff.a[2])}
                </React.Fragment> : <React.Fragment key={nanoid()}/>}
            </React.Fragment>
    }
    return <React.Fragment key={nanoid()}>
        {effName(eff)}
    </React.Fragment>;
}

export const effName = (eff: any): string => {
    switch (eff.e) {
        case "everyOtherCompany":
        case "everyPlayer":
        case "highestVpPlayer":
        case "vpNotHighestPlayer":
        case "optional":
        case "alternative":
        case "studio":
        case "noStudio":
            // @ts-ignore
            return i18n.chain.effect[eff.e] + effName(eff.a);
        default:
            break;
    }
    if (eff.e === "pay") {
        const paySuffix = (affix: string) => "，" + effName(eff.a.eff);
        switch(eff.a.cost.e){
            case "vp":
                return i18n.chain.effect.pay + eff.a.cost.a + "声望" + paySuffix(eff.a.eff);
            case "deposit":
                return i18n.chain.effect.pay + eff.a.cost.a + "存款" + paySuffix(eff.a.eff);
            case "res":
                return i18n.chain.effect.pay + eff.a.cost.a + "资源" + paySuffix(eff.a.eff);
        }
        return i18n.chain.effect.pay + effName(eff.a.cost) + paySuffix(eff.a.eff);
    }
    if (eff.e === "era") {
        let r = []
        for (let i = 0; i < 3; i++) {
            let sub = eff.a[i];
            if (sub.e === "none") continue;
            const eraConvert = i as 0 | 1 | 2;
            r.push(i18n.chain.effect.era[eraConvert] + effName(sub));
        }
        return r.join("。");
    }
    if (eff.e === "step") {
        let strList = eff.a.map((e: any) => effName(e));
        let str = "";
        for (let i = 0; i < strList.length; i++) {
            let s = strList[i];
            if(s[s.length - 1] === "。" || i === strList.length - 1){
                str += s;
            }else{
                str += s + "，";
            }
        }
        return str;
    }
    if (eff.e === "choice") {
        const numberIcon = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"];
        let res = eff.a.map((e: any, idx: number) => numberIcon[idx] + effName(e));
        return i18n.chain.effect.choice + res.join("；");
    }
    // @ts-ignore
    let name = i18n.chain.effect[eff.e];
    if (typeof name === "string") {
        return name;
    } else {
        if (typeof eff.a === "number" || typeof eff.a === "string") {
            return name({a: eff.a});
        } else {
            return name(eff.a);
        }
    }
}

const CardInfoInner = ({cid}: ICardEffectProps) => {
    const card = getCardById(cid);
    const r = card.region;

    return <Grid container size={12} sx={{flexDirection: 'column'}}>
        <Grid container>
            <Typography
                style={{
                    color: getColor(r),
                    whiteSpace: 'pre-line'
                }}
            >{getCardName(cid) + " - " + getRegionEraTextById(cid) + " "}</Typography>

            {card.industry > 0 ? Array(card.industry).fill(1).map((_, idx) =>
                    <IndustryIcon
                        key={`industry-${idx}`}
                        style={{color: getColor(r)}}/>)
                : <React.Fragment/>}
            {card.aesthetics > 0 ? Array(card.aesthetics).fill(1).map((_, idx) =>
                    <AestheticsIcon
                        key={`aesthetics-${idx}`}
                        style={{color: getColor(r)}}/>)
                : <React.Fragment/>}
            {/*<CardEffect cid={cid}/>*/}
        </Grid>
        <Grid>
            <Typography style={{whiteSpace: 'pre-line'}}>{getEffectTextById(cid)}</Typography>
        </Grid>
    </Grid>
}

export const getRegionEraTextById = (cid: CardID): string => {
    const card = getCardById(cid);
    if (card.category === CardCategory.BASIC) {
        return `基础`;
    }
    const r = card.region;
    const e = card.era;
    const eraText = {
        [IEra.ONE]: "I",
        [IEra.TWO]: "II",
        [IEra.THREE]: "III"
    }
    return `${i18n.chain.region[r]} ${eraText[e]}`;
}

export const CardInfo = React.memo(CardInfoInner);

const effectTextCache = new Map<string, string>();

export const getEffectTextById = (cid: CardID): string => {
    // Rendered for every card on the board on every state update, but the text
    // only depends on the card and the active locale.
    const cacheKey = `${i18n.getLocaleName()}|${cid}`;
    const cached = effectTextCache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }
    const buyEffText = buyCardEffectText(cid);
    const playEffText = playCardEffectText(cid);
    const arch = archiveCardEffectText(cid);
    const score = scoreEffectText(cid);
    const eff = getCardEffect(cid);
    const schoolBasic = eff.hasOwnProperty("school") && !isTechSchool(cid)
        ? i18n.chain.effect.school({
            hand: eff.school.hand,
            action: eff.school.action
        }) : ""
    const schoolEffectTextStr = schoolEffectText(cid);
    // The card face is a narrow column: wrap the effect lines so the text does
    // not run into the artwork.
    const textList = [buyEffText, playEffText, arch, schoolBasic, schoolEffectTextStr, score];
    const lineList: string[] = [];
    for (const text of textList) {
        if (text === "") continue;
        const addPoint = text[text.length - 1] !== "。";
        const line = text + (addPoint ? "。" : "");
        if (text === schoolBasic) {
            lineList.push(line);
        } else if (lineList.length === 0) {
            lineList.push(line);
        } else if (line.length + lineList[lineList.length - 1].length <= 20) {
            lineList[lineList.length - 1] += line;
        } else {
            lineList.push(line);
        }
    }
    const result = lineList.join("\n");
    effectTextCache.set(cacheKey, result);
    return result;
}

export const CardEffect = ({cid}: ICardEffectProps) => {
    const effObj = getCardEffect(cid);
    const cardObj = getCardById(cid);
    const isSchool = cardObj.type === CardType.S;
    const buyEffText = buyCardEffectText(cid);
    const playEffText = playCardEffectText(cid);
    const arch = archiveCardEffectText(cid);
    const score = scoreEffectText(cid);
    return <React.Fragment key={nanoid()}>
        {buyEffText !== "" ? <React.Fragment key={nanoid()}>
            <Typography key={nanoid()}>
                【<BuyCardHeaderIcon style={verticalAlign}/>】
            </Typography>
            {effIcon(effObj.buy)}
        </React.Fragment> : <React.Fragment key={nanoid()}/>}
        {playEffText !== "" ? <React.Fragment key={nanoid()}>
            <Typography key={nanoid()} aria-label={i18n.chain.effect.playCardHeader}>
                【<PlayCardIcon style={verticalAlign}/> 】
            </Typography>
            {effIcon(effObj.play)}
        </React.Fragment> : <React.Fragment key={nanoid()}/>}
        {arch !== "" ? <React.Fragment key={nanoid()}>
            <Typography key={nanoid()} aria-label={i18n.chain.effect.breakthroughHeader}>
                【<ArchiveHeaderIcon style={verticalAlign}/>】
            </Typography>
            {effIcon(effObj.archive)}
        </React.Fragment> : <React.Fragment key={nanoid()}/>}
        {isSchool ? <React.Fragment key={nanoid()}>
            <Typography key={nanoid()} aria-label={i18n.chain.effect.continuous}>
                <ContinuousHeaderIcon style={verticalAlign}/>
            </Typography>
            {!isTechSchool(cid) ? <Typography key={nanoid()}>
                <CardIcon key={nanoid()}/>{effObj.school.hand}
                <ActionPointIcon key={nanoid()}/>{effObj.school.action}
            </Typography> : <React.Fragment key={nanoid()}/>}
            <Typography key={nanoid()}>
                {schoolEffectText(cid)}
            </Typography>
        </React.Fragment> : ""}
        {score !== "" ? <Typography key={nanoid()}>{score}</Typography>
            : <React.Fragment key={nanoid()}/>}
    </React.Fragment>
}

export default CardInfo;

export const CardPanel = ({cardId, width}: { cardId: CardID, width?: string | number }) => {
    const card = getCardById(cardId);
    const cardLabel = cardId in AllClassicCards ? cardId.slice(1) : cardId;

    return <div
        className={`dybn-card card-view-item${card.category === CardCategory.LEGEND ? " card-view-item--legend" : ""}`}
        style={{position: "relative", ...(width !== undefined ? {width} : undefined)}}
    >
        <CardAdjustBadge cardId={cardId}/>
        <div className="card-view-meta">
            <Typography className="card-view-meta-text">#{cardLabel}</Typography>
        </div>
        <div
            style={{
                backgroundImage: `url("/img/${cardId}.png")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
                backgroundSize: 'auto 100%',
                margin: '4px 0',
                ...(card.category === CardCategory.LEGEND ? {
                    boxShadow: '2px 2px 2px #000000c4, -1px -1px 1px 1px #dadadacc'
                } : {})
            }}
        >
            <CardInfo cid={cardId}/>
            <Typography
                style={{
                    display: 'inline-flex',
                    verticalAlign: 'middle'
                }}>
                <IndustryIcon/>
                {card.cost.industry}
                <AestheticsIcon/>
                {card.cost.aesthetics}
                <ResIcon/>
                {card.cost.res}
                <PrestigeIcon/>
                {card.vp}
            </Typography>
        </div>
    </div>;
};

/** 悬停展示卡牌时使用的 Tooltip 属性（白底、完整卡面） */
export const CardHoverTooltipProps = {
    slotProps: {
        tooltip: {className: "card-hover-tooltip"},
        arrow: {className: "card-hover-tooltip-arrow"},
    },
    arrow: true,
    enterDelay: 100,
};
