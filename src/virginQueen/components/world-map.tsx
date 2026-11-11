import React from "react";
import i18n from "../../constant/i18n";
import {CONTROLLER_COLORS, Controller, VQGame, controllerName} from "../constant/general";
import {WORLD_MAP_HEIGHT, WORLD_MAP_LOCATIONS, WORLD_MAP_WIDTH, projectWorld} from "../data/world-map";
import worldLand from "../data/world-background.json";
import {MapLabelPlacement, placeMapLabels} from "./map-geometry";

const WORLD_LABEL_FONT_SIZE = 6.2;
const WORLD_LABEL_DISTANCES = [7, 10, 14, 19, 25, 32] as const;

const ownerColor = (owner: Controller | undefined): string =>
    owner === undefined ? "#d2ccbe" : CONTROLLER_COLORS[owner];

/**
 * The physical board's World Map runs along the left and bottom edges.  Screen
 * space does not allow that full L-shaped layout, so the same triangular
 * settlement spaces are presented as a compact, collapsible inset over the
 * Atlantic — or, with `primary`, as the full-size board while the Europe map
 * takes over the inset.  Gold/maroon/gray triangles follow the printed home
 * colours; the current control marker and colony state are layered on top.
 */
export const WorldMapInset = ({G, primary = false}: {G: VQGame; primary?: boolean}) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    // Keep the inset open on desktop where there is spare Atlantic space, but
    // start collapsed on phones where it would otherwise cover the Europe map.
    // The primary view always fills the board, so there is nothing to fold.
    const [openState, setOpen] = React.useState(() => typeof window === "undefined" || window.innerWidth >= 600);
    const open = primary || openState;
    const colonyCount = Object.keys(G.worldColonies).length;
    const locations = WORLD_MAP_LOCATIONS.filter((location) => {
        if (!location.gameOnly) return true;
        if (location.gameId === undefined) return false;
        return G.worldColonies[location.gameId] !== undefined || G.worldControls[location.gameId] !== undefined;
    });
    const labels = placesFor(locations, G, vqLocale);
    const placements = React.useMemo(() => placeMapLabels(labels, {
        fontSize: WORLD_LABEL_FONT_SIZE,
        bounds: {width: WORLD_MAP_WIDTH, height: WORLD_MAP_HEIGHT},
        candidateDistances: WORLD_LABEL_DISTANCES,
    }), [G, vqLocale, open]);

    const heading = <>
        <span>{i18n.chain.vq.worldUi.worldMap}</span>
        <span className="vq-world-map-count">{colonyCount} {i18n.chain.vq.worldUi.coloniesShort}</span>
    </>;
    const body = <div className="vq-world-map-body">
        <svg viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`} role="img"
             aria-label={i18n.chain.vq.worldUi.worldMapAria}>
            <rect width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} rx={3} fill="#b8d0cb"/>
            <path d={worldLand.path} fill="#e7dab9" stroke="#8a967b" strokeWidth={0.35} fillRule="evenodd"/>
            {locations.map((location) => {
                const [x, y] = projectWorld(location.lon, location.lat);
                const gameId = location.gameId ?? (G.worldControls[location.id] !== undefined || G.worldColonies[location.id] !== undefined ? location.id : undefined);
                const colonyOwner = gameId === undefined ? undefined : G.worldColonies[gameId];
                const controlOwner = gameId === undefined ? undefined : G.worldControls[gameId];
                const owner = colonyOwner ?? controlOwner ?? location.home;
                const name = vqLocale === "en" ? location.nameEn : location.nameZh;
                const ownerText = owner === undefined ? i18n.chain.vq.worldUi.vacant : controllerName(owner, vqLocale);
                const label = `${name} · ${ownerText}${colonyOwner !== undefined ? ` · ${i18n.chain.vq.worldUi.colony}` : ""}`;
                const placement: MapLabelPlacement | undefined = placements[location.id];
                const active = colonyOwner !== undefined;
                const size = active ? 4.8 : 4.2;
                return <g key={location.id} className={`vq-world-location${active ? " vq-world-colony" : ""}`} role="img" aria-label={label}>
                    <title>{label}</title>
                    <polygon points={`${x},${y - size} ${x + size},${y + size * 0.8} ${x - size},${y + size * 0.8}`}
                             fill={ownerColor(owner)} stroke={active ? "#fffdf6" : "#4b3d2b"}
                             strokeWidth={active ? 1.25 : 0.6}/>
                    {placement !== undefined && <g pointerEvents="none">
                        {placement.leader !== undefined && <line className="vq-world-label-leader" {...placement.leader}/>}
                        <text x={placement.x} y={placement.y} textAnchor={placement.textAnchor}
                              dominantBaseline="central" fontSize={WORLD_LABEL_FONT_SIZE}
                              fontWeight={active ? 700 : 500} fill="#30291e" paintOrder="stroke"
                              stroke="#f4eddd" strokeWidth={1.7} strokeLinejoin="round">{name}</text>
                    </g>}
                </g>;
            })}
        </svg>
        <div className="vq-world-map-key">
            <span><i style={{background: CONTROLLER_COLORS.spain}}/>{i18n.chain.vq.worldUi.spanishHome}</span>
            <span><i style={{background: CONTROLLER_COLORS.portugal}}/>{i18n.chain.vq.worldUi.portugueseHome}</span>
            <span><i style={{background: "#d2ccbe"}}/>{i18n.chain.vq.worldUi.unoccupiedSpace}</span>
        </div>
    </div>;

    // As the primary view the world map takes over the whole board instead of
    // floating as a collapsible inset over the Atlantic.
    if (primary) {
        return <section className="vq-world-map vq-world-map-primary" role="region"
                        aria-label={i18n.chain.vq.worldUi.worldMapAria}>
            <div className="vq-world-map-heading">{heading}</div>
            {body}
        </section>;
    }
    return <details className="vq-world-map" open={open}
                    onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
        <summary>{heading}</summary>
        {body}
    </details>;
};

const placesFor = (
    locations: typeof WORLD_MAP_LOCATIONS,
    G: VQGame,
    vqLocale: "en" | "zh_CN",
) => locations.map((location) => {
    const [x, y] = projectWorld(location.lon, location.lat);
    const gameId = location.gameId;
    const active = gameId !== undefined && G.worldColonies[gameId] !== undefined;
    const controlled = gameId !== undefined && G.worldControls[gameId] !== undefined;
    return {
        id: location.id,
        x,
        y,
        text: vqLocale === "en" ? location.nameEn : location.nameZh,
        priority: active ? 700 : controlled || location.home !== undefined ? 380 : 220,
        visible: true,
    };
});
