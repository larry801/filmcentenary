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
    navalCount,
    POWER_INFO,
    POWER_NAMES,
    POWERS,
    Power,
    ReligionArea,
    VQGame,
    isPower,
    powerAt,
} from "../constant/general";
import {cardById} from "../constant/cards";
import {LEADER_BY_ID} from "../constant/leaders";
import {patronDef, royalAvailable, scenarioSetup, scienceBonusById, seaCaptainById} from "../scenario";
import {DUTCH_KEYS, SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES} from "../constant/spaces";
import {PATRONAGE_VP_AWARD_BY_ID} from "../data/patronage";
import {PatronageVpAward} from "../data/types";
import {
    atWar,
    baseVp,
    capitalOf,
    controlledKeys,
    powerVp,
    protestantSpaceCount,
    religionCandidates,
    rebellionTargets,
    religiousSpecialVp,
    victoryStandings,
    warCost,
    zonePorts,
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
    const [maleRoyal, setMaleRoyal] = React.useState("");
    const [femaleRoyal, setFemaleRoyal] = React.useState("");
    const [patronageCp, setPatronageCp] = React.useState(2);

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
        return <Paper key={id} variant="outlined" sx={{p: 0.75, mb: 0.5}}>
            <Stack direction="row" spacing={0.5} sx={{alignItems: "center", flexWrap: "wrap"}}>
                <Typography variant="caption" sx={{fontWeight: 700}}>{def.name}</Typography>
                <Chip size="small" label={`${def.cp} CP`} color={def.kind === "home" ? "secondary" : "default"}/>
                {def.kind === "event" && <Chip size="small" variant="outlined" label="事件"/>}
                {def.kind === "home" && <Chip size="small" variant="outlined" label="本国牌"/>}
            </Stack>
            {def.text !== undefined && <Typography variant="caption" color="text.secondary">{def.text}</Typography>}
            <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
                {def.kind !== "command" && <Button size="small" variant="contained"
                                                  disabled={disabled}
                                                  onClick={() => moves.playCard({cardId: id, asEvent: true})}>
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
                <Typography variant="body2">已按场景发放本国牌与年度手牌；确认手牌后结束本阶段。</Typography>
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
                <Typography variant="subtitle2">宗教行动</Typography>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {religionActions(me).map((a) => <Button key={a.label} size="small" variant="outlined"
                                                             disabled={!myTurn || cp < 2}
                                                             onClick={() => a.run()}>{a.label}</Button>)}
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
                    {G.patronsAvailable.map((id) => patronDef(id)).filter((p) => p !== undefined && p.region === me && !POWERS.some((x) => G.powers[x].patrons.includes(p.id))).map((p) =>
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
                                                      disabled={!myTurn || G.powers[me].warsMinors.includes(m)}
                                                      onClick={() => moves.declareWarMinor({target: m})}>
                        {MINOR_NAMES[m].zh}
                    </Button>)}
                </Stack>
                <Divider/>
                <Typography variant="subtitle2">王室联姻</Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-male">男性王室</InputLabel>
                    <Select labelId="vq-male" label="男性王室" value={maleRoyal}
                            onChange={(e) => setMaleRoyal(e.target.value)}>
                        {G.royals.filter((r) => r.gender === "male" && royalAvailable(r) && (r.turn ?? 1) <= G.year).map((r) =>
                            <MenuItem key={r.id} value={r.id}>{r.name} ({POWER_NAMES[r.power].zh})</MenuItem>)}
                    </Select>
                </FormControl>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-female">女性王室</InputLabel>
                    <Select labelId="vq-female" label="女性王室" value={femaleRoyal}
                            onChange={(e) => setFemaleRoyal(e.target.value)}>
                        {G.royals.filter((r) => r.gender === "female" && royalAvailable(r) && (r.turn ?? 1) <= G.year).map((r) =>
                            <MenuItem key={r.id} value={r.id}>{r.name} ({POWER_NAMES[r.power].zh})</MenuItem>)}
                    </Select>
                </FormControl>
                <Button size="small" variant="outlined" disabled={!myTurn || maleRoyal === "" || femaleRoyal === ""}
                        onClick={() => moves.betroth({male: maleRoyal, female: femaleRoyal})}>订婚</Button>
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
                <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                    结束外交回合
                </Button>
            </Stack>;
        }
        if (phase === "spring") {
            return <Stack spacing={1}>
                <Typography variant="body2">从首都免费调动一支陆军编队。选择“春季部署”，先点首都，再点目的地。</Typography>
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
                <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
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
                {me !== undefined && ps !== undefined && <Paper sx={{p: 1, mb: 1}}>
                    <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                        <Box sx={{width: 14, height: 14, bgcolor: CONTROLLER_COLORS[me], borderRadius: 0.5}}/>
                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>{POWER_NAMES[me].zh}</Typography>
                        <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, me).length} 关键城市`}/>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        统治者：{POWER_INFO[me].ruler.name}（行政 {POWER_INFO[me].ruler.admin} / 额外牌 {POWER_INFO[me].ruler.cardBonus}）
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
                        {G.powers[p].wars.length > 0 && <Typography variant="caption" color="text.secondary">
                            战:{G.powers[p].wars.map((w) => POWER_NAMES[w].short).join("/")}
                        </Typography>}
                    </Stack>)}
                </Paper>
                <Paper sx={{p: 1, mb: 1}}>
                    <Typography variant="subtitle2" gutterBottom>行动</Typography>
                    {actionPanel()}
                </Paper>
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
