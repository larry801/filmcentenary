import React from "react";
import {
    AllClassicCards,
    CardID, CardType,
    EventCardID,
    getCardById,
    getScoreCardByID,
    IEra,
    Region,
    ScoreCardID
} from "../types/core";
import PrestigeIcon from '@material-ui/icons/EmojiEvents';
import {
    ActionPointIcon, AestheticsCardIcon, BuyCardForFreeIcon,
    CardIcon,
    CardToArchiveIcon,
    ChampionIcon,
    DevelopmentAwardBadge,
    DiscardIconHelper,
    DrawnShareIcon,
    FreeBreakthroughIcon, getColor, IndustryCardIcon, LegendCardIcon,
    LoseShareIcon, NormalCardIcon
} from "./icons"
import InsertCommentIcon from '@material-ui/icons/RateReview';
import DepositIcon from '@material-ui/icons/LocalAtm';
import Typography from "@material-ui/core/Typography";
import ContinuousHeaderIcon from '@material-ui/icons/RepeatOne';
import ArchiveHeaderIcon from '@material-ui/icons/Archive';
import BuyCardHeaderIcon from '@material-ui/icons/ShoppingCart';
import AestheticsIcon from '@material-ui/icons/ImportContacts';
import IndustryIcon from '@material-ui/icons/Settings';
import { nanoid } from "nanoid";
import CompetitionIcon from '@material-ui/icons/SportsKabaddi';
import AnyPlayerIcon from '@material-ui/icons/People';
import PlayCardIcon from '@material-ui/icons/PlayCircleFilledWhiteOutlined';
import {getCardEffect} from "../constant/effects";
import i18n from "../constant/i18n";
import HandIcon from "@material-ui/icons/PanTool";
import ResIcon from '@material-ui/icons/MonetizationOn';
import UpgradeBadgeIcon from '@material-ui/icons/PublishRounded';
import Badge from "@material-ui/core/Badge";
import OptionalIcon from '@material-ui/icons/Help';
import PickIcon from '@material-ui/icons/Colorize';
import UpdateSlotIcon from '@material-ui/icons/Loop';
import StudioIcon from '@material-ui/icons/Business';
import PayIcon from '@material-ui/icons/Remove';
import SearchIcon from '@material-ui/icons/Search';
import Grid from "@material-ui/core/Grid";

export interface ICardEffectProps {
    cid: CardID,
}

const verticalAlign = {verticalAlign: "-0.125em"};


export const getCardName = (cardId: string): string => {
    if (cardId in i18n.card) {
        // @ts-ignore
        return i18n.card[cardId];
    } else {
        if (cardId in AllClassicCards) {
            let trimmedID = cardId.slice(1)
            // @ts-ignore
            return i18n.card[trimmedID];
        } else {
            if (cardId in EventCardID) {
                // @ts-ignore
                return i18n.card[cardId]
            } else {
                if (cardId in ScoreCardID) {
                    const scoreCard = getScoreCardByID(cardId);
                    return i18n.score.cardName({
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
export const playCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("play") && effObj.play.e !== "none") {
        r.push(i18n.effect.playCardHeader);
        r.push(effName(effObj.play));
    }
    return r.join("");
}
export const buyCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    try{
        if (effObj.hasOwnProperty("buy") && effObj.buy.e !== "none") {
            r.push(i18n.effect.buyCardHeader);
            r.push(effName(effObj.buy));
        }
    }catch (e) {
        console.error(`${e}|${effObj}|${cardId}`);
    }
    return r.join("");
}
export const schoolEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    try{
        if (effObj.hasOwnProperty("school")) {
            if (effObj.hasOwnProperty("response") && effObj.response.hasOwnProperty("pre") && effObj.response.pre.e !== "none") {
                r.push(i18n.effect.extraEffect);
                if (effObj.response.pre.e === "multiple") {
                    effObj.response.effect.forEach((singleEff: any) => {
                        r.push(effName(singleEff.pre))
                        r.push(effName(singleEff.effect))
                    })
                } else {
                    r.push(effName(effObj.response.pre));
                    r.push(effName(effObj.response.effect));
                }
            }
        } else {
            if (effObj.hasOwnProperty("response") && effObj.response.hasOwnProperty("pre") && effObj.response.pre.e !== "none") {
                r.push(i18n.effect.responseHeader);
                r.push(effName(effObj.response.pre));
                r.push(effName(effObj.response.effect));
            }
        }
    }catch (e) {
        console.error(`${e}|${JSON.stringify(effObj)}|${cardId}`);
    }finally {

    }
    return r.join("");
}
export const archiveCardEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("archive") && effObj.archive.e !== "none") {
        r.push(i18n.effect.breakthroughHeader);
        r.push(effName(effObj.archive));
    }
    return r.join("");
}
export const scoreEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("scoring")) {
        r.push(i18n.effect.scoringHeader);
        r.push(effName(effObj.scoring));
    }
    return r.join("");
}

export const effIcon = (eff: any): JSX.Element => {
    switch (eff.e) {
        case "discardAesthetics":
            return <React.Fragment key={eff.e}>
                <DiscardIconHelper elem={<AestheticsCardIcon/>}/>X{eff.a}
            </React.Fragment>
        case "discardIndustry":
            return <React.Fragment key={nanoid()}>
                <DiscardIconHelper elem={<IndustryCardIcon/>}/>X{eff.a}
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
                        overlap="rectangle"
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
        case "loseAnyRegionShare":
            return <React.Fragment key={nanoid()}><LoseShareIcon
                r={Region.NONE} key={nanoid()}/></React.Fragment>
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
                            overlap="rectangle"
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
                            overlap="rectangle"
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
                            overlap="rectangle"
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
                            overlap="rectangle"
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
                {i18n.effect.choice}
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
            return i18n.effect[eff.e] + effName(eff.a);
        default:
            break;
    }
    if (eff.e === "pay") {
        return i18n.effect.pay + effName(eff.a.cost) + effName(eff.a.eff);
    }
    if (eff.e === "era") {
        let r = []
        for (let i = 0; i < 3; i++) {
            let sub = eff.a[i];
            if (sub.e === "none") continue;
            const eraConvert = i as 0 | 1 | 2;
            r.push(i18n.effect.era[eraConvert]);
            r.push(effName(sub));
        }
        return r.join("");
    }
    if (eff.e === "step") {
        // @ts-ignore
        return eff.a.map(e => effName(e)).join("，");
    }
    if (eff.e === "choice") {
        let res = eff.a.map((e: any, idx: number) => "（" + (idx + 1).toString() + "）" + effName(e));
        res.unshift(i18n.effect.choice)
        return res.join("");
    }
    // @ts-ignore
    let name = i18n.effect[eff.e];
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

export const CardInfo = ({cid}: ICardEffectProps) => {
    const card = getCardById(cid);
    const r = card.region;

    return <Grid
        container item xs={12}
    >
        {card.industry > 0 ? Array(card.industry).fill(1).map(() =>
                <IndustryIcon
                    key={nanoid()}
                    style={{color: getColor(r)}}/>)
            : <React.Fragment key={nanoid()}/>}
        {card.aesthetics > 0 ? Array(card.aesthetics).fill(1).map(() =>
                <AestheticsIcon
                    key={nanoid()}
                    style={{color: getColor(r)}}/>)
            : <React.Fragment key={nanoid()}/>}
        <Typography
            style={{
                color: getColor(r)
            }}
        >{getCardName(cid)}</Typography>
        <CardEffect cid={cid}/>
        <Typography>{getEffectTextById(cid)}</Typography>
    </Grid>
}

export const getEffectTextById = (cid: CardID): string => {
    const buyEffText = buyCardEffectText(cid);
    const playEffText = playCardEffectText(cid);
    const arch = archiveCardEffectText(cid);
    const score = scoreEffectText(cid);
    const eff = getCardEffect(cid);
    const schoolBasic = eff.hasOwnProperty("school")
        ? i18n.effect.school({
            hand: eff.school.hand,
            action: eff.school.action
        }) : ""
    return `${buyEffText}${playEffText}${arch}${score}${schoolBasic}${schoolEffectText(cid)}`
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
            <Typography key={nanoid()} aria-label={i18n.effect.playCardHeader}>
                【<PlayCardIcon style={verticalAlign}/> 】
            </Typography>
            {effIcon(effObj.play)}
        </React.Fragment> : <React.Fragment key={nanoid()}/>}
        {arch !== "" ? <React.Fragment key={nanoid()}>
            <Typography key={nanoid()} aria-label={i18n.effect.breakthroughHeader}>
                【<ArchiveHeaderIcon style={verticalAlign}/>】
            </Typography>
            {effIcon(effObj.archive)}
        </React.Fragment> : <React.Fragment key={nanoid()}/>}
        {isSchool ? <React.Fragment key={nanoid()}>
            <Typography key={nanoid()} aria-label={i18n.effect.continuous}>
                <ContinuousHeaderIcon style={verticalAlign}/>
            </Typography>
            <Typography key={nanoid()}>
                <CardIcon key={nanoid()}/>{effObj.school.hand}
                <ActionPointIcon key={nanoid()}/>{effObj.school.action}
            </Typography>
            <Typography key={nanoid()}>
                {schoolEffectText(cid)}
            </Typography>
        </React.Fragment> : ""}
        {score !== "" ? <Typography key={nanoid()}>{score}</Typography>
            : <React.Fragment key={nanoid()}/>}
    </React.Fragment>
}

export default React.memo(CardInfo);
