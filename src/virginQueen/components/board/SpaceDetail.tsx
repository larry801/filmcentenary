import React from "react";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import {VQGame} from "../../constant/general";
import {SPACE_BY_ID, SEA_ZONE_BY_ID} from "../../mapData";
import {AREA_NAMES, POWER_NAMES, isPower, landCount, navalCount} from "../../constant/general";
import {controllerNameZh} from "../../ownership";
import {LEADER_BY_ID} from "../../constant/leaders";

const cell = (v: number): string => (v > 0 ? String(v) : "·");

interface SpaceDetailProps {
    G: VQGame;
    selected?: string;
}

export const SpaceDetail: React.FC<SpaceDetailProps> = ({G, selected}) => {
    const space = selected !== undefined ? G.spaces[selected] : undefined;
    const spaceDef = selected !== undefined ? SPACE_BY_ID[selected] : undefined;
    const selectedSea = selected ? G.seaZones[selected as keyof VQGame["seaZones"]] : undefined;
    
    if (space !== undefined && spaceDef !== undefined) {
        return (
            <section className="vq-space-detail" aria-label="选中地区详情">
                <Typography variant="subtitle2">{spaceDef.name}</Typography>
                <Typography variant="caption" color="text-secondary">
                    {spaceDef.kind === "key" ? "关键城市" : spaceDef.kind === "fortress" ? "要塞" : "开放城市"}
                    {spaceDef.ports !== undefined && spaceDef.ports.length > 0 ? ` · 港口：${spaceDef.ports.join(", ")}` : ""}
                    {spaceDef.area !== undefined ? ` · ${AREA_NAMES[spaceDef.area].zh}` : ""}
                </Typography>
                <Typography variant="body2" sx={{mt: 0.5}}>
                    控制：<b>{isPower(space.control) ? POWER_NAMES[space.control].zh : space.control}</b>
                    {" · "}{space.religion === "protestant" ? "新教" : "天主教"}
                    {space.unrest ? " · 动荡" : ""}
                    {space.siege !== undefined ? ` · 被 ${POWER_NAMES[space.siege.by].short} 围困` : ""}
                </Typography>
                {Object.keys(space.land).map((c) => {
                    const st = space.land[c as keyof typeof space.land];
                    if (st === undefined) return null;
                    return <Typography key={c} variant="caption" sx={{display: "block"}}>
                        陆军 {controllerNameZh(c as any)}: 正规 {cell(st.regular)} / 雇佣 {cell(st.merc)} / 骑兵 {cell(st.cav)}
                    </Typography>;
                })}
                {Object.keys(space.naval).map((c) => {
                    const st = space.naval[c as keyof typeof space.naval];
                    if (st === undefined) return null;
                    return <Typography key={c} variant="caption" sx={{display: "block"}}>
                        海军 {controllerNameZh(c as any)}: 桨帆 {cell(st.galley)} / 大帆 {cell(st.galleon)} / 快帆 {cell(st.racebuilt)} / 海盗 {cell(st.corsair)}
                    </Typography>;
                })}
                {G.espionage?.jesuits.includes(selected!) && <Chip size="small" label="耶稣会士"/>}
                {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
                    将领：{space.leaders.map((id: string) => LEADER_BY_ID[id]?.name ?? id).join("、")}
                </Typography>}
            </section>
        );
    }
    
    if (selectedSea && selected) {
        return (
            <section className="vq-space-detail" aria-label="选中海域详情">
                <Typography variant="subtitle2">{SEA_ZONE_BY_ID[selected]?.name}</Typography>
                <Typography variant="caption">海域舰队</Typography>
                {Object.entries(selectedSea.naval).map(([controller, stack]: [string, any]) => (
                    <Typography key={controller} variant="body2">
                        {controllerNameZh(controller as any)}：桨帆 {stack?.galley ?? 0} / 大帆 {stack?.galleon ?? 0} / 快帆 {stack?.racebuilt ?? 0} / 海盗 {stack?.corsair ?? 0}
                    </Typography>
                ))}
                {Object.keys(selectedSea.naval).length === 0 && <Typography variant="body2">此海域无舰队。</Typography>}
            </section>
        );
    }
    
    return null;
};
