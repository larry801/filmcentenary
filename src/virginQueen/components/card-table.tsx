import React from "react";
import i18n from "../../constant/i18n";
import {CardRow, CardTablePage, CardTableSection} from "../../components/game-card-table";
import {OFFICIAL_CARDS} from "../data/cards";
import {OfficialCardDef} from "../data/types";
import {cardById, cardImageUrl} from "../constant/cards";
import {powerName} from "../constant/general";

/**
 * Virgin Queen card list: the official 112-card deck transcribed in
 * `data/cards.ts`. Card names are bilingual; printed effect text is the
 * Chinese card face (the data set has no English transcription).
 */
const VQCardTable = () => {
    i18n.use();
    const t = i18n.chain.gameCardTables;
    const col = t.columns;
    const g = t.virginQueen;
    const tray = i18n.chain.vq.cardTray;
    const isEn = i18n.getLocaleName() === "en";
    const locale = isEn ? "en" : "zh_CN";

    const name = (card: OfficialCardDef): string => isEn ? card.nameEn : card.nameZh;

    const kindLabel = (card: OfficialCardDef): string => {
        switch (card.kind) {
            case "home": return tray.homeCard;
            case "event": return tray.eventCard;
            case "mandatory": return tray.mandatoryCard;
            case "response": return tray.responseCard;
            case "combat": return tray.combatCard;
            default: return String(card.kind);
        }
    };

    const turnLabel = (card: OfficialCardDef): string => {
        if (card.availableFromTurn === "variable") return g.turn.variable;
        if (card.availableFromTurn === null) return "—";
        return String(card.availableFromTurn);
    };

    const notes = (card: OfficialCardDef): string => [
        card.timing,
        card.removeOnEvent ? g.remove.onEvent : null,
        card.removeAfterUse ? g.remove.afterUse : null,
        card.removeCondition,
        card.notes,
    ].filter((value): value is string => value !== null && value !== undefined && value !== "")
        .join(" · ") || "—";

    const rows: CardRow[] = OFFICIAL_CARDS.map(card => {
        const src = cardImageUrl(cardById(card.id));
        return [
            card.number,
            src === undefined ? "—" : (
                <img src={src} alt={name(card)} width={40} loading="lazy"
                     style={{display: "block", borderRadius: 2}}/>
            ),
            name(card),
            card.cp ?? "—",
            turnLabel(card),
            kindLabel(card),
            card.power === undefined ? "—" : powerName(card.power, locale),
            card.textZh,
            notes(card),
        ];
    });

    return <CardTablePage title={g.title} subtitle={g.subtitle}>
        <CardTableSection
            name="Virgin Queen official cards"
            title={g.officialCards}
            head={[
                col.number, col.image, col.name, col.cp, col.turn,
                col.cardType, col.power, col.effect, col.notes,
            ]}
            rows={rows}
        />
    </CardTablePage>;
};

export default VQCardTable;
