import React from "react";
import {Controller, landCount, navalCount, Religion, VQGame} from "../constant/general";
import {LAND_LINKS, SEA_ZONES, SPACE_BY_ID, SPACES} from "../constant/spaces";
import {CONTROLLER_COLORS} from "../constant/general";

const X = (lon: number): number => 10 + ((lon + 11) / 47) * 980;
const Y = (lat: number): number => 10 + ((58 - lat) / 26) * 600;

const nodeColor = (control: Controller): string => CONTROLLER_COLORS[control] ?? "#9e9e9e";

export interface VQMapProps {
    G: VQGame;
    selected?: string;
    onSelect: (id: string) => void;
}

function SpaceShape({id, G, selected, onSelect}: { id: string; G: VQGame; selected?: string; onSelect: (id: string) => void }) {
    const def = SPACE_BY_ID[id];
    const st = G.spaces[id];
    const x = X(def.lon);
    const y = Y(def.lat);
    const color = nodeColor(st.control);
    const stroke = st.religion === "protestant" ? "#ffffff" : "#1b1b1b";
    const isSelected = selected === id;
    const landN = Object.keys(st.land).reduce((n, c) => n + landCount(st.land[c as Controller]), 0);
    const navalN = Object.keys(st.naval).reduce((n, c) => n + navalCount(st.naval[c as Controller]), 0);
    const total = landN + navalN;
    const leaders = st.leaders.length;
    const kind = def.kind === "open" && G.spaces[id].fortress ? "fortress" : def.kind;
    let shape: React.ReactNode;
    if (kind === "key") {
        shape = <rect x={x - 6} y={y - 6} width={12} height={12} fill={color} stroke={stroke}
                      strokeWidth={isSelected ? 3 : 1.4}/>;
    } else if (kind === "fortress") {
        shape = <polygon points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`} fill={color}
                         stroke={stroke} strokeWidth={isSelected ? 3 : 1.4}/>;
    } else {
        shape = <circle cx={x} cy={y} r={6} fill={color} stroke={stroke} strokeWidth={isSelected ? 3 : 1.4}/>;
    }
    const title = [
        def.name,
        `控制：${st.control}`,
        `宗教：${st.religion === "protestant" ? "新教" : "天主教"}`,
        `陆军 ${landN} / 海军 ${navalN} / 将领 ${leaders}`,
        st.unrest ? "动荡" : "",
        st.siege ? `被 ${st.siege.by} 围困` : "",
    ].filter(Boolean).join("\n");
    return <g onClick={() => onSelect(id)} style={{cursor: "pointer"}}>
        <title>{title}</title>
        {isSelected && <circle cx={x} cy={y} r={12} fill="none" stroke="#ffd54f" strokeWidth={2.5}/>}
        {st.unrest && <circle cx={x} cy={y} r={9.5} fill="none" stroke="#d32f2f" strokeWidth={1.6}
                              strokeDasharray="2 2"/>}
        {st.siege && <circle cx={x} cy={y} r={11} fill="none" stroke="#ff8f00" strokeWidth={1.4}/>}
        {shape}
        {total > 0 && <text x={x + 8} y={y - 6} fontSize={7} fill="#111" fontWeight={700}>{total}</text>}
        {leaders > 0 && <text x={x + 8} y={y + 3} fontSize={6} fill="#4a148c">L{leaders}</text>}
        <text x={x} y={y + 17} textAnchor="middle" fontSize={6.4} fill="#212121">{def.name}</text>
    </g>;
}

export const VQMap = ({G, selected, onSelect}: VQMapProps) => {
    return <svg viewBox="0 0 1000 620" width="100%" style={{background: "#f3ead3", borderRadius: 8, border: "1px solid #d7c9a5"}}>
        <rect x={0} y={0} width={1000} height={620} fill="#efe3c4"/>
        <rect x={20} y={250} width={960} height={360} fill="#dceef6" opacity={0.65}/>
        {LAND_LINKS.map(([a, b, pass], i) => {
            const da = SPACE_BY_ID[a];
            const db = SPACE_BY_ID[b];
            return <line key={`l-${i}`} x1={X(da.lon)} y1={Y(da.lat)} x2={X(db.lon)} y2={Y(db.lat)}
                         stroke={pass ? "#8d6e63" : "#9e8f6f"} strokeWidth={pass ? 1 : 0.8}
                         strokeDasharray={pass ? "3 2" : undefined} opacity={0.65}/>;
        })}
        {SEA_ZONES.map((z) => <text key={z.id} x={X(z.label[0])} y={Y(z.label[1])} fontSize={9}
                                    fill="#2b6f8a" fontStyle="italic" textAnchor="middle" opacity={0.85}>
            {z.name}
        </text>)}
        {SPACES.map((s) => <SpaceShape key={s.id} id={s.id} G={G} selected={selected} onSelect={onSelect}/>)}
        <g transform="translate(20, 596)">
            <rect x={0} y={-10} width={11} height={11} fill="#fff" stroke="#222"/>
            <text x={15} y={0} fontSize={8}>Key</text>
            <polygon points="68,-10 74,-4 68,2 62,-4" fill="#fff" stroke="#222"/>
            <text x={78} y={0} fontSize={8}>Fortress</text>
            <circle cx={134} cy={-5} r={5} fill="#fff" stroke="#222"/>
            <text x={142} y={0} fontSize={8}>Open</text>
            <circle cx={184} cy={-5} r={7} fill="none" stroke="#d32f2f" strokeDasharray="2 2"/>
            <text x={194} y={0} fontSize={8}>Unrest</text>
            <circle cx={242} cy={-5} r={7} fill="none" stroke="#ff8f00"/>
            <text x={252} y={0} fontSize={8}>Siege</text>
        </g>
    </svg>;
};

export const religionLabel = (r: Religion): string => r === "protestant" ? "新教" : "天主教";
