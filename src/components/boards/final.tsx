import React from "react";
import i18n from "../../constant/i18n";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import {IG} from "../../types/setup";
import {rank} from "../../game/util";
import {Ctx, PlayerID} from "boardgame.io";
import {
    Region,
} from "../../types/core";
import {getColor} from "../icons";
import {getCardName, CardPanel} from "../card";
import {calcCardEfficiency, calcRoundFromTurn} from "../../game/statMetrics";
import './final.css';


export interface IFinalScoreTableProps {
    G: IG,
    ctx: Ctx,
    getName:(p:PlayerID)=>string;
    showFinalScoreTable?: boolean,
    showStatsSection?: boolean,
}

type MetricType = "level" | "score" | "eraRatio" | "time" | "vpStats";

const regionsBySeat = [Region.NA, Region.WE, Region.EE, Region.ASIA];

const getTimeSnapshotForPlayer = (G: IG, playerIndex: number): { roundTimeMs: number, totalTimeMs: number } => {
    const playerID = playerIndex.toString();
    const tracking = G.timeTracking;
    const baseRound = tracking?.roundTimeMsByPlayer?.[playerID] || 0;
    const baseTotal = tracking?.totalTimeMsByPlayer?.[playerID] || 0;
    const currentPlayer = tracking?.currentTurnPlayer;
    const startedAt = tracking?.currentTurnStartedAtMs || 0;
    if (currentPlayer === playerID && startedAt > 0) {
        const running = Math.max(0, Date.now() - startedAt);
        return {
            roundTimeMs: baseRound + running,
            totalTimeMs: baseTotal + running,
        };
    }
    return {
        roundTimeMs: baseRound,
        totalTimeMs: baseTotal,
    };
}

const metricValue = (
    metric: MetricType,
    item: { industry: number, aesthetics: number, score: number, eraRatio: number, roundTimeMs: number, totalTimeMs: number },
): number => {
    if (metric === "level") {
        return (item.industry || 0) + (item.aesthetics || 0);
    }
    if (metric === "score") {
        return item.score || 0;
    }
    if (metric === "time") {
        return (item.totalTimeMs || 0) / 1000;
    }
    if (metric === "vpStats") {
        return 0;
    }
    return (item.eraRatio || 0) * 100;
}

const metricLabel = (metric: MetricType): string => {
    if (metric === "level") {
        return "等级";
    }
    if (metric === "score") {
        return "分数";
    }
    if (metric === "eraRatio") {
        return "牌效比";
    }
    if (metric === "time") {
        return "时间（总用时）";
    }
    if (metric === "vpStats") {
        return "分数统计";
    }
    return "";
}

const formatDuration = (ms: number): string => {
    const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const formatMetric = (metric: MetricType, value: number): string => {
    if (metric === "eraRatio") {
        return value.toFixed(2);
    }
    if (metric === "time") {
        return formatDuration(value * 1000);
    }
    return value.toFixed(2);
}

// 2026-10 分数来源统计：固定展示顺序（未列出的来源排在后面）
const VP_SOURCE_ORDER = ["美学奖励", "争夺", "电影院", "制片厂", "地区结算（北美）", "地区结算（西欧）", "地区结算（东欧）", "地区结算（亚洲）", "地区结算", "牌分", "工业大奖", "美学大奖", "第一名标志物", "卡牌效果", "事件", "初始设置", "其他效果"];
const VP_REGION_PSEUDO_ID = "__region__";
const VP_OTHER_PSEUDO_ID = "__other__";

/** 是否为「地区结算」类来源（兼容旧数据的无地区写法） */
const isRegionSettlementSource = (source: string): boolean => source === "地区结算" || source.startsWith("地区结算（");

const FinalScoreTable = ({G, ctx, getName, showFinalScoreTable = true, showStatsSection = true}: IFinalScoreTableProps) => {
    i18n.use();
    const [metric, setMetric] = React.useState<MetricType>("level");
    const [hoveredPlayer, setHoveredPlayer] = React.useState<number | null>(null);
    const [showStats, setShowStats] = React.useState<boolean>(showStatsSection && !showFinalScoreTable);
    const [vpStatsMode, setVpStatsMode] = React.useState<"source" | "card">("source");
    // 按牌模式下，悬停的卡牌显示在同一行的「相邻一列」，不遮挡正在浏览的那一列
    const [vpCardPreview, setVpCardPreview] = React.useState<{player: number, cardId: string} | null>(null);
    // 窄屏（手机）没有 hover，也没有相邻列可用，改为只用点击详情
    const [isNarrow, setIsNarrow] = React.useState<boolean>(() =>
        typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches
    );
    React.useEffect(() => {
        const mq = window.matchMedia("(max-width: 900px)");
        const onChange = () => setIsNarrow(mq.matches);
        onChange();
        mq.addListener(onChange);
        return () => mq.removeListener(onChange);
    }, []);
    // 按牌列表同一行有几列（与下方 Grid 的 md/sm 断点一致），用于定位「相邻列」
    const [cardsPerRow, setCardsPerRow] = React.useState<number>(() =>
        typeof window !== "undefined" && window.matchMedia("(min-width: 960px)").matches ? 4 : 2
    );
    React.useEffect(() => {
        const mq = window.matchMedia("(min-width: 960px)");
        const onChange = () => setCardsPerRow(mq.matches ? 4 : 2);
        onChange();
        mq.addListener(onChange);
        return () => mq.removeListener(onChange);
    }, []);
    const [vpSourceDetail, setVpSourceDetail] = React.useState<{player: number, source: string} | null>(null);
    const [vpCardDetail, setVpCardDetail] = React.useState<{player: number, cardId: string} | null>(null);
    // 按牌列表各列的 DOM 引用（用于测量相邻列位置）与浮层的屏幕矩形
    const vpCardColRefs = React.useRef<Array<HTMLDivElement | null>>([]);
    const [vpPreviewAnchor, setVpPreviewAnchor] = React.useState<{top: number, left: number, width: number} | null>(null);


    const scoreRank = (a: string, b: string) => rank(G, ctx, parseInt(a), parseInt(b));
    const order = [...G.order]
    const getPlainPlayerName = (playerIndex: number): string => {
        const raw = getName(playerIndex.toString() as PlayerID);
        return raw.replace(/\(\*\*\)|\(\*\)/g, "");
    };

    const timeline = React.useMemo(() => {
        const source = Array.isArray(G.settlementTimeline) ? [...G.settlementTimeline] : [];
        const currentTurn = typeof ctx.turn === "number" && Number.isFinite(ctx.turn) ? ctx.turn : 0;
        const playerCount = G.playerCount || G.pub.length || 1;
        const currentSnapshot = {
            turn: currentTurn,
            round: calcRoundFromTurn(currentTurn, playerCount),
            players: G.pub.map((p, idx) => ({
                industry: p.industry || 0,
                aesthetics: p.aesthetics || 0,
                score: (p.finalScoring?.total || 0) > 0 ? (p.finalScoring?.total || 0) : (p.vp || 0),
                eraRatio: calcCardEfficiency(G, idx),
                roundTimeMs: 0,
                totalTimeMs: 0,
            })),
        };
        currentSnapshot.players = currentSnapshot.players.map((item, idx) => {
            const t = getTimeSnapshotForPlayer(G, idx);
            return {
                ...item,
                roundTimeMs: t.roundTimeMs,
                totalTimeMs: t.totalTimeMs,
            };
        });
        if (!source.some(s => s.turn === currentTurn)) {
            source.push(currentSnapshot);
        }
        const normalized = source.map((s) => ({
            ...s,
            round: typeof (s as any).round === "number" ? (s as any).round : calcRoundFromTurn(s.turn, playerCount),
        }));
        normalized.sort((a, b) => a.turn - b.turn);
        const byRound = new Map<number, typeof normalized[number]>();
        normalized.forEach((s) => {
            byRound.set(s.round, s);
        });
        return Array.from(byRound.values()).sort((a, b) => a.round - b.round);
    }, [G, ctx.turn]);

    // 2026-10 分数来源统计：按来源
    const vpSourceMatrix = React.useMemo(() => {
        return G.pub.map(pub => {
            const merged: { [source: string]: number } = {};
            const add = (source: string, amount: number) => {
                if (!amount) return;
                merged[source] = (merged[source] || 0) + amount;
            };
            Object.entries(pub.vpStats?.source ?? {}).forEach(([source, amount]) => add(source, amount));
            Object.entries(pub.vpStatsFinal?.source ?? {}).forEach(([source, amount]) => add(source, amount));
            return merged;
        });
    }, [G.pub]);

    const vpSourceRows = React.useMemo(() => {
        const keys = new Set<string>();
        vpSourceMatrix.forEach(row => Object.keys(row).forEach(k => keys.add(k)));
        const ordered = VP_SOURCE_ORDER.filter(k => keys.has(k));
        const extra = Array.from(keys).filter(k => !VP_SOURCE_ORDER.includes(k)).sort();
        return [...ordered, ...extra];
    }, [vpSourceMatrix]);

    // 2026-10 分数来源统计：按牌
    const vpCardMatrix = React.useMemo(() => {
        return G.pub.map(pub => {
            const merged: { [cardId: string]: { [source: string]: number } } = {};
            const add = (cardId: string, source: string, amount: number) => {
                if (!amount) return;
                const entry = merged[cardId] ?? {};
                entry[source] = (entry[source] || 0) + amount;
                merged[cardId] = entry;
            };
            Object.entries(pub.vpStats?.card ?? {}).forEach(([cardId, sources]) => {
                Object.entries(sources).forEach(([source, amount]) => add(cardId, source, amount));
            });
            Object.entries(pub.vpStatsFinal?.card ?? {}).forEach(([cardId, sources]) => {
                Object.entries(sources).forEach(([source, amount]) => add(cardId, source, amount));
            });
            return merged;
        });
    }, [G.pub]);

    const vpCardCell = (playerIndex: number, cardId: string): number => {
        const row = vpCardMatrix[playerIndex] ?? {};
        const regionSource = Object.entries(vpSourceMatrix[playerIndex] ?? {})
            .filter(([source]) => isRegionSettlementSource(source))
            .reduce((sum, [, amount]) => sum + amount, 0);
        const regionAttributed = Object.values(row).reduce((sum, sources) => sum
            + Object.entries(sources)
                .filter(([source]) => isRegionSettlementSource(source))
                .reduce((a, [, amount]) => a + amount, 0), 0);
        if (cardId === VP_REGION_PSEUDO_ID) {
            return regionSource - regionAttributed;
        }
        if (cardId === VP_OTHER_PSEUDO_ID) {
            const pub = G.pub[playerIndex];
            const total = (pub.finalScoring?.total || 0) > 0 ? (pub.finalScoring?.total || 0) : (pub.vp || 0);
            const cardSum = Object.values(row).reduce((sum, sources) => sum + Object.values(sources).reduce((a, b) => a + b, 0), 0);
            return total - cardSum - (regionSource - regionAttributed);
        }
        return Object.values(row[cardId] ?? {}).reduce((a, b) => a + b, 0);
    };

    const vpPlayerTotal = (playerIndex: number): number => {
        const pub = G.pub[playerIndex];
        return (pub.finalScoring?.total || 0) > 0 ? (pub.finalScoring?.total || 0) : (pub.vp || 0);
    };

    const vpCardLabel = (cardId: string): string => {
        if (cardId === VP_REGION_PSEUDO_ID) return "地区结算";
        if (cardId === VP_OTHER_PSEUDO_ID) return "其他分数";
        if (cardId === "__unattributed__") return "未归属";
        return getCardName(cardId);
    };

    // 按牌视图：每个玩家一列，每项为（牌，分数）；末尾补「地区结算」「其他分数」以闭合数据
    const vpPlayerCardItems = (playerIndex: number): Array<{cardId: string, amount: number}> => {
        const row = vpCardMatrix[playerIndex] ?? {};
        const items = Object.keys(row)
            .map(cardId => ({
                cardId,
                amount: Object.values(row[cardId]).reduce((a, b) => a + b, 0),
            }))
            .filter(item => item.amount !== 0)
            .sort((a, b) => b.amount - a.amount);
        const region = vpCardCell(playerIndex, VP_REGION_PSEUDO_ID);
        const other = vpCardCell(playerIndex, VP_OTHER_PSEUDO_ID);
        if (region !== 0) items.push({cardId: VP_REGION_PSEUDO_ID, amount: region});
        if (other !== 0) items.push({cardId: VP_OTHER_PSEUDO_ID, amount: other});
        return items;
    };

    // 按来源详情：该玩家在该来源下，每张牌贡献了多少分
    const vpSourceDetailRows = (playerIndex: number, source: string): Array<{cardId: string, amount: number}> => {
        const row = vpCardMatrix[playerIndex] ?? {};
        const items: Array<{cardId: string, amount: number}> = [];
        Object.entries(row).forEach(([cardId, sources]) => {
            const amount = sources[source] || 0;
            if (amount !== 0) items.push({cardId, amount});
        });
        items.sort((a, b) => b.amount - a.amount);
        const attributed = items.reduce((sum, item) => sum + item.amount, 0);
        const total = vpSourceMatrix[playerIndex]?.[source] || 0;
        const remainder = total - attributed;
        if (remainder !== 0) items.push({cardId: "__unattributed__", amount: remainder});
        return items;
    };

    // 按牌详情：该玩家该牌在每个来源提供了多少分
    const vpCardDetailRows = (playerIndex: number, cardId: string): Array<{source: string, amount: number}> => {
        if (cardId === VP_REGION_PSEUDO_ID) {
            const row = vpCardMatrix[playerIndex] ?? {};
            const result: Array<{source: string, amount: number}> = [];
            Object.entries(vpSourceMatrix[playerIndex] ?? {}).forEach(([source, total]) => {
                if (!isRegionSettlementSource(source)) return;
                const attributed = Object.values(row).reduce((sum, sources) => sum + (sources[source] || 0), 0);
                const residual = total - attributed;
                if (residual !== 0) result.push({source, amount: residual});
            });
            return result.sort((a, b) => b.amount - a.amount);
        }
        if (cardId === VP_OTHER_PSEUDO_ID) {
            const row = vpCardMatrix[playerIndex] ?? {};
            const attributedBySource: {[source: string]: number} = {};
            Object.values(row).forEach(sources => Object.entries(sources).forEach(([source, amount]) => {
                attributedBySource[source] = (attributedBySource[source] || 0) + amount;
            }));
            const result: Array<{source: string, amount: number}> = [];
            Object.entries(vpSourceMatrix[playerIndex] ?? {}).forEach(([source, total]) => {
                if (isRegionSettlementSource(source)) return;
                const residual = total - (attributedBySource[source] || 0);
                if (residual !== 0) result.push({source, amount: residual});
            });
            return result.sort((a, b) => b.amount - a.amount);
        }
        const sources = vpCardMatrix[playerIndex]?.[cardId] ?? {};
        return Object.entries(sources)
            .filter(([, amount]) => amount !== 0)
            .map(([source, amount]) => ({source, amount}))
            .sort((a, b) => b.amount - a.amount);
    };

    // 卡面预览位置：放在同一行的相邻列；当所在列是行末时改用左侧列
    const previewCardId = vpCardPreview !== null ? vpCardPreview.cardId : null;
    const previewOwner = vpCardPreview !== null ? vpCardPreview.player : null;
    // 相邻列下标：行内还有右侧列时用右邻列，处于行末则用左邻列
    const previewSlotFor = (owner: number): number | null => {
        const total = G.pub.length;
        const rowStart = Math.floor(owner / cardsPerRow) * cardsPerRow;
        const rowEnd = Math.min(total, rowStart + cardsPerRow) - 1;
        if (owner < rowEnd) return owner + 1;
        if (owner > rowStart) return owner - 1;
        return null;
    };
    // 悬停卡牌：记录卡牌 + 相邻列在屏幕上的位置。
    // 浮层用 fixed 定位（不占文档流）+ 固定高度：
    // 否则浮层一变高就会撑高页面 / 挤走滚动条，导致鼠标底下的卡牌换掉，
    // 触发新的 mouseenter → 浮层再变高 → 反复循环（抽搐）。
    const showCardPreview = (owner: number, cardId: string) => {
        if (isNarrow) return;
        // 同一张牌重复触发（鼠标抖动）时不做任何事，避免状态反复刷新
        if (vpCardPreview !== null && vpCardPreview.player === owner && vpCardPreview.cardId === cardId) return;
        const targetSlot = previewSlotFor(owner) ?? owner;
        const el = vpCardColRefs.current[targetSlot];
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setVpPreviewAnchor({top: rect.top, left: rect.left, width: rect.width});
        setVpCardPreview({player: owner, cardId});
    };

    // 页面滚动时浮层跟随所在列移动（不关闭），窗口尺寸变化时关闭。
    // 注意不能加 capture：否则浮层 / 列表自身的滚动也会被当成页面滚动，一滑就关掉。
    React.useEffect(() => {
        if (vpCardPreview === null) return;
        const reposition = () => {
            const slot = previewSlotFor(vpCardPreview.player) ?? vpCardPreview.player;
            const el = vpCardColRefs.current[slot];
            if (!el) return;
            const rect = el.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > window.innerHeight) {
                setVpCardPreview(null);
                return;
            }
            setVpPreviewAnchor({top: Math.max(8, rect.top), left: rect.left, width: rect.width});
        };
        const clear = () => setVpCardPreview(null);
        window.addEventListener("scroll", reposition);
        window.addEventListener("resize", clear);
        return () => {
            window.removeEventListener("scroll", reposition);
            window.removeEventListener("resize", clear);
        };
    }, [vpCardPreview, cardsPerRow]);

    // 卡面 + 来源明细：弹窗与「相邻列」预览共用同一套内容（弹窗横排，预览竖排）
    const vpCardDetailBody = (player: number, cardId: string, stacked: boolean) => <div
        style={{display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap"}}>
        {!cardId.startsWith("__")
            ? <div style={{flex: stacked ? "1 1 100%" : "0 1 auto", maxWidth: "100%"}}>
                <CardPanel cardId={cardId as any} width={stacked ? "100%" : 360}/>
            </div>
            : null}
        <div style={{flex: stacked ? "1 1 100%" : "1 1 260px", minWidth: 0}}>
            <Table size="small" aria-label="vp card detail">
                <TableHead>
                    <TableRow>
                        <TableCell>来源</TableCell>
                        <TableCell>分数</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {vpCardDetailRows(player, cardId).map(row => <TableRow key={`vp-card-detail-${row.source}`}>
                        <TableCell>{row.source}</TableCell>
                        <TableCell>{row.amount}</TableCell>
                    </TableRow>)}
                    <TableRow>
                        <TableCell><span style={{fontWeight: 600}}>合计</span></TableCell>
                        <TableCell><span style={{fontWeight: 600}}>{vpCardCell(player, cardId)}</span></TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    </div>;

    const chart = React.useMemo(() => {
        if (timeline.length === 0 || G.pub.length === 0) {
            return null;
        }
        const width = 900;
        const height = 260;
        const left = 46;
        const right = 16;
        const top = 18;
        const bottom = 34;
        const plotW = width - left - right;
        const plotH = height - top - bottom;

        const rounds = timeline.map(t => t.round);
        const minRound = Math.min(...rounds);
        const maxRound = Math.max(...rounds);
        const xRange = Math.max(1, maxRound - minRound);

        const values = timeline.flatMap(t => t.players.map(p => metricValue(metric, p)));
        const minY = Math.min(...values);
        const maxY = Math.max(...values);
        const yRange = Math.max(1e-6, maxY - minY);

        const lines = G.pub.map((_, playerIdx) => {
            const pts = timeline.map(t => {
                const player = t.players[playerIdx] || {industry: 0, aesthetics: 0, score: 0, eraRatio: 0, roundTimeMs: 0, totalTimeMs: 0};
                const v = metricValue(metric, player);
                const x = left + ((t.round - minRound) / xRange) * plotW;
                const y = top + (1 - ((v - minY) / yRange)) * plotH;
                return {x, y, v};
            });
            return {
                playerIdx,
                color: getColor(regionsBySeat[playerIdx] ?? Region.NONE),
                polyline: pts.map(p => `${p.x},${p.y}`).join(" "),
                pts,
            };
        });

        const yTicks = [0, 0.25, 0.5, 0.75, 1].map(r => ({
            y: top + (1 - r) * plotH,
            v: minY + r * yRange,
        }));

        return {width, height, left, right, top, bottom, minRound, maxRound, yTicks, lines};
    }, [timeline, metric, G.pub]);

    // 按牌模式下的相邻列浮层用 fixed 定位，不受 TableContainer 的 overflow 影响
    return <TableContainer component={Paper}>
        {showFinalScoreTable ? <Table className={"table"} size="small" aria-label="Scoring table">
            <TableHead>
                <TableRow>
                    <TableCell>{i18n.chain.playerName.player}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.board}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.card}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.industryAward}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.aesAward}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.archive}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.events}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.total}</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {order.sort(scoreRank).map(p => {
                    const pub = G.pub[parseInt(p)];
                    const f = pub.finalScoring;
                    return <TableRow key={p}>
                        <TableCell component="th" scope="row">
                            {getName(p)}
                        </TableCell>
                        <TableCell>{pub.vp}</TableCell>
                        <TableCell>{f.card}</TableCell>
                        <TableCell>{f.industryAward}</TableCell>
                        <TableCell>{f.aestheticsAward}</TableCell>
                        <TableCell>{f.archive}</TableCell>
                        <TableCell>{f.events}</TableCell>
                        <TableCell>{f.total}</TableCell>
                    </TableRow>
                })}
            </TableBody>
        </Table> : null}

        <div style={{padding: 12}}>
            {showFinalScoreTable && showStatsSection ? <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                <div style={{fontSize: 13, color: "#5f6b7a"}}>数据统计</div>
                <Button size="small" variant="outlined" color="primary" onClick={() => setShowStats(v => !v)}>
                    {showStats ? "隐藏统计" : "显示统计"}
                </Button>
            </div> : null}

            {showStatsSection && showStats ? <>
            <div style={{display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10}}>
                <Button size="small" variant={metric === "level" ? "contained" : "outlined"} color="primary" onClick={() => setMetric("level")}>等级</Button>
                <Button size="small" variant={metric === "score" ? "contained" : "outlined"} color="primary" onClick={() => setMetric("score")}>分数</Button>
                <Button size="small" variant={metric === "eraRatio" ? "contained" : "outlined"} color="primary" onClick={() => setMetric("eraRatio")}>牌效比</Button>
                <Button size="small" variant={metric === "time" ? "contained" : "outlined"} color="primary" onClick={() => setMetric("time")}>时间</Button>
                <Button size="small" variant={metric === "vpStats" ? "contained" : "outlined"} color="primary" onClick={() => setMetric("vpStats")}>分数统计</Button>
            </div>

            {metric !== "vpStats" ? <>
            <div style={{marginBottom: 8, fontSize: 13, color: "#5f6b7a"}}>{metricLabel(metric)} 随轮变化折线</div>
            {metric === "time" ? <div style={{marginBottom: 8, fontSize: 12, color: "#8a94a6"}}>时间折线按总用时绘制</div> : null}

            {chart ? <div style={{width: "100%", overflowX: "auto", marginBottom: 12}}>
                <svg
                    viewBox={`0 0 ${chart.width} ${chart.height}`}
                    preserveAspectRatio="xMidYMid meet"
                    style={{width: "100%", height: "auto", minWidth: 500, aspectRatio: `${chart.width}/${chart.height}`, background: "#fbfcff", border: "1px solid #eef2f7", borderRadius: 8}}
                >
                    {chart.yTicks.map((tick, i) => <g key={`y-${i}`}>
                        <line x1={chart.left} y1={tick.y} x2={chart.width - chart.right} y2={tick.y} stroke="#e7ecf4" strokeWidth="1" />
                        <text x={chart.left - 8} y={tick.y + 4} textAnchor="end" fill="#7f8da3" fontSize="11">{formatMetric(metric, tick.v)}</text>
                    </g>)}

                    {chart.lines.map(line => {
                        const isActive = hoveredPlayer === null || hoveredPlayer === line.playerIdx;
                        const lastPt = line.pts[line.pts.length - 1];
                        return <g
                            key={`line-${line.playerIdx}`}
                            onMouseEnter={() => setHoveredPlayer(line.playerIdx)}
                            onMouseLeave={() => setHoveredPlayer(null)}
                            style={{cursor: "pointer"}}
                        >
                            <polyline
                                fill="none"
                                stroke={line.color}
                                strokeWidth={isActive ? "3" : "2"}
                                strokeOpacity={isActive ? 1 : 0.25}
                                points={line.polyline}
                            />
                            {line.pts.map((p, idx) => <circle
                                key={`pt-${line.playerIdx}-${idx}`}
                                cx={p.x}
                                cy={p.y}
                                r={isActive ? "3.2" : "2.2"}
                                fill={line.color}
                                fillOpacity={isActive ? 1 : 0.25}
                            />)}
                            {lastPt ? <text
                                x={Math.min(lastPt.x + 8, chart.width - chart.right - 8)}
                                y={lastPt.y - 6}
                                fill={line.color}
                                fillOpacity={isActive ? 1 : 0.35}
                                fontSize={isActive ? "12" : "11"}
                                fontWeight={isActive ? "bold" : "normal"}
                            >{getPlainPlayerName(line.playerIdx)}</text> : null}
                        </g>
                    })}

                    <text x={chart.left} y={chart.height - 8} fill="#7f8da3" fontSize="11">第 {chart.minRound} 轮</text>
                    <text x={chart.width - chart.right} y={chart.height - 8} textAnchor="end" fill="#7f8da3" fontSize="11">第 {chart.maxRound} 轮</text>
                </svg>
            </div> : null}

            <Table size="small" aria-label="metric round table">
                <TableHead>
                    <TableRow>
                        <TableCell>轮</TableCell>
                        {G.pub.map((_, idx) => <TableCell key={`p-header-${idx}`}>
                            <span style={{color: getColor(regionsBySeat[idx] ?? Region.NONE)}}>{getPlainPlayerName(idx)}</span>
                        </TableCell>)}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {timeline.map((t) => <TableRow key={`r-${t.round}`}>
                        <TableCell>{t.round}</TableCell>
                        {G.pub.map((_, idx) => {
                            const player = t.players[idx] || {industry: 0, aesthetics: 0, score: 0, eraRatio: 0, roundTimeMs: 0, totalTimeMs: 0};
                            const v = metricValue(metric, player);
                            return <TableCell key={`v-${t.round}-${idx}`}>{metric === "time" ? `${formatDuration(player.totalTimeMs || 0)}` : formatMetric(metric, v)}</TableCell>
                        })}
                    </TableRow>)}
                </TableBody>
            </Table>
            </> : <>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8}}>
                    <div style={{fontSize: 13, color: "#5f6b7a"}}>分数统计</div>
                    <div>
                        <Button size="small" variant={vpStatsMode === "source" ? "contained" : "outlined"} color="primary"
                                onClick={() => setVpStatsMode("source")} style={{marginRight: 8}}>按来源</Button>
                        <Button size="small" variant={vpStatsMode === "card" ? "contained" : "outlined"} color="primary"
                                onClick={() => setVpStatsMode("card")}>按牌</Button>
                    </div>
                </div>
                {vpStatsMode === "source" ? <>
                    <div style={{fontSize: 12, color: "#8a94a6", marginBottom: 6}}>点击数值，查看该玩家在该来源下每张牌的贡献。</div>
                    <Table size="small" aria-label="vp source stats">
                        <TableHead>
                            <TableRow>
                                <TableCell>来源</TableCell>
                                {G.pub.map((_, idx) => <TableCell key={`vp-source-header-${idx}`}>
                                    <span style={{color: getColor(regionsBySeat[idx] ?? Region.NONE)}}>{getPlainPlayerName(idx)}</span>
                                </TableCell>)}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {vpSourceRows.map(source => <TableRow key={`vp-source-${source}`}>
                                <TableCell>{source}</TableCell>
                                {G.pub.map((_, idx) => {
                                    const value = vpSourceMatrix[idx]?.[source] || 0;
                                    return <TableCell key={`vp-source-${source}-${idx}`}>
                                        <Button size="small" onClick={() => setVpSourceDetail({player: idx, source})}
                                                style={{minWidth: 0, padding: "2px 6px", textTransform: "none"}}>{value}</Button>
                                    </TableCell>;
                                })}
                            </TableRow>)}
                            <TableRow>
                                <TableCell><span style={{fontWeight: 600}}>合计</span></TableCell>
                                {G.pub.map((_, idx) => <TableCell key={`vp-source-total-${idx}`}>
                                    <span style={{fontWeight: 600}}>{vpPlayerTotal(idx)}</span>
                                </TableCell>)}
                            </TableRow>
                        </TableBody>
                    </Table>
                </> : <>
                    <div style={{fontSize: 12, color: "#8a94a6", marginBottom: 6}}>{isNarrow ? "每个玩家一列；点按卡牌查看卡面与来源明细。" : "每个玩家一列；鼠标移到卡牌上，卡面与来源明细会以浮层显示在相邻一列；点击卡牌可打开弹窗。"}</div>
                    <div onMouseLeave={() => setVpCardPreview(null)}>
                    <Grid container spacing={1}>
                        {G.pub.map((_, idx) => {
                            const items = vpPlayerCardItems(idx);
                            return <Grid size={{xs: 12, sm: 6, md: 3}} key={`vp-card-col-${idx}`} sx={{minWidth: 0}}>
                                <div ref={(el) => { vpCardColRefs.current[idx] = el; }}>
                                    <Paper variant="outlined">
                                        <div style={{padding: 8, height: "100%"}}>
                                            <div style={{fontWeight: 600, color: getColor(regionsBySeat[idx] ?? Region.NONE), marginBottom: 4}}>
                                                {getPlainPlayerName(idx)}
                                            </div>
                                            <div style={{maxHeight: 340, overflowY: "auto", paddingRight: 2}}>
                                                {items.length === 0 ? <div style={{fontSize: 12, color: "#8a94a6"}}>暂无数据</div> :
                                                    items.map(item => {
                                                        const isPseudo = item.cardId.startsWith("__");
                                                        return <Button
                                                            key={`vp-card-item-${idx}-${item.cardId}`}
                                                            fullWidth
                                                            size="small"
                                                            style={{justifyContent: "space-between", textTransform: "none", padding: "5px 6px", minHeight: 30, lineHeight: 1.3}}
                                                            onMouseEnter={() => { if (isPseudo) setVpCardPreview(null); else showCardPreview(idx, item.cardId); }}
                                                            onFocus={() => { if (isPseudo) setVpCardPreview(null); else showCardPreview(idx, item.cardId); }}
                                                            onClick={() => setVpCardDetail({player: idx, cardId: item.cardId})}
                                                        >
                                                            <span style={{flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left", fontStyle: isPseudo ? "italic" : "normal", color: isPseudo ? "#5f6b7a" : undefined}}>{vpCardLabel(item.cardId)}</span>
                                                            <span style={{flex: "0 0 auto", marginLeft: 8, fontWeight: 600}}>{item.amount}</span>
                                                        </Button>;
                                                    })}
                                            </div>
                                            <div style={{borderTop: "1px solid #eef2f7", marginTop: 4, paddingTop: 4, display: "flex", justifyContent: "space-between", fontWeight: 600, fontSize: 13}}>
                                                <span>合计</span><span>{vpPlayerTotal(idx)}</span>
                                            </div>
                                        </div>
                                    </Paper>
                                </div>
                            </Grid>;
                        })}
                    </Grid>
                    {!isNarrow && previewCardId !== null && previewOwner !== null && vpPreviewAnchor !== null
                        ? <div style={{
                            position: "fixed",
                            top: vpPreviewAnchor.top,
                            left: vpPreviewAnchor.left,
                            width: vpPreviewAnchor.width,
                            // 固定高度：不同卡牌的来源条数不同，若让浮层随内容增减会不停抽动
                            height: Math.max(240, Math.min(560, window.innerHeight - vpPreviewAnchor.top - 16)),
                            boxSizing: "border-box",
                            padding: 8,
                            overflowY: "auto",
                            overscrollBehavior: "contain",
                            zIndex: 1300,
                            background: "#ffffff",
                            border: "1px solid #d5dce5",
                            borderRadius: 4,
                            boxShadow: "0 6px 18px rgba(0, 0, 0, 0.18)"
                        }}>
                            <div style={{fontSize: 12, fontWeight: 600, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: getColor(regionsBySeat[previewOwner] ?? Region.NONE)}}>
                                {vpCardLabel(previewCardId)} · {getPlainPlayerName(previewOwner)}
                            </div>
                            {vpCardDetailBody(previewOwner, previewCardId, true)}
                        </div>
                        : null}
                    </div>
                </>}
            </>}
            </> : null}

            <Dialog open={vpSourceDetail !== null} onClose={() => setVpSourceDetail(null)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    {vpSourceDetail !== null ? `${getPlainPlayerName(vpSourceDetail.player)} · ${vpSourceDetail.source}` : ""}
                </DialogTitle>
                <DialogContent>
                    {vpSourceDetail !== null ? <Table size="small" aria-label="vp source detail">
                        <TableHead>
                            <TableRow>
                                <TableCell>卡牌</TableCell>
                                <TableCell>分数</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {vpSourceDetailRows(vpSourceDetail.player, vpSourceDetail.source).map(row => <TableRow key={`vp-source-detail-${row.cardId}`}>
                                <TableCell>{vpCardLabel(row.cardId)}</TableCell>
                                <TableCell>{row.amount}</TableCell>
                            </TableRow>)}
                            <TableRow>
                                <TableCell><span style={{fontWeight: 600}}>合计</span></TableCell>
                                <TableCell><span style={{fontWeight: 600}}>{vpSourceMatrix[vpSourceDetail.player]?.[vpSourceDetail.source] || 0}</span></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table> : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setVpSourceDetail(null)} color="primary">关闭</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={vpCardDetail !== null} onClose={() => setVpCardDetail(null)} maxWidth="md" fullWidth>
                <DialogTitle>
                    {vpCardDetail !== null ? `${getPlainPlayerName(vpCardDetail.player)} · ${vpCardLabel(vpCardDetail.cardId)}` : ""}
                </DialogTitle>
                <DialogContent>
                    {vpCardDetail !== null ? vpCardDetailBody(vpCardDetail.player, vpCardDetail.cardId, isNarrow) : null}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setVpCardDetail(null)} color="primary">关闭</Button>
                </DialogActions>
            </Dialog>
        </div>
    </TableContainer>
}

export default FinalScoreTable;
