import React from "react";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import {
    AllClassicCards,
    BANNED_CHAOS_MEDIA_CARD_IDS,
    BasicCardID,
    CardID,
    EventCardID,
    getCardById,
    Region,
    ScoreCardID,
} from "../types/core";
import i18n from "../constant/i18n";
import CardInfo, {CardEffect, CardPanel} from "./card";

import "./card.css";
import "./card-view-table.css";

// （硬编码）
const YANG_EXTENSION_IDS = new Set<string>([
    "S4001", "S4002", "S4003", "S4004", "S4005", "S4006", "S4007", "S4008",
]);

const MUKI_EXTENSION_IDS = new Set<string>([
    "S5001", "S5002", "S5003", "S5004",
    "S5201", "S5202", "S5203", "S5204", "S5205", "S5206", "S5207", "S5208", "S5209",
]);

const DAWN_EXTENSION_IDS = new Set<string>([
    "S52681", "S52682", "S52683", "S52684",
]);

const TECH_EXTENSION_IDS = new Set<string>([
    "S52691", "S52692", "S52693", "S52694",
    "S52701", "S52702",
]);

const QM_EXTENSION_IDS = new Set<string>([
    "S6001", "S6002", "S6003", "S6004",
]);

const CHAOS_MEDIA_IDS = new Set<string>([
    "F6111", "F6121", "F6131",
    "P6211", "P6213", "F6212", "P6221", "F6222", "P6231", "F6232", "S6241", "F6242", "P6243",
    "P6311", "F6312", "F6313", "F6314", "P6321", "F6322", "F6323", "P6331", "F6332", "F6333", "P6341", "S6342", "F6343",
]);

const ALL_EXTENSION_IDS = new Set<string>([
    ...Array.from(YANG_EXTENSION_IDS),
    ...Array.from(MUKI_EXTENSION_IDS),
    ...Array.from(DAWN_EXTENSION_IDS),
    ...Array.from(TECH_EXTENSION_IDS),
    ...Array.from(QM_EXTENSION_IDS),
    ...Array.from(CHAOS_MEDIA_IDS),
]);

const FilmQuotes = [
    "镜头不是记录现实，而是迫使现实说出它不愿说的话。",
    "真正的自由，不在街道上，而在你敢不敢剪掉多余的顺从。",
    "历史不会自动公正，电影只是给沉默的人一盏灯。",
    "当生活失去节拍，就让角色先跳舞，真相会跟上来。",
    "最深的戏剧，常常发生在无人说话的十秒钟里。",
    "风雨不是背景，它是人物命运的另一种台词。",
    "你越尊重普通人的一天，电影就越接近伟大。",
    "梦从不撒谎，撒谎的是我们清醒时的体面。",
    "我拍的不是答案，而是人类面对答案时的颤抖。",
    "悬念不是爆炸，而是观众知道导火索还在燃烧。",
    "给我一个角度，我就能让城堡看起来像牢笼。",
    "时间不是被剪掉的片段，而是被凝视后的重量。",
    "镜头先学会倾听，人物才愿意把灵魂借给你。",
    "爱电影的人，最终都会把人生拍成一次告白。",
    "规则存在的意义，是提醒你何时该故意越线。",
    "遗憾最会发光，所以我总在夜里拍爱情。",
    "命运从不喊口号，它只在岔路口轻轻碰你一下。",
    "少一点表演，多一点存在，人物就会自己呼吸。",
    "一张饭桌，足够容纳一个时代的告别。",
    "两张镜头相撞时，观众脑海里会诞生第三个真相。",
    "城市越宏伟，人心里的迷宫就越黑。",
    "别替贫穷编诗，先把它拍成无法回避的现实。",
    "真正的不安，不来自血，而来自熟悉秩序的裂缝。",
    "温柔不是软弱，它是对残酷世界的长期反抗。",
    "当一个城市学会沉默，它的故事才真正开始。",
    "历史从不只写在书里，也写在谁被允许开口。",
    "再普通的一顿饭，也可能是时代留下的底片。",
    "镜头会报复每一个把爱当成道具的人。",
    "边界不是地图上的线，是人心里那道借口。",
    "如果规则不讲理，叛逆就是最诚实的礼貌。",
    "一把刀最锋利的时候，往往还在沉默。",
    "漂泊不是没有根，而是根长在风里。",
    "当你以为黑暗在船舱外，它其实已经学会了你的呼吸。",
    "复活过去很容易，承担未来却总是太晚。",
    "白昼能照亮街道，却照不见每个人的立场。",
    "真正的坠落，是终于愿意用凡人的心去爱。",
    "爱不是答案，爱是你愿不愿意继续提问。",
    "灰烬不会说话，但它知道火曾经多热。",
    "土地沉默太久，歌声就成了证词。",
    "唱到破音的那一刻，人才真正听见自己。",
    "生命最固执的地方，是总在边缘处再给你一口甜。",
    "离开故乡不是终点，是学会理解故乡的开始。",
    "恐惧最擅长伪装成秩序。",
    "机器不会做梦，但会逼人忘记梦。",
    "尊严有时比面包轻，却比饥饿更难扛。",
    "最远的距离，常常是一家人坐在同一张桌子。",
    "当面具裂开，沉默比语言更响亮。",
    "我们以为在逃离世界，其实在追赶自己。",
    "有些爱情没有开始，因为它已经在错过里完成了。",
    "宇宙最远的地方，仍旧是人类记忆的回声。",
];

const toNum = (cardId: CardID): number => parseInt(cardId.slice(1), 10);

const regionOrder = [Region.NA, Region.WE, Region.EE, Region.ASIA, Region.EXTENSION, Region.EXTENSION1, Region.EXTENSION2, Region.NONE];

const sortById = (cards: CardID[]) => [...cards].sort((a: string, b: string) => {
    return toNum(a as CardID) - toNum(b as CardID);
});

const groupByRegionEra = (cards: CardID[]) => {
    const grouped = new Map<string, CardID[]>();
    cards.forEach((id) => {
        const c = getCardById(id);
        const key = `${c.region}-${c.era}`;
        const prev = grouped.get(key) || [];
        grouped.set(key, [...prev, id]);
    });

    return Array.from(grouped.entries())
        .sort((a, b) => {
            const [ar, ae] = a[0].split("-").map(n => parseInt(n, 10));
            const [br, be] = b[0].split("-").map(n => parseInt(n, 10));
            const regionDiff = regionOrder.indexOf(ar as Region) - regionOrder.indexOf(br as Region);
            if (regionDiff !== 0) return regionDiff;
            return ae - be;
        })
        .map(([key, ids]) => {
            const [regionCode, eraCode] = key.split("-").map(n => parseInt(n, 10));
            const region = regionCode as Region;
            const era = eraCode;
            return {
                id: `rg-${region}-${era}`,
                title: `${i18n.chain.region[region]}${era + 1}时代`,
                region,
                cards: sortById(ids),
            };
        });
};

const regionToSubmenuClass = (region?: Region): string => {
    switch (region) {
        case Region.NA:
            return "submenu-na";
        case Region.WE:
            return "submenu-we";
        case Region.EE:
            return "submenu-ee";
        case Region.ASIA:
            return "submenu-asia";
        default:
            return "";
    }
};

const EventCardPanel = ({cardId}: { cardId: EventCardID }) => {
    const card = getCardById(cardId);
    return <div
        className="dybn-card card-view-item"
        style={{
            backgroundImage: `url("/img/${cardId}.png")`,
        }}
    >
        <div className="card-view-meta">
            <Typography className="card-view-meta-text">#{cardId}</Typography> {i18n.chain.pub.era}{i18n.chain.era[card.era]} 
        </div>
        <Typography>
            {i18n.chain.card[cardId]}
        </Typography>
        <Typography className="card-view-bottom-stats">
            {
                // @ts-ignore
                i18n.chain.eventName[cardId]
            }
        </Typography>
    </div>;
};

const Section = ({id, title, cards}: {
    id: string,
    title: string,
    cards: CardID[],
}) => <section id={id} className="card-view-section card-album-page">
    <div className="card-view-header-wrap">
        <Typography variant="h5" className="card-view-header">{title}</Typography>
        <span className="card-view-count">{cards.length}</span>
    </div>
    <Divider className="card-view-divider"/>
    <div className="card-view-grid">
        {cards.map((cardId) => <CardPanel
            key={cardId}
            cardId={cardId}
        />)}
    </div>
</section>;

const EventSection = ({id, title, cards}: {
    id: string,
    title: string,
    cards: EventCardID[],
}) => <section id={id} className="card-view-section card-album-page">
    <div className="card-view-header-wrap">
        <Typography variant="h5" className="card-view-header">{title}</Typography>
        <span className="card-view-count">{cards.length}</span>
    </div>
    <Divider className="card-view-divider"/>
    <div className="card-view-grid">
        {cards.map((cardId) => <EventCardPanel
            key={cardId}
            cardId={cardId}
        />)}
    </div>
</section>;

const SectionWithSubsections = ({id, title, cards, subsections}: {
    id: string,
    title: string,
    cards: CardID[],
    subsections: Array<{ id: string, title: string, cards: CardID[] }>,
}) => <section id={id} className="card-view-section card-album-page">
    <div className="card-view-header-wrap">
        <Typography variant="h5" className="card-view-header">{title}</Typography>
        <span className="card-view-count">{cards.length}</span>
    </div>
    <Divider className="card-view-divider"/>
    {subsections.map((s) => <div key={s.id} className="card-view-subsection">
        <Typography variant="subtitle1" className="card-view-subsection-title">{s.title}</Typography>
        <div className="card-view-grid">
            {s.cards.map((cardId) => <CardPanel key={cardId} cardId={cardId}/>) }
        </div>
    </div>)}
</section>;

const CardViewTable = () => {
    i18n.use();

    const classicCards = (Object.keys(AllClassicCards) as CardID[])
        .filter(id => !BANNED_CHAOS_MEDIA_CARD_IDS.includes(id as string))
        .sort((a: string, b: string) => {
            const aNumId = parseInt(a.slice(1));
            const bNumId = parseInt(b.slice(1));
            return aNumId - bNumId;
        });

    const cardsClassicCore = sortById(classicCards.filter((id) => !ALL_EXTENSION_IDS.has(id as string)));
    const cardsYangExtension = sortById(classicCards.filter((id) => YANG_EXTENSION_IDS.has(id as string)));
    const cards5xxxQm = sortById(classicCards.filter((id) => QM_EXTENSION_IDS.has(id as string)));
    const cards5xxxMuki = sortById(classicCards.filter((id) => MUKI_EXTENSION_IDS.has(id as string)));
    const cardsDawn = sortById(classicCards.filter((id) => DAWN_EXTENSION_IDS.has(id as string)));
    const cardsTech = sortById(classicCards.filter((id) => TECH_EXTENSION_IDS.has(id as string)));
    const cardsChaos = sortById(classicCards.filter((id) => CHAOS_MEDIA_IDS.has(id as string)));

    const sectionsClassicCoreByRegionEra = groupByRegionEra(cardsClassicCore);
    const sections6xxx = groupByRegionEra(cardsChaos);

    const basicCards = Object.keys(BasicCardID) as CardID[];
    const eventCards = Object.keys(EventCardID) as EventCardID[];
    const scoreCards = Object.keys(ScoreCardID) as CardID[];

    const navSections = [
        {
            id: "classic",
            title: "经典",
            children: sectionsClassicCoreByRegionEra.map((s) => ({id: s.id, title: s.title, region: s.region})),
        },
        {id: "classic-4", title: "杨 - 流派扩"},
        ...(cards5xxxQm.length > 0 ? [{id: "classic-5-qm", title: "qm扩"}] : []),
        {id: "classic-5-muki", title: "muki扩"},
        {id: "classic-5-monthly", title: "月度流派扩"},
        {id: "classic-6", title: "乱世光影"},
        {id: "basic", title: "基础卡"},
        {id: "event", title: "事件卡"},
        {id: "score", title: "计分卡"},
    ];

    return <Grid container className="card-view-root card-album-root">
        <Grid size={12}>
            <div className="card-album-cover">
                <Typography variant="h4" gutterBottom>{i18n.chain.drawer.cards}</Typography>
                <Typography color="textSecondary">
                    <i>{FilmQuotes[Math.floor(Math.random() * FilmQuotes.length)]}</i>
                </Typography>
            </div>
            <div className="card-album-toc card-album-toc--right">
                {navSections.map((s) => <div key={s.id} className={`card-album-toc-group${s.children ? " has-children" : ""}`}>
                    <a href={s.children ? `#${s.children[0].id}` : `#${s.id}`} className="card-album-toc-item">
                        {s.title}
                    </a>
                    {s.children ? <div className="card-album-toc-submenu">
                        {s.children.map((child) => <a
                            key={child.id}
                            href={`#${child.id}`}
                            className={`card-album-toc-subitem ${regionToSubmenuClass(child.region)}`}
                        >
                            {child.title}
                        </a>)}
                    </div> : <React.Fragment/>}
                </div>)}
            </div>
        </Grid>
        <Grid size={12}>
            {sectionsClassicCoreByRegionEra.map((s) => <Section key={s.id} id={s.id} title={s.title} cards={s.cards}/>) }

            <Section id="classic-4" title="杨 - 流派扩" cards={cardsYangExtension}/>

            {cards5xxxQm.length > 0 ? <Section id="classic-5-qm" title="qm扩" cards={cards5xxxQm}/> : <React.Fragment/>}
            <Section id="classic-5-muki" title="muki扩" cards={cards5xxxMuki}/>
            <SectionWithSubsections
                id="classic-5-monthly"
                title="月度流派扩"
                cards={[...cardsDawn, ...cardsTech]}
                subsections={[
                    {
                        id: "monthly-dawn",
                        title: "2026-8 流派扩：破晓",
                        cards: cardsDawn,
                    },
                    {
                        id: "monthly-tech",
                        title: "2026-9 流派扩：技术革新",
                        cards: cardsTech,
                    },
                ]}
            />

            <SectionWithSubsections
                id="classic-6"
                title="乱世光影"
                cards={cardsChaos}
                subsections={sections6xxx.map((s) => ({
                    id: `rsgy-${s.id}`,
                    title: s.title,
                    cards: s.cards,
                }))}
            />

            <Section id="basic" title="基础卡" cards={basicCards}/>
            <EventSection id="event" title="事件卡" cards={eventCards}/>
            <Section id="score" title="计分卡" cards={scoreCards}/>
        </Grid>
    </Grid>;
};

export default CardViewTable;
