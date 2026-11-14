import React from "react";
import i18n from "../../constant/i18n";
import {CardRow, CardTablePage, CardTableSection} from "../../components/game-card-table";
import {Cards, getFullDesc, getPlanById, idToCard, sjCardById} from "../util";
import {getProvinceById} from "../constant/province";
import {BaseCardID, PlanID} from "../constant/general";

/**
 * Song-Jinn card list. The card text lives in `util.ts`' `idToCard` / `idToPlan`
 * (there is no separate i18n dictionary for this game), so the table reads the
 * very same definitions the engine uses.
 */
const SongJinnCardTable = () => {
    i18n.use();
    const t = i18n.chain.gameCardTables;
    const col = t.columns;
    const g = t.songJinn;

    const eraLabel = (era: string): string => {
        switch (era) {
            case "E": return g.era.E;
            case "M": return g.era.M;
            default: return g.era.L;
        }
    };
    const sideLabel = (country: string): string =>
        country === "宋" ? g.side.song : g.side.jinn;
    const traits = (card: Cards): string => [
        String(card.duration) === "CONTINUOUS" ? g.duration.continuous : g.duration.instant,
        card.combat ? g.traits.combat : null,
        card.remove ? g.traits.remove : null,
    ].filter((value): value is string => value !== null).join(" · ");

    const eventRows: CardRow[] = Object.keys(idToCard).map(id => {
        const card = sjCardById(id as BaseCardID);
        return [
            String(card.id),
            card.name,
            sideLabel(String(card.country)),
            eraLabel(String(card.era)),
            card.op,
            traits(card),
            getFullDesc(card),
        ];
    });

    const planRows: CardRow[] = Object.values(PlanID).map(pid => {
        const plan = getPlanById(pid);
        return [
            plan.id,
            plan.name,
            plan.vp,
            plan.level,
            plan.provinces.map(p => getProvinceById(p)?.name ?? String(p)).join("、"),
            plan.desc,
        ];
    });

    return <CardTablePage title={g.title} subtitle={g.subtitle}>
        <CardTableSection
            name="Song-Jinn event cards"
            title={g.eventCards}
            head={[col.number, col.name, col.side, col.era, col.op, col.traits, col.description]}
            rows={eventRows}
        />
        <CardTableSection
            name="Song-Jinn operation plans"
            title={g.planCards}
            head={[col.number, col.name, col.vp, col.level, col.provinces, col.effect]}
            rows={planRows}
        />
    </CardTablePage>;
};

export default SongJinnCardTable;
