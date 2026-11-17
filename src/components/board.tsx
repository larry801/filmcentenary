import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardCardSlot, BoardRegion, SchoolRegion} from "./region";
import {activePlayer, canAfford, getRegionRank} from "../game/util";
import {getValidHelper} from "../game/board-util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@mui/material/Button";
import PubPanel from "./pub";
import {
    BasicCardID,
    BuildingType,
    EventCardID,
    ExtensionMode,
    IBuildingSlot,
    ICardSlot,
    Region,
    SimpleRuleNumPlayers,
    valid_regions
} from "../types/core";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import LogView from './log-view';
import CheckIcon from '@mui/icons-material/Check';
import DeckIcon from '@mui/icons-material/Layers';
import NormalCardIcon from '@mui/icons-material/RadioButtonUnchecked';
import LegendCardIcon from '@mui/icons-material/StarBorder';
import StudioIcon from '@mui/icons-material/Business';
import TheatersIcon from '@mui/icons-material/Theaters';
import OperationPanel from "./boards/operation";
import FinalScoreTable from "./boards/final";
import {getCardName} from "./card";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import SetupPanel from "./boards/setup-game-mode";
import { getAllExtensions } from "../extensions/registry";
// @ts-ignore
import disconnectedSfx from './media/connect.mp3'
// @ts-ignore
import playerTurnSfx from './media/turn.mp3';
import {ChampionIcon, DrawnShareIcon, getColor} from "./icons";
import Dialog from "@mui/material/Dialog";
import ErrorBoundary from "./error";
import ExportLogButton from "./export-log-button";

let sound: HTMLAudioElement;
let connectedSound: HTMLAudioElement;

export const playConnectedSound = () => {
    if (!connectedSound) {
        connectedSound = new Audio(disconnectedSfx);
    }
    connectedSound.play().then(() => {
    });
}

export const playSound = () => {
    if (!sound) {
        sound = new Audio(playerTurnSfx);
    }
    sound.play().then(() => {
    });
};


export function usePrevious(value: any) {
    const ref = React.useRef<any>(undefined);

    React.useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}

export const FilmCentenaryBoard = ({
                                       G,
                                       log,
                                       ctx,
                                       events,
                                       moves,
                                       undo,
                                       redo,
                                       matchData,
                                       matchID,
                                       playerID,
                                       isActive,
                                       isMultiplayer,
                                       isConnected
                                   }: BoardProps<IG>) => {

    i18n.use();
    const canMoveCurrent = ctx.currentPlayer === playerID && activePlayer(ctx) === playerID;
    const canMoveOutOfTurn = ctx.currentPlayer !== playerID && activePlayer(ctx) === playerID;
    const canMove = ctx.currentPlayer === playerID ? canMoveCurrent : canMoveOutOfTurn;
    const curPlayerSuffix = "(*)";
    const connectedPrefix = "---";
    const prevIsActive = usePrevious(isActive);
    const prevIsConnected = usePrevious(isConnected);

    React.useEffect(() => {
        if (isMultiplayer && !isConnected && prevIsConnected) {
            playConnectedSound();
        }
    }, [prevIsConnected, isConnected])

    React.useEffect(() => {
        if (isActive && prevIsActive === false) {
            playSound();
        }
    }, [prevIsActive, isActive])

    const locale = i18n.getLocaleName();

    React.useEffect((): () => void => {
        document.title = (isActive ? curPlayerSuffix : "") + i18n.chain.title;
        return () => document.title = i18n.chain.title;
    }, [isActive, locale])

    const activePid = activePlayer(ctx);
    // Names are used by every panel and every card slot, so they are computed
    // once per state instead of once per lookup.
    const names = React.useMemo((): Record<string, string> => {
        const map: Record<string, string> = {};
        // Duplicate names inside one match get -1, -2, ... in playerID order.
        const nameCounts: Record<string, string[]> = {};
        if (matchData !== undefined && ctx.gameover === undefined) {
            for (const m of matchData) {
                if (m.name === undefined || m.name === null) continue;
                const ids = nameCounts[m.name] ?? [];
                ids.push(m.id.toString());
                nameCounts[m.name] = ids;
            }
        }
        for (let p = 0; p < ctx.numPlayers; p++) {
            const pid = p.toString();
            let name = i18n.chain.playerName.player + pid;
            const found = matchData === undefined
                ? []
                : matchData.filter(m => m.id.toString() === pid);
            const matchDataName = found.length > 0 && found[0].name !== undefined && found[0].name !== null
                ? found[0].name
                : null;
            // 匿名随机模式：游戏进行中隐藏真名，终局或开始前显示
            if (G.anonymousRandomMode) {
                const isGameActive = ctx.phase !== "InitPhase" && ctx.gameover === undefined;
                if (isGameActive) {
                    const anonymousName = G.anonymousPlayerNames[parseInt(pid)] || "";
                    if (G.anonymousRandomRevealed && anonymousName !== "") {
                        name = anonymousName;
                    } else {
                        name = matchDataName !== null ? "！！！" : "？？？";
                    }
                    const curSuffix = ctx.currentPlayer === pid ? curPlayerSuffix : "";
                    const activeSuffix = activePid === pid && ctx.currentPlayer !== pid ? "(**)" : "";
                    map[pid] = `${name}${curSuffix}${activeSuffix}`;
                    continue;
                }
            }
            if (matchDataName !== null) {
                name = matchDataName;
                const sameNamePlayers = nameCounts[matchDataName];
                if (sameNamePlayers !== undefined && sameNamePlayers.length > 1) {
                    const idx = sameNamePlayers.indexOf(pid);
                    if (idx >= 0) {
                        name = `${name}-${idx + 1}`;
                    }
                }
            }
            const curSuffix = ctx.currentPlayer === pid ? curPlayerSuffix : "";
            const activeSuffix = activePid === pid && ctx.currentPlayer !== pid ? "(**)" : "";
            map[pid] = `${name}${curSuffix}${activeSuffix}`;
        }
        return map;
    }, [matchData, ctx.currentPlayer, activePid, locale, G.anonymousRandomMode, G.anonymousPlayerNames, G.anonymousRandomRevealed, ctx.phase, ctx.gameover]);

    const getName = React.useCallback((playerID: PlayerID | null = ctx.currentPlayer): string => {
        if (playerID === null) {
            return i18n.chain.playerName.spectator
        }
        const cached = names[playerID];
        return cached !== undefined ? cached : i18n.chain.playerName.player + playerID;
    }, [names, ctx.currentPlayer]);

    const comment = React.useCallback((slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    }), [moves, playerID]);

    // Cards that can pay for a purchase: identical for every card slot.
    const helpers = React.useMemo(
        () => (playerID === null ? [] : getValidHelper(G, playerID)),
        [G, playerID]
    );

    // Region rankings: one shared lookup per region instead of one per region
    // per panel (only the four-player board shows them).
    const regionRanks = React.useMemo(
        () => ctx.numPlayers > SimpleRuleNumPlayers
            ? valid_regions.map(r => getRegionRank(G, ctx, r))
            : [],
        [G, ctx, ctx.numPlayers]
    );

    // 从 matchData 提取所有玩家名称（复用 getName 中 getMatchDataName 的逻辑）
    const extractNamesFromMatchData = (): Record<string, string> => {
        if (matchData === undefined) return {};
        const names: Record<string, string> = {};
        for (const m of matchData) {
            if (m.name) names[m.id.toString()] = m.name;
        }
        return names;
    };

    const showBoardStatus = () => {
        const playerNames = extractNamesFromMatchData();
        const args = ctx.numPlayers > SimpleRuleNumPlayers ? {
            regions: [
                G.regions[Region.NA],
                G.regions[Region.WE],
                G.regions[Region.EE],
                G.regions[Region.ASIA],
                G.regions[Region.EXTENSION],
            ],
            school: [],
            film: [],
            matchID: matchID,
            playerNames,
        } : {
            regions: [],
            school: G.twoPlayer.school,
            film: G.twoPlayer.film,
            matchID: matchID,
            playerNames,
        }
        moves.showBoardStatus(args);
    }

    const endPhase = () => events?.endPhase?.();

    const [open, setOpen] = React.useState(true);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const [showSpectatorTrend, setShowSpectatorTrend] = React.useState(true);
    const [filterRegion, setFilterRegion] = React.useState<Region | null>(null);

    // 切换地区后，仅当筛选栏不在视口内时才滚动到筛选栏顶部
    React.useEffect(() => {
        if (filterRegion !== null) {
            requestAnimationFrame(() => {
                const el = document.getElementById('regionFilter');
                if (!el) return;
                const rect = el.getBoundingClientRect();
                // 筛选栏顶部被 sticky AppBar 遮挡（约80px），或已滚出视口上方时，才需要滚动
                const isVisible = rect.top >= 80 && rect.bottom <= window.innerHeight;
                if (!isVisible) {
                    el.scrollIntoView({ block: 'start' });
                }
            });
        }
    }, [filterRegion]);

    const isRegionVisible = (r: Region): boolean => {
        if (r === Region.EXTENSION) {
            if (ExtensionMode.FIXED === G.extensionMode) return false;
            if (G.extensionMode === ExtensionMode.FOUR) return true;
            return G.hasSchoolExtension;
        }
        if (r === Region.EXTENSION1) {
            if (ExtensionMode.FIXED === G.extensionMode) return false;
            if (G.extensionMode === ExtensionMode.FOUR) return false;
            return G.hasSchoolExtensionMuki || G.hasSchoolExtensionQM;
        }
        if (r === Region.EXTENSION2) {
            if (ExtensionMode.FIXED === G.extensionMode) return false;
            if (G.extensionMode === ExtensionMode.FOUR) return false;
            return G.hasSchoolExtensionMuki2;
        }
        if (r === Region.MONTHLY_SCHOOL) {
            if (ExtensionMode.FIXED === G.extensionMode) return false;
            if (G.extensionMode === ExtensionMode.FOUR) return false;
            return G.hasSchoolExtensionDawn || G.hasSchoolExtensionTech || G.hasSchoolExtensionVisual;
        }
        // 主地区始终可见
        return true;
    };

    const allRegions: Region[] = [
        Region.NA, Region.WE, Region.EE, Region.ASIA,
        Region.EXTENSION, Region.EXTENSION1, Region.EXTENSION2,
        Region.MONTHLY_SCHOOL
    ];

    const visibleDisplayRegions: Region[] = allRegions.filter(r => isRegionVisible(r));

    // 键盘 A/D 左右切换地区
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (ctx.phase === "InitPhase") return;
            if (ctx.numPlayers === SimpleRuleNumPlayers) return;
            if (visibleDisplayRegions.length === 0) return;

            const currentIndex = filterRegion === null ? -1 : visibleDisplayRegions.indexOf(filterRegion);

            if (e.key === 'a' || e.key === 'A') {
                e.preventDefault();
                const newIndex = currentIndex <= 0 ? visibleDisplayRegions.length - 1 : currentIndex - 1;
                setFilterRegion(visibleDisplayRegions[newIndex]);
            } else if (e.key === 'd' || e.key === 'D') {
                e.preventDefault();
                const newIndex = currentIndex >= visibleDisplayRegions.length - 1 ? 0 : currentIndex + 1;
                setFilterRegion(visibleDisplayRegions[newIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [filterRegion, visibleDisplayRegions, ctx.phase, ctx.numPlayers]);

    const isExtensionRegion = (r: Region): boolean =>
        r === Region.EXTENSION || r === Region.EXTENSION1 || r === Region.EXTENSION2 || r === Region.MONTHLY_SCHOOL;

    const renderRegionButtonContent = (r: Region, selected: boolean): React.ReactNode => {
        // @ts-ignore
        const regionInfo = G.regions[r];
        const color = getColor(r);
        const textColor = selected ? '#fff' : color;

        // 建筑槽位显示（参考地区组件的显示方式）
        const activeSlots = regionInfo.buildings.filter((slot: IBuildingSlot) => slot.activated);
        const buildingNodes: React.ReactNode[] = activeSlots.map((slot: IBuildingSlot, idx: number) => {
            const ownerName = slot.owner === "" ? i18n.chain.pub.emptyBuildingSlot : getName(slot.owner);
            if (slot.owner === "") {
                // 激活但无拥有者：显示 电影院/制片厂 图标 + "空"
                return (
                    <span key={idx} style={{display: 'inline-flex', alignItems: 'center'}}>
                        <TheatersIcon style={{fontSize: 16}}/>/<StudioIcon style={{fontSize: 16}}/>
                        {ownerName}
                    </span>
                );
            }
            // 激活且有拥有者：显示对应建筑图标 + 拥有者名
            return (
                <span key={idx} style={{display: 'inline-flex', alignItems: 'center'}}>
                    {slot.building === BuildingType.cinema ? <TheatersIcon style={{fontSize: 16}}/> : <StudioIcon style={{fontSize: 16}}/>}
                    {ownerName}
                </span>
            );
        });
        const buildingDisplay: React.ReactNode = buildingNodes.length > 0
            ? buildingNodes.map((node, i) =>
                <React.Fragment key={i}>{i > 0 && <span>, </span>}{node}</React.Fragment>
            )
            : <span>{i18n.chain.pub.emptyBuildingSlot}</span>;

        // 卡牌信息
        const allCards: { name: string; affordable: boolean }[] = [];
        const addCard = (slot: ICardSlot) => {
            if (slot.card !== null) {
                const cardName = getCardName(slot.card);
                const afford = playerID !== null && canAfford(G, ctx, slot.card, playerID);
                allCards.push({ name: cardName, affordable: afford });
            }
        };
        addCard(regionInfo.legend);
        regionInfo.normal.forEach(addCard);

        // 卡牌分行（每行2个）
        const cardColor = (affordable: boolean): string => {
            if (selected) return '#fff';
            return affordable ? '#4caf50' : 'inherit';
        };
        const cardRows: React.ReactNode[] = [];
        for (let i = 0; i < allCards.length; i += 2) {
            const pair = allCards.slice(i, i + 2);
            cardRows.push(
                <span key={i} style={{lineHeight: 1.4}}>
                    {pair.map((c, j) =>
                        <React.Fragment key={j}>
                            {j > 0 && <span style={{color: selected ? '#fff' : 'inherit'}}> | </span>}
                            <span style={{color: cardColor(c.affordable)}}>{c.name}{c.affordable ? ' ✓' : ''}</span>
                        </React.Fragment>
                    )}
                </span>
            );
        }

        // 流派扩不显示份额和建筑
        if (isExtensionRegion(r)) {
            return (
                <span style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1}}>
                    <span style={{color: textColor}}>{i18n.chain.region[r]}</span>
                    {cardRows}
                </span>
            );
        }

        return (
            <span style={{display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1}}>
                <span style={{display: 'inline-flex', alignItems: 'center', gap: 2}}>
                    <span style={{color: textColor}}>{i18n.chain.region[r]}{i18n.chain.era[regionInfo.era as 0 | 1 | 2]}</span>
                    <span> (</span>
                    <DrawnShareIcon r={r}/>
                    <span>×{regionInfo.share}</span>
                    <span>, </span>
                    {buildingDisplay}
                    <span>)</span>
                </span>
                {cardRows}
            </span>
        );
    };

    const cardBoard = ctx.numPlayers === SimpleRuleNumPlayers ?
        <Grid container size={{xs: 12, sm: 7}}>
            <Grid size={{xs: 12, sm: 6}}>
                <Typography>
                    {valid_regions.map(r => {
                        const regionIdx: 0 | 1 | 2 | 3 | 4 | 5 | 6 = r;
                        const region = G.regions[regionIdx];
                        return <React.Fragment key={`region-share-${r}`}>
                            <DrawnShareIcon r={r}/>{region.share}
                        </React.Fragment>;
                    })}
                    <ChampionIcon champion={{
                        region: Region.NONE,
                        era: G.twoPlayer.era
                    }}/><DeckIcon/><LegendCardIcon/>{G.twoPlayer.schoolDeckLength}<NormalCardIcon/>{G.twoPlayer.filmDeckLength}
                </Typography>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.school[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.school[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[2]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[3]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
        </Grid> :

        <Grid container size={{xs: 12, sm: 7}} sx={{flexDirection: 'column', flexWrap: 'nowrap', alignContent: 'flex-start'}}>
            <Grid id="regionFilter" sx={{flexShrink: 0, width: '100%', scrollMarginTop: 80}}>
                <Grid container spacing={1} sx={{justifyContent: 'center', padding: 1 / 2}}>
                    <Grid>
                        <Button
                            size="small"
                            variant={filterRegion === null ? "contained" : "outlined"}
                            color={filterRegion === null ? "primary" : "inherit"}
                            onClick={() => setFilterRegion(null)}
                        >
                            {i18n.getLocaleName() === 'en' ? 'All Regions' : '所有地区'}
                        </Button>
                    </Grid>
                    {visibleDisplayRegions.map(r => (
                        <Grid key={r}>
                            <Button
                                size="small"
                                variant={filterRegion === r ? "contained" : "outlined"}
                                color={filterRegion === r ? "primary" : "inherit"}
                                onClick={() => setFilterRegion(r)}
                            >
                                {renderRegionButtonContent(r, filterRegion === r)}
                            </Button>
                        </Grid>
                    ))}
                </Grid>
            </Grid>
            <Grid sx={{flex: 1, overflowY: 'auto', width: '100%'}}>
                {(filterRegion === null || filterRegion === Region.NA) &&
                    <BoardRegion getPlayerName={getName} r={Region.NA} moves={moves} region={G.regions[Region.NA]} G={G} ctx={ctx}
                                 playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.WE) &&
                    <BoardRegion getPlayerName={getName} r={Region.WE} moves={moves} region={G.regions[Region.WE]} G={G} ctx={ctx}
                                 playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.EE) &&
                    <BoardRegion getPlayerName={getName} r={Region.EE} moves={moves} region={G.regions[Region.EE]} G={G} ctx={ctx}
                                 playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.ASIA) &&
                    <BoardRegion getPlayerName={getName} r={Region.ASIA} moves={moves} region={G.regions[Region.ASIA]} G={G} ctx={ctx}
                                 playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.EXTENSION) &&
                    <SchoolRegion getPlayerName={getName} r={Region.EXTENSION} moves={moves} region={G.regions[Region.EXTENSION]} G={G} ctx={ctx}
                                  playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.EXTENSION1) &&
                    <SchoolRegion getPlayerName={getName} r={Region.EXTENSION1} moves={moves} region={G.regions[Region.EXTENSION1]} G={G} ctx={ctx}
                                  playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.EXTENSION2) &&
                    <SchoolRegion getPlayerName={getName} r={Region.EXTENSION2} moves={moves} region={G.regions[Region.EXTENSION2]} G={G} ctx={ctx}
                                  playerID={playerID} helpers={helpers}/>}
                {(filterRegion === null || filterRegion === Region.MONTHLY_SCHOOL) &&
                    <SchoolRegion getPlayerName={getName} r={Region.MONTHLY_SCHOOL} moves={moves} region={G.regions[Region.MONTHLY_SCHOOL]} G={G} ctx={ctx}
                                  playerID={playerID} helpers={helpers}/>}
            </Grid>
        </Grid>

    const disconnectNotice = isConnected ? <></> :
        <>
            <Button
                fullWidth
                style={{textTransform: 'none'}}
                onClick={handleOpen}
                color="secondary"
                variant={"outlined"}
            >
                <Typography>
                    {i18n.chain.disconnected}
                </Typography>
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>
                    <Typography variant="h5" component="h1">
                        {i18n.chain.disconnected}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {i18n.chain.disconnected}
                </DialogContent>
            </Dialog>
        </>

    const gameOverResult = ctx.gameover === undefined ? <></> :
        <>
            <Button
                fullWidth
                style={{textTransform: 'none'}}
                onClick={handleOpen}
                color="secondary"
                variant={"outlined"}
            >
                <Typography>
                    {i18n.chain.gameOver.title}
                </Typography>
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>
                    <Typography variant="h5" component="h1">
                        {i18n.chain.gameOver.title}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Paper variant="elevation">
                        <Typography variant="h6" component="h2">{
                            // @ts-ignore
                            i18n.chain.gameOver.reason[ctx.gameover.reason]
                        }</Typography>
                        <Typography variant="h6" component="h2">{i18n.chain.gameOver.winner}</Typography>
                        <Typography variant="h6" component="h2">{getName(ctx.gameover.winner)}</Typography>
                    </Paper>
                    <FinalScoreTable G={G} ctx={ctx} getName={getName}/>
                    <ExportLogButton gameName="film" matchID={matchID} log={log}/>
                </DialogContent>
            </Dialog>
        </>

    const spectatorTrendPanel = playerID === null || ctx.gameover !== undefined ?
        <Grid size={12}>
            <Paper variant="elevation">
                <div style={{padding: 8}}>
                    <Grid container sx={{justifyContent: 'space-between', alignItems: 'center'}}>
                        <Grid>
                            <Typography variant="h6" component="h2">对局趋势（观战）</Typography>
                        </Grid>
                        <Grid>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setShowSpectatorTrend(v => !v)}
                            >
                                {showSpectatorTrend ? "隐藏" : "显示"}
                            </Button>
                        </Grid>
                    </Grid>
                    {showSpectatorTrend ? <FinalScoreTable G={G} ctx={ctx} getName={getName} showFinalScoreTable={false}/> : <></>}
                </div>
            </Paper>
        </Grid> : <></>
    const upperPanel = playerID !== null ? <>
            {ctx.phase === "InitPhase" ?
                isActive ? <Grid size={12}>
                    <SetupPanel ctx={ctx} moves={moves}/>
                    <Button
                        fullWidth
                        autoFocus
                        variant="contained"
                        color={"primary"}
                        size="large"
                        disabled={!canMove}
                        onClick={showBoardStatus}>
                        {i18n.chain.action.showBoardStatus}
                    </Button>
                    {G.pending.endPhase && canMoveCurrent ?
                        <Button
                            fullWidth
                            variant={"outlined"}
                            onClick={endPhase}
                        >
                            {i18n.chain.action.endPhase}
                        </Button>
                        : <></>}
                </Grid> : <></>
                : <>
                    {cardBoard}
                    {ctx.gameover === undefined
                        ?
                        <OperationPanel
                            G={G} ctx={ctx}
                            moves={moves}
                            playerID={playerID}
                            events={events}
                            undo={undo} redo={redo}
                            getName={getName}
                            log={log}
                            helpers={helpers}
                            regionRanks={regionRanks}
                        />
                        : <></>}
                </>}
        </>
        : <></>

    return <ErrorBoundary>
        <Grid container key={`film-centenary-board-player-${playerID}`} sx={{justifyContent: 'flex-start'}}>
            {gameOverResult}
            {disconnectNotice}
            {G.pending.lastRoundOfGame && ctx.gameover === undefined ?
                <Grid container size={12} sx={{justifyContent: 'space-evenly'}}>
                    <Paper variant="elevation">
                        <Typography variant="h4" component="h1">{i18n.chain.pub.lastRoundOfGame}</Typography>
                    </Paper> </Grid> : <></>}
            {ctx.numPlayers !== SimpleRuleNumPlayers ? <>
                {/* 自定义选项 */}
                {(() => {
                    // 收集卡牌扩展名称
                    const cardExtNames: string[] = [];
                    if (G.hasExtensionChaosMedia) cardExtNames.push(i18n.chain.setting.enableExtensionChaosMedia);
                    if (G.enabledExtensions && G.enabledExtensions.length > 0) {
                        const allExts = getAllExtensions();
                        G.enabledExtensions.forEach(extId => {
                            const ext = allExts.find(e => e.id === extId);
                            cardExtNames.push(ext ? (ext.label?.ch || ext.name) : extId);
                        });
                    }
                    // 重点选项摘要
                    const summaryParts: string[] = [];
                    if (cardExtNames.length > 0) summaryParts.push(...cardExtNames);
                    if (G.testModeCinema) summaryParts.push(i18n.chain.setting.testModeCinema);
                    if (G.testModeEnd180) summaryParts.push(i18n.chain.setting.testModeEnd180);
                    if (G.disableUndo) summaryParts.push(i18n.chain.setting.disableUndo);
                    const hasAnySpecial = summaryParts.length > 0;
                    return <>
                <Grid container size={12}>
                    <Grid size={12}>
                        <Typography variant="body2" sx={{padding: '2px 8px', display: 'flex', alignItems: 'center'}}>
                            {i18n.chain.setting.customOptions}
                            {hasAnySpecial ?
                                <Typography variant="body2" component="span" sx={{marginLeft: 1 / 2}}>
                                    {summaryParts.map((part, i) => <span key={i}>
                                        {i > 0 ? ' |' : ''}
                                        <CheckIcon sx={{fontSize: 14, verticalAlign: 'middle', color: '#d32f2f'}}/>
                                        {part}
                                    </span>)}
                                </Typography> :
                                <Typography variant="body2" component="span" color="textSecondary" sx={{marginLeft: 1 / 2}}>
                                    X
                                </Typography>}
                        </Typography>
                    </Grid>
                </Grid>
                    </>;
                })()}
                {/* 事件栏 */}
                <Grid container spacing={2} size={12}>
                <Grid size={4}>
                    <Typography>{`${i18n.chain.pub.events}(${G.eventDeckLength})`}</Typography
                    ></Grid>
                {G.events.map((e: EventCardID, idx: number) => <Grid key={idx} size={4}>
                    <Paper key={idx} elevation={5}>
                        <Typography>{getCardName(e)}</Typography>
                        <Typography>{i18n.chain.eventName[e]}</Typography>
                    </Paper></Grid>)}
            </Grid>
            </> : <></>}
            {playerID === null ? cardBoard : <></>}
            {upperPanel}
            <Grid container sx={{justifyContent: 'space-evenly'}}>
                <Grid><Typography>{i18n.chain.card.B01} {G.basicCards.B01}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B02} {G.basicCards.B02}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B03} {G.basicCards.B03}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B04} {G.basicCards.B04}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B05} {G.basicCards.B05}</Typography></Grid>
            </Grid>
            {
                log === undefined ? <></> :
                    <LogView log={log} getPlayerName={getName} G={G}/>
            }
            {G.order.map((i: PlayerID) =>
                <Grid key={`grid-pub-panel-${i}-${playerID}`} size={{sm: 6, lg: 3}}>
                    <ErrorBoundary>
                        <PubPanel log={log} ctx={ctx} i={G.pub[parseInt(i)]} G={G} idx={parseInt(i)}
                                  getName={getName} regionRanks={regionRanks}/>
                    </ErrorBoundary>
                </Grid>
            )}
            <Grid size={12}>
                <FinalScoreTable G={G} ctx={ctx} getName={getName} showStatsSection={false}/>
            </Grid>
            {spectatorTrendPanel}
        </Grid>
    </ErrorBoundary>
}
