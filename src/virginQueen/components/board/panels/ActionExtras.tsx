import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import {ActionGroup} from "../../theme";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import i18n from "../../../../constant/i18n";
import {powerName, minorName, MINOR_POWERS, POWERS, Power, VQGame} from "../../../constant/general";
import {LEADER_BY_ID} from "../../../constant/leaders";
import {patronDef, scenarioSetup, scienceBonusById, seaCaptainById, seaCaptainName} from "../../../scenario";
import {seaZoneName} from "../../../mapData";
import {WORLD_SEA_ZONES, WORLD_SETTLEMENTS} from "../../../data/world";
import {PATRONAGE_VP_AWARD_BY_ID} from "../../../data/patronage";
import {MINOR_DIPLOMACY} from "../../../data/minorDiplomacy";
import {PatronageVpAward} from "../../../data/types";
import {allied} from "../../../util";
import {isActivatedMajor, playerCount} from "../../../ownership";
import {assassinationTargets} from "../../../espionage";

import {dataName, leaderLabel, patronLabel, patronageAwardSummary, placeLabel, vqLocaleNow} from "../helpers";
import {useVQBoard} from "../BoardContext";

export const ActionExtras = () => {
    const {G, moves, vqLocale, selected, piracyZone, setPiracyZone, piracyTarget, setPiracyTarget, patronageCp, setPatronageCp, setEspionageTarget, assassinationTarget, setAssassinationTarget, assassinationCp, setAssassinationCp, catholicRebellionCp, setCatholicRebellionCp, informantSource, setInformantSource, expeditionCaptain, setExpeditionCaptain, expeditionHasColony, setExpeditionHasColony, me, espionageTarget, myTurn, ps, cp, canAct, space, spaceDef, religionActions} = useVQBoard();
    if (me === undefined) return null;
    const patronageSetup = scenarioSetup(G.scenario, playerCount(G)).patronage;
    const vpAwards = patronageSetup.vpAwards.map((id) => PATRONAGE_VP_AWARD_BY_ID[id])
        .filter((award): award is PatronageVpAward => award !== undefined);
    const artistMarkersLeft = vpAwards.filter((award) => award.kind === "artist").length;
    const scientistMarkersLeft = vpAwards.filter((award) => award.kind === "scientist").length;
    const expeditionCaptainDef = seaCaptainById(expeditionCaptain);
    const expeditionBaseCost = expeditionCaptainDef?.expeditionCost ?? 1;
    const hasFreeColonist = expeditionCaptainDef?.freeColonist === true || ps?.scienceBonuses.includes("plantation");
    const expeditionCost = expeditionBaseCost + (expeditionHasColony && !hasFreeColonist ? 1 : 0);
    // Badge counts mirror each group's enable conditions below, so a collapsed
    // group still shows whether it has something to do right now.
    const available = (label: string, count: number) => ({available: count, availableLabel: i18n.chain.vq.actionUi.availableCount.replace("{count}", String(count)), title: label});
    const religionCount = myTurn && cp >= 2 ? religionActions(me).length : 0;
    const influenceCount = !myTurn || cp < 1 ? 0
        : MINOR_POWERS.filter((minor) => (G.scenario !== "tutorial" || ["papacy", "venice"].includes(minor)) &&
            (MINOR_DIPLOMACY[minor].eligible.includes(me) || (G.scenario === "tutorial" && minor === "papacy" && me === "ottoman")) &&
            !G.minorInfluenceBlocked[me].includes(minor) && !G.minorDiplomacyResolved.includes(minor) && (ps?.influence[minor] ?? 0) < 9).length +
          (["ottoman", "hre"] as Power[]).filter((target) => G.majorInfluence?.[target]?.[me] !== undefined && !G.majorDiplomacyResolved?.includes(target)).length;
    const spyTargets = POWERS.filter((p) => p !== me && !isActivatedMajor(G, p));
    const espionageCount = !canAct || G.year < 3 ? 0 : [
        cp >= 2 && spyTargets.length > 0,
        cp >= 2 && G.informants.filter((i) => i.owner === me).length < 2 && spyTargets.some((t) => !G.informants.some((i) => i.owner === me && i.target === t)),
        cp >= 2 && !G.assassinationUsed.includes(me) && assassinationTargets(G, me).length > 0,
    ].filter(Boolean).length;
    const myCaptainsAtSea = Object.values(G.worldCaptains).filter((ex) => ex.power === me && ex.movedImpulse !== G.impulse).length;
    const captainsReady = (ps?.seaCaptains ?? []).filter((id) => (seaCaptainById(id)?.turn ?? 99) <= G.year && G.worldCaptains[id] === undefined).length;
    const worldCount = myTurn && cp >= 1 ? myCaptainsAtSea + captainsReady : 0;
    const patronCount = !myTurn || cp < 2 ? 0 : G.patronsAvailable.map((id) => patronDef(id))
        .filter((p) => p !== undefined && p.region === me && !POWERS.some((x) => G.powers[x].patrons.includes(p.id)) &&
            !G.patronizedThisTurn.includes(`${me}:${p.kind}`)).length;
    const piracyCount = myTurn && cp >= 1
        ? Object.keys(G.seaZones).filter((z) => G.seaZones[z as keyof VQGame["seaZones"]].naval[me] !== undefined).length : 0;
    return <>
        {G.scenario !== "tutorial" && <ActionGroup {...available(i18n.chain.vq.actionUi.religionActions, religionCount)}>
        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
            {religionActions(me).map((a) => <Button key={a.label} size="small" variant="outlined"
                                                     disabled={!myTurn || cp < 2}
                                                     onClick={() => a.run()}>{a.label}</Button>)}
        </Stack>
        <Divider/>
        </ActionGroup>}
        <ActionGroup {...available(i18n.chain.vq.empire.minorInfluenceDiplomacy, influenceCount)}>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.empire.minorInfluenceNote}
        </Typography>
        <Stack spacing={0.5}>
            {MINOR_POWERS.filter((minor) => G.scenario !== "tutorial" || ["papacy", "venice"].includes(minor)).map((minor) => {
                const influence = ps?.influence[minor] ?? 0;
                const ally = POWERS.find((candidate) => G.powers[candidate].alliedMinors.includes(minor));
                const resolved = G.minorDiplomacyResolved.includes(minor);
                const eligible = (MINOR_DIPLOMACY[minor].eligible.includes(me) || (G.scenario === "tutorial" && minor === "papacy" && me === "ottoman")) &&
                    !G.minorInfluenceBlocked[me].includes(minor);
                return <Stack key={minor} direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                    <Typography variant="caption" sx={{minWidth: 78}}>
                        {minorName(minor, vqLocale)} {ally ? `· ${powerName(ally, vqLocale)}${i18n.chain.vq.empire.minorAlly}` : `· ${i18n.chain.vq.intel.unactivated}`}
                    </Typography>
                    <Chip size="small" variant="outlined" label={`${i18n.chain.vq.empire.influence} ${influence}`} />
                    <Button size="small" variant="outlined"
                            disabled={!myTurn || cp < 1 || !eligible || resolved || influence >= 9}
                            onClick={() => moves.influence({target: minor})}>+1 {i18n.chain.vq.empire.influence}</Button>
                    {resolved && <Chip size="small" color="success" label={i18n.chain.vq.empire.resolvedThisTurn}/>}
                </Stack>;
            })}
            {G.majorInfluence && (["ottoman", "hre"] as Power[]).filter((target) => G.majorInfluence![target]?.[me] !== undefined)
                .map((target) => <Stack key={target} direction="row" spacing={0.5}>
                    <Typography variant="caption">{powerName(target, vqLocale)} · {i18n.chain.vq.empire.influence} {G.majorInfluence![target]![me]}</Typography>
                    <Button size="small" disabled={!myTurn || cp < 1 || G.majorDiplomacyResolved?.includes(target)}
                        onClick={() => moves.influence({target})}>+1 {i18n.chain.vq.empire.influence}</Button>
                </Stack>)}
        </Stack>
        <Divider/>
        </ActionGroup>
        {G.scenario !== "tutorial" && !isActivatedMajor(G, me) && <><ActionGroup {...available(i18n.chain.vq.empire.espionageTable, espionageCount)}>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.empire.espionageNote}
        </Typography>
        <FormControl size="small" fullWidth>
            <InputLabel id="vq-espionage-target">{i18n.chain.vq.board.targetPower}</InputLabel>
            <Select labelId="vq-espionage-target" label={i18n.chain.vq.board.targetPower} value={espionageTarget}
                    onChange={(e) => setEspionageTarget(e.target.value as Power)}>
                {POWERS.filter((p) => p !== me && !isActivatedMajor(G, p)).map((p) => <MenuItem key={p} value={p}>{powerName(p, vqLocale)}</MenuItem>)}
            </Select>
        </FormControl>
        <Select size="small" value={informantSource} onChange={(e) => setInformantSource(e.target.value)} displayEmpty>
            <MenuItem value="">{i18n.chain.vq.empire.spyFromPool}</MenuItem>
            {G.informants.filter((i) => i.owner === me && !i.neutralized).map((i) =>
                <MenuItem key={i.target} value={i.target}>{i18n.chain.vq.empire.moveSpyAt}{powerName(i.target, vqLocale)}{i18n.chain.vq.empire.moveSpySuffix}</MenuItem>)}
        </Select>
        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
            <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || espionageTarget === me ||
                G.informants.some((i) => i.owner === me && i.target === espionageTarget) ||
                (informantSource === "" && G.informants.filter((i) => i.owner === me).length >= 2)}
                    onClick={() => moves.plantInformant({target: espionageTarget, ...(informantSource ? {fromTarget: informantSource} : {})})}>{i18n.chain.vq.empire.deploySpy}</Button>
            <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || espionageTarget === me}
                    onClick={() => moves.gainIntelligence({target: espionageTarget})}>{i18n.chain.vq.empire.gainIntelligence}</Button>
        </Stack>
        <FormControl size="small" fullWidth>
            <InputLabel id="vq-assassination-target">{i18n.chain.vq.empire.assassinationTarget}</InputLabel>
            <Select labelId="vq-assassination-target" label={i18n.chain.vq.empire.assassinationTarget} value={assassinationTarget}
                    onChange={(e) => setAssassinationTarget(e.target.value)}>
                <MenuItem value="elizabeth" disabled={!assassinationTargets(G, me).includes("elizabeth")}>{i18n.chain.vq.empire.targetElizabeth}</MenuItem>
                {assassinationTargets(G, me).includes("rudolf") && <MenuItem value="rudolf">{i18n.chain.vq.empire.targetRudolf}</MenuItem>}
                {assassinationTargets(G, me).filter((id) => id !== "elizabeth" && id !== "rudolf").map((id) =>
                    <MenuItem key={id} value={id}>{leaderLabel(id)} ({powerName(LEADER_BY_ID[id].power, vqLocale)})</MenuItem>)}
            </Select>
        </FormControl>
        <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
            <Select size="small" value={assassinationCp} onChange={(e) => setAssassinationCp(Number(e.target.value))}>
                {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
            </Select>
            <Button size="small" variant="outlined" disabled={!canAct || cp < assassinationCp || G.year < 3 || G.assassinationUsed.includes(me) ||
                !assassinationTargets(G, me).includes(assassinationTarget)}
                    onClick={() => moves.assassinate({target: assassinationTarget, cp: assassinationCp})}>{i18n.chain.vq.empire.attemptAssassination}</Button>
        </Stack>
        {me === "spain" && <>
            <Typography variant="caption">{i18n.chain.vq.empire.jesuitsOnCard} {G.espionage?.jesuitsOnCard ?? 0} / {i18n.chain.vq.empire.england} {G.espionage?.jesuits.length ?? 0} / {i18n.chain.vq.empire.jesuitsCapNote}</Typography>
            <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || (G.espionage?.jesuitsOnCard ?? 0) < 1 ||
                spaceDef?.area !== "england" || G.espionage?.jesuits.includes(selected!)}
                onClick={() => moves.plantInformant({space: selected})}>{i18n.chain.vq.empire.deployJesuitTo} {spaceDef?.area === "england" ? placeLabel(spaceDef.id) : i18n.chain.vq.empire.selectedRegion} (2 CP)</Button>
            <Stack direction="row" spacing={0.5}>
                <Select size="small" value={catholicRebellionCp} onChange={(e) => setCatholicRebellionCp(Number(e.target.value))}>
                    {[3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                </Select>
                <Button size="small" variant="outlined" disabled={!canAct || cp < catholicRebellionCp || G.year < 3 ||
                    G.assassinationUsed.includes("spain") || allied(G, "spain", "england")}
                    onClick={() => moves.englishCatholicRebellion({cp: catholicRebellionCp})}>{i18n.chain.vq.empire.englishCatholicRebellion}</Button>
            </Stack>
        </>}
        {G.informants.map((i) => <Typography key={`${i.owner}:${i.target}`} variant="caption">
            {powerName(i.owner, vqLocale)} → {powerName(i.target, vqLocale)}{i18n.chain.vq.empire.informantSep}{i.neutralized ? i18n.chain.vq.empire.informantNeutralized : i.plantedImpulse < G.impulse ? i18n.chain.vq.empire.informantActive : i18n.chain.vq.empire.informantPending}
        </Typography>)}
        <Divider/>
        </ActionGroup>
        <ActionGroup {...available(i18n.chain.vq.worldUi.title, worldCount)}>
        <Typography variant="caption" color="text.secondary">{i18n.chain.vq.worldUi.intro}</Typography>
        <Stack spacing={0.5}>
            {WORLD_SEA_ZONES.map((zone) => {
                const here = Object.entries(G.worldCaptains).filter(([, ex]) => ex.location === zone.id);
                return <Paper key={zone.id} variant="outlined" sx={{p: 0.5}}>
                    <Typography variant="caption" sx={{fontWeight: 700}}>{dataName(zone)}{i18n.getLocaleName() === "en" ? "" : ` (${zone.nameEn})`}</Typography>
                    {here.map(([id, ex]) => <Typography key={id} variant="caption" sx={{display: "block"}}>
                        {seaCaptainName(seaCaptainById(id), vqLocale) || id} · {powerName(ex.power, vqLocale)}{ex.damaged ? " · " + i18n.chain.vq.worldUi.damaged : ""}{ex.colony ? " · " + i18n.chain.vq.worldUi.carryingColony : ""}
                    </Typography>)}
                    {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id).map((s) => <Typography key={s.id} variant="caption" sx={{display: "block"}}>
                        {dataName(s)}: {G.worldControls[s.id] === undefined ? i18n.chain.vq.worldUi.vacant : `${powerName(G.worldControls[s.id]!, vqLocale)} ${i18n.chain.vq.worldUi.controls}`}
                        {G.worldFortresses?.[s.id] !== undefined ? ` · ${powerName(G.worldFortresses[s.id]!, vqLocale)} ${i18n.chain.vq.worldUi.fortress}` : ""}
                    </Typography>)}
                    {(G.worldPatrols?.[zone.id] ?? 0) > 0 && <Typography variant="caption" sx={{display: "block"}}>{i18n.chain.vq.worldUi.spanishPatrols}: {G.worldPatrols?.[zone.id]}</Typography>}
                    {me === "spain" && WORLD_SETTLEMENTS.some((s) => s.seaZone === zone.id &&
                        (G.worldControls[s.id] === "spain" || G.worldColonies[s.id] === "spain")) &&
                        <Button size="small" variant="outlined" disabled={!myTurn || cp < 2}
                            onClick={() => moves.buildPatrol({zone: zone.id})}>{i18n.chain.vq.worldUi.buildPatrol}</Button>}
                    {me === "spain" && WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id &&
                        (G.worldControls[s.id] === "spain" || G.worldColonies[s.id] === "spain") &&
                        G.worldFortresses?.[s.id] === undefined).map((s) =>
                        <Button key={`fort-${s.id}`} size="small" variant="outlined" disabled={!myTurn || cp < 2 || (G.worldFortressesBuilt ?? 0) >= 2}
                            onClick={() => moves.buildWorldFortress({settlement: s.id})}>{dataName(s)} · {i18n.chain.vq.worldUi.buildFortress}</Button>)}
                    {here.filter(([, ex]) => ex.power === me).map(([id]) => <Stack key={id} direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                        {zone.adjacent.map((next) => <Button key={next} size="small" variant="text" disabled={!myTurn || (cp < 1 && !Object.values(G.worldCaptains).some((ex) => ex.power === me && ex.movedImpulse === G.impulse)) || G.worldCaptains[id].movedImpulse === G.impulse}
                            onClick={() => moves.moveExpedition({captain: id, zone: next})}>{i18n.chain.vq.worldUi.sailTo} {dataName(WORLD_SEA_ZONES.find((z) => z.id === next))}</Button>)}
                        {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id && s.id !== "philippines" && G.worldControls[s.id] === undefined && G.worldCaptains[id].colony).map((s) =>
                            <Button key={s.id} size="small" variant="text" disabled={!myTurn || cp < 1}
                                onClick={() => moves.settleColony({captain: id, settlement: s.id})}>{dataName(s)} · {i18n.chain.vq.worldUi.foundColony}</Button>)}
                        {me !== "spain" && <Button size="small" variant="outlined" disabled={!myTurn || cp < 2}
                            onClick={() => moves.worldPiracy({captain: id})}>{i18n.chain.vq.worldUi.worldPiracy}</Button>}
                    </Stack>)}
                </Paper>;
            })}
        </Stack>
        <FormControl size="small" fullWidth>
            <InputLabel id="vq-expedition-captain">{i18n.chain.vq.worldUi.expeditionCaptain}</InputLabel>
            <Select labelId="vq-expedition-captain" label={i18n.chain.vq.worldUi.expeditionCaptain} value={expeditionCaptain}
                    onChange={(e) => setExpeditionCaptain(e.target.value)}>
                {ps?.seaCaptains.filter((id) => (seaCaptainById(id)?.turn ?? 99) <= G.year && G.worldCaptains[id] === undefined).map((id) =>
                    <MenuItem key={id} value={id}>{seaCaptainName(seaCaptainById(id), vqLocale) || id}</MenuItem>)}
            </Select>
        </FormControl>
        <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
            <Button size="small" variant="outlined" disabled={!myTurn || cp < expeditionCost || expeditionCaptain === "" ||
                (expeditionHasColony && (me === "hre" || (me === "ottoman" && !G.suezDone)))}
                    onClick={() => moves.buildExpedition({captain: expeditionCaptain, colony: expeditionHasColony})}>
                {i18n.chain.vq.worldUi.buildExpedition} ({expeditionCost} CP)
            </Button>
            <Button size="small" variant={expeditionHasColony ? "contained" : "outlined"}
                    disabled={me === "hre" || (me === "ottoman" && !G.suezDone)}
                    onClick={() => setExpeditionHasColony(!expeditionHasColony)}>{i18n.chain.vq.worldUi.carryColony}</Button>
        </Stack>
        <Divider/>
        </ActionGroup>
        <ActionGroup {...available(i18n.chain.vq.worldUi.patronageTitle, patronCount)}>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.worldUi.markersLeft}: {i18n.chain.vq.worldUi.artist} {artistMarkersLeft}{i18n.chain.vq.worldUi.markerCount}, {i18n.chain.vq.worldUi.scientist} {scientistMarkersLeft}{i18n.chain.vq.worldUi.markerCount} ({i18n.chain.vq.worldUi.markersTotal} {vpAwards.length}{i18n.chain.vq.worldUi.markerCount})
        </Typography>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.worldUi.artistAwards}: {patronageAwardSummary(vpAwards, "artist")}
        </Typography>
        <Typography variant="caption" color="text.secondary">
            {i18n.chain.vq.worldUi.scientistAwards}: {patronageAwardSummary(vpAwards, "scientist")}
        </Typography>
        {patronageSetup.unavailableVpAwards?.map((id) => {
            const award = PATRONAGE_VP_AWARD_BY_ID[id];
            return award === undefined ? null : <Typography key={id} variant="caption" color="text.secondary">
                {i18n.chain.vq.worldUi.removedInScenario}: {award.nameEn} ({award.vp} VP{award.artistType ? ` · ${award.artistType}` : ""})
            </Typography>;
        })}
        <FormControl size="small" fullWidth>
            <InputLabel id="vq-patron-cp">{i18n.chain.vq.worldUi.investCp}</InputLabel>
            <Select labelId="vq-patron-cp" label={i18n.chain.vq.worldUi.investCp} value={patronageCp}
                    onChange={(e) => setPatronageCp(Number(e.target.value))}>
                {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
            </Select>
        </FormControl>
        <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
            {G.patronsAvailable.map((id) => patronDef(id)).filter((p): p is NonNullable<typeof p> => p !== undefined && p.region === me && !POWERS.some((x) => G.powers[x].patrons.includes(p.id))).map((p) =>
                <Button key={p.id} size="small" variant="outlined"
                        disabled={!myTurn || cp < patronageCp || G.patronizedThisTurn.includes(`${me}:${p.kind}`)}
                        onClick={() => moves.patronize({patron: p.id, cp: patronageCp})}>
                    {patronLabel(p)}{p.rating === null ? ` (${i18n.chain.vq.worldUi.ratingPending})` : ` (${i18n.chain.vq.worldUi.rating} ${p.rating})`}{p.kind === "scientist" ? ` · ${i18n.chain.vq.worldUi.scientist}` : ""}
                </Button>)}
        </Stack>
        </ActionGroup></>}
        {ps !== undefined && ps.seaCaptains.length > 0 && <>
            <Divider/>
            <Typography variant="subtitle2">{i18n.chain.vq.worldUi.seaCaptains}</Typography>
            {ps.seaCaptains.map((id) => {
                const captain = seaCaptainById(id);
                return <Typography key={id} variant="caption">{seaCaptainName(captain, vqLocale) || id}{i18n.chain.vq.punct.colon}{captain === undefined ? "" : (vqLocale === "en" ? captain.bonus : (captain.bonusZh ?? captain.bonus))}</Typography>;
            })}
        </>}
        {ps !== undefined && ps.scienceBonuses.length > 0 && <>
            <Typography variant="subtitle2">{i18n.chain.vq.worldUi.scienceBonusesEarned}</Typography>
            {ps.scienceBonuses.map((id) => {
                const bonus = scienceBonusById(id);
                return <Typography key={id} variant="caption">{dataName(bonus) || id}{i18n.chain.vq.punct.colon}{bonus?.description}</Typography>;
            })}
        </>}
        <Divider/>
        <ActionGroup {...available(i18n.chain.vq.worldUi.piracyTitle, piracyCount)}>
        <Stack spacing={0.5}>
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-pirate-zone">{i18n.chain.vq.worldUi.seaZone}</InputLabel>
                <Select labelId="vq-pirate-zone" label={i18n.chain.vq.worldUi.seaZone} value={piracyZone}
                        onChange={(e) => setPiracyZone(e.target.value)}>
                    {Object.keys(G.seaZones).filter((z) => G.seaZones[z as keyof VQGame["seaZones"]].naval[me] !== undefined)
                        .map((z) => <MenuItem key={z} value={z}>{seaZoneName(z, vqLocaleNow())}</MenuItem>)}
                </Select>
            </FormControl>
            <FormControl size="small" fullWidth>
                <InputLabel id="vq-pirate-target">{i18n.chain.vq.worldUi.target}</InputLabel>
                <Select labelId="vq-pirate-target" label={i18n.chain.vq.worldUi.target} value={piracyTarget}
                        onChange={(e) => setPiracyTarget(e.target.value)}>
                    {POWERS.filter((p) => p !== me).map((p) => <MenuItem key={p} value={p}>{powerName(p, vqLocale)}</MenuItem>)}
                </Select>
            </FormControl>
            <Button size="small" variant="outlined" disabled={!myTurn || cp < 1 || piracyZone === "" || piracyTarget === ""}
                    onClick={() => moves.piracy({zone: piracyZone, target: piracyTarget})}>{i18n.chain.vq.worldUi.launchPiracy}</Button>
        </Stack>
        </ActionGroup>
    </>;
};
