import React from "react";
import {BoardProps} from "boardgame.io/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Grid from "@mui/material/Grid";
import InputLabel from "@mui/material/InputLabel";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import {
    AREA_NAMES,
    CONTROLLER_COLORS,
    controllerNameZh,
    landCount,
    MINOR_NAMES,
    MINOR_POWERS,
    LandStack,
    navalCount,
    POWER_INFO,
    POWER_NAMES,
    POWERS,
    Power,
    RULER_NAMES,
    ReligionArea,
    VQGame,
    isPower,
    powerAt,
} from "../constant/general";
import {cardById} from "../constant/cards";
import {LEADER_BY_ID} from "../constant/leaders";
import {patronDef, royalAvailable, scenarioSetup, scienceBonusById, seaCaptainById} from "../scenario";
import {DUTCH_KEYS, SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES} from "../constant/spaces";
import {WORLD_SEA_ZONES, WORLD_SETTLEMENTS} from "../data/world";
import {PATRONAGE_VP_AWARD_BY_ID} from "../data/patronage";
import {MINOR_DIPLOMACY} from "../data/minorDiplomacy";
import {PatronageVpAward} from "../data/types";
import {
    atWar,
    baseVp,
    capitalOf,
    controlledKeys,
    homeCardChoiceRequired,
    keepsBothHomeCards,
    powerVp,
    protestantSpaceCount,
    religionCandidates,
    rebellionTargets,
    religiousSpecialVp,
    victoryStandings,
    warCost,
    zonePorts,
    minorAvailable,
} from "../util";
import {VQMap} from "./map";

type Mode =
    | "inspect"
    | "recruitRegular"
    | "recruitMerc"
    | "recruitCav"
    | "buildGalley"
    | "buildGalleon"
    | "buildRacebuilt"
    | "buildCorsair"
    | "moveLand"
    | "moveNaval"
    | "spring"
    | "control"
    | "assault"
    | "buildFortress"
    | "rebellion";

const MODE_LABELS: Record<Mode, string> = {
    inspect: "查看",
    recruitRegular: "征募正规军 (1 CP)",
    recruitMerc: "征募雇佣兵 (1 CP)",
    recruitCav: "征募骑兵 (1 CP)",
    buildGalley: "建造桨帆船 (1 CP)",
    buildGalleon: "建造大帆船 (2 CP)",
    buildRacebuilt: "建造快帆船 (2 CP)",
    buildCorsair: "建造海盗船 (1 CP)",
    moveLand: "陆军移动 (1/2 CP)",
    moveNaval: "海军移动 (1 CP)",
    spring: "春季部署 (免费)",
    control: "控制/清除动荡 (1 CP)",
    assault: "强攻 (1 CP)",
    buildFortress: "修筑要塞 (2 CP)",
    rebellion: "新教叛乱 (2-5 CP)",
};

const PHASE_LABELS: Record<string, string> = {
    cardDraw: "Card Draw 阶段",
    diplomacy: "外交阶段",
    spring: "春季部署",
    action: "行动阶段",
};

const patronageAwardSummary = (awards: PatronageVpAward[], kind: "artist" | "scientist"): string => {
    const typeNames: Record<string, string> = {writer: "写作", painter: "绘画", architect: "建筑", any: "不限类型"};
    const selected = awards.filter((award) => award.kind === kind);
    const vpValues = [...new Set(selected.map((award) => award.vp))].sort((a, b) => b - a);
    if (kind === "scientist") {
        return vpValues.map((vp) => `${vp}VP ×${selected.filter((award) => award.vp === vp).length}`).join("、");
    }
    return vpValues.flatMap((vp) => {
        const ofValue = selected.filter((award) => award.vp === vp);
        const types = ["writer", "painter", "architect", "any"];
        return types.flatMap((type) => {
            const count = ofValue.filter((award) => (award.artistType ?? "any") === type).length;
            return count > 0 ? [`${typeNames[type]} ${vp}VP ×${count}`] : [];
        });
    }).join("、");
};

const cell = (v: number): string => (v > 0 ? String(v) : "·");

export const VirginQueenBoard = ({G, ctx, moves, playerID, isActive}: BoardProps<VQGame>) => {
    const [selected, setSelected] = React.useState<string | undefined>("london");
    const [mode, setMode] = React.useState<Mode>("inspect");
    const [from, setFrom] = React.useState<string | null>(null);
    const [rebelCp, setRebelCp] = React.useState(2);
    const [piracyZone, setPiracyZone] = React.useState("");
    const [piracyTarget, setPiracyTarget] = React.useState("");
    const [diploTarget, setDiploTarget] = React.useState<Power>("spain");
    const [domesticRoyal, setDomesticRoyal] = React.useState("");
    const [foreignRoyal, setForeignRoyal] = React.useState("");
    const [patronageCp, setPatronageCp] = React.useState(2);
    const [espionageTarget, setEspionageTarget] = React.useState<Power>("spain");
    const [assassinationTarget, setAssassinationTarget] = React.useState("elizabeth");
    const [assassinationCp, setAssassinationCp] = React.useState(2);
    const [expeditionCaptain, setExpeditionCaptain] = React.useState("");
    const [expeditionHasColony, setExpeditionHasColony] = React.useState(false);
    const [foreignArmySize, setForeignArmySize] = React.useState(3);
    const [foreignWarUnits, setForeignWarUnits] = React.useState<{space: string; kind: keyof LandStack}[]>([]);
    const [foreignWarLeader, setForeignWarLeader] = React.useState("");

    const me: Power | undefined = playerID === null ? undefined : powerAt(playerID);
    const myTurn = me !== undefined && ctx.currentPlayer === playerID;
    const phase = ctx.phase ?? "";
    const ps = me !== undefined ? G.powers[me] : undefined;
    const cp = ps?.cp ?? 0;
    const hand = ps?.cards ?? [];
    const canAct = myTurn && phase === "action";

    React.useEffect(() => {
        setMode("inspect");
        setFrom(null);
        setForeignWarUnits([]);
        setForeignWarLeader("");
    }, [ctx.phase, ctx.currentPlayer]);

    const doSpaceAction = (id: string): void => {
        if (!canAct || me === undefined) {
            return;
        }
        switch (mode) {
            case "recruitRegular":
                moves.recruit({space: id, kind: "regular"});
                break;
            case "recruitMerc":
                moves.recruit({space: id, kind: "merc"});
                break;
            case "recruitCav":
                moves.recruit({space: id, kind: "cav"});
                break;
            case "buildGalley":
                moves.buildNaval({port: id, kind: "galley"});
                break;
            case "buildGalleon":
                moves.buildNaval({port: id, kind: "galleon"});
                break;
            case "buildRacebuilt":
                moves.buildNaval({port: id, kind: "racebuilt"});
                break;
            case "buildCorsair":
                moves.buildNaval({port: id, kind: "corsair"});
                break;
            case "moveLand":
                if (from === null) {
                    if ((G.spaces[id].land[me]?.regular ?? 0) + (G.spaces[id].land[me]?.merc ?? 0) + (G.spaces[id].land[me]?.cav ?? 0) > 0) {
                        setFrom(id);
                    }
                } else {
                    moves.moveLand({from, to: id});
                    setFrom(null);
                }
                break;
            case "moveNaval":
                if (from === null) {
                    if (G.seaZones[id as keyof VQGame["seaZones"]]?.naval[me] !== undefined) {
                        setFrom(id);
                    } else if (G.spaces[id] !== undefined && (G.spaces[id].naval[me] !== undefined)) {
                        setFrom(id);
                    }
                } else {
                    moves.moveNaval({from, to: id});
                    setFrom(null);
                }
                break;
            case "spring":
                if (from === null) {
                    if ([capitalOf(G, me)].includes(id)) {
                        setFrom(id);
                    }
                } else {
                    moves.springDeploy({from, to: id});
                    setFrom(null);
                }
                break;
            case "control":
                moves.controlSpace({space: id});
                break;
            case "assault":
                moves.assault({space: id});
                break;
            case "buildFortress":
                moves.buildFortress({space: id});
                break;
            case "rebellion":
                moves.rebellion({space: id, cp: rebelCp});
                break;
            default:
                break;
        }
    };

    const onSelect = (id: string): void => {
        setSelected(id);
        doSpaceAction(id);
    };

    const space = selected !== undefined ? G.spaces[selected] : undefined;
    const spaceDef = selected !== undefined ? SPACE_BY_ID[selected] : undefined;
    const standings = victoryStandings(G);

    const cardView = (id: string) => {
        const def = cardById(id);
        const disabled = !canAct || ps === undefined || ps.cardPlayed;
        const handler = def.officialEffect?.kind === "manual" ? def.officialEffect.handler : "";
        const foreignWarPower = handler === "warInPersia" ? "ottoman" : handler === "warWithPoland" ? "hre" : undefined;
        const foreignWarBlocked = foreignWarPower !== undefined && (G.foreignWars[foreignWarPower] !== undefined ||
            (foreignWarPower === "hre" && atWar(G, "hre", "ottoman")) ||
            Object.values(G.spaces).filter((space) => space.siege === undefined)
                .reduce((total, space) => total + landCount(space.land[foreignWarPower]), 0) < 3);
        return <Paper key={id} variant="outlined" sx={{p: 0.75, mb: 0.5}}>
            <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                <Typography variant="caption" sx={{fontWeight: 700}}>{def.name}</Typography>
                <Chip size="small" label={`${def.cp} CP`} color={def.kind === "home" ? "secondary" : "default"}/>
                {def.kind === "event" && <Chip size="small" variant="outlined" label="事件"/>}
                {def.kind === "home" && <Chip size="small" variant="outlined" label="本国牌"/>}
            </Stack>
            {def.text !== undefined && <Typography variant="caption" color="text.secondary">{def.text}</Typography>}
            {foreignWarPower !== undefined && <FormControl size="small" sx={{mt: 0.5, minWidth: 130}}>
                <InputLabel id={`vq-war-size-${id}`}>境外军规模</InputLabel>
                <Select labelId={`vq-war-size-${id}`} label="境外军规模" value={foreignArmySize}
                        onChange={(e) => setForeignArmySize(Number(e.target.value))}>
                    {[3, 5].map((n) => <MenuItem key={n} value={n}>{n} 个独立军</MenuItem>)}
                </Select>
            </FormControl>}
            <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
                {def.kind !== "command" && <Button size="small" variant="contained"
                                                  disabled={disabled || foreignWarBlocked}
                                                  onClick={() => moves.playCard({cardId: id, asEvent: true,
                                                      ...(foreignWarPower !== undefined ? {target: String(foreignArmySize)} : {})})}>
                    {def.kind === "home" ? "使用能力" : "作为事件"}
                </Button>}
                <Button size="small" variant="outlined" disabled={disabled}
                        onClick={() => moves.playCard({cardId: id})}>作为 CP</Button>
            </Stack>
        </Paper>;
    };

    const actionPanel = () => {
        if (me === undefined) {
            return <Typography variant="body2" color="text.secondary">旁观模式：只能查看局势。</Typography>;
        }
        if (phase === "cardDraw") {
            return <Stack spacing={1}>
                <Typography variant="subtitle2">Card Draw 阶段 · 第 {G.year} 回合</Typography>
                <Typography variant="body2">已按本回合可用性发放本国牌与年度手牌。拥有两张可用本国牌的强国，将在春季部署时秘密保留一张。</Typography>
                {G.powers.ottoman.ruler === "suleiman" &&
                    <Typography variant="caption" color="text.secondary">苏莱曼一世在位时，奥斯曼可保留两张本国牌。</Typography>}
                <Typography variant="caption" color="text.secondary">{G.scenario === "campaign" ? "拉罗谢尔之围（Campaign）" : "荷兰起义开始（Tournament）"}</Typography>
                {me !== "france" && me !== "protestant" ? null : G.seaCaptainsAvailable.map((id) => {
                    const captain = seaCaptainById(id);
                    if (captain === undefined || captain.turn > G.year) {
                        return null;
                    }
                    return <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                                   onClick={() => moves.claimSeaCaptain({captain: id})}>
                        领取共享船长：{captain.nameZh ?? captain.nameEn}
                    </Button>;
                })}
                <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>结束 Card Draw 阶段</Button>
            </Stack>;
        }
        if (phase === "action") {
            const patronageSetup = scenarioSetup(G.scenario).patronage;
            const vpAwards = patronageSetup.vpAwards.map((id) => PATRONAGE_VP_AWARD_BY_ID[id])
                .filter((award): award is PatronageVpAward => award !== undefined);
            const artistMarkersLeft = vpAwards.filter((award) => award.kind === "artist").length;
            const scientistMarkersLeft = vpAwards.filter((award) => award.kind === "scientist").length;
            const expeditionCaptainDef = seaCaptainById(expeditionCaptain);
            const expeditionBaseCost = expeditionCaptainDef?.bonus.startsWith("Costs 2 CP") ? 2 : 1;
            const hasFreeColonist = expeditionCaptainDef?.bonus.startsWith("Free colonist") || ps?.scienceBonuses.includes("plantation");
            const expeditionCost = expeditionBaseCost + (expeditionHasColony && !hasFreeColonist ? 1 : 0);
            return <Stack spacing={1}>
                <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                    <Typography variant="body2">剩余 CP：<b>{cp}</b></Typography>
                    <Chip size="small" label={`手牌 ${hand.length}`}/>
                    {ps !== undefined && ps.cardPlayed && <Chip size="small" color="success" label="本回合已出牌"/>}
                </Stack>
                {!myTurn && <Typography variant="caption" color="text.secondary">等待 {POWER_NAMES[G.activePower].zh} 行动。</Typography>}
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-mode">行动</InputLabel>
                    <Select labelId="vq-mode" label="行动" value={mode}
                            onChange={(e) => {
                                setMode(e.target.value as Mode);
                                setFrom(null);
                            }}>
                        {Object.keys(MODE_LABELS)
                            .filter((m) => m !== "rebellion" || me === "protestant")
                            .map((m) => <MenuItem key={m} value={m}>{MODE_LABELS[m as Mode]}</MenuItem>)}
                    </Select>
                </FormControl>
                {mode === "rebellion" && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-rebel">叛乱投入 CP</InputLabel>
                    <Select labelId="vq-rebel" label="叛乱投入 CP" value={rebelCp}
                            onChange={(e) => setRebelCp(Number(e.target.value))}>
                        {[2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                </FormControl>}
                <Typography variant="caption" color="text.secondary">
                    {mode === "inspect" ? "在地图上点击城市查看详情。" : "在地图上点击目标城市执行行动。"}
                    {from !== null ? ` 已选择起点：${SPACE_BY_ID[from]?.name ?? from}` : ""}
                </Typography>
                <Divider/>
                <Stack direction="row" spacing={1} sx={{flexWrap: "wrap"}}>
                    <Button size="small" color="inherit" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.pass()}>跳过</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.endImpulse()}>结束冲动</Button>
                </Stack>
                <Divider/>
                {G.foreignWars[me]?.status === "setup" && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">境外战争部署 · {G.foreignWars[me]?.enemy}</Typography>
                    <Typography variant="caption" color="text.secondary">选取 3–8 个本国陆军单位；可从多个未被围困的城市调集，并可带一名陆军将领。</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", my: 0.5}}>
                        {foreignWarUnits.map((unit, index) => <Chip key={`${unit.space}-${unit.kind}-${index}`} size="small"
                            label={`${SPACE_BY_ID[unit.space]?.name ?? unit.space} ${unit.kind}`} onDelete={() => setForeignWarUnits((old) => old.filter((_, i) => i !== index))}/>)}
                        {foreignWarUnits.length > 0 && <Button size="small" onClick={() => setForeignWarUnits([])}>清空</Button>}
                    </Stack>
                    {Object.entries(G.spaces).filter(([, state]) => state.siege === undefined && landCount(state.land[me]) > 0).map(([spaceId, state]) => <Stack key={spaceId} direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                        <Typography variant="caption" sx={{minWidth: 80}}>{SPACE_BY_ID[spaceId]?.name ?? spaceId}</Typography>
                        {(["regular", "merc", "cav"] as const).filter((kind) => (state.land[me]?.[kind] ?? 0) > 0).map((kind) => {
                            const picked = foreignWarUnits.filter((unit) => unit.space === spaceId && unit.kind === kind).length;
                            return <Button key={kind} size="small" variant="outlined" disabled={foreignWarUnits.length >= 8 || picked >= (state.land[me]?.[kind] ?? 0)}
                                onClick={() => setForeignWarUnits((old) => [...old, {space: spaceId, kind}])}>+ {kind} ({(state.land[me]?.[kind] ?? 0) - picked})</Button>;
                        })}
                    </Stack>)}
                    <FormControl size="small" fullWidth sx={{mt: 0.5}}>
                        <InputLabel id="vq-foreign-war-leader">随军将领（可选）</InputLabel>
                        <Select labelId="vq-foreign-war-leader" label="随军将领（可选）" value={foreignWarLeader}
                                onChange={(e) => setForeignWarLeader(e.target.value)}>
                            <MenuItem value="">不带将领</MenuItem>
                            {Object.values(G.leaders).filter((leader) => LEADER_BY_ID[leader.id]?.power === me && LEADER_BY_ID[leader.id]?.kind === "army" &&
                                Object.values(G.spaces).some((state) => state.leaders.includes(leader.id))).map((leader) =>
                                <MenuItem key={leader.id} value={leader.id}>{LEADER_BY_ID[leader.id]?.name ?? leader.id}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="contained" sx={{mt: 0.5}} disabled={!myTurn || foreignWarUnits.length < 3 || foreignWarUnits.length > 8}
                            onClick={() => moves.commitForeignWarForce({units: foreignWarUnits, ...(foreignWarLeader ? {leaderId: foreignWarLeader} : {})})}>派出部队</Button>
                </Paper>}
                {G.foreignWars[me]?.status === "active" && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">境外战争进行中 · {G.foreignWars[me]?.enemy}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        我方 {landCount(G.foreignWars[me]!.units)} 人 · 敌方 {G.foreignWars[me]!.enemyUnits} 人
                        {G.foreignWars[me]!.leaderId ? ` · 将领 ${LEADER_BY_ID[G.foreignWars[me]!.leaderId!]?.name}` : ""}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 0.5}}>
                        <Button size="small" variant="contained" disabled={!myTurn || cp < 1 || landCount(G.foreignWars[me]!.units) === 0}
                                onClick={() => moves.fightForeignWar()}>作战 (1 CP)</Button>
                        {(["regular", "merc", "cav"] as const).filter((kind) => kind !== "cav" || me === "ottoman").filter((kind) => kind !== "merc" || me !== "ottoman").map((kind) =>
                            <Button key={kind} size="small" variant="outlined" disabled={!myTurn || cp < (kind === "regular" ? 2 : 1) || landCount(G.foreignWars[me]!.units) >= 8}
                                    onClick={() => moves.reinforceForeignWar({kind})}>增援 {kind} ({kind === "regular" ? 2 : 1} CP)</Button>)}
                    </Stack>
                </Paper>}
                <Divider/>
                <Typography variant="subtitle2">宗教行动</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {religionActions(me).map((a) => <Button key={a.label} size="small" variant="outlined"
                                                             disabled={!myTurn || cp < 2}
                                                             onClick={() => a.run()}>{a.label}</Button>)}
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">小国影响力与外交</Typography>
                <Typography variant="caption" color="text.secondary">
                    购买影响力每枚 1 CP；事件或对小国宣战触发外交决议，同一小国每回合只能决议一次。
                </Typography>
                <Stack spacing={0.5}>
                    {MINOR_POWERS.map((minor) => {
                        const influence = ps?.influence[minor] ?? 0;
                        const ally = POWERS.find((candidate) => G.powers[candidate].alliedMinors.includes(minor));
                        const resolved = G.minorDiplomacyResolved.includes(minor);
                        const eligible = MINOR_DIPLOMACY[minor].eligible.includes(me) &&
                            !G.minorInfluenceBlocked[me].includes(minor);
                        return <Stack key={minor} direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                            <Typography variant="caption" sx={{minWidth: 78}}>
                                {MINOR_NAMES[minor].zh} {ally ? `· ${POWER_NAMES[ally].zh}盟友` : "· 未激活"}
                            </Typography>
                            <Chip size="small" variant="outlined" label={`影响力 ${influence}`} />
                            <Button size="small" variant="outlined"
                                    disabled={!myTurn || cp < 1 || !eligible || resolved || influence >= 9}
                                    onClick={() => moves.influence({target: minor})}>+1 影响力</Button>
                            {resolved && <Chip size="small" color="success" label="本回合已决议"/>}
                        </Stack>;
                    })}
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">间谍与刺杀</Typography>
                <Typography variant="caption" color="text.secondary">
                    第 3 回合起开放。间谍按 2 CP 派遣；情报行动为 2 CP；刺杀每回合一次，投入 2–4 CP。
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    当前骰表为可玩近似：命中按 5–6 计，情报命中可夺取手牌并解除间谍，刺杀按双方命中差判定；官方结果表尚待录入。
                </Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-espionage-target">目标势力</InputLabel>
                    <Select labelId="vq-espionage-target" label="目标势力" value={espionageTarget}
                            onChange={(e) => setEspionageTarget(e.target.value as Power)}>
                        {POWERS.filter((p) => p !== me).map((p) => <MenuItem key={p} value={p}>{POWER_NAMES[p].zh}</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < 2 || G.year < 3 || G.informants.some((i) => i.target === espionageTarget)}
                            onClick={() => moves.plantInformant({target: espionageTarget})}>派遣间谍 (2 CP)</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < 2 || G.year < 3}
                            onClick={() => moves.gainIntelligence({target: espionageTarget})}>获取情报 (2 CP)</Button>
                </Stack>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-assassination-target">刺杀目标</InputLabel>
                    <Select labelId="vq-assassination-target" label="刺杀目标" value={assassinationTarget}
                            onChange={(e) => setAssassinationTarget(e.target.value)}>
                        <MenuItem value="elizabeth" disabled={!G.royals.some((r) => r.id === "elizabeth" && r.alive)}>伊丽莎白一世</MenuItem>
                        {Object.values(G.leaders).filter((l) => LEADER_BY_ID[l.id]?.kind === "army" && LEADER_BY_ID[l.id]?.power !== me &&
                            l.location !== "pool" && l.location !== "captured" && l.location !== "offMap").map((l) =>
                            <MenuItem key={l.id} value={l.id}>{LEADER_BY_ID[l.id]?.name ?? l.id} ({POWER_NAMES[LEADER_BY_ID[l.id].power].zh})</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
                    <Select size="small" value={assassinationCp} onChange={(e) => setAssassinationCp(Number(e.target.value))}>
                        {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < assassinationCp || G.year < 3 || G.assassinationUsed.includes(me)}
                            onClick={() => moves.assassinate({target: assassinationTarget, cp: assassinationCp})}>尝试刺杀</Button>
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">世界地图 · 探险与殖民</Typography>
                <Typography variant="caption" color="text.secondary">海域按已录入的粗略邻接关系逐区航行；尚未录入的官方航行检定与海盗规则不会自动结算。</Typography>
                <Stack spacing={0.5}>
                    {WORLD_SEA_ZONES.map((zone) => {
                        const here = Object.entries(G.worldCaptains).filter(([, ex]) => ex.location === zone.id);
                        return <Paper key={zone.id} variant="outlined" sx={{p: 0.5}}>
                            <Typography variant="caption" sx={{fontWeight: 700}}>{zone.nameZh} ({zone.nameEn})</Typography>
                            {here.map(([id, ex]) => <Typography key={id} variant="caption" sx={{display: "block"}}>
                                {seaCaptainById(id)?.nameZh ?? id} · {POWER_NAMES[ex.power].zh}{ex.damaged ? " · 受损" : ""}{ex.colony ? " · 携带殖民地" : ""}
                            </Typography>)}
                            {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id).map((s) => <Typography key={s.id} variant="caption" sx={{display: "block"}}>
                                {s.nameZh}：{G.worldControls[s.id] === undefined ? "空置" : `${POWER_NAMES[G.worldControls[s.id]!].zh}控制`}
                            </Typography>)}
                            {here.filter(([, ex]) => ex.power === me).map(([id]) => <Stack key={id} direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                                {zone.adjacent.map((next) => <Button key={next} size="small" variant="text" disabled={!myTurn || (cp < 1 && !Object.values(G.worldCaptains).some((ex) => ex.power === me && ex.movedImpulse === G.impulse)) || G.worldCaptains[id].movedImpulse === G.impulse}
                                    onClick={() => moves.moveExpedition({captain: id, zone: next})}>航行至 {WORLD_SEA_ZONES.find((z) => z.id === next)?.nameZh}</Button>)}
                                {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id && s.id !== "philippines" && G.worldControls[s.id] === undefined && G.worldCaptains[id].colony).map((s) =>
                                    <Button key={s.id} size="small" variant="text" disabled={!myTurn || cp < 1}
                                        onClick={() => moves.settleColony({captain: id, settlement: s.id})}>在{s.nameZh}建立殖民地</Button>)}
                            </Stack>)}
                        </Paper>;
                    })}
                </Stack>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-expedition-captain">探险船长</InputLabel>
                    <Select labelId="vq-expedition-captain" label="探险船长" value={expeditionCaptain}
                            onChange={(e) => setExpeditionCaptain(e.target.value)}>
                        {ps?.seaCaptains.filter((id) => (seaCaptainById(id)?.turn ?? 99) <= G.year && G.worldCaptains[id] === undefined).map((id) =>
                            <MenuItem key={id} value={id}>{seaCaptainById(id)?.nameZh ?? seaCaptainById(id)?.nameEn ?? id}</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < expeditionCost || expeditionCaptain === "" || (me === "hre" && expeditionHasColony)}
                            onClick={() => moves.buildExpedition({captain: expeditionCaptain, colony: expeditionHasColony})}>
                        建立探险队 ({expeditionCost} CP)
                    </Button>
                    <Button size="small" variant={expeditionHasColony ? "contained" : "outlined"}
                            onClick={() => setExpeditionHasColony(!expeditionHasColony)}>携带殖民地</Button>
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">赞助 (每回合最多一位艺术家与一位科学家)</Typography>
                <Typography variant="caption" color="text.secondary">
                    剩余 VP 标记：艺术家 {artistMarkersLeft} 枚、科学家 {scientistMarkersLeft} 枚（共 {vpAwards.length} 枚）
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    艺术奖励：{patronageAwardSummary(vpAwards, "artist")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    科学奖励：{patronageAwardSummary(vpAwards, "scientist")}
                </Typography>
                {patronageSetup.unavailableVpAwards?.map((id) => {
                    const award = PATRONAGE_VP_AWARD_BY_ID[id];
                    return award === undefined ? null : <Typography key={id} variant="caption" color="text.secondary">
                        本场景移除：{award.nameEn}（{award.vp} VP{award.artistType ? ` · ${award.artistType}` : ""}）
                    </Typography>;
                })}
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-patron-cp">投入 CP</InputLabel>
                    <Select labelId="vq-patron-cp" label="投入 CP" value={patronageCp}
                            onChange={(e) => setPatronageCp(Number(e.target.value))}>
                        {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {G.patronsAvailable.map((id) => patronDef(id)).filter((p): p is NonNullable<typeof p> => p !== undefined && p.region === me && !POWERS.some((x) => G.powers[x].patrons.includes(p.id))).map((p) =>
                        <Button key={p.id} size="small" variant="outlined"
                                disabled={!myTurn || cp < patronageCp || G.patronizedThisTurn.includes(`${me}:${p.kind}`)}
                                onClick={() => moves.patronize({patron: p.id, cp: patronageCp})}>
                            {p.name}{p.rating === null ? " (评级待录)" : ` (评级 ${p.rating})`}{p.kind === "scientist" ? " · 科学家" : ""}
                        </Button>)}
                </Stack>
                {ps !== undefined && ps.seaCaptains.length > 0 && <>
                    <Divider/>
                    <Typography variant="subtitle2">船长</Typography>
                    {ps.seaCaptains.map((id) => {
                        const captain = seaCaptainById(id);
                        return <Typography key={id} variant="caption">{captain?.nameZh ?? captain?.nameEn ?? id}：{captain?.bonus}</Typography>;
                    })}
                </>}
                {ps !== undefined && ps.scienceBonuses.length > 0 && <>
                    <Typography variant="subtitle2">已获得的科学奖励</Typography>
                    {ps.scienceBonuses.map((id) => {
                        const bonus = scienceBonusById(id);
                        return <Typography key={id} variant="caption">{bonus?.nameZh ?? id}：{bonus?.description}</Typography>;
                    })}
                </>}
                <Divider/>
                <Typography variant="subtitle2">海盗 (1 CP)</Typography>
                <Stack spacing={0.5}>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-pirate-zone">海域</InputLabel>
                        <Select labelId="vq-pirate-zone" label="海域" value={piracyZone}
                                onChange={(e) => setPiracyZone(e.target.value)}>
                            {Object.keys(G.seaZones).filter((z) => G.seaZones[z as keyof VQGame["seaZones"]].naval[me] !== undefined)
                                .map((z) => <MenuItem key={z} value={z}>{SEA_ZONE_BY_ID[z]?.name ?? z}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-pirate-target">目标</InputLabel>
                        <Select labelId="vq-pirate-target" label="目标" value={piracyTarget}
                                onChange={(e) => setPiracyTarget(e.target.value)}>
                            {POWERS.filter((p) => p !== me).map((p) => <MenuItem key={p} value={p}>{POWER_NAMES[p].zh}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < 1 || piracyZone === "" || piracyTarget === ""}
                            onClick={() => moves.piracy({zone: piracyZone, target: piracyTarget})}>发动海盗</Button>
                </Stack>
            </Stack>;
        }
        if (phase === "diplomacy") {
            const handCp = hand.reduce((n, id) => n + cardById(id).cp, 0);
            return <Stack spacing={1}>
                <Typography variant="subtitle2">外交</Typography>
                <Typography variant="caption" color="text.secondary">
                    手牌总 CP：{handCp}（宣战/议和使用手牌支付，本国牌不可用于宣战）
                </Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-diplo">目标强国</InputLabel>
                    <Select labelId="vq-diplo" label="目标强国" value={diploTarget}
                            onChange={(e) => setDiploTarget(e.target.value as Power)}>
                        {POWERS.filter((p) => p !== me).map((p) => <MenuItem key={p} value={p}>{POWER_NAMES[p].zh}</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget)}
                            onClick={() => moves.declareWar({target: diploTarget})}>
                        宣战 ({warCost(G, me, diploTarget)} CP)
                    </Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || !atWar(G, me, diploTarget)}
                            onClick={() => moves.makePeace({target: diploTarget})}>议和</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget)}
                            onClick={() => moves.formAlliance({target: diploTarget})}>结盟</Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    宣战/议和使用手牌支付；同盟只持续本回合。
                </Typography>
                <Typography variant="subtitle2">对小国宣战 (2 CP)</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {MINOR_POWERS.map((m) => <Button key={m} size="small" variant="outlined"
                                                      disabled={!myTurn || G.powers[me].warsMinors.includes(m) ||
                                                          POWERS.some((major) => G.powers[major].alliedMinors.includes(m)) ||
                                                          !minorAvailable(G, m)}
                                                      onClick={() => moves.declareWarMinor({target: m})}>
                        {MINOR_NAMES[m].zh}
                    </Button>)}
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">王室联姻</Typography>
                {playerID !== null && ctx.activePlayers?.[playerID] === "respondBetroth" && G.pendingBetrothal !== null ? (
                    <Stack spacing={1}>
                        <Typography variant="body2">
                            {POWER_NAMES[G.pendingBetrothal.proposer].zh} 提议联姻：
                            {G.royals.find((r) => r.id === G.pendingBetrothal!.male)?.name ?? G.pendingBetrothal.male}
                            {" ↔ "}
                            {G.royals.find((r) => r.id === G.pendingBetrothal!.female)?.name ?? G.pendingBetrothal.female}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="contained" color="success"
                                    onClick={() => moves.acceptBetroth()}>同意</Button>
                            <Button size="small" variant="outlined" color="error"
                                    onClick={() => moves.rejectBetroth()}>拒绝</Button>
                        </Stack>
                    </Stack>
                ) : G.pendingBetrothal !== null && G.pendingBetrothal.proposer === me ? (
                    <Typography variant="body2" color="text.secondary">
                        ⏳ 等待 {POWER_NAMES[G.pendingBetrothal.target].zh} 回应联姻提议…
                    </Typography>
                ) : (<>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-domestic">本国王室</InputLabel>
                        <Select labelId="vq-domestic" label="本国王室" value={domesticRoyal}
                                onChange={(e) => { setDomesticRoyal(e.target.value as string); setForeignRoyal(""); }}>
                            {G.royals.filter((r) => r.power === me && royalAvailable(r) && (r.turn ?? 1) <= G.year).map((r) =>
                                <MenuItem key={r.id} value={r.id}>{r.name} ({r.gender === "male" ? "男" : "女"})</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-foreign">外国王室</InputLabel>
                        <Select labelId="vq-foreign" label="外国王室" value={foreignRoyal}
                                onChange={(e) => setForeignRoyal(e.target.value as string)}
                                disabled={domesticRoyal === ""}>
                            {(() => {
                                const domesticDef = G.royals.find((r) => r.id === domesticRoyal);
                                const targetGender = domesticDef?.gender === "male" ? "female" : "male";
                                return G.royals.filter((r) =>
                                    r.power !== me &&
                                    r.gender === targetGender &&
                                    royalAvailable(r) &&
                                    (r.turn ?? 1) <= G.year &&
                                    !(domesticDef?.family && r.family === domesticDef.family) &&
                                    !(me !== undefined && atWar(G, me, r.power))
                                ).map((r) =>
                                    <MenuItem key={r.id} value={r.id}>{r.name} ({POWER_NAMES[r.power].zh})</MenuItem>);
                            })()}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="outlined"
                            disabled={!myTurn || domesticRoyal === "" || foreignRoyal === "" || G.pendingBetrothal !== null}
                            onClick={() => {
                                const d = G.royals.find((r) => r.id === domesticRoyal);
                                const male = d?.gender === "male" ? domesticRoyal : foreignRoyal;
                                const female = d?.gender === "female" ? domesticRoyal : foreignRoyal;
                                moves.proposeBetroth({male, female});
                            }}>提议联姻</Button>
                </>)}
                {Object.keys(G.leaders).filter((id) => G.leaders[id].location === "captured" && LEADER_BY_ID[id]?.power === me).length > 0 && <>
                    <Divider/>
                    <Typography variant="subtitle2">赎回被俘将领</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {Object.keys(G.leaders).filter((id) => G.leaders[id].location === "captured" && LEADER_BY_ID[id]?.power === me)
                            .map((id) => <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                                                 onClick={() => moves.ransom({leaderId: id})}>
                                {LEADER_BY_ID[id]?.name ?? id}
                            </Button>)}
                    </Stack>
                </>}
                <Divider/>
                <Button size="small" variant="outlined" disabled={!myTurn || G.pendingBetrothal !== null} onClick={() => moves.endPhaseTurn()}>
                    结束外交回合
                </Button>
            </Stack>;
        }
        if (phase === "spring") {
            const springHomeCards = hand.filter((id) => cardById(id).kind === "home");
            const choiceRequired = homeCardChoiceRequired(G, me);
            const mayKeepBoth = keepsBothHomeCards(G, me);
            return <Stack spacing={1}>
                <Typography variant="body2">
                    春季部署：先秘密选择本回合保留的本国牌（未选中的面朝下放在势力卡上），然后可从首都免费调动一支陆军编队。
                </Typography>
                {mayKeepBoth && <Typography variant="caption" color="success.main">
                    苏莱曼一世在位：奥斯曼可保留两张本国牌，无需二选一。
                </Typography>}
                {springHomeCards.length > 1 && !ps?.homeCardChoiceDone && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">选择保留的本国牌</Typography>
                    <Typography variant="caption" color="text.secondary">
                        其余本国牌将面朝下放在势力卡上，直到下一年的 Card Draw。
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {springHomeCards.map((id) => <Button key={id} size="small" variant="outlined"
                                                           disabled={!myTurn}
                                                           onClick={() => moves.chooseHomeCard({cardId: id})}>
                            保留 {cardById(id).name}
                        </Button>)}
                    </Stack>
                </Stack>}
                {ps !== undefined && (ps.homeCardSetAside?.length ?? 0) > 0 && <Typography variant="caption" color="text.secondary">
                    面朝下放在势力卡上：{(ps.homeCardSetAside ?? []).map((id) => cardById(id).name).join("、")}
                </Typography>}
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-spring-mode">行动</InputLabel>
                    <Select labelId="vq-spring-mode" label="行动" value={mode}
                            onChange={(e) => {
                                setMode(e.target.value as Mode);
                                setFrom(null);
                            }}>
                        <MenuItem value="inspect">查看</MenuItem>
                        <MenuItem value="spring">春季部署</MenuItem>
                    </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                    首都：{CAPITAL_SPACES_UI[me] ?? ""} {from !== null ? `· 起点 ${SPACE_BY_ID[from]?.name}` : ""}
                </Typography>
                <Button size="small" variant="outlined" disabled={!myTurn || choiceRequired} onClick={() => moves.endPhaseTurn()}>
                    结束春季部署
                </Button>
            </Stack>;
        }
        return null;
    };

    const religionActions = (me: Power): { label: string; run: () => void }[] => {
        const list: { label: string; run: () => void }[] = [];
        const add = (label: string, side: "preach" | "suppress", area: ReligionArea) => {
            list.push({
                label,
                run: () => side === "preach" ? moves.preach({area}) : moves.suppress({area}),
            });
        };
        if (me === "spain") {
            add("布道：英格兰 (2 CP)", "preach", "england");
            add("镇压：尼德兰 (2 CP)", "suppress", "netherlands");
        }
        if (me === "protestant") {
            add("布道：法国 (2 CP)", "preach", "france");
            add("布道：尼德兰 (2 CP)", "preach", "netherlands");
            add("布道：苏格兰 (2 CP)", "preach", "scotland");
        }
        if (me === "england") {
            add("镇压：英格兰 (2 CP)", "suppress", "england");
        }
        if (me === "france") {
            add("镇压：法国 (2 CP)", "suppress", "france");
            add("镇压：苏格兰 (2 CP)", "suppress", "scotland");
        }
        return list;
    };

    return <Box sx={{p: 1}}>
        {ctx.gameover !== undefined && <Paper sx={{p: 1, mb: 1, bgcolor: "#e8f5e9"}}>
            <Typography variant="h6">对局结束 · 胜者：{POWER_NAMES[powerAt(String(ctx.gameover.winner))].zh}</Typography>
            <Typography variant="caption">原因：{ctx.gameover.reason ?? ""}</Typography>
        </Paper>}
        <Paper sx={{p: 1, mb: 1}}>
            <Stack direction="row" spacing={1} sx={{alignItems: "center", flexWrap: "wrap"}}>
                <Typography variant="h6" sx={{fontWeight: 700}}>Virgin Queen</Typography>
                <Chip color="primary" label={`第 ${G.year} 回合`}/>
                <Chip variant="outlined" label={PHASE_LABELS[phase] ?? phase}/>
                <Chip variant="outlined" label={`当前：${POWER_NAMES[G.activePower].zh}`}/>
                <Chip variant="outlined" label={`牌堆 ${G.deckCount ?? 0}`}/>
                <Chip variant="outlined" label={`新教地区 ${protestantSpaceCount(G)}`}/>
                <Box sx={{flexGrow: 1}}/>
                {standings.map((s) => <Chip key={s.power} size="small"
                                             label={`${POWER_NAMES[s.power].short} ${s.vp}`}
                                             sx={{
                                                 bgcolor: CONTROLLER_COLORS[s.power],
                                                 color: s.power === "spain" || s.power === "england" ? "#fff" : "#fff",
                                             }}/>) }
            </Stack>
            {G.lastRolls !== "" && <Typography variant="caption" color="text.secondary">最近掷骰：{G.lastRolls}</Typography>}
        </Paper>
        <Grid container spacing={1}>
            <Grid size={{xs: 12, md: 8}}>
                <VQMap G={G} selected={selected} onSelect={onSelect}/>
                <Paper sx={{p: 1, mt: 1, maxHeight: 150, overflow: "auto"}}>
                    <Typography variant="subtitle2">日志</Typography>
                    <List dense disablePadding>
                        {G.log.slice(-10).reverse().map((l, i) => <ListItem key={i} disableGutters sx={{py: 0}}>
                            <Typography variant="caption">{l}</Typography>
                        </ListItem>)}
                    </List>
                </Paper>
            </Grid>
            <Grid size={{xs: 12, md: 4}}>
                {phase === "diplomacy" && <Paper sx={{p: 1, mb: 1}}>
                    <Typography variant="subtitle2" gutterBottom>外交</Typography>
                    {actionPanel()}
                </Paper>}
                {me !== undefined && ps !== undefined && <Paper sx={{p: 1, mb: 1}}>
                    <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                        <Box sx={{width: 14, height: 14, bgcolor: CONTROLLER_COLORS[me], borderRadius: 0.5}}/>
                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>{POWER_NAMES[me].zh}</Typography>
                        <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, me).length} 关键城市`}/>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        统治者：{RULER_NAMES[ps.ruler] ?? POWER_INFO[me].ruler.name}（行政 {POWER_INFO[me].ruler.admin} / 额外牌 {POWER_INFO[me].ruler.cardBonus}）
                        · 基础 {baseVp(G, me)} + 宗教 {religiousSpecialVp(G, me)} + 奖励 {ps.bonusVp}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                        <Typography variant="caption">战争：{ps.wars.length > 0 ? ps.wars.map((w) => POWER_NAMES[w].short).join(", ") : "无"}</Typography>
                        <Typography variant="caption">同盟：{ps.allies.length > 0 ? ps.allies.map((w) => POWER_NAMES[w].short).join(", ") : "无"}</Typography>
                        <Typography variant="caption">宝藏：{ps.treasures.length}</Typography>
                    </Stack>
                </Paper>}
                {me !== undefined && <Paper sx={{p: 1, mb: 1, maxHeight: 320, overflow: "auto"}}>
                    <Stack direction="row" sx={{alignItems: "center", justifyContent: "space-between"}}>
                        <Typography variant="subtitle2">手牌</Typography>
                        <Stack direction="row" spacing={0.5}>
                            {ps !== undefined && ps.treasures.map((t, i) =>
                                <Button key={i} size="small" variant="outlined"
                                        disabled={!canAct || !ps.cardPlayed || ps.treasurePlayed}
                                        onClick={() => moves.playTreasure({index: i})}>{t} CP</Button>)}
                        </Stack>
                    </Stack>
                    {hand.length === 0 && <Typography variant="caption" color="text.secondary">（无手牌）</Typography>}
                    {hand.map(cardView)}
                </Paper>}
                <Paper sx={{p: 1, mb: 1}}>
                    <Typography variant="subtitle2" gutterBottom>列强概览</Typography>
                    {POWERS.map((p) => <Stack key={p} direction="row" spacing={0.5} sx={{alignItems: "center", mb: 0.25}}>
                        <Box sx={{width: 10, height: 10, bgcolor: CONTROLLER_COLORS[p], borderRadius: 0.5}}/>
                        <Typography variant="caption" sx={{minWidth: 72}}>{POWER_NAMES[p].short}</Typography>
                        <Chip size="small" label={`${powerVp(G, p)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, p).length}K`}/>
                        <Chip size="small" variant="outlined" label={`${G.handCounts?.[p] ?? G.powers[p].cards.length}牌`}/>
                        {(G.homeCardSetAsideCounts?.[p] ?? 0) > 0 &&
                            <Chip size="small" variant="outlined" label={`面朝下 ${G.homeCardSetAsideCounts?.[p]}`}/>}
                        {G.powers[p].wars.length > 0 && <Typography variant="caption" color="text.secondary">
                            战:{G.powers[p].wars.map((w) => POWER_NAMES[w].short).join("/")}
                        </Typography>}
                    </Stack>)}
                </Paper>
                {phase !== "diplomacy" && <Paper sx={{p: 1, mb: 1}}>
                    <Typography variant="subtitle2" gutterBottom>行动</Typography>
                    {actionPanel()}
                </Paper>}
                {space !== undefined && spaceDef !== undefined && <Paper sx={{p: 1}}>
                    <Typography variant="subtitle2">{spaceDef.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
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
                        if (st === undefined) {
                            return null;
                        }
                        return <Typography key={c} variant="caption" sx={{display: "block"}}>
                            陆军 {controllerNameZh(c as any)}: 正规 {cell(st.regular)} / 雇佣 {cell(st.merc)} / 骑兵 {cell(st.cav)}
                        </Typography>;
                    })}
                    {Object.keys(space.naval).map((c) => {
                        const st = space.naval[c as keyof typeof space.naval];
                        if (st === undefined) {
                            return null;
                        }
                        return <Typography key={c} variant="caption" sx={{display: "block"}}>
                            海军 {controllerNameZh(c as any)}: 桨帆 {cell(st.galley)} / 大帆 {cell(st.galleon)} / 快帆 {cell(st.racebuilt)} / 海盗 {cell(st.corsair)}
                        </Typography>;
                    })}
                    {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
                        将领：{space.leaders.map((id) => LEADER_BY_ID[id]?.name ?? id).join("、")}
                    </Typography>}
                </Paper>}
            </Grid>
        </Grid>
    </Box>;
};

const CAPITAL_SPACES_UI: Record<Power, string> = {
    ottoman: "Istanbul",
    spain: "Madrid / Milan",
    england: "London",
    france: "Paris",
    hre: "Vienna",
    protestant: "La Rochelle / Amsterdam",
};
