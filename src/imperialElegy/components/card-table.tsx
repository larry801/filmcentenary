import React from "react";
import i18n from "../../constant/i18n";
import {CardOriginalImage, CardRow, CardTablePage, CardTableSection} from "../../components/game-card-table";
import {CARDS} from "../constant/cards.data";
import {CardDef} from "../constant/cards";
import {GOALS, GoalDef} from "../constant/goals";
import {decadeLabel} from "../engine/deck";
import {ieLocale, ieT} from "./i18n";
import {cardDisplayName} from "./cardDisplay";
import {cardImageSrc} from "./preferences";

/**
 * Imperial Elegy card list. Names, effects and card types are bilingual in
 * `cards.data.ts` / `goals.ts`, so the table follows the active locale. Type
 * labels and power names come from the game's own i18n dictionary.
 */
const ImperialElegyCardTable = () => {
    i18n.use();
    const t = i18n.chain.gameCardTables;
    const col = t.columns;
    const g = t.imperialElegy;
    const locale = ieLocale();
    const strings = ieT();
    const isEn = locale === "en";

    const flags = (card: CardDef): string => [
        card.remove ? g.flags.remove : null,
        card.draw ? g.flags.draw : null,
        card.warOnly ? g.flags.warOnly : null,
        card.gwOnly ? g.flags.gwOnly : null,
        card.botBox === undefined || card.botBox.length === 0
            ? null
            : `${strings.botBox}: ${card.botBox.map(p => strings.seats[p]).join(", ")}`,
    ].filter((value): value is string => value !== null).join(" · ") || "—";

    const originalImage = (src: string | null, title: string): React.ReactNode =>
        src === null ? "—" : <CardOriginalImage src={src} alt={title}/>;

    const goalImageSrc = (goal: GoalDef): string | null =>
        cardImageSrc(`cards/goal-${goal.power}-${String(goal.number).padStart(2, "0")}.png`);

    const cardRow = (card: CardDef): CardRow => [
        card.number ?? card.id,
        cardDisplayName(card, isEn ? "en" : "zh_CN"),
        originalImage(cardImageSrc(card.image), cardDisplayName(card, isEn ? "en" : "zh_CN")),
        strings.cardType[card.type],
        card.cp,
        decadeLabel(card.entry)[isEn ? "en" : "zh"],
        card.power === undefined ? "—" : strings.seats[card.power],
        flags(card),
        isEn ? card.text : card.textZh,
    ];

    const head: React.ReactNode[] = [
        col.number, col.name, col.image, col.cardType, col.cp, col.decade, col.power, col.flags, col.effect,
    ];

    const goalRows: CardRow[] = GOALS.map(goal => [
        goal.number,
        isEn ? goal.title : goal.titleZh,
        originalImage(goalImageSrc(goal), isEn ? goal.title : goal.titleZh),
        strings.seats[goal.power],
        goal.vp,
        isEn ? goal.text : goal.textZh,
    ]);

    return <CardTablePage title={g.title} subtitle={g.subtitle}>
        <CardTableSection
            name="Imperial Elegy action cards"
            title={g.actionCards}
            head={head}
            rows={CARDS.actions.map(cardRow)}
        />
        <CardTableSection
            name="Imperial Elegy home cards"
            title={g.homeCards}
            head={head}
            rows={CARDS.home.map(cardRow)}
        />
        <CardTableSection
            name="Imperial Elegy Great War cards"
            title={g.greatWarCards}
            head={head}
            rows={CARDS.greatWar.map(cardRow)}
        />
        <CardTableSection
            name="Imperial Elegy national goals"
            title={g.goalCards}
            head={[col.number, col.name, col.image, col.power, col.vp, col.effect]}
            rows={goalRows}
        />
    </CardTablePage>;
};

export default ImperialElegyCardTable;
