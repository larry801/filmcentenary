import React from "react";
import i18n from "../../constant/i18n";
import {VQGame} from "../../constant/general";
import {POWER_NAMES, powerName, Power} from "../../constant/general";
import {CONTROLLER_COLORS} from "../../constant/general";
import {scenarioName} from "../../scenario";
import {victoryStandings} from "../../util";

const PHASE_LABELS: Record<string, string> = {};

interface BoardHeaderProps {
    G: VQGame;
    ctx: any;
    me?: string;
    cp?: number;
}

export const BoardHeader: React.FC<BoardHeaderProps> = ({G, ctx, me, cp}) => {
    i18n.use();
    const vqLocale = (i18n.getLocaleName() === "en" ? "en" : "zh_CN") as "en" | "zh_CN";
    const phase = ctx.phase ?? "";
    const phaseLabel = i18n.chain.vq.header.phase[phase as keyof typeof i18n.chain.vq.header.phase] ?? phase;
    const standings = victoryStandings(G);
    
    return (
        <header className="vq-status">
            <div>
                <div className="vq-eyebrow">{i18n.chain.vq.header.eyebrow}</div>
                <h1 className="vq-title">{i18n.chain.vq.header.title}</h1>
            </div>
            <div className="vq-status-meta">
                <span>{scenarioName(G.scenario)} · {i18n.chain.vq.header.turn} {G.year}{G.scenario === "tutorial" ? " / 3" : ""}</span>
                <span> / {phaseLabel}</span>
                <strong>{ctx.gameover !== undefined ? i18n.chain.vq.header.gameOver : `${i18n.chain.vq.header.current}：${powerName(G.activePower, vqLocale)}`}</strong>
                <span>{me ? `${powerName(me as Power, vqLocale)} · ${cp} CP` : i18n.chain.vq.header.spectator}</span>
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
