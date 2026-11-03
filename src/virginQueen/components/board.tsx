import React from "react";
import {BoardProps} from "boardgame.io/react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import Drawer from "@mui/material/Drawer";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import useMediaQuery from "@mui/material/useMediaQuery";
import {ActionGroup, VQSurface} from "./theme";
import ExportLogButton from "../../components/export-log-button";
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
    CardDef,
    CONTROLLER_COLORS,
    controllerNameZh,
    HRE_RELIGIOUS_PREFERENCE_NAMES,
    HreReligiousPreference,
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
import {cardById, cardImageUrl} from "../constant/cards";
import {LEADER_BY_ID, SEA_CAPTAIN_LEADER_BY_CAPTAIN} from "../constant/leaders";
import {patronDef, royalAvailable, scenarioSetup, scienceBonusById, seaCaptainById} from "../scenario";
import {DUTCH_KEYS, SEA_ZONE_BY_ID, SPACE_BY_ID, SPACES} from "../mapData";
import {WORLD_SEA_ZONES, WORLD_SETTLEMENTS} from "../data/world";
import {PATRONAGE_VP_AWARD_BY_ID} from "../data/patronage";
import {MINOR_DIPLOMACY} from "../data/minorDiplomacy";
import {PatronageVpAward} from "../data/types";
import {
    atWar,
    baseVp,
    capitalOf,
    catholicLeagueSpaceOptions,
    controlledKeys,
    homeCardChoiceRequired,
    hreReligiousPreferenceRequired,
    hreReligiousVp,
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
    friendlyController,
    landNeighbors,
    seaPathBetweenPorts,
} from "../util";
import {VQMap} from "./map";
import {TutorialGuide} from "./tutorial-guide";
import {controlledPowers, ownerOf, isActivatedMajor, participatingPowers} from "../ownership";
import {tutorialFortressVp, tutorialSpaceAllowed} from "../tutorial";
import {scenarioName} from "../scenario";
import {Controller} from "../constant/general";
import {battleOptions} from "../combat";
import {canPlayTutorialEvent, tutorialEventOptions} from "../tutorialEvents";
import {canPlayGrandVizier, canPlayUntimelyDeath, cardEventOptions, isGrandVizier, untimelyDeathTargets} from "../cardEvents";
import {piracyOptions} from "../piracy";
import {actionResponseOptions} from "../moves";
import {interceptionOptions} from "../interception";
import {assassinationTargets, espionageOptions, canPlayEspionageEvent, canPlayNorthernRising, doubleAgentTargets, isEspionageEvent} from "../espionage";

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
    | "navalTransport"
    | "spring"
    | "control"
    | "assault"
    | "buildFortress"
    | "rebellion";

const MODE_LABELS: Record<Mode, string> = {
    inspect: "查看",
    recruitRegular: "征募正规军 (2 CP)",
    recruitMerc: "征募雇佣兵 (1 CP)",
    recruitCav: "征募骑兵 (1 CP)",
    buildGalley: "建造桨帆船 (2 CP)",
    buildGalleon: "建造大帆船 (2 CP)",
    buildRacebuilt: "建造快帆船 (2 CP)",
    buildCorsair: "建造海盗船 (1 CP)",
    moveLand: "陆军移动 (1/2 CP)",
    moveNaval: "海军移动 (1 CP)",
    navalTransport: "海运陆军 (海域数 + 1 CP)",
    spring: "春季部署 (免费编队)",
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

/** Scanned card art, with the text tile as the fallback when it is missing. */
const CardArt = ({def, className, lazy = false}: {def: CardDef; className: string; lazy?: boolean}) => {
    const [failed, setFailed] = React.useState(false);
    const src = cardImageUrl(def);
    if (src === undefined || failed) return null;
    return <img className={className} src={src} alt={`${def.name} 卡牌图`} width={376} height={526}
        loading={lazy ? "lazy" : "eager"} onError={() => setFailed(true)}/>;
};

export const VirginQueenBoard = ({G, ctx, moves, playerID, isActive, matchID}: BoardProps<VQGame>) => {
    const [selected, setSelected] = React.useState<string | undefined>(G.scenario === "tutorial"
        ? playerID === "1" ? "madrid" : "istanbul" : "london");
    const isDesktop = useMediaQuery("(min-width:1024px)");
    const [mobileView, setMobileView] = React.useState("map");
    const [handExpanded, setHandExpanded] = React.useState(true);
    const [selectedCard, setSelectedCard] = React.useState<string>();
    const actionRef = React.useRef<HTMLElement>(null);
    const sidebarRef = React.useRef<HTMLElement>(null);
    const panelID = React.useId();
    const [mode, setMode] = React.useState<Mode>("inspect");
    const [from, setFrom] = React.useState<string | null>(null);
    const [movingUnits, setMovingUnits] = React.useState<LandStack>({regular: 0, merc: 0, cav: 0});
    const [movingOwner, setMovingOwner] = React.useState<Controller>("ottoman");
    const [movingLeaders, setMovingLeaders] = React.useState<string[]>([]);
    const [transportZones, setTransportZones] = React.useState<string[]>([]);
    const [rebelCp, setRebelCp] = React.useState(2);
    const [seaCaptainChoice, setSeaCaptainChoice] = React.useState("");
    const [seaCaptainPort, setSeaCaptainPort] = React.useState("");
    const [piracyZone, setPiracyZone] = React.useState("");
    const [piracyTarget, setPiracyTarget] = React.useState("");
    const [diploTarget, setDiploTarget] = React.useState<Power>("spain");
    const [loanFromPort, setLoanFromPort] = React.useState("");
    const [loanToPort, setLoanToPort] = React.useState("");
    const [loanLeader, setLoanLeader] = React.useState("");
    const [domesticRoyal, setDomesticRoyal] = React.useState("");
    const [foreignRoyal, setForeignRoyal] = React.useState("");
    const [patronageCp, setPatronageCp] = React.useState(2);
    const [espionageTargetSelection, setEspionageTarget] = React.useState<Power>("spain");
    const [assassinationTarget, setAssassinationTarget] = React.useState("elizabeth");
    const [assassinationCp, setAssassinationCp] = React.useState(2);
    const [catholicRebellionCp, setCatholicRebellionCp] = React.useState(3);
    const [informantSource, setInformantSource] = React.useState("");
    const [espionageEventTarget, setEspionageEventTarget] = React.useState("");
    const [expeditionCaptain, setExpeditionCaptain] = React.useState("");
    const [expeditionHasColony, setExpeditionHasColony] = React.useState(false);
    const [foreignArmySize, setForeignArmySize] = React.useState(3);
    const [foreignWarUnits, setForeignWarUnits] = React.useState<{space: string; kind: keyof LandStack}[]>([]);
    const [foreignWarLeader, setForeignWarLeader] = React.useState("");

    const [viewPower, setViewPower] = React.useState<Power>();
    const owned = controlledPowers(G, playerID);
    const piracyResponder = G.pendingPiracy && (G.pendingPiracy.step === "losses" ? G.pendingPiracy.power : G.pendingPiracy.target);
    const actionResponder = G.pendingAction && (G.pendingAction.power === "ottoman" ? "spain" : "ottoman");
    const responsePower = G.pendingIntercept && ownerOf(G, G.pendingIntercept.defender) === playerID ? G.pendingIntercept.defender :
        G.pendingEspionage && ownerOf(G, G.pendingEspionage.responding) === playerID ? G.pendingEspionage.responding :
        actionResponder && ownerOf(G, actionResponder) === playerID ? actionResponder :
        piracyResponder && ownerOf(G, piracyResponder) === playerID ? piracyResponder :
        G.pendingCardEvent && ownerOf(G, G.pendingCardEvent.responding) === playerID ? G.pendingCardEvent.responding :
        G.pendingTutorialEvent && ownerOf(G, G.pendingTutorialEvent.responding) === playerID ? G.pendingTutorialEvent.responding :
        G.pendingBattle && ownerOf(G, G.pendingBattle.responding) === playerID ? G.pendingBattle.responding :
        G.pendingBetrothal && ownerOf(G, G.pendingBetrothal.target) === playerID ? G.pendingBetrothal.target : undefined;
    const me: Power | undefined = responsePower ?? (ctx.currentPlayer === playerID ? G.activePower :
        viewPower && owned.includes(viewPower) ? viewPower : owned[0]);
    const legalEspionageTargets = POWERS.filter((p) => p !== me && !isActivatedMajor(G, p));
    const espionageTarget = legalEspionageTargets.includes(espionageTargetSelection) ? espionageTargetSelection : legalEspionageTargets[0];
    const myTurn = ctx.gameover === undefined && me !== undefined && ctx.currentPlayer === playerID && me === G.activePower;
    const phase = ctx.phase ?? "";
    const ps = me !== undefined ? G.powers[me] : undefined;
    const cp = ps?.cp ?? 0;
    const hand = ps?.cards ?? [];
    const canAct = myTurn && phase === "action" && !G.pendingEspionage && !G.pendingBattle && !G.pendingActivation && !G.pendingCardEvent && !G.pendingTutorialEvent && !G.pendingPiracy && !G.pendingAction && !G.pendingIntercept;

    React.useEffect(() => {
        setMode("inspect");
        setFrom(null);
        setForeignWarUnits([]);
        setForeignWarLeader("");
    }, [ctx.phase, ctx.currentPlayer, G.activePower]);

    React.useEffect(() => {setSelectedCard(undefined);}, [me, playerID]);

    const doSpaceAction = (id: string): void => {
        // Sea labels share selection with cities, but only naval movement accepts a sea target.
        if (G.spaces[id] === undefined && mode !== "moveNaval") return;
        if ((!canAct && !(myTurn && phase === "spring" && mode === "spring")) || me === undefined) {
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
            case "navalTransport":
                if (from === null) {
                    const owner = (Object.keys(G.spaces[id].land) as Controller[]).find((candidate) =>
                        (mode === "navalTransport" ? candidate === me : friendlyController(G, me, candidate)) && landCount(G.spaces[id].land[candidate]) > 0);
                    if (owner) {
                        setFrom(id);
                        setMovingOwner(owner);
                        setMovingUnits({...G.spaces[id].land[owner]!});
                        setMovingLeaders(G.spaces[id].leaders.filter((leader) => LEADER_BY_ID[leader]?.power === owner && LEADER_BY_ID[leader]?.kind === "army"));
                        setTransportZones([]);
                    }
                } else {
                    if (mode === "navalTransport") moves.navalTransport({from, to: id, zones: transportZones, units: movingUnits, leaders: movingLeaders});
                    else moves.moveLand({from, to: id, units: movingUnits, unitPower: movingOwner, leaders: movingLeaders});
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
                        setMovingOwner(me);
                        setMovingUnits({...G.spaces[id].land[me] ?? {regular: 0, merc: 0, cav: 0}});
                        setMovingLeaders(G.spaces[id].leaders.filter((leader) => LEADER_BY_ID[leader]?.power === me && LEADER_BY_ID[leader]?.kind === "army").slice(0, 2));
                    }
                } else {
                    moves.springDeploy({from, to: id, units: movingUnits, leaders: movingLeaders});
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
        const espionageTargets = handler === "walsingham" ? ["offensive", "defensive", ...POWERS.filter((p) => p !== "england" && !isActivatedMajor(G, p))] :
            handler === "cipherKey" ? ["remove", ...POWERS.filter((p) => p !== me && !isActivatedMajor(G, p))] :
                handler === "doubleAgent" && me !== undefined ? doubleAgentTargets(G, me) :
                    handler === "untimelyDeath" && G.scenario !== "tutorial" ? (untimelyDeathTargets(G).length ? untimelyDeathTargets(G) : ["none"]) : [];
        const espionageTarget = espionageTargets.includes(espionageEventTarget) ? espionageEventTarget : espionageTargets[0];
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
            <CardArt def={def} className="vq-card-detail-art"/>
            {def.text !== undefined && <Typography variant="caption" color="text.secondary">{def.text}</Typography>}
            {espionageTargets.length > 0 && <Select size="small" fullWidth value={espionageTarget}
                onChange={(e) => setEspionageEventTarget(e.target.value)}>
                {espionageTargets.map((target) => <MenuItem key={target} value={target}>
                    {target === "offensive" ? "进攻模式" : target === "defensive" ? "防御模式" : target === "remove" ? "移除本国所有敌方解码书" : target.includes(">")
                        ? `策反 ${POWER_NAMES[target.split(">")[0] as Power].zh} 间谍（调回监视${POWER_NAMES[target.split(">")[1] as Power].zh}的本国间谍）`
                        : handler === "doubleAgent" ? `策反 ${POWER_NAMES[target as Power].zh} 间谍`
                        : handler === "untimelyDeath" ? (target === "none" ? "没有可移除的将领" : `移出游戏：${LEADER_BY_ID[target]?.name ?? target}`)
                        : POWER_NAMES[target as Power].zh}
                </MenuItem>)}
            </Select>}
            {foreignWarPower !== undefined && <FormControl size="small" sx={{mt: 0.5, minWidth: 130}}>
                <InputLabel id={`vq-war-size-${id}`}>境外军规模</InputLabel>
                <Select labelId={`vq-war-size-${id}`} label="境外军规模" value={foreignArmySize}
                        onChange={(e) => setForeignArmySize(Number(e.target.value))}>
                    {[3, 5].map((n) => <MenuItem key={n} value={n}>{n} 个独立军</MenuItem>)}
                </Select>
            </FormControl>}
            <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
                {(def.kind !== "command" || def.officialKind === "mandatory" || G.scenario === "tutorial") && <Button size="small" variant="contained"
                                                  disabled={disabled || foreignWarBlocked ||
                                                      (isEspionageEvent(handler) && !canPlayEspionageEvent(G, me!, handler, espionageTarget)) ||
                                                      (handler === "untimelyDeath" && G.scenario !== "tutorial" && !canPlayUntimelyDeath(G, espionageTarget)) ||
                                                      (handler === "northernRising" && G.scenario !== "tutorial" && !canPlayNorthernRising(G)) ||
                                                      (isGrandVizier(def) && !canPlayGrandVizier(G, me!, ctx.numPlayers)) ||
                                                      (G.scenario === "tutorial" && !canPlayTutorialEvent(G, me!, id))}
                                                  onClick={() => {moves.playCard({cardId: id, asEvent: true,
                                                      ...(espionageTargets.length ? {target: espionageTarget} : {}),
                                                      ...(foreignWarPower !== undefined ? {target: String(foreignArmySize)} : {})}); setSelectedCard(undefined);}}>
                    {def.kind === "home" ? "使用能力" : "作为事件"}
                </Button>}
                <Button size="small" variant="outlined" disabled={disabled || def.officialKind === "mandatory"}
                        onClick={() => {moves.playCard({cardId: id}); setSelectedCard(undefined);}}>作为 CP</Button>
            </Stack>
        </Paper>;
    };

    const actionPanel = () => {
        if (G.pendingEspionage) return <Stack spacing={1}>
            <Typography>谍报结算 · 等待 {POWER_NAMES[G.pendingEspionage.responding].zh} 选择。</Typography>
            <Typography variant="body2">{G.pendingEspionage.step === "responses" ? "可在掷骰前使用响应牌。" :
                G.pendingEspionage.step === "offense" ? `剩余 ${G.pendingEspionage.remaining} 次情报效果，每种效果最多一次。` :
                G.pendingEspionage.step === "conversions" ? `在英格兰分配${G.pendingEspionage.conversionSide === "protestant" ? "新教" : "天主教"}转化骰；可用 6 点扩展基础，或保留至最后转化有部队的地区。` :
                G.pendingEspionage.step === "rebelLosses" ? `英格兰还需分配 ${G.pendingEspionage.remaining} 次损失。` :
                G.pendingEspionage.step === "massacreConvert" ? `圣巴托罗缪大屠杀：还可将 ${G.pendingEspionage.remaining} 个法国政治控制的新教地区改为天主教。` :
                G.pendingEspionage.step === "massacreAssassinate" ? `法国可免费对科利尼进行一次 ${G.pendingEspionage.cp} CP 刺杀。` :
                G.pendingEspionage.step === "northernConvert" ? `北方崛起：西班牙再选择 ${G.pendingEspionage.remaining} 个英格兰地区改为天主教（无新教部队，距事件开始时的天主教地区 2 格内）。` :
                G.pendingEspionage.step === "northernUnrest" ? `北方崛起：西班牙未与英格兰交战，再放置 ${G.pendingEspionage.remaining} 个动荡（无人占领或天主教地区）。` :
                "选择下方合法选项，完成官方结果表的后续结算。"}</Typography>
            {ownerOf(G, G.pendingEspionage.responding) === playerID && espionageOptions(G).map((entry) =>
                <Button key={entry.id} variant="outlined" onClick={() => moves.chooseEspionage({choice: entry.id})}>{entry.label}</Button>)}
        </Stack>;
        if (G.pendingCardEvent) return <Stack spacing={1}>
            <Typography>{G.pendingCardEvent.kind === "cancelEvent" ? "事件响应" : "大维齐尔"} · 等待奥斯曼帝国选择。</Typography>
            {G.pendingCardEvent.kind === "cancelEvent" ? <Typography variant="body2">
                {cardById(G.pendingCardEvent.cardId).name} 尚未结算；可打出大维齐尔取消此事件。
            </Typography> : G.pendingCardEvent.step === "recruit" ? <Typography variant="body2">
                还可增加 {G.pendingCardEvent.remaining} 个单位。正规军可放入合法家乡地区或境外战争；桨帆船限爱琴海家乡港口。
            </Typography> : <Typography variant="body2">
                选择增募单位或尝试建造运河。苏伊士运河仅限 5～6 人局；取消事件在其他事件结算前选择。
            </Typography>}
            {G.pendingCardEvent.kind === "grandVizier" && G.pendingCardEvent.step === "effect" && ctx.numPlayers >= 5 &&
                !G.suezDone && <Typography variant="body2">
                    运河判定：掷 1 骰，加累计失败 {G.suezAttempts} 次{G.powers.ottoman.scienceBonuses.includes("excavation") ? "，再加挖掘奖励 2" : ""}，达到 6 即成功；奖励 2 VP 和永久抽牌 +1。
                </Typography>}
            {ownerOf(G, G.pendingCardEvent.responding) === playerID && cardEventOptions(G, ctx.numPlayers).map((entry) =>
                <Button key={entry.id} onClick={() => moves.chooseCardEvent({choice: entry.id})}>{entry.label}</Button>)}
        </Stack>;
        if (G.pendingIntercept) return <Stack spacing={1}>
            <Typography>拦截 · 等待 {POWER_NAMES[G.pendingIntercept.defender].zh}。</Typography>
            {ownerOf(G, G.pendingIntercept.defender) === playerID && interceptionOptions(G).map((entry) =>
                <Button key={entry.id} onClick={() => moves.chooseInterception({choice: entry.id})}>{entry.label}</Button>)}
        </Stack>;
        if (G.pendingAction) return <Stack spacing={1}>
            <Typography>行动响应 · 等待 {POWER_NAMES[actionResponder!].zh}。</Typography>
            {ownerOf(G, actionResponder!) === playerID && actionResponseOptions(G).map((entry) =>
                <Button key={entry.id} onClick={() => moves.respondAction({choice: entry.id})}>{entry.label}</Button>)}
        </Stack>;
        if (G.pendingPiracy) return <Stack spacing={1}>
            <Typography>海盗行动 · 等待 {POWER_NAMES[piracyResponder!].zh} 选择。</Typography>
            {ownerOf(G, piracyResponder!) === playerID && piracyOptions(G).map((entry) =>
                <Button key={entry.id} onClick={() => moves.choosePiracy({choice: entry.id})}>{entry.label}</Button>)}
        </Stack>;
        if (G.pendingTutorialEvent) return <Stack spacing={1}>
            <Typography>{cardById(G.pendingTutorialEvent.cardId).name} · 等待 {POWER_NAMES[G.pendingTutorialEvent.responding].zh} 选择。</Typography>
            {G.pendingTutorialEvent.step === "roadFormation" && <Typography variant="body2">
                先选择米兰的部队与随军将领，再选择部署目的地；最多跨越一个山口，不能渡海。也可不部署。
            </Typography>}
            {G.pendingTutorialEvent.step === "rebelLosses" && <Typography variant="body2">
                {SPACE_BY_ID[G.pendingTutorialEvent.space!].name}：还需分配 {G.pendingTutorialEvent.remaining} 次损失，可选择陆军或舰队。
            </Typography>}
            {ownerOf(G, G.pendingTutorialEvent.responding) === playerID && tutorialEventOptions(G).map((entry) =>
                <Button key={entry.id} onClick={() => moves.chooseTutorialEvent({choice: entry.id})}>{entry.label}</Button>)}
        </Stack>;
        if (G.pendingBattle) return <Stack spacing={1}>
            <Typography>战斗：{SPACE_BY_ID[G.pendingBattle.location]?.name ?? G.pendingBattle.location} · 等待 {POWER_NAMES[G.pendingBattle.responding].zh} 选择。</Typography>
            {ownerOf(G, G.pendingBattle.responding) === playerID && battleOptions(G).map((option) =>
                <Button key={option.id} onClick={() => moves.chooseBattle({choice: option.id})}>{option.label}</Button>)}
        </Stack>;
        if (G.pendingActivation) {
            const pending = G.pendingActivation;
            const canRespond = ownerOf(G, pending.ally) === playerID;
            return <Stack spacing={1}>
                <Typography>等待 {POWER_NAMES[pending.ally].zh} 激活 {POWER_NAMES[pending.power].zh}。</Typography>
                {canRespond && <>
                    <Button onClick={() => moves.chooseMajorActivation({})}>激活，不追加宣战</Button>
                    {pending.aggressor && <Button onClick={() => moves.chooseMajorActivation({joinDefense: true})}>协同参战并激活</Button>}
                    {POWERS.filter((power) => power !== pending.power && ownerOf(G, power) !== playerID && ownerOf(G, power) !== undefined)
                        .map((power) => <Button key={power} onClick={() => moves.chooseMajorActivation({war: power})}>激活并向{POWER_NAMES[power].zh}宣战</Button>)}
                </>}
            </Stack>;
        }
        if (me === undefined) {
            return <Typography variant="body2" color="text.secondary">旁观模式：只能查看局势。</Typography>;
        }
        if (phase === "cardDraw") {
            const powers = participatingPowers(G);
            const nextPhase = G.scenario === "tutorial" ? "春季部署阶段" : "外交阶段";
            return <Stack spacing={1}>
                <Typography variant="subtitle2">Card Draw 阶段 · 第 {G.year} 回合</Typography>
                <Typography variant="body2" color={myTurn ? "primary" : "text.secondary"}>
                    {`${myTurn ? "请确认" : "等待"} P${Number(ctx.currentPlayer) + 1} · ${POWER_NAMES[G.activePower].zh} 完成抽牌（${powers.indexOf(G.activePower) + 1}/${powers.length}）。`}
                </Typography>
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
                <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.endPhaseTurn()}>
                    {`确认${POWER_NAMES[G.activePower].zh}抽牌完成`}
                </Button>
                <ActionGroup title="抽牌与本国牌规则">
                <Typography variant="body2">已按本回合可用性发放本国牌与年度手牌。拥有两张可用本国牌的强国，将在春季部署时秘密保留一张。</Typography>
                <Typography variant="body2">{`各参战强国依次确认后进入${nextPhase}；同一玩家控制的强国也需分别确认。`}</Typography>
                {G.powers.ottoman.ruler === "suleiman" &&
                    <Typography variant="caption" color="text.secondary">苏莱曼一世在位时，奥斯曼可保留两张本国牌。</Typography>}
                <Typography variant="caption" color="text.secondary">{scenarioName(G.scenario)}</Typography>
                </ActionGroup>
            </Stack>;
        }
        if (phase === "action") {
            const patronageSetup = scenarioSetup(G.scenario, G.playerPowers ? 2 : 6).patronage;
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
                {G.pendingNavalOrder !== undefined && G.pendingNavalOrder.attacker === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">选择海战目标顺序</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 0.5}}>
                        {G.pendingNavalOrder.enemies.map((enemy) => <Button key={enemy} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseNavalOrder({enemy})}>{POWER_NAMES[enemy].zh}</Button>)}
                    </Stack>
                </Paper>}
                {G.pendingWithdraw !== undefined && G.pendingWithdraw.defender === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">守军选择</Typography>
                    <Typography variant="caption" color="text.secondary">
                        {SPACE_BY_ID[G.pendingWithdraw.space]?.name ?? G.pendingWithdraw.space} 的守军可退入要塞，或出城野战。
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{mt: 0.5}}>
                        <Button size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseWithdraw({withdraw: true})}>退入要塞</Button>
                        <Button size="small" variant="outlined" color="error" disabled={!myTurn}
                            onClick={() => moves.chooseWithdraw({withdraw: false})}>出城野战</Button>
                    </Stack>
                </Paper>}
                {G.pendingContinue !== undefined && G.pendingContinue.power === me && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">守军退入要塞</Typography>
                    <Typography variant="caption" color="text.secondary">
                        可花 1 CP 继续行军到相邻空地区，或返回 {SPACE_BY_ID[G.pendingContinue.origin]?.name ?? G.pendingContinue.origin}。
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap", mt: 0.5}}>
                        {landNeighbors(G.pendingContinue.space).filter((neighbor) => !neighbor.pass).map((neighbor) =>
                            <Button key={neighbor.id} size="small" variant="outlined" disabled={!myTurn || cp < 1}
                                onClick={() => moves.continueMove({to: neighbor.id})}>{SPACE_BY_ID[neighbor.id]?.name ?? neighbor.id}</Button>)}
                        <Button size="small" variant="outlined" disabled={!myTurn} onClick={() => moves.stopContinue()}>返回出发地</Button>
                    </Stack>
                </Paper>}
                {me === "spain" && G.armada !== undefined && <Paper variant="outlined" sx={{p: 1}}>
                    <Typography variant="subtitle2">西班牙阿马达 · 强度 {G.armada.strength}</Typography>
                    <Typography variant="caption" color="text.secondary">
                        位于 {SPACE_BY_ID[G.armada.location]?.name ?? G.armada.location}；与西班牙舰队同格时自动参战/随行。
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                        <Button size="small" variant="outlined"
                            disabled={!myTurn || cp < 3 || G.armada.strength >= 8 || !["seville", "corunna", "lisbon"].includes(G.armada.location)}
                            onClick={() => moves.upgradeArmada()}>升级阿马达 (3 CP)</Button>
                        {G.spaces[G.armada.location] !== undefined && <Button size="small" variant="outlined"
                            disabled={!myTurn} onClick={() => moves.loadArmada()}>装载陆军</Button>}
                        {G.spaces[G.armada.location] !== undefined && G.armada.land !== undefined && <Button size="small" variant="outlined"
                            disabled={!myTurn} onClick={() => moves.unloadArmada()}>卸载陆军</Button>}
                    </Stack>
                    {G.armada.land !== undefined && <Typography variant="caption" color="text.secondary">
                        搭载：{G.armada.land.regular} 正规 / {G.armada.land.merc} 雇佣 / {G.armada.land.cav} 骑兵（上限 {G.armada.strength}）
                    </Typography>}
                    {G.seaZones[G.armada.location as keyof VQGame["seaZones"]] !== undefined &&
                        SPACES.filter((space) => (space.ports ?? []).some((zone) => zone === G.armada!.location) && G.spaces[space.id].control === "spain").map((space) =>
                        <Stack key={space.id} direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                            <Button size="small" variant="outlined" disabled={!myTurn || cp < 1}
                                onClick={() => moves.armadaTransport({port: space.id, direction: "load"})}>从 {space.name} 装载</Button>
                            <Button size="small" variant="outlined" disabled={!myTurn || cp < 1 || G.armada?.land === undefined}
                                onClick={() => moves.armadaTransport({port: space.id, direction: "unload"})}>卸载到 {space.name}</Button>
                        </Stack>)}
                </Paper>}
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-mode">行动</InputLabel>
                    <Select labelId="vq-mode" label="行动" value={mode}
                            onChange={(e) => {
                                setMode(e.target.value as Mode);
                                setFrom(null);
                            }}>
                        {Object.keys(MODE_LABELS)
                            .filter((m) => m !== "recruitMerc" || me !== "ottoman")
                            .filter((m) => m !== "recruitCav" || me === "ottoman")
                            .filter((m) => m !== "rebellion" || me === "protestant")
                            .filter((m) => G.scenario !== "tutorial" || !["buildFortress", "buildRacebuilt", "rebellion"].includes(m))
                            .map((m) => <MenuItem key={m} value={m}>{MODE_LABELS[m as Mode]}</MenuItem>)}
                    </Select>
                </FormControl>
                {(mode === "moveLand" || mode === "navalTransport" || mode === "spring") && from && <Stack spacing={0.5}>
                    <Typography variant="caption">选择移动编队，再点击目的地。无将领最多 4 单位；最多两名将领。</Typography>
                    {mode === "navalTransport" && <>
                        <Typography variant="caption">按顺序选择运输海域，每个海域须有己方舰队，最多运输 5 单位。</Typography>
                        <Select size="small" multiple value={transportZones} onChange={(event) => setTransportZones(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)}>
                            {Object.values(SEA_ZONE_BY_ID).filter((zone) => navalCount(G.seaZones[zone.id].naval[me]) > 0)
                                .map((zone) => <MenuItem key={zone.id} value={zone.id}>{zone.name}</MenuItem>)}
                        </Select>
                        <Typography variant="caption">航线：{transportZones.map((zone) => SEA_ZONE_BY_ID[zone].name).join(" → ") || "尚未选择"}</Typography>
                    </>}
                    <Select size="small" value={movingOwner} onChange={(event) => {
                        const owner = event.target.value as Controller;
                        setMovingOwner(owner);
                        setMovingUnits({...G.spaces[from].land[owner]!});
                        setMovingLeaders([]);
                    }}>
                        {(Object.keys(G.spaces[from].land) as Controller[]).filter((owner) => (mode === "navalTransport" || mode === "spring" ? owner === me : friendlyController(G, me, owner)) && landCount(G.spaces[from].land[owner]) > 0)
                            .map((owner) => <MenuItem key={owner} value={owner}>{controllerNameZh(owner)}</MenuItem>)}
                    </Select>
                    {(["regular", "merc", "cav"] as const).map((kind) => <Stack key={kind} direction="row" spacing={1}>
                        <Typography variant="caption">{kind}</Typography>
                        <Select size="small" value={movingUnits[kind]} onChange={(event) => setMovingUnits({...movingUnits, [kind]: Number(event.target.value)})}>
                            {Array.from({length: (G.spaces[from].land[movingOwner]?.[kind] ?? 0) + 1}, (_, count) => <MenuItem key={count} value={count}>{count}</MenuItem>)}
                        </Select>
                    </Stack>)}
                    {G.spaces[from].leaders.filter((leader) => LEADER_BY_ID[leader]?.power === movingOwner && LEADER_BY_ID[leader]?.kind === "army").map((leader) =>
                        <Button key={leader} variant={movingLeaders.includes(leader) ? "contained" : "outlined"} onClick={() => setMovingLeaders(movingLeaders.includes(leader) ? movingLeaders.filter((id) => id !== leader) : [...movingLeaders, leader])}>{LEADER_BY_ID[leader].name}</Button>)}
                </Stack>}
                {mode === "rebellion" && <FormControl size="small" fullWidth>
                    <InputLabel id="vq-rebel">叛乱投入 CP</InputLabel>
                    <Select labelId="vq-rebel" label="叛乱投入 CP" value={rebelCp}
                            onChange={(e) => setRebelCp(Number(e.target.value))}>
                        {[2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                </FormControl>}
                <Typography variant="caption" color="text.secondary">
                    {mode === "inspect" ? "在地图上点击城市查看详情。" : "在地图上点击目标城市执行行动。"}
                    {from !== null ? ` 已选择起点：${SPACE_BY_ID[from]?.name ?? SEA_ZONE_BY_ID[from]?.name ?? from}` : ""}
                </Typography>
                <Stack direction="row" spacing={1}>
                    {!isDesktop && <Button size="small" variant="contained" onClick={() => setMobileView("map")}>前往地图</Button>}
                    {from !== null && <Button size="small" onClick={() => setFrom(null)}>取消起点</Button>}
                </Stack>
                <Divider/>
                <Stack direction="row" spacing={1} sx={{flexWrap: "wrap"}}>
                    <Button size="small" color="inherit" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.pass()}>跳过</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.endImpulse()}>结束行动轮次</Button>
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
                {G.scenario !== "tutorial" && <ActionGroup title="宗教行动">
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    {religionActions(me).map((a) => <Button key={a.label} size="small" variant="outlined"
                                                             disabled={!myTurn || cp < 2}
                                                             onClick={() => a.run()}>{a.label}</Button>)}
                </Stack>
                <Divider/>
                </ActionGroup>}
                <ActionGroup title="小国影响力与外交">
                <Typography variant="caption" color="text.secondary">
                    购买影响力每枚 1 CP；事件或对小国宣战触发外交决议，同一小国每回合只能决议一次。
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
                                {MINOR_NAMES[minor].zh} {ally ? `· ${POWER_NAMES[ally].zh}盟友` : "· 未激活"}
                            </Typography>
                            <Chip size="small" variant="outlined" label={`影响力 ${influence}`} />
                            <Button size="small" variant="outlined"
                                    disabled={!myTurn || cp < 1 || !eligible || resolved || influence >= 9}
                                    onClick={() => moves.influence({target: minor})}>+1 影响力</Button>
                            {resolved && <Chip size="small" color="success" label="本回合已决议"/>}
                        </Stack>;
                    })}
                    {G.majorInfluence && (["ottoman", "hre"] as Power[]).filter((target) => G.majorInfluence![target]?.[me] !== undefined)
                        .map((target) => <Stack key={target} direction="row" spacing={0.5}>
                            <Typography variant="caption">{POWER_NAMES[target].zh} · 影响力 {G.majorInfluence![target]![me]}</Typography>
                            <Button size="small" disabled={!myTurn || cp < 1 || G.majorDiplomacyResolved?.includes(target)}
                                onClick={() => moves.influence({target})}>+1 影响力</Button>
                        </Stack>)}
                </Stack>
                <Divider/>
                </ActionGroup>
                {G.scenario !== "tutorial" && !isActivatedMajor(G, me) && <><ActionGroup title="谍报 · 官方 Espionage Table">
                <Typography variant="caption" color="text.secondary">
                    第 3 回合起开放。情报与派遣人员各 2 CP；刺杀 2–4 CP，天主教叛乱 3–5 CP，两者共用每回合一次标记。
                </Typography>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-espionage-target">目标势力</InputLabel>
                    <Select labelId="vq-espionage-target" label="目标势力" value={espionageTarget}
                            onChange={(e) => setEspionageTarget(e.target.value as Power)}>
                        {POWERS.filter((p) => p !== me && !isActivatedMajor(G, p)).map((p) => <MenuItem key={p} value={p}>{POWER_NAMES[p].zh}</MenuItem>)}
                    </Select>
                </FormControl>
                <Select size="small" value={informantSource} onChange={(e) => setInformantSource(e.target.value)} displayEmpty>
                    <MenuItem value="">使用人员池中的间谍</MenuItem>
                    {G.informants.filter((i) => i.owner === me && !i.neutralized).map((i) =>
                        <MenuItem key={i.target} value={i.target}>调动在{POWER_NAMES[i.target].zh}的间谍</MenuItem>)}
                </Select>
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || espionageTarget === me ||
                        G.informants.some((i) => i.owner === me && i.target === espionageTarget) ||
                        (informantSource === "" && G.informants.filter((i) => i.owner === me).length >= 2)}
                            onClick={() => moves.plantInformant({target: espionageTarget, ...(informantSource ? {fromTarget: informantSource} : {})})}>派遣／调动间谍 (2 CP)</Button>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || espionageTarget === me}
                            onClick={() => moves.gainIntelligence({target: espionageTarget})}>获取情报 (2 CP)</Button>
                </Stack>
                <FormControl size="small" fullWidth>
                    <InputLabel id="vq-assassination-target">刺杀目标</InputLabel>
                    <Select labelId="vq-assassination-target" label="刺杀目标" value={assassinationTarget}
                            onChange={(e) => setAssassinationTarget(e.target.value)}>
                        <MenuItem value="elizabeth" disabled={!assassinationTargets(G, me).includes("elizabeth")}>伊丽莎白一世</MenuItem>
                        {assassinationTargets(G, me).filter((id) => id !== "elizabeth").map((id) =>
                            <MenuItem key={id} value={id}>{LEADER_BY_ID[id].name} ({POWER_NAMES[LEADER_BY_ID[id].power].zh})</MenuItem>)}
                    </Select>
                </FormControl>
                <Stack direction="row" spacing={0.5} sx={{alignItems: "center"}}>
                    <Select size="small" value={assassinationCp} onChange={(e) => setAssassinationCp(Number(e.target.value))}>
                        {[2, 3, 4].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                    </Select>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < assassinationCp || G.year < 3 || G.assassinationUsed.includes(me) ||
                        !assassinationTargets(G, me).includes(assassinationTarget)}
                            onClick={() => moves.assassinate({target: assassinationTarget, cp: assassinationCp})}>尝试刺杀</Button>
                </Stack>
                {me === "spain" && <>
                    <Typography variant="caption">耶稣会士：势力卡 {G.espionage?.jesuitsOnCard ?? 0} / 英格兰 {G.espionage?.jesuits.length ?? 0} / 总上限 5。选中英格兰地区后可派遣。</Typography>
                    <Button size="small" variant="outlined" disabled={!canAct || cp < 2 || G.year < 3 || (G.espionage?.jesuitsOnCard ?? 0) < 1 ||
                        spaceDef?.area !== "england" || G.espionage?.jesuits.includes(selected!)}
                        onClick={() => moves.plantInformant({space: selected})}>派遣耶稣会士到 {spaceDef?.area === "england" ? spaceDef.name : "选中地区"} (2 CP)</Button>
                    <Stack direction="row" spacing={0.5}>
                        <Select size="small" value={catholicRebellionCp} onChange={(e) => setCatholicRebellionCp(Number(e.target.value))}>
                            {[3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n} CP</MenuItem>)}
                        </Select>
                        <Button size="small" variant="outlined" disabled={!canAct || cp < catholicRebellionCp || G.year < 3 ||
                            G.assassinationUsed.includes("spain") || G.powers.spain.allies.includes("england")}
                            onClick={() => moves.englishCatholicRebellion({cp: catholicRebellionCp})}>英格兰天主教叛乱</Button>
                    </Stack>
                </>}
                {G.informants.map((i) => <Typography key={`${i.owner}:${i.target}`} variant="caption">
                    {POWER_NAMES[i.owner].zh} → {POWER_NAMES[i.target].zh}：{i.neutralized ? "已无效化，冬季回收" : i.plantedImpulse < G.impulse ? "+2 攻击骰" : "下次行动轮次起生效"}
                </Typography>)}
                <Divider/>
                </ActionGroup>
                <ActionGroup title="世界地图 · 探险与殖民">
                <Typography variant="caption" color="text.secondary">海域按已录入的粗略邻接关系逐区航行；危险航路、贸易风、殖民地与西班牙巡逻/要塞、世界海盗已接入自动结算。</Typography>
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
                                {G.worldFortresses?.[s.id] !== undefined ? ` · ${POWER_NAMES[G.worldFortresses[s.id]!].zh}要塞` : ""}
                            </Typography>)}
                            {(G.worldPatrols?.[zone.id] ?? 0) > 0 && <Typography variant="caption" sx={{display: "block"}}>西班牙巡逻舰：{G.worldPatrols?.[zone.id]}</Typography>}
                            {me === "spain" && WORLD_SETTLEMENTS.some((s) => s.seaZone === zone.id &&
                                (G.worldControls[s.id] === "spain" || G.worldColonies[s.id] === "spain")) &&
                                <Button size="small" variant="outlined" disabled={!myTurn || cp < 2}
                                    onClick={() => moves.buildPatrol({zone: zone.id})}>建造巡逻舰 (2 CP)</Button>}
                            {me === "spain" && WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id &&
                                (G.worldControls[s.id] === "spain" || G.worldColonies[s.id] === "spain") &&
                                G.worldFortresses?.[s.id] === undefined).map((s) =>
                                <Button key={`fort-${s.id}`} size="small" variant="outlined" disabled={!myTurn || cp < 2 || (G.worldFortressesBuilt ?? 0) >= 2}
                                    onClick={() => moves.buildWorldFortress({settlement: s.id})}>在{s.nameZh}建要塞 (2 CP)</Button>)}
                            {here.filter(([, ex]) => ex.power === me).map(([id]) => <Stack key={id} direction="row" spacing={0.5} sx={{mt: 0.5, flexWrap: "wrap"}}>
                                {zone.adjacent.map((next) => <Button key={next} size="small" variant="text" disabled={!myTurn || (cp < 1 && !Object.values(G.worldCaptains).some((ex) => ex.power === me && ex.movedImpulse === G.impulse)) || G.worldCaptains[id].movedImpulse === G.impulse}
                                    onClick={() => moves.moveExpedition({captain: id, zone: next})}>航行至 {WORLD_SEA_ZONES.find((z) => z.id === next)?.nameZh}</Button>)}
                                {WORLD_SETTLEMENTS.filter((s) => s.seaZone === zone.id && s.id !== "philippines" && G.worldControls[s.id] === undefined && G.worldCaptains[id].colony).map((s) =>
                                    <Button key={s.id} size="small" variant="text" disabled={!myTurn || cp < 1}
                                        onClick={() => moves.settleColony({captain: id, settlement: s.id})}>在{s.nameZh}建立殖民地</Button>)}
                                {me !== "spain" && <Button size="small" variant="outlined" disabled={!myTurn || cp < 2}
                                    onClick={() => moves.worldPiracy({captain: id})}>世界海盗 (2 CP)</Button>}
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
                    <Button size="small" variant="outlined" disabled={!myTurn || cp < expeditionCost || expeditionCaptain === "" ||
                        (expeditionHasColony && (me === "hre" || (me === "ottoman" && !G.suezDone)))}
                            onClick={() => moves.buildExpedition({captain: expeditionCaptain, colony: expeditionHasColony})}>
                        建立探险队 ({expeditionCost} CP)
                    </Button>
                    <Button size="small" variant={expeditionHasColony ? "contained" : "outlined"}
                            disabled={me === "hre" || (me === "ottoman" && !G.suezDone)}
                            onClick={() => setExpeditionHasColony(!expeditionHasColony)}>携带殖民地</Button>
                </Stack>
                <Divider/>
                </ActionGroup>
                <ActionGroup title="赞助（每回合各一位）">
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
                </ActionGroup></>}
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
                <ActionGroup title="海盗 (1 CP)">
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
                </ActionGroup>
            </Stack>;
        }
        if (phase === "diplomacy") {
            const handCp = hand.reduce((n, id) => n + cardById(id).cp, 0);
            return <Stack spacing={1}>
                <Typography variant="subtitle2">外交</Typography>
                <Typography variant="caption" color="text.secondary">
                    手牌总 CP：{handCp}（宣战/议和使用手牌支付，本国牌不可用于宣战）
                </Typography>
                {G.pendingCatholicLeague !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                    <Typography variant="subtitle2">天主教联盟：西班牙选择法国地区</Typography>
                    <Typography variant="caption" color="text.secondary">
                        还需选择 {G.pendingCatholicLeague.remaining} 个未设防的法国本土地区（不能是休格诺家乡地区）。
                    </Typography>
                    {me === "spain" ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {catholicLeagueSpaceOptions(G).map((id) => <Button key={id} size="small" variant="outlined" disabled={!myTurn}
                            onClick={() => moves.chooseCatholicLeagueSpace({space: id})}>{SPACE_BY_ID[id].name}</Button>)}
                    </Stack> : <Typography variant="body2" color="text.secondary">等待西班牙选择…</Typography>}
                </Stack>}
                {G.pendingHreReplacement !== undefined && <Stack spacing={0.5} sx={{p: 1, border: 1, borderColor: "divider", borderRadius: 1}}>
                    <Typography variant="subtitle2">神圣罗马帝国冬季补员</Typography>
                    <Typography variant="caption" color="text.secondary">
                        选择 1 正规军、2 雇佣兵，或将雇佣兵市场标记从 0 移到 4。
                    </Typography>
                    {playerID !== null && ownerOf(G, "hre") === playerID ? <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canRegular}
                            onClick={() => moves.chooseHreReplacement({choice: "regular"})}>维也纳 +1 正规军</Button>
                        <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMercs}
                            onClick={() => moves.chooseHreReplacement({choice: "mercs"})}>维也纳 +2 雇佣兵</Button>
                        <Button size="small" variant="outlined" disabled={!myTurn || !G.pendingHreReplacement.canMarker || G.mercenariesForHire !== 0}
                            onClick={() => moves.chooseHreReplacement({choice: "marker"})}>雇佣兵市场 0→4</Button>
                    </Stack> : <Typography variant="body2" color="text.secondary">等待神圣罗马选择…</Typography>}
                </Stack>}
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
                <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                    <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget) ||
                        !ps?.cards.some((id) => cardById(id).kind !== "home")}
                        onClick={() => moves.giveRandomCard({target: diploTarget})}>随机赠送一张牌</Button>
                    <Button size="small" variant="outlined" disabled={!myTurn || atWar(G, me, diploTarget) || selected === undefined ||
                        (G.spaces[selected]?.land[me]?.merc ?? 0) < 1}
                        onClick={() => selected !== null && moves.giveMercenary({target: diploTarget, space: selected})}>赠送选中地区1雇佣兵</Button>
                </Stack>
                {ps !== undefined && ps.treasures.length > 0 && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">赠送宝藏给 {POWER_NAMES[diploTarget].zh}</Typography>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {ps.treasures.map((value, index) => <Button key={`${value}-${index}`} size="small" variant="outlined"
                            disabled={!myTurn || atWar(G, me, diploTarget)}
                            onClick={() => moves.giveTreasure({target: diploTarget, index})}>价值 {value}</Button>)}
                    </Stack>
                </Stack>}
                {G.powers[me].allies.includes(diploTarget) && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">海军借调</Typography>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-loan-from">借出港口</InputLabel>
                        <Select labelId="vq-loan-from" label="借出港口" value={loanFromPort}
                                onChange={(e) => setLoanFromPort(e.target.value)}>
                            {SPACES.filter((space) => space.control === me && (space.ports?.length ?? 0) > 0)
                                .map((space) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-loan-to">接收港口</InputLabel>
                        <Select labelId="vq-loan-to" label="接收港口" value={loanToPort}
                                onChange={(e) => setLoanToPort(e.target.value)}>
                            {SPACES.filter((space) => space.control === diploTarget && (space.ports?.length ?? 0) > 0)
                                .map((space) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-loan-leader">随借海军将领（可选）</InputLabel>
                        <Select labelId="vq-loan-leader" label="随借海军将领（可选）" value={loanLeader}
                                onChange={(e) => setLoanLeader(e.target.value)}>
                            <MenuItem value="">不借将领</MenuItem>
                            {(G.spaces[loanFromPort]?.leaders ?? []).filter((id) => LEADER_BY_ID[id]?.kind === "naval" &&
                                LEADER_BY_ID[id]?.power === me).map((id) =>
                                <MenuItem key={id} value={id}>{LEADER_BY_ID[id]?.name ?? id}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Stack direction="row" spacing={0.5} sx={{flexWrap: "wrap"}}>
                        {(["galley", "galleon", "racebuilt"] as const).map((kind) =>
                            <Button key={kind} size="small" variant="outlined"
                                disabled={!myTurn || loanFromPort === "" || loanToPort === "" || !seaPathBetweenPorts(loanFromPort, loanToPort)}
                                onClick={() => moves.loanNaval({target: diploTarget, fromPort: loanFromPort, toPort: loanToPort, kind, ...(loanLeader ? {leader: loanLeader} : {})})}>
                                借出 {kind}
                            </Button>)}
                    </Stack>
                </Stack>}
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
            const preferenceRequired = hreReligiousPreferenceRequired(G, me);
            const mayKeepBoth = keepsBothHomeCards(G, me);
            return <Stack spacing={1}>
                {preferenceRequired && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">秘密宗教倾向</Typography>
                    <Typography variant="caption" color="text.secondary">首回合选择一次；胜利判定时足以取胜或阻止他国支配胜利才会公开。</Typography>
                    <Stack direction="row" spacing={0.5}>
                        {(Object.keys(HRE_RELIGIOUS_PREFERENCE_NAMES) as HreReligiousPreference[]).map((preference) =>
                            <Button key={preference} size="small" variant="outlined" disabled={!myTurn}
                                    onClick={() => moves.chooseHreReligiousPreference({preference})}>
                                {HRE_RELIGIOUS_PREFERENCE_NAMES[preference]}
                            </Button>)}
                    </Stack>
                </Stack>}
                <Typography variant="body2">
                    春季部署：{choiceRequired && "先秘密选择本回合保留的本国牌（未选中的面朝下放在势力卡上），然后"}可从首都免费调动一支陆军编队。
                </Typography>
                {mayKeepBoth && <Typography variant="caption" color="success.main">
                    苏莱曼一世在位：奥斯曼可保留两张本国牌，无需二选一。
                </Typography>}
                {choiceRequired && <Stack spacing={0.5}>
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
                {me === "england" && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">海船长作为海军将领</Typography>
                    <Typography variant="caption" color="text.secondary">
                        可把一名英国海船长放到有英国舰队的英国本土港口，作为本回合海军将领；冬季返回海船长池。
                    </Typography>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-sea-captain">海船长</InputLabel>
                        <Select labelId="vq-sea-captain" label="海船长" value={seaCaptainChoice}
                                onChange={(e) => setSeaCaptainChoice(e.target.value)}>
                            {G.powers.england.seaCaptains.filter((id) => SEA_CAPTAIN_LEADER_BY_CAPTAIN[id] &&
                                (seaCaptainById(id)?.turn ?? 99) <= G.year &&
                                G.leaders[SEA_CAPTAIN_LEADER_BY_CAPTAIN[id]] === undefined)
                                .map((id) => <MenuItem key={id} value={id}>{seaCaptainById(id)?.nameEn ?? id}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" fullWidth>
                        <InputLabel id="vq-sea-captain-port">港口</InputLabel>
                        <Select labelId="vq-sea-captain-port" label="港口" value={seaCaptainPort}
                                onChange={(e) => setSeaCaptainPort(e.target.value)}>
                            {SPACES.filter((space) => space.control === "england" && space.home === "england" &&
                                (space.ports?.length ?? 0) > 0 && navalCount(G.spaces[space.id].naval.england) > 0)
                                .map((space) => <MenuItem key={space.id} value={space.id}>{space.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button size="small" variant="outlined" disabled={!myTurn || seaCaptainChoice === "" || seaCaptainPort === ""}
                        onClick={() => moves.placeSeaCaptainLeader({captain: seaCaptainChoice, port: seaCaptainPort})}>
                        放置海船长
                    </Button>
                </Stack>}
                {me === "spain" && <Stack spacing={0.5}>
                    <Typography variant="subtitle2">珍宝舰队护航</Typography>
                    <Typography variant="caption" color="text.secondary">最多 2 艘大帆船；仅春季调整，且本回合只能单向移动。</Typography>
                    <Stack direction="row" spacing={0.5}>
                        {[0, 1, 2].map((count) => <Button key={count} size="small" variant="outlined"
                            disabled={!myTurn || (G.treasureFleetEscorts ?? 0) === count}
                            onClick={() => moves.setTreasureFleetEscorts({count})}>护航 {count}</Button>)}
                    </Stack>
                </Stack>}
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
                    首都：{me === "hre" && G.hreCapital !== undefined ? SPACE_BY_ID[G.hreCapital]?.name ?? G.hreCapital : me === "protestant" && G.protestantCapital !== undefined ? SPACE_BY_ID[G.protestantCapital]?.name ?? G.protestantCapital : CAPITAL_SPACES_UI[me] ?? ""} {from !== null ? `· 起点 ${SPACE_BY_ID[from]?.name}` : ""}
                </Typography>
                <Button size="small" variant="outlined" disabled={!myTurn || choiceRequired || preferenceRequired} onClick={() => moves.endPhaseTurn()}>
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

    const pendingPower = G.pendingIntercept?.defender ?? actionResponder ?? piracyResponder ??
        G.pendingEspionage?.responding ?? G.pendingCardEvent?.responding ?? G.pendingTutorialEvent?.responding ?? G.pendingBattle?.responding ?? G.pendingActivation?.ally ?? G.pendingBetrothal?.target;
    const hasResponse = pendingPower !== undefined && ctx.gameover === undefined;
    const selectedSea = selected ? G.seaZones[selected as keyof VQGame["seaZones"]] : undefined;
    const panelProps = (name: string) => ({id: `${panelID}-${name}`, role: isDesktop ? undefined : "tabpanel",
        "aria-labelledby": isDesktop ? undefined : `${panelID}-tab-${name}`, hidden: !isDesktop && mobileView !== name});
    React.useEffect(() => {
        if (hasResponse) {
            if (actionRef.current) actionRef.current.scrollTop = 0;
            if (sidebarRef.current) sidebarRef.current.scrollTop = 0;
        }
    }, [hasResponse, pendingPower, G.pendingBattle?.step, G.pendingPiracy?.step, G.pendingTutorialEvent?.step, G.pendingCardEvent, G.pendingEspionage?.step]);

    return <VQSurface><div className="vq-board">
        <header className="vq-status">
            <div><div className="vq-eyebrow">A game of diplomacy & empire · 1559–1598</div>
                <h1 className="vq-title">Virgin Queen</h1></div>
            <div className="vq-status-meta">
                <span>{scenarioName(G.scenario)} · 第 {G.year}{G.scenario === "tutorial" ? " / 3" : ""} 回合</span>
                <span> / {PHASE_LABELS[phase] ?? phase}</span>
                <strong>{ctx.gameover !== undefined ? "对局结束" : `当前：${POWER_NAMES[G.activePower].zh}`}</strong>
                <span>{me ? `${POWER_NAMES[me].zh} · ${cp} CP` : "旁观模式"}</span>
                {standings.map((entry) => <span key={entry.power} className="vq-score">
                    <i className="vq-dot" style={{background: CONTROLLER_COLORS[entry.power]}}/>{POWER_NAMES[entry.power].short} <b>{entry.vp} VP</b>
                </span>)}
            </div>
        </header>
        {hasResponse && <div className="vq-response" role="status">
            <span>需要响应 · {POWER_NAMES[pendingPower].zh}{ownerOf(G, pendingPower) === playerID ? " · 轮到你选择" : " · 等待选择"}</span>
            {!isDesktop && <Button size="small" onClick={() => setMobileView("action")}>查看响应</Button>}
        </div>}
        <Tabs className="vq-mobile-tabs" value={mobileView} onChange={(_event, value) => setMobileView(value)} variant="fullWidth" aria-label="对局分区">
            {[["map", "地图"], ["action", hasResponse ? "行动 · 待响应" : "行动"], ["hand", `手牌 ${hand.length}`], ["intel", "局势"]].map(([value, label]) =>
                <Tab key={value} id={`${panelID}-tab-${value}`} aria-controls={`${panelID}-${value}`} value={value} label={label}/>)}
        </Tabs>
        <div className="vq-workspace">
            <section className="vq-panel vq-map-panel" {...panelProps("map")}>
                <VQMap G={G} selected={selected} origin={from} onSelect={onSelect}/>
                {!isDesktop && selected && <div className="vq-map-selection">
                    <Button size="small" variant="contained" onClick={() => setMobileView("action")}>{spaceDef?.name ?? SEA_ZONE_BY_ID[selected]?.name} · 详情 / 操作</Button>
                </div>}
            </section>
            <aside className="vq-sidebar" ref={sidebarRef}>
            <section className="vq-panel vq-actions" ref={actionRef} {...panelProps("action")}>
                <TutorialGuide G={G} ctx={ctx} playerID={playerID}/>
                <div className="vq-panel-heading"><h2>{hasResponse ? "响应与结算" : "当前行动"}</h2>
                    <Chip variant="outlined" label={me ? `${cp} CP` : "旁观"}/></div>
                {owned.length > 1 && <Stack direction="row" spacing={0.5} useFlexGap sx={{flexWrap: "wrap", mb: 1}}>
                    {owned.map((power) => <Button key={power} size="small" disabled={myTurn || !!responsePower}
                        variant={me === power ? "contained" : "outlined"} onClick={() => setViewPower(power)}>{POWER_NAMES[power].zh}</Button>)}
                </Stack>}
                {ctx.gameover !== undefined ? <Paper variant="outlined" sx={{p: 1.5, mb: 1}} role="status">
                    <Typography variant="h6">对局结束 · 胜者：P{Number(ctx.gameover.winner) + 1} {POWER_NAMES[(ctx.gameover.power ?? powerAt(String(ctx.gameover.winner))) as Power].zh}</Typography>
                    <Typography variant="body2">原因：{ctx.gameover.reason ?? ""}</Typography>
                    {matchID !== undefined && <ExportLogButton gameName="virginQueen" matchID={matchID}/>}
                </Paper> : actionPanel()}
                {space !== undefined && spaceDef !== undefined && <section className="vq-space-detail" aria-label="选中地区详情">
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
                    {G.espionage?.jesuits.includes(selected!) && <Chip size="small" label="耶稣会士"/>}
                    {space.leaders.length > 0 && <Typography variant="caption" sx={{display: "block"}}>
                        将领：{space.leaders.map((id) => LEADER_BY_ID[id]?.name ?? id).join("、")}
                    </Typography>}
                </section>}
                {selectedSea && selected && <section className="vq-space-detail" aria-label="选中海域详情">
                    <Typography variant="subtitle2">{SEA_ZONE_BY_ID[selected]?.name}</Typography>
                    <Typography variant="caption">海域舰队</Typography>
                    {Object.entries(selectedSea.naval).map(([controller, stack]) => <Typography key={controller} variant="body2">
                        {controllerNameZh(controller as Controller)}：桨帆 {stack?.galley ?? 0} / 大帆 {stack?.galleon ?? 0} / 快帆 {stack?.racebuilt ?? 0} / 海盗 {stack?.corsair ?? 0}
                    </Typography>)}
                    {Object.keys(selectedSea.naval).length === 0 && <Typography variant="body2">此海域无舰队。</Typography>}
                </section>}
            </section>
            <section className="vq-panel vq-intel" {...panelProps("intel")}>
                <ActionGroup title="列强概览">
                    {POWERS.map((p) => <Stack key={p} direction="row" spacing={0.5} sx={{alignItems: "center", mb: 0.25}}>
                        <Box sx={{width: 10, height: 10, bgcolor: CONTROLLER_COLORS[p], borderRadius: 0.5}}/>
                        <Typography variant="caption" sx={{minWidth: 72}}>{POWER_NAMES[p].short} · {ownerOf(G, p) === undefined ? "未激活" : `P${Number(ownerOf(G, p)) + 1}`}</Typography>
                        <Chip size="small" label={`${powerVp(G, p)} VP`}/>
                        {p === "hre" && G.hreReligiousPreferenceChosen && <Chip size="small" variant="outlined"
                            label={G.hreReligiousPreference !== undefined && (me === "hre" || G.hreReligiousPreferenceRevealed)
                                ? `${G.hreReligiousPreferenceRevealed ? "已公开" : "秘密"}：${HRE_RELIGIOUS_PREFERENCE_NAMES[G.hreReligiousPreference]} · ${hreReligiousVp(G)} VP${G.hreReligiousPreferenceRevealed ? "" : "（未计入）"}`
                                : "宗教倾向已秘密选择"}/>}
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, p).length}K`}/>
                        <Chip size="small" variant="outlined" label={`${G.handCounts?.[p] ?? G.powers[p].cards.length}牌`}/>
                        {(G.homeCardSetAsideCounts?.[p] ?? 0) > 0 &&
                            <Chip size="small" variant="outlined" label={`面朝下 ${G.homeCardSetAsideCounts?.[p]}`}/>}
                        {G.powers[p].wars.length > 0 && <Typography variant="caption" color="text.secondary">
                            战:{G.powers[p].wars.map((w) => POWER_NAMES[w].short).join("/")}
                        </Typography>}
                    </Stack>)}
                </ActionGroup>
                {me !== undefined && ps !== undefined && <ActionGroup title="我的势力">
                    <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                        <Box sx={{width: 14, height: 14, bgcolor: CONTROLLER_COLORS[me], borderRadius: 0.5}}/>
                        <Typography variant="subtitle1" sx={{fontWeight: 700}}>{POWER_NAMES[me].zh}</Typography>
                        <Chip size="small" label={`${powerVp(G, me)} VP`}/>
                        <Chip size="small" variant="outlined" label={`${controlledKeys(G, me).length} 关键城市`}/>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                        统治者：{ps.ruler === "elizabethDead" ? "伊丽莎白逝世后的继任政府" : RULER_NAMES[ps.ruler] ?? POWER_INFO[me].ruler.name}（行政 {ps.ruler === "elizabethDead" ? 1 : POWER_INFO[me].ruler.admin} / 额外牌 {ps.ruler === "elizabethDead" ? 0 : POWER_INFO[me].ruler.cardBonus}）
                        · 基础 {baseVp(G, me)} + 宗教 {religiousSpecialVp(G, me)} + 奖励 {ps.bonusVp}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{mt: 0.5}}>
                        <Typography variant="caption">战争：{ps.wars.length > 0 ? ps.wars.map((w) => POWER_NAMES[w].short).join(", ") : "无"}</Typography>
                        <Typography variant="caption">同盟：{ps.allies.length > 0 ? ps.allies.map((w) => POWER_NAMES[w].short).join(", ") : "无"}</Typography>
                        <Typography variant="caption">宝藏：{ps.treasures.length}</Typography>
                    </Stack>
                </ActionGroup>}

                {G.espionage?.inspections.filter((entry) => playerID !== null && ownerOf(G, entry.viewer) === playerID).map((entry) =>
                    <ActionGroup key={`${entry.viewer}:${entry.target}`} title={`秘密情报 · ${POWER_NAMES[entry.target].zh}手牌快照`}>
                        <Typography variant="caption">仅你可见；记录查看时的手牌，不随对方后续行动更新。</Typography>
                        {entry.cards.map((id) => <Typography key={id} variant="body2">{cardById(id).name} · {cardById(id).cp} CP</Typography>)}
                    </ActionGroup>)}
                <ActionGroup title={`对局日志 · ${G.log.length}`}>
                    {G.lastRolls && <Typography variant="body2">最近掷骰：{G.lastRolls}</Typography>}
                    <List dense disablePadding>{G.log.slice(-30).reverse().map((line, index) => <ListItem key={index} disableGutters sx={{py: 0.5}}>
                        <Typography variant="caption">{line}</Typography>
                    </ListItem>)}</List>
                </ActionGroup>
                <ActionGroup title="场景与胜利条件">
                    <Typography variant="body2">{scenarioName(G.scenario)} · 牌堆 {G.deckCount ?? 0} · 新教地区 {protestantSpaceCount(G)}</Typography>
                    {G.scenario === "tutorial" && <>
                        <Typography variant="body2">奥斯曼：军事胜利立即获胜；回合结束达到 20 VP 获胜。第 3 回合结束未达成则西班牙获胜。</Typography>
                        <Typography variant="body2">奥斯曼 {powerVp(G, "ottoman")} VP（关键城市 {baseVp(G, "ottoman")}，无动荡要塞 {tutorialFortressVp(G)}，其他 {G.powers.ottoman.bonusVp}）。剩余回合：{Math.max(0, 4 - G.year)}。</Typography>
                    </>}
                </ActionGroup>
            </section>
            </aside>
            <section className="vq-panel vq-hand" {...panelProps("hand")}>
                <div className="vq-panel-heading"><h2>手牌 <span style={{fontWeight: 400}}>· {hand.length} 张</span></h2>
                    <Stack direction="row" spacing={0.5}>
                        {ps?.treasures.map((treasure, index) => <Button key={index} size="small" variant="outlined"
                            disabled={!canAct || !ps.cardPlayed || ps.treasurePlayed} onClick={() => moves.playTreasure({index})}>宝藏 {treasure} CP</Button>)}
                        {isDesktop && <Button size="small" aria-expanded={handExpanded} aria-controls={`${panelID}-cards`}
                            onClick={() => setHandExpanded(!handExpanded)}>{handExpanded ? "收起手牌" : "展开手牌"}</Button>}
                    </Stack>
                </div>
                <div id={`${panelID}-cards`} hidden={isDesktop && !handExpanded}>
                    {hand.length === 0 && <Typography variant="body2" color="text.secondary">{me ? "暂无手牌。" : "旁观模式仅展示公开牌数。"}</Typography>}
                    <div className="vq-card-tray">{hand.map((id) => {
                        const card = cardById(id);
                        return <button key={id} className="vq-card" aria-label={`查看卡牌 ${card.name} · ${card.cp} CP`} onClick={() => setSelectedCard(id)}>
                            <CardArt def={card} className="vq-card-art" lazy/>
                            <small>{card.kind === "home" ? "本国牌" : card.kind === "event" ? "事件牌" : "行动牌"}<span className="vq-card-cp">{card.cp} CP</span></small>
                            <strong>{card.name}</strong><small>查看详情 ↗</small>
                        </button>;
                    })}</div>
                </div>
            </section>
        </div>
        <Drawer anchor="right" open={selectedCard !== undefined && hand.includes(selectedCard)} onClose={() => setSelectedCard(undefined)}>
            {selectedCard && hand.includes(selectedCard) && <div className="vq-surface vq-card-detail" role="dialog" aria-modal="true" aria-label={`卡牌详情 ${cardById(selectedCard).name}`}>
                <div className="vq-panel-heading"><h2>卡牌详情</h2><Button onClick={() => setSelectedCard(undefined)}>关闭详情</Button></div>
                {cardView(selectedCard)}
            </div>}
        </Drawer>
    </div></VQSurface>;
};

const CAPITAL_SPACES_UI: Record<Power, string> = {
    ottoman: "Istanbul",
    spain: "Madrid / Milan",
    england: "London",
    france: "Paris",
    hre: "Vienna",
    protestant: "La Rochelle / Amsterdam",
};
