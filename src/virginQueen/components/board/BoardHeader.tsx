import React from "react";
import {VQGame} from "../../constant/general";
import {POWER_NAMES, CONTROLLER_COLORS} from "../../constant/general";
import {scenarioName} from "../../scenario";
import {victoryStandings} from "../../util";

const PHASE_LABELS: Record<string, string> = {
    cardDraw: "Card Draw 阶段",
    diplomacy: "外交阶段",
    spring: "春季部署",
    action: "行动阶段",
};

interface BoardHeaderProps {
    G: VQGame;
    ctx: any;
    me?: string;
    cp?: number;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({G, ctx, me, cp}) => {
    const phase = ctx.phase ?? "";
    const standings = victoryStandings(G);
    
    return (
        <header className="vq-status">
            <div>
                <div className="vq-eyebrow">A game of diplomacy & empire · 1559–1598</div>
                <h1 className="vq-title">Virgin Queen</h1>
            </div>
            <div className="vq-status-meta">
                <span>{scenarioName(G.scenario)} · 第 {G.year}{G.scenario === "tutorial" ? " / 3" : ""} 回合</span>
                <span> / {PHASE_LABELS[phase] ?? phase}</span>
                <strong>{ctx.gameover !== undefined ? "对局结束" : `当前：${POWER_NAMES[G.activePower as keyof typeof POWER_NAMES].zh}`}</strong>
                <span>{me ? `${POWER_NAMES[me as keyof typeof POWER_NAMES].zh} · ${cp} CP` : "旁观模式"}</span>
                {standings.map((entry: any) => (
                    <span key={entry.power} className="vq-score">
                        <i className="vq-dot" style={{background: (CONTROLLER_COLORS as any)[entry.power]}}/>
                        {(POWER_NAMES as any)[entry.power].short} <b>{entry.vp} VP</b>
                    </span>
                ))}
            </div>
        </header>
    );
};
