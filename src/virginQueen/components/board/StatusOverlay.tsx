import React from "react";
import IconButton from "@mui/material/IconButton";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import i18n from "../../../constant/i18n";
import {CONTROLLER_COLORS, powerName, powerShortName} from "../../constant/general";
import {scenarioName} from "../../scenario";
import {useVQBoard} from "./BoardContext";

const STORAGE_KEY = "vq.statusCollapsed";

/** Remembered choice first; otherwise phones start collapsed so the map stays visible. */
const initialCollapsed = (): boolean => {
    // Server rendering (and node-environment tests) has no window: render expanded.
    if (typeof window === "undefined") return false;
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored !== null) return stored === "1";
    } catch {
        // Storage can be unavailable (privacy mode, tests); fall through to the default.
    }
    return typeof window.matchMedia === "function" && !window.matchMedia("(min-width:1024px)").matches;
};

/**
 * Game status (scenario, turn, phase, active power, scores) as a card that
 * floats over the map instead of taking a full row above it. It can be
 * collapsed to a one-line pill.
 */
export const StatusOverlay = () => {
    const {G, ctx, me, cp, vqLocale, displayYear, phaseText, standings} = useVQBoard();
    const [collapsed, setCollapsed] = React.useState(initialCollapsed);
    const toggle = (): void => {
        setCollapsed((current) => {
            const next = !current;
            try {
                window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
            } catch {
                // Ignore: collapse still works for this session.
            }
            return next;
        });
    };
    const gameOver = ctx.gameover !== undefined;
    const turnText = `${scenarioName(G.scenario, vqLocale)} · ${i18n.chain.vq.header.turn} ${displayYear}${G.scenario === "tutorial" ? " / 3" : ""}`;
    const currentText = gameOver ? i18n.chain.vq.header.gameOver
        : `${i18n.chain.vq.header.current}${i18n.chain.vq.punct.colon}${powerName(G.activePower, vqLocale)}`;
    const toggleLabel = collapsed ? i18n.chain.vq.header.expandStatus : i18n.chain.vq.header.collapseStatus;
    const contentId = React.useId();
    return <header className={`vq-status${collapsed ? " vq-status--collapsed" : ""}`}>
        <div className="vq-status-head">
            {!gameOver && <i className="vq-dot vq-status-turn-dot" style={{background: CONTROLLER_COLORS[G.activePower]}} aria-hidden="true"/>}
            <div className="vq-status-titles">
                {!collapsed && <div className="vq-eyebrow">{i18n.chain.vq.header.eyebrow}</div>}
                <h1 className="vq-title">Virgin Queen</h1>
            </div>
            {collapsed && <span className="vq-status-summary">
                {`${i18n.chain.vq.header.turn} ${displayYear}`}{phaseText !== "" ? ` · ${phaseText}` : ""} · <strong>{currentText}</strong>
            </span>}
            <IconButton size="small" className="vq-status-toggle" aria-label={toggleLabel} title={toggleLabel}
                        aria-expanded={!collapsed} aria-controls={contentId} onClick={toggle}>
                {collapsed ? <ExpandMoreIcon fontSize="small"/> : <ExpandLessIcon fontSize="small"/>}
            </IconButton>
        </div>
        <div className="vq-status-meta" id={contentId} hidden={collapsed}>
            <span>{turnText}</span>
            {phaseText !== "" && <span> / {phaseText}</span>}
            <strong>{currentText}</strong>
            <span>{me ? `${i18n.chain.vq.header.viewing} ${powerName(me, vqLocale)} · ${cp} CP` : i18n.chain.vq.header.spectator}</span>
            {standings.map((entry) => <span key={entry.power} className="vq-score">
                <i className="vq-dot" style={{background: CONTROLLER_COLORS[entry.power]}}/>{powerShortName(entry.power, vqLocale)} <b>{entry.vp} VP</b>
            </span>)}
        </div>
    </header>;
};
