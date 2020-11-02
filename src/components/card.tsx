import React from "react";
import {
    AllClassicCards,
    CardID,
    CardType,
    EventCardID,
    getCardById,
    getScoreCardByID,
    Region,
    ScoreCardID
} from "../types/core";
import PrestigeIcon from '@material-ui/icons/EmojiEvents';
import {CardIcon, CardToArchiveIcon, DiscardIcon, FreeBreakthroughIcon} from "./icons"
import InsertCommentIcon from '@material-ui/icons/InsertComment';
import DepositIcon from '@material-ui/icons/LocalAtm';
import Typography from "@material-ui/core/Typography";
import Grid from "@material-ui/core/Grid";
import AestheticsIcon from '@material-ui/icons/ImportContacts';
import IndustryIcon from '@material-ui/icons/Settings';
import {generate} from "shortid";
import {getCardEffect} from "../constant/effects";
import i18n from "../constant/i18n";
import {ActionPointIcon, DrawnShareIcon, getColor} from "./icons";
import HandIcon from "@material-ui/icons/PanTool";
import ResIcon from '@material-ui/icons/MonetizationOn';
import ForFreeIcon from '@material-ui/icons/MoneyOff';
import EraOneIcon from '@material-ui/icons/LooksOne';
import EraTwoIcon from '@material-ui/icons/LooksTwo';
import EraThreeIcon from '@material-ui/icons/Looks3';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import Badge from "@material-ui/core/Badge";
import UpdateIcon from '@material-ui/icons/Loop';
import PayIcon from '@material-ui/icons/CreditCard';

export interface ICardEffectProps {
    cid: CardID,
}

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
                    let scoreCard = getScoreCardByID(cardId);
                    return i18n.score.cardName({
                        era: scoreCard.era,
                        region: scoreCard.region,
                        rank: scoreCard.rank,
                    })
                } else {
                    throw Error(`Unknown id ${cardId}`)
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
    if (effObj.hasOwnProperty("buy") && effObj.buy.e !== "none") {
        r.push(i18n.effect.buyCardHeader);
        r.push(effName(effObj.buy));
    }
    return r.join("");
}
export const schoolEffectText = (cardId: CardID): string => {
    let effObj = getCardEffect(cardId);
    let r: string[] = [];
    if (effObj.hasOwnProperty("school")) {
        if (effObj.hasOwnProperty("response") && effObj.response.pre.e !== "none") {
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
        case "shareASIA":
            return <><DrawnShareIcon r={Region.ASIA}/></>
        case "shareEE":
            return <><DrawnShareIcon r={Region.EE}/></>
        case "shareWE":
            return <><DrawnShareIcon r={Region.WE}/></>
        case "anyRegionShare":
            return <><DrawnShareIcon r={Region.NONE}/></>
        case "pay":
            return <Typography>
                <PayIcon/>
                {effIcon(eff.a.cost)}:{effIcon(eff.a.eff)}
            </Typography>
        case "update":
            return <><UpdateIcon/></>
        case "choice":
            return <>
                {i18n.effect.choice}
                {eff.a.map((i: any, idx: number) =>
                    <>({idx + 1}){effIcon(i)}</>
                )}
            </>
        case "aestheticsLevelUp":
            return <Badge badgeContent={<ArrowUpwardIcon/>}>
                <AestheticsIcon/>
            </Badge>
        case "industryLevelUp":
            return <Badge badgeContent={<ArrowUpwardIcon/>}>
                <IndustryIcon/>
            </Badge>
        case "shareNA":
            return <>
                <DrawnShareIcon r={Region.NA}/>X{eff.a}
            </>
        case "aestheticsToVp":
            return <>
                <PrestigeIcon/>X<AestheticsIcon/>
            </>
        case "industryToVp":
            return <>
                <PrestigeIcon/>X<IndustryIcon/>
            </>
        case "resFromIndustry":
            return <>
                <ResIcon/>X<IndustryIcon/>
            </>
        case "shareToVp":
            return <>
                <PrestigeIcon/>X<DrawnShareIcon r={eff.a}/>
            </>
        case "breakthroughResDeduct":
            return <> <FreeBreakthroughIcon/> </>
        case "archive":
            return <>
                <CardToArchiveIcon/>X{eff.a}
            </>
        case "discard":
            return <><DiscardIcon/>X{eff.a}</>
        case "draw":
            return <>
                <CardIcon/>X{eff.a}
            </>
        case "loseVp":
            return <><PrestigeIcon/>-{eff.a}</>
        case "vp":
        case "addVp":
        case "addExtraVp":
            return <><PrestigeIcon/>+{eff.a}</>
        case "loseDeposit":
            return <Typography><DepositIcon/>-{eff.a}</Typography>
        case "deposit":
            return <><DepositIcon/>+{eff.a}</>
        case "res":
        case "addRes":
            return <><ResIcon/>+{eff.a}</>
        case "comment":
            if (eff.a === 1) {
                return <InsertCommentIcon/>
            } else {
                return <><InsertCommentIcon/>X{eff.a}</>
            }
        case "buy":
            return <>
                <Badge
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    badgeContent={<ForFreeIcon/>}>
                    <CardIcon/>
                </Badge>
                {getCardName(eff.a)}</>
        case "buyCardToHand":
            return <>
                <Badge
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    badgeContent={<ForFreeIcon/>}
                >
                    <CardIcon/>
                </Badge>
                <HandIcon/>
                {getCardName(eff.a)}</>
        case "step":
            return <>
                {eff.a.map((i: any) => effIcon(i))}
            </>
        case "era":
            return <>
                {eff.a[0].e !== "none" ? <Typography><EraOneIcon/>{effIcon(eff.a[0])}</Typography> : <></>}
                {eff.a[1].e !== "none" ? <Typography><EraTwoIcon/>{effIcon(eff.a[1])}</Typography> : <></>}
                {eff.a[2].e !== "none" ? <Typography><EraThreeIcon/>{effIcon(eff.a[2])}</Typography> : <></>}
            </>
    }
    return <>{effName(eff)}</>;
}
// PanTool competition
// Archive
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
            r.push(i18n.effect.era[i as 0 | 1 | 2]);
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
    return <Grid container item xs={12}>
        {card.industry > 0 ? Array(card.industry).fill(1).map(() =>
                <IndustryIcon
                    key={generate()}
                    style={{color: getColor(r)}}/>)
            : <></>}
        {card.aesthetics > 0 ? Array(card.aesthetics).fill(1).map(() =>
                <AestheticsIcon
                    key={generate()}
                    style={{color: getColor(r)}}/>)
            : <></>}
        <Typography>{getCardName(cid)}</Typography>
        <CardEffect cid={cid}/>
    </Grid>
}

export const CardEffect = ({cid}: ICardEffectProps) => {
    const effObj = getCardEffect(cid);
    const cardObj = getCardById(cid);
    const isSchool = cardObj.type === CardType.S;
    const buyEffText = buyCardEffectText(cid);
    const playEffText = playCardEffectText(cid);
    const arch = archiveCardEffectText(cid);
    const score = scoreEffectText(cid);
    return <>
        {buyEffText !== "" ? <><Typography>{i18n.effect.buyCardHeader}</Typography>{effIcon(effObj.buy)}</> : <></>}
        {playEffText !== "" ? <><Typography>{i18n.effect.playCardHeader}</Typography> {effIcon(effObj.play)}</> : <></>}
        {arch !== "" ? <><Typography>{i18n.effect.breakthroughHeader}</Typography> {effIcon(effObj.archive)}</> : <></>}
        {isSchool ? <>
            <Typography>{i18n.effect.continuous}</Typography>
            <Typography>
                <CardIcon/>{effObj.school.hand}
                <ActionPointIcon/>{effObj.school.action}
            </Typography>
            <Typography>{schoolEffectText(cid)}</Typography>
        </> : <></>}
        {score !== "" ? <Typography>{score}</Typography> : <></>}
    </>
}

export default CardInfo;
