import React from "react";
import {
    CardCategory,
    CardID,
    Champion,
    getCardById,
    IEra,
    IPubInfo,
    Region,
    SchoolCardID,
    SimpleRuleNumPlayers,
    valid_regions,
    ValidRegion
} from "../types/core";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import i18n from '../constant/i18n'
import {IG} from "../types/setup";
import DeckIcon from '@mui/icons-material/Layers';
import NoScoringCardIcon from '@mui/icons-material/Block';
import DiscardDeckIcon from '@mui/icons-material/Block';
import PlayedCardDeck from '@mui/icons-material/Unarchive';
import AestheticsIcon from '@mui/icons-material/ImportContacts';
import IndustryIcon from '@mui/icons-material/Settings';
import ResourceIcon from '@mui/icons-material/MonetizationOn';
import DepositIcon from '@mui/icons-material/LocalAtm';
import {getCardName} from "./card";
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import PanToolIcon from "@mui/icons-material/PanTool";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import {ActionPointIcon, ChampionIcon, DrawnShareIcon, getColor} from "./icons";
import Paper from "@mui/material/Paper";
import ArchiveIcon from '@mui/icons-material/Archive';
import LegendCardIcon from '@mui/icons-material/StarBorder';
import {getPlayerInferredHand} from "../game/board-util";
import {getRegionRank, legendCountsByRegion} from "../game/util";
import TextField from '@mui/material/TextField';
import {CardList, getLogText} from "./boards/list-card";
import ErrorBoundary from "./error";

const styles = {
    root: {
        background: 'linear-gradient(45deg, #FE6B8B 30%, #FF8E53 90%)',
        border: 0,
        borderRadius: 3,
        boxShadow: '0 3px 5px 2px rgba(255, 105, 135, .3)',
        color: 'white',
        height: 48,
        padding: '0 30px',
    },
    iconAlign: {
        display: 'inline-flex',
        verticalAlign: "middle",
    },
};

export interface IPubPanelProps {
    i: IPubInfo,
    idx: number,
    getName: (p: PlayerID) => string,
    G: IG,
    ctx: Ctx,
    log: LogEntry[],
    /** Optional: rankings computed once by the board and shared by all panels. */
    regionRanks?: PlayerID[][],
    hideLog?: boolean,
}

export const PubPanel = ({log, ctx, i, idx, getName, G, regionRanks, hideLog = false}: IPubPanelProps) => {
    i18n.use();
    const playerID = idx.toString()
    // Everything below is derived from the state: compute it once per state
    // instead of once per use (this panel is rendered for every player).
    const legendCounts = React.useMemo(
        () => legendCountsByRegion(G, playerID),
        [G, playerID]
    )
    const legendCount = (r: ValidRegion) => legendCounts[r] ?? 0;

    const ranks = React.useMemo(
        () => regionRanks !== undefined ? regionRanks : valid_regions.map(r => getRegionRank(G, ctx, r)),
        [regionRanks, G, ctx]
    )
    const regionRank = (r: ValidRegion) => i.shares[r] === 0 ? -1 : ranks[r].indexOf(playerID);

    // 2026-9 技术流派高光：定格电影(行动力/红)、特技电影(手牌/紫)、有声电影(存款/蓝)、特艺七彩(声望/蓝)
    const ownsStopMotion = i.archive.includes("S52691" as any);
    const ownsStunt = i.archive.includes("S52692" as any);
    const ownsSound = i.archive.includes("S52693" as any);
    const ownsColor = i.archive.includes("S52694" as any);
    // 2026-10 技术流派高光：变焦镜头(美学/西欧紫)、3D电影(竞争力/北美蓝)
    const ownsZoomLens = i.archive.includes("S52701" as any);
    const owns3DFilm = i.archive.includes("S52702" as any);
    const zoomLensColor = getColor(Region.WE);
    const film3DColor = getColor(Region.NA);
    // 「竞争力：」拆成名字与冒号，水印只居中在名字后面
    const competitionLabel = i18n.chain.pub.competitionPower;
    const competitionName = competitionLabel.replace(/[：:]\s*$/, "");
    const competitionColon = competitionLabel.slice(competitionName.length);

    // 2026-10：分数右侧显示下一个 40/80/120 等级奖励提示
    const nextVpThreshold = !i.vpAward.v60 ? 40 : (!i.vpAward.v90 ? 80 : (!i.vpAward.v120 ? 120 : null));

    // 用时每秒刷新一次
    const [, setTick] = React.useState(0);
    React.useEffect(() => {
        const timer = window.setInterval(() => setTick(v => v + 1), 1000);
        return () => window.clearInterval(timer);
    }, []);

    const possibleHand = React.useMemo(
        () => getPlayerInferredHand(G, playerID),
        [G, playerID]
    );

    const shareAndLegendAriaLabel = React.useMemo(() => {
        let labelText = ""
        valid_regions.forEach(r => labelText += `${i18n.chain.region[r]}${i.shares[r]}${i18n.chain.pub.share}${i18n.chain.pub.legend}${legendCount(r)}`)
        return labelText
    }, [i.shares, legendCounts])
    const sharesAriaLabel = React.useMemo(() => {
        let labelText = i18n.chain.pub.share
        valid_regions.forEach(r => labelText += `${i18n.chain.region[r]}${i.shares[r]}`)
        return labelText
    }, [i.shares])
    const championAriaLabel = React.useMemo(() => {
        let labelText = i18n.chain.pub.champion
        i.champions.forEach((champion: Champion) => labelText += `${i18n.chain.region[champion.region]}${i18n.chain.era[champion.era]}`)
        return labelText
    }, [i.champions])
    // Only the tail of the log can be shown, so the whole history is not scanned.
    const playerLogText = React.useMemo(() => {
        const lines: string[] = [];
        for (let idx2 = log.length - 1; idx2 >= 0 && lines.length < 40; idx2--) {
            const entry = log[idx2];
            if (entry.action.payload.playerID === playerID) {
                lines.push(getLogText(entry, getName, G));
            }
        }
        return lines.join('\n');
    }, [log, log.length, playerID, getName, G]);
    const schoolTitle = i.school !== null ? `${getCardName(i.school)}` : "";

    const formatDuration = (ms: number): string => {
        const totalSeconds = Math.max(0, Math.floor((ms || 0) / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const getTimeText = (): string => {
        const tracking = G.timeTracking;
        const baseRound = tracking?.roundTimeMsByPlayer?.[playerID] || 0;
        const baseTotal = tracking?.totalTimeMsByPlayer?.[playerID] || 0;
        if (tracking?.currentTurnPlayer === playerID && (tracking.currentTurnStartedAtMs || 0) > 0) {
            const running = Math.max(0, Date.now() - tracking.currentTurnStartedAtMs);
            return `${formatDuration(baseRound + running)} / ${formatDuration(baseTotal + running)}`;
        }
        return `${formatDuration(baseRound)} / ${formatDuration(baseTotal)}`;
    }

    return <Grid container key={`pub${idx}-${playerID}`} sx={{justifyContent: 'center', alignItems: 'center'}}>
        {!hideLog && <Grid size={12}>
            {/*<textarea*/}
            {/*    defaultValue={playerLogText}*/}
            {/*    disabled*/}
            {/*    rows={6}*/}
            {/*/>*/}
            <TextField
                aria-live="polite"
                disabled
                value={playerLogText}
                fullWidth
                multiline
                minRows={2}
                maxRows={8}
                variant="filled"
            />
        </Grid>}
        <Grid container size={3} sx={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
            <Grid>
                <Typography sx={styles.iconAlign}>
                    {getName(idx.toString())}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.handSize}${i.handSize}`} sx={styles.iconAlign}>
                    <PanToolIcon style={ownsStunt ? {color: '#9c27b0'} : undefined}/>{i.handSize}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.res}${i.resource}`} sx={styles.iconAlign}>
                    <ResourceIcon/> {i.resource}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.deposit}${i.deposit}`} sx={styles.iconAlign}>
                    <DepositIcon style={ownsSound ? {color: '#2196f3'} : undefined}/>{i.deposit}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.competitionPower}${i.competitionPower}`} sx={styles.iconAlign}>
                    {competitionName}
                    {competitionColon}
                    <span style={owns3DFilm ? {position: 'relative', display: 'inline-block'} : undefined}>
                        {owns3DFilm ? <AestheticsIcon style={{
                            position: 'absolute',
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: 24,
                            opacity: 0.32,
                            color: film3DColor,
                            pointerEvents: 'none'
                        }}/> : null}
                        <span style={owns3DFilm ? {
                            position: 'relative',
                            fontWeight: 700,
                            textShadow: '1px 0 0 #fff, -1px 0 0 #fff, 0 1px 0 #fff, 0 -1px 0 #fff, ' +
                                '1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff'
                        } : undefined}>{i.competitionPower}</span>
                    </span>
                </Typography>
            </Grid>
            <Grid>
                <Typography sx={styles.iconAlign} style={{fontSize: 12, color: "#5f6b7a"}}>
                    {`用时(${getTimeText()})`}
                </Typography>
            </Grid>
        </Grid>
        <Grid container size={3} sx={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.industry}${i.industry}`} sx={styles.iconAlign}>
                    <IndustryIcon/> {i.industry}
                    {i.school !== null && getCardById(i.school).industry > 0 ? `(+${getCardById(i.school).industry})` : ""}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.aesthetics}${i.aesthetics}`} sx={styles.iconAlign}>
                    <span style={ownsZoomLens ? {
                        position: 'relative',
                        display: 'inline-block',
                        width: 24,
                        height: 24,
                        lineHeight: 0,
                        verticalAlign: 'middle'
                    } : undefined}>
                        <AestheticsIcon style={ownsZoomLens ? {color: zoomLensColor, display: 'block'} : undefined}/>
                        {ownsZoomLens ? <>
                            {/* 奖杯作为淡底纹水印，位于美学图标左侧，中线对齐图标左边线 */}
                            <EmojiEventsIcon style={{
                                position: 'absolute',
                                left: 0,
                                top: 'calc(50% - 2px)',
                                transform: 'translate(-50%, -50%)',
                                fontSize: 21,
                                color: zoomLensColor,
                                opacity: 0.25,
                                pointerEvents: 'none'
                            }}/>
                        </> : null}
                    </span> <span style={ownsZoomLens ? {color: zoomLensColor} : undefined}>{i.aesthetics}</span>
                    {i.school !== null && getCardById(i.school).aesthetics > 0 ? `(+${getCardById(i.school).aesthetics})` : ""}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.action}${i.action}`} sx={styles.iconAlign}>
                    <ActionPointIcon color={ownsStopMotion ? '#e53935' : undefined}/> {i.action}</Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.vp}${i.vp}`} sx={styles.iconAlign}>
                    <EmojiEventsIcon style={ownsColor ? {color: '#2196f3'} : undefined}/> {i.vp}
                    {nextVpThreshold !== null ?
                        <span style={{color: '#b0b7c3', fontSize: 12, marginLeft: 1 / 4}}> / {nextVpThreshold}</span>
                        : null}
                </Typography>
            </Grid>
        </Grid>
        <Grid size={3}>
            {i.school !== null ?
                <>
                    <CardList
                        title={schoolTitle}
                        cards={[i.school]}
                        label={
                            <Typography>
                                {schoolTitle}
                            </Typography>}
                    />
                </> : <></>}
            {G.playerCount > SimpleRuleNumPlayers ?
                <ErrorBoundary>
                    <Paper aria-label={shareAndLegendAriaLabel}>
                        {valid_regions.map((r: ValidRegion) => {
                                const share = i.shares[r];
                                const legend = legendCount(r);
                                const rank = regionRank(r);
                                const rankEraHint: IEra = rank;
                                const rankHintIcon = rank === -1 ? <NoScoringCardIcon sx={styles.iconAlign}/> :
                                    <ChampionIcon champion={{
                                        region: r,
                                        era: rankEraHint,
                                    }}/>;
                                return <Grid container key={`share-${playerID}-${r}`} sx={{justifyContent: 'center', alignItems: 'center'}}>
                                    <Grid sx={styles.iconAlign} size={4}>
                                        <DrawnShareIcon r={r}/>
                                        {share}
                                    </Grid>
                                    <Grid sx={styles.iconAlign} size={4}>
                                        {rankHintIcon}
                                    </Grid>
                                    <Grid sx={styles.iconAlign} size={4}>
                                        <LegendCardIcon style={{color: getColor(r)}}/>
                                        {legend}
                                    </Grid>
                                </Grid>
                            }
                        )}
                    </Paper>
                </ErrorBoundary>
                :
                <Paper aria-label={sharesAriaLabel}>
                    {valid_regions.map((r: ValidRegion) => {
                        const share = i.shares[r];
                        return <Grid container key={r}>
                            <DrawnShareIcon r={r}/>
                            {share}
                        </Grid>
                    })}
                </Paper>
            }
            {i.champions.length > 0 ? <Paper aria-label={championAriaLabel}>
                {i.champions.map((c: Champion, i2: number) => <ChampionIcon key={`champion-${i2}-${c.region}-${c.era}`}
                                                                           champion={c}/>)}
            </Paper> : <></>}
        </Grid>
        <Grid size={3}>
            <CardList
                title={`${i18n.chain.pub.discard}(${i.discard.length})`}
                cards={i.discard}
                label={
                    <Typography sx={styles.iconAlign}><DiscardDeckIcon/>{i.discard.length}</Typography>
                }
            />
            <CardList
                cards={possibleHand} label={
                <Typography sx={styles.iconAlign}>
                    <PanToolIcon/>
                    <DeckIcon/>
                    {possibleHand.length}
                </Typography>
            } title={
                `${i18n.chain.pub.allCards}(${possibleHand.length})`
            }/>
            {i.revealedHand.length > 0 ?
                <CardList
                    cards={i.revealedHand} label={
                    <Typography sx={styles.iconAlign}>
                        <PanToolIcon/>{i.revealedHand.length}
                    </Typography>
                }
                    title={`${i18n.chain.pub.revealedHand}(${i.revealedHand.length})`}/>
                : <></>}
            <CardList
                cards={i.archive}
                title={`${i18n.chain.pub.archive}(${i.archive.length})`}
                label={<Typography sx={styles.iconAlign}><ArchiveIcon/>{i.archive.length} </Typography>}
            />
            <CardList
                cards={i.playedCardInTurn} title={`${i18n.chain.pub.playedCards}(${i.playedCardInTurn.length})`}
                label={<Typography sx={styles.iconAlign}>
                    <PlayedCardDeck/>{i.playedCardInTurn.length}
                </Typography>}/>
        </Grid>
    </Grid>

}

export default React.memo(PubPanel);
