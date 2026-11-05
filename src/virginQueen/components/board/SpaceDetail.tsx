import React from "react";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import i18n from "../../constant/i18n";
import {VQGame} from "../../constant/general";
import {SPACE_BY_ID, SEA_ZONE_BY_ID} from "../../mapData";
import {areaName, controllerName, isPower, powerName} from "../../constant/general";
import {LEADER_BY_ID} from "../../constant/leaders";

const cell = (v: number): string => (v > 0 ? String(v) : "·");

interface SpaceDetailProps {
    G: VQGame;
    selected?: string;
}

export const SpaceDetail: React.FC<SpaceDetailProps> = ({G, selected}) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const e = i18n.chain.vq.board;
    const space = selected !== undefined ? G.spaces[selected] : undefined;
    const spaceDef = selected !== undefined ? SPACE_BY_ID[selected] : undefined;
    const selectedSea = selected ? G.seaZones[selected as keyof VQGame["seaZones"]] : undefined;
    
    if (space !== undefined && spaceDef !== undefined) {
        return (
            <section className="vq-space-detail" aria-label={e.spaceDetailLabel}>
                <Typography variant="subtitle2">{spaceDef.name}</Typography>
                <Typography variant="caption" color="text-secondary">
                    {spaceDef.kind === "key" ? e.keyCity : spaceDef.kind === "fortress" ? e.fortress : e.openCity}
                    {spaceDef.ports !== undefined && spaceDef.ports.length > 0 ? ` · ${e.port}: ${spaceDef.ports.join(", ")}` : ""}
                    {spaceDef.area !== undefined ? ` · ${areaName(spaceDef.area, vqLocale)}` : ""}
                </Typography>
                <Typography variant="body2" sx={{mt: 0.5}}>
                    {e.control}: <b>{isPower(space.control) ? powerName(space.control, vqLocale) : controllerName(space.control, vqLocale)}</b>
                    {" · "}{space.religion === "protestant" ? e.protestant : e.catholic}
                    {space.unrest ? ` · ${e.unrest}` : ""}
                    {space.siege !== undefined ? ` · ${e.besiegedBy} ${powerName(space.siege.by, vqLocale)}` : ""}
                </Typography>
                {Object.keys(space.land).map((c) => {
                    const st = space.land[c as keyof typeof space.land];
                    if (st === undefined) return null;
                    return <Typography key={c} variant="caption" sx={{display: "block"}}>
                        {e.army} {controllerName(c as any, vqLocale)}: {e.regular} {cell(st.regular)} / {e.merc} {cell(st.merc)} / {e.cav} {cell(st.cav)}
                    </Typography>;
                })}
                {Object.keys(space.naval).map((c) => {
                    const st = space.naval[c as keyof typeof space.naval];
                    if (st === undefined) return null;
                    return <Typography key={c} variant="caption" sx={{display: "block"}}>
                        {e.navy} {controllerName(c as any, vqLocale)}: {e.galley} {cell(st.galley)} / {e.galleon} {cell(st.galleon)} / {e.racebuilt} {cell(st.racebuilt)} / {e.corsair} {cell(st.corsair)}
                    </Typography>;
                })}
                {G.espionage?.jesuits.includes(selected!) && <Chip size="small" label={e.jesuits}/>}
                {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
                    {e.leaders}: {space.leaders.map((id: string) => LEADER_BY_ID[id]?.name ?? id).join(", ")}
                </Typography>}
            </section>
        );
    }
    
    if (selectedSea && selected) {
        return (
            <section className="vq-space-detail" aria-label={e.seaDetailLabel}>
                <Typography variant="subtitle2">{SEA_ZONE_BY_ID[selected]?.name}</Typography>
                <Typography variant="caption">{e.seaFleets}</Typography>
                {Object.entries(selectedSea.naval).map(([controller, stack]: [string, any]) => (
                    <Typography key={controller} variant="body2">
                        {controllerName(controller as any, vqLocale)}: {e.galley} {stack?.galley ?? 0} / {e.galleon} {stack?.galleon ?? 0} / {e.racebuilt} {stack?.racebuilt ?? 0} / {e.corsair} {stack?.corsair ?? 0}
                    </Typography>
                ))}
                {Object.keys(selectedSea.naval).length === 0 && <Typography variant="body2">{e.noFleet}</Typography>}
            </section>
        );
    }
    
    return null;
};
