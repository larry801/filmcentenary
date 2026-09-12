import React from "react";
import {
    CardID,
    Champion,
    getCardById,
    IEra,
    IPubInfo,
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
}

export const PubPanel = ({log, ctx, i, idx, getName, G, regionRanks}: IPubPanelProps) => {
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

    return <Grid container key={`pub${idx}-${playerID}`} sx={{justifyContent: 'center', alignItems: 'center'}}>
        <Grid size={12}>
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
        </Grid>
        <Grid container size={3} sx={{justifyContent: 'center', alignItems: 'center', flexDirection: 'column'}}>
            <Grid>
                <Typography sx={styles.iconAlign}>
                    {getName(idx.toString())}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.handSize}${i.handSize}`} sx={styles.iconAlign}>
                    <PanToolIcon/>{i.handSize}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.res}${i.resource}`} sx={styles.iconAlign}>
                    <ResourceIcon/> {i.resource}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.deposit}${i.deposit}`} sx={styles.iconAlign}>
                    <DepositIcon/>{i.deposit}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.competitionPower}${i.resource}`} sx={styles.iconAlign}>
                     {i18n.chain.pub.competitionPower}
                     {i.competitionPower}
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
                    <AestheticsIcon/> {i.aesthetics}
                    {i.school !== null && getCardById(i.school).aesthetics > 0 ? `(+${getCardById(i.school).aesthetics})` : ""}
                </Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.action}${i.action}`} sx={styles.iconAlign}>
                    <ActionPointIcon/> {i.action}</Typography>
            </Grid>
            <Grid>
                <Typography aria-label={`${i18n.chain.pub.vp}${i.vp}`} sx={styles.iconAlign}>
                    <EmojiEventsIcon/> {i.vp}
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
                title={`${i18n.chain.pub.discard}${i.discard.length}`}
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
