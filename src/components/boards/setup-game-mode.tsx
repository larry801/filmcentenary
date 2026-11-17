import React from 'react';
import Checkbox from '@mui/material/Checkbox';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Collapse from '@mui/material/Collapse';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import {ExtensionMode, GameMode, GameTurnOrder} from "../../types/core";
import {Ctx} from "boardgame.io";
import Grid from "@mui/material/Grid";

import i18n from "../../constant/i18n";
import { getAllExtensions } from "../../extensions/registry";

export interface ISetupPanelProps {
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
}

const LS_KEY = "film-centenary-game-options";

/** 推荐设置：一键调整【自定义选项】的预设 */
type RecommendPreset = "classic" | "wild" | "latest";

/**
 * 「全部发放」模式下月度流派区只有一个，多个月度扩需要归一为单个。
 * 优先级：2026-10 视觉奇观 > 2026-9 技术革新 > 2026-8 流派扩。
 */
const normalizeMonthlyForAll = (dawn: boolean, tech: boolean, visual: boolean) => {
    if (visual) return {dawn: false, tech: false, visual: true};
    if (tech) return {dawn: false, tech: true, visual: false};
    if (dawn) return {dawn: true, tech: false, visual: false};
    return {dawn: false, tech: false, visual: false};
};

/**
 * 【最新出品】硬编码：最新的月度流派扩。
 * 当前为 2026-9【技术革新】（Ⅰ时代）+ 2026-10【视觉奇观】（Ⅱ时代）；2026-8 与 2026-10 同为Ⅱ时代，故不选。
 * 注意：这两张扩都需要上场，而「全部发放」的月度流派区一次只能放一个扩，
 * 因此【最新出品】预设使用【每时代2个】模式，由各时代分别从已启用的扩中抽取。
 * 后续新增月度扩时更新此常量。
 */
const LATEST_MONTHLY_PRESET: Record<"dawn" | "tech" | "visual", boolean> = {
    dawn: false,
    tech: true,
    visual: true,
};

interface ISavedOptions {
    mode: GameMode;
    order: GameTurnOrder;
    extensionMode: ExtensionMode;
    enableSchoolExtension: boolean;
    enableSchoolExtensionMuki: boolean;
    enableSchoolExtensionMuki2: boolean;
    enableSchoolExtensionDawn: boolean;
    enableSchoolExtensionTech: boolean;
    enableSchoolExtensionVisual: boolean;
    enableSchoolExtensionQM: boolean;
    enableExtensionChaosMedia: boolean;
    disableUndo: boolean;
    testModeCinema: boolean;
    testModeEnd180: boolean;
    enabledExtensions: string[];
}

/** 从 localStorage 读取上次保存的选项 */
function loadOptions(): ISavedOptions | null {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) return JSON.parse(raw) as ISavedOptions;
    } catch {}
    return null;
}

/** 保存选项到 localStorage */
function saveOptions(opts: ISavedOptions): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(opts));
    } catch {}
}

/** 检查保存的选项是否有任何扩展被启用 */
function hasAnySavedExtensionEnabled(saved: ISavedOptions | null): boolean {
    if (!saved) return false;
    return (
        saved.enableSchoolExtension ||
        saved.enableSchoolExtensionMuki ||
        saved.enableSchoolExtensionMuki2 ||
        saved.enableSchoolExtensionDawn ||
        saved.enableSchoolExtensionTech ||
        saved.enableSchoolExtensionVisual ||
        saved.enableSchoolExtensionQM ||
        saved.enableExtensionChaosMedia ||
        (saved.enabledExtensions && saved.enabledExtensions.length > 0) ||
        saved.extensionMode !== ExtensionMode.NONE ||
        saved.disableUndo ||
        saved.testModeCinema ||
        saved.testModeEnd180
    );
}

export default function SetupPanel({moves, ctx}: ISetupPanelProps) {
    i18n.use();

    // 尝试从 localStorage 恢复上次选项
    const saved = React.useMemo(() => loadOptions(), []);

    const [mode, setMode] = React.useState<GameMode>(saved?.mode ?? GameMode.NORMAL);
    const [order, setOrder] = React.useState<GameTurnOrder>(saved?.order ?? GameTurnOrder.FIXED);
    const [extensionMode, setExtensionMode] = React.useState<ExtensionMode>(saved?.extensionMode ?? ExtensionMode.NONE);
    const [enableSchoolExtension, setEnableSchoolExtension] = React.useState(saved?.enableSchoolExtension ?? false);
    const [enableSchoolExtensionMuki, setEnableSchoolExtensionMuki] = React.useState(saved?.enableSchoolExtensionMuki ?? false);
    const [enableSchoolExtensionMuki2, setEnableSchoolExtensionMuki2] = React.useState(saved?.enableSchoolExtensionMuki2 ?? false);
    // 月度流派扩：「全部发放」模式下月度流派区只有一个，三个月度扩完全互斥；
    // 同时启用多个时按优先级归一：2026-10 视觉奇观 > 2026-9 技术革新 > 2026-8 流派扩。
    const savedModeIsAll = (saved?.extensionMode ?? ExtensionMode.NONE) === ExtensionMode.NONE;
    // 新月度扩自动勾选：若已保存的月度扩全部为已勾选，则新扩默认勾选；否则不勾选
    const MONTHLY_EXTENSION_KEYS = ["enableSchoolExtensionDawn", "enableSchoolExtensionTech", "enableSchoolExtensionVisual"];
    const savedMonthlyKeys = saved
        ? MONTHLY_EXTENSION_KEYS.filter(k => (saved as any)[k] !== undefined)
        : [];
    const allSavedMonthlyEnabled = savedMonthlyKeys.length > 0 && savedMonthlyKeys.every(k => (saved as any)[k] === true);
    const defaultVisual = saved ? ((saved as any).enableSchoolExtensionVisual ?? allSavedMonthlyEnabled) : false;
    const savedMonthly = {
        dawn: saved?.enableSchoolExtensionDawn ?? false,
        tech: saved?.enableSchoolExtensionTech ?? false,
        visual: defaultVisual,
    };
    const initMonthly = savedModeIsAll
        ? normalizeMonthlyForAll(savedMonthly.dawn, savedMonthly.tech, savedMonthly.visual)
        : savedMonthly;
    const [enableSchoolExtensionDawn, setEnableSchoolExtensionDawn] = React.useState(initMonthly.dawn);
    const [enableSchoolExtensionTech, setEnableSchoolExtensionTech] = React.useState(initMonthly.tech);
    const [enableSchoolExtensionVisual, setEnableSchoolExtensionVisual] = React.useState<boolean>(initMonthly.visual);
    const [enableSchoolExtensionQM, setEnableSchoolExtensionQM] = React.useState(saved?.enableSchoolExtensionQM ?? false);
    const [enableExtensionChaosMedia, setEnableExtensionChaosMedia] = React.useState(saved?.enableExtensionChaosMedia ?? false);
    const [disableUndo, setDisableUndo] = React.useState(saved?.disableUndo ?? false);
    const [testModeCinema, setTestModeCinema] = React.useState(saved?.testModeCinema ?? false);
    const [testModeEnd180, setTestModeEnd180] = React.useState(saved?.testModeEnd180 ?? false);
    const [enabledExtensions, setEnabledExtensions] = React.useState<string[]>(saved?.enabledExtensions ?? []);
    // 手机端判定（窄屏时自定义选项默认隐藏）
    const [isMobile, setIsMobile] = React.useState<boolean>(() =>
        typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches
    );
    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 600px)');
        const onChange = () => setIsMobile(mq.matches);
        onChange();
        mq.addListener(onChange);
        return () => mq.removeListener(onChange);
    }, []);
    // 如果有保存的扩展选项，默认展开自定义选项面板（手机端始终默认折叠）
    const [showCustomOptions, setShowCustomOptions] = React.useState(
        !isMobile && hasAnySavedExtensionEnabled(saved)
    );

    // 是否有任何扩展选项被启用
    const hasAnyExtensionEnabled =
        enableSchoolExtension ||
        enableSchoolExtensionMuki ||
        enableSchoolExtensionMuki2 ||
        enableSchoolExtensionDawn ||
        enableSchoolExtensionTech ||
        enableSchoolExtensionVisual ||
        enableSchoolExtensionQM ||
        enableExtensionChaosMedia ||
        enabledExtensions.length > 0 ||
        extensionMode !== ExtensionMode.NONE ||
        disableUndo;

    // 已注册的 DIY 扩展列表（安全加载，失败时返回空数组）
    const registeredExtensions = React.useMemo(() => {
        try {
            return getAllExtensions();
        } catch (e) {
            console.warn("[SetupPanel] Failed to load extensions:", e);
            return [];
        }
    }, []);

    // 清理 localStorage 中可能已失效的扩展 ID（扩展已被移除）
    const validEnabledExtensions = React.useMemo(() => {
        const registeredIds = new Set(registeredExtensions.map(e => e.id));
        return enabledExtensions.filter(id => registeredIds.has(id));
    }, [enabledExtensions, registeredExtensions]);

    // 同步：如果清理后有变化，更新状态
    React.useEffect(() => {
        if (validEnabledExtensions.length !== enabledExtensions.length) {
            setEnabledExtensions(validEnabledExtensions);
        }
    }, [validEnabledExtensions, enabledExtensions.length]);

    /** 统一切换扩展选项后调用 moves.setupGameMode */
    const applyOptions = React.useCallback((
        overrides: Partial<ISavedOptions>
    ) => {
        const current = {
            mode, order, extensionMode,
            enableSchoolExtension, enableSchoolExtensionMuki,
            enableSchoolExtensionMuki2, enableSchoolExtensionDawn,
            enableSchoolExtensionTech, enableSchoolExtensionVisual,
            enableSchoolExtensionQM,
            enableExtensionChaosMedia, disableUndo,
            testModeCinema, testModeEnd180,
            enabledExtensions,
            ...overrides,
        };
        moves.setupGameMode(current);
        saveOptions(current);
    }, [mode, order, extensionMode, enableSchoolExtension, enableSchoolExtensionMuki,
        enableSchoolExtensionMuki2, enableSchoolExtensionDawn, enableSchoolExtensionTech, enableSchoolExtensionVisual, enableSchoolExtensionQM, enableExtensionChaosMedia,
        disableUndo, testModeCinema, testModeEnd180, enabledExtensions, moves]);

    // 组件挂载时，如果有保存的选项，应用一次（全部发放模式下月度扩归一为单个）
    React.useEffect(() => {
        if (saved) {
            moves.setupGameMode({
                ...saved,
                enableSchoolExtensionDawn: initMonthly.dawn,
                enableSchoolExtensionTech: initMonthly.tech,
                enableSchoolExtensionVisual: initMonthly.visual,
            });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newMode: GameMode = event.target.value as GameMode;
        setMode(newMode);
        applyOptions({ mode: newMode });
    };

    const handleFirstPlayerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newOrder: GameTurnOrder = event.target.value as GameTurnOrder;
        setOrder(newOrder);
        applyOptions({ order: newOrder });
    };

    const handleExtensionModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newExtensionMode: ExtensionMode = event.target.value as ExtensionMode;
        setExtensionMode(newExtensionMode);
        const overrides = { extensionMode: newExtensionMode } as Partial<ISavedOptions>;
        // 切到全部发放时，月度扩归一为单个（优先级 2026-10 > 2026-9 > 2026-8）
        if (newExtensionMode === ExtensionMode.NONE) {
            const m = normalizeMonthlyForAll(enableSchoolExtensionDawn, enableSchoolExtensionTech, enableSchoolExtensionVisual);
            setEnableSchoolExtensionDawn(m.dawn);
            setEnableSchoolExtensionTech(m.tech);
            setEnableSchoolExtensionVisual(m.visual);
            overrides.enableSchoolExtensionDawn = m.dawn;
            overrides.enableSchoolExtensionTech = m.tech;
            overrides.enableSchoolExtensionVisual = m.visual;
        }
        applyOptions(overrides);
    };

    // --- 扩展 checkbox handlers ---
    const makeExtHandler = (
        setter: (v: boolean) => void,
        key: keyof ISavedOptions
    ) => (_event: React.ChangeEvent<{}>, checked: boolean) => {
        setter(checked);
        applyOptions({ [key]: checked } as Partial<ISavedOptions>);
    };

    // --- 月度扩互斥：全部发放模式下月度流派区只有一个，三个月度扩完全互斥（每时代2个模式可共存） ---
    const monthlyMutex = extensionMode === ExtensionMode.NONE;
    const handleMonthlyToggle = (target: "dawn" | "tech" | "visual") => (_event: React.ChangeEvent<{}>, checked: boolean) => {
        const setters = {
            dawn: setEnableSchoolExtensionDawn,
            tech: setEnableSchoolExtensionTech,
            visual: setEnableSchoolExtensionVisual,
        };
        const keys = {
            dawn: "enableSchoolExtensionDawn",
            tech: "enableSchoolExtensionTech",
            visual: "enableSchoolExtensionVisual",
        } as const;
        setters[target](checked);
        const overrides: Partial<ISavedOptions> = {[keys[target]]: checked} as Partial<ISavedOptions>;
        // 全部发放模式下月度流派区只有一个：勾选任意一个时取消其余两个
        if (checked && monthlyMutex) {
            (["dawn", "tech", "visual"] as const).forEach(other => {
                if (other === target) return;
                setters[other](false);
                (overrides as any)[keys[other]] = false;
            });
        }
        applyOptions(overrides);
    };

    // --- DIY 扩展 checkbox handler ---
    const handleDiyExtToggle = (extId: string, checked: boolean) => {
        const next = checked
            ? [...enabledExtensions, extId]
            : enabledExtensions.filter(id => id !== extId);
        setEnabledExtensions(next);
        applyOptions({ enabledExtensions: next });
    };

    // --- 推荐设置：一键调整扩展相关选项（不改变 180分 / 电影院 / 禁止撤回） ---
    const applyRecommendPreset = (preset: RecommendPreset) => {
        if (preset === "classic") {
            // 【经典基础】取消所有扩展（卡牌 + 流派），全部发放
            setExtensionMode(ExtensionMode.NONE);
            setEnableSchoolExtension(false);
            setEnableSchoolExtensionMuki(false);
            setEnableSchoolExtensionMuki2(false);
            setEnableSchoolExtensionDawn(false);
            setEnableSchoolExtensionTech(false);
            setEnableSchoolExtensionVisual(false);
            setEnableSchoolExtensionQM(false);
            setEnableExtensionChaosMedia(false);
            setEnabledExtensions([]);
            applyOptions({
                extensionMode: ExtensionMode.NONE,
                enableSchoolExtension: false,
                enableSchoolExtensionMuki: false,
                enableSchoolExtensionMuki2: false,
                enableSchoolExtensionDawn: false,
                enableSchoolExtensionTech: false,
                enableSchoolExtensionVisual: false,
                enableSchoolExtensionQM: false,
                enableExtensionChaosMedia: false,
                enabledExtensions: [],
            });
            return;
        }
        if (preset === "wild") {
            // 【狂野全扩】开启所有扩展（卡牌 + 流派 + DIY），每时代2个
            const allDiyIds = registeredExtensions.map(ext => ext.id);
            setExtensionMode(ExtensionMode.FOUR);
            setEnableSchoolExtension(true);
            setEnableSchoolExtensionMuki(true);
            setEnableSchoolExtensionMuki2(true);
            setEnableSchoolExtensionDawn(true);
            setEnableSchoolExtensionTech(true);
            setEnableSchoolExtensionVisual(true);
            setEnableSchoolExtensionQM(true);
            setEnableExtensionChaosMedia(true);
            setEnabledExtensions(allDiyIds);
            applyOptions({
                extensionMode: ExtensionMode.FOUR,
                enableSchoolExtension: true,
                enableSchoolExtensionMuki: true,
                enableSchoolExtensionMuki2: true,
                enableSchoolExtensionDawn: true,
                enableSchoolExtensionTech: true,
                enableSchoolExtensionVisual: true,
                enableSchoolExtensionQM: true,
                enableExtensionChaosMedia: true,
                enabledExtensions: allDiyIds,
            });
            return;
        }
        // 【最新出品】仅选择最新的月度流派扩（2026-9 技术革新 Ⅰ + 2026-10 视觉奇观 Ⅱ）。
        // 两个扩都要上场，而「全部发放」的月度流派区只能放一个扩，因此改用【每时代2个】模式；
        // 【卡牌扩展 - 乱世光影】保持不变
        setExtensionMode(ExtensionMode.FOUR);
        setEnableSchoolExtension(false);
        setEnableSchoolExtensionMuki(false);
        setEnableSchoolExtensionMuki2(false);
        setEnableSchoolExtensionDawn(LATEST_MONTHLY_PRESET.dawn);
        setEnableSchoolExtensionTech(LATEST_MONTHLY_PRESET.tech);
        setEnableSchoolExtensionVisual(LATEST_MONTHLY_PRESET.visual);
        setEnableSchoolExtensionQM(false);
        setEnabledExtensions([]);
        applyOptions({
            extensionMode: ExtensionMode.FOUR,
            enableSchoolExtension: false,
            enableSchoolExtensionMuki: false,
            enableSchoolExtensionMuki2: false,
            enableSchoolExtensionDawn: LATEST_MONTHLY_PRESET.dawn,
            enableSchoolExtensionTech: LATEST_MONTHLY_PRESET.tech,
            enableSchoolExtensionVisual: LATEST_MONTHLY_PRESET.visual,
            enableSchoolExtensionQM: false,
            enabledExtensions: [],
        });
    };

    /** 推荐设置按钮组 */
    const presetButtons = (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Button
                variant="contained"
                color="primary"
                size="large"
                style={{ height: 42 }}
                onClick={() => applyRecommendPreset("classic")}
            >
                {i18n.chain.setting.presetClassic}
            </Button>
            <Button
                variant="contained"
                color="primary"
                size="large"
                style={{ height: 42 }}
                disabled={ctx.numPlayers < 3}
                onClick={() => applyRecommendPreset("wild")}
            >
                {i18n.chain.setting.presetWild}
            </Button>
            <Button
                variant="contained"
                color="primary"
                size="large"
                style={{ height: 42 }}
                disabled={ctx.numPlayers < 3}
                onClick={() => applyRecommendPreset("latest")}
            >
                {i18n.chain.setting.presetLatest}
            </Button>
        </div>
    );

    /** 推荐设置区块：inline=true 时与自定义选项标题同排 */
    const renderRecommendSettings = (inline: boolean) => (
        <FormControl
            component="fieldset"
            style={inline
                ? { flexDirection: 'row', alignItems: 'center', gap: 8 }
                : { marginTop: 8 }}
        >
            <FormLabel component="legend" style={inline ? { marginBottom: 0, whiteSpace: 'nowrap' } : undefined}>
                {i18n.chain.setting.recommendedSettings}
            </FormLabel>
            {presetButtons}
        </FormControl>
    );

    return (
        <Grid container>
            {/* ====== 游戏模式 ====== */}
            <FormControl component="fieldset">
                <FormLabel component="legend">{i18n.chain.setting.mode}</FormLabel>
                <RadioGroup row aria-label={i18n.chain.setting.mode} name="mode" value={mode} onChange={handleChange}>
                    <FormControlLabel value={GameMode.NORMAL} control={<Radio/>} label={i18n.chain.setting.normal}/>
                    <FormControlLabel value={GameMode.NEWBIE} control={<Radio/>} label={i18n.chain.setting.newbie}/>
                    <FormControlLabel
                        disabled={ctx.numPlayers < 4}
                        value={GameMode.TEAM2V2} control={<Radio/>} label={i18n.chain.setting.team}/>
                </RadioGroup>
            </FormControl>

            {/* ====== 行动顺序 ====== */}
            <FormControl component="fieldset">
                <FormLabel component="legend">{i18n.chain.setting.order}</FormLabel>
                <RadioGroup row aria-label={i18n.chain.setting.order} name="order" value={order}
                            onChange={handleFirstPlayerChange}>
                    <FormControlLabel value={GameTurnOrder.FIXED} control={<Radio/>} label={i18n.chain.setting.fixedFirst}/>
                    <FormControlLabel value={GameTurnOrder.FIRST_RANDOM} control={<Radio/>} label={i18n.chain.setting.randomFirst}/>
                    <FormControlLabel
                        disabled={ctx.numPlayers === 2}
                        value={GameTurnOrder.ALL_RANDOM} control={<Radio/>} label={i18n.chain.setting.allRandom}/>
                    <FormControlLabel value={GameTurnOrder.ANONYMOUS_RANDOM} control={<Radio/>} label={i18n.chain.setting.anonymousRandom}/>
                </RadioGroup>
            </FormControl>

            {/* ====== 自定义选项（可折叠） ====== */}
            <div style={{ width: '100%', marginTop: 8, marginBottom: 12 }}>
                <div
                    onClick={() => setShowCustomOptions(!showCustomOptions)}
                    style={{
                        display: 'flex', alignItems: 'center', cursor: 'pointer',
                        userSelect: 'none', padding: '4px 0',
                    }}
                >
                    <span style={{ fontSize: 16, marginRight: 6, transition: 'transform 0.2s', display: 'inline-block', transform: showCustomOptions ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                        ▶
                    </span>
                    <Typography variant="subtitle2" style={{ fontWeight: 500 }}>
                        {i18n.chain.setting.customOptions}
                    </Typography>
                    {hasAnyExtensionEnabled && (
                        <Typography variant="caption" style={{ marginLeft: 8, color: '#4caf50' }}>
                            ●
                        </Typography>
                    )}
                    {!isMobile && (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{ marginLeft: 12, display: 'flex', alignItems: 'center', cursor: 'default' }}
                        >
                            {renderRecommendSettings(true)}
                        </div>
                    )}
                </div>

                <Collapse in={showCustomOptions}>
                    <div style={{ paddingLeft: 32, paddingTop: 4 }}>
                        <FormControl component="fieldset">
                            <FormControlLabel
                                checked={enableSchoolExtension}
                                onChange={makeExtHandler(setEnableSchoolExtension, 'enableSchoolExtension')}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtension}/>
                            <FormControlLabel
                                checked={enableSchoolExtensionMuki}
                                onChange={makeExtHandler(setEnableSchoolExtensionMuki, 'enableSchoolExtensionMuki')}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtensionMuki}/>
                            <FormControlLabel
                                checked={enableSchoolExtensionMuki2}
                                onChange={makeExtHandler(setEnableSchoolExtensionMuki2, 'enableSchoolExtensionMuki2')}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtensionMuki2}/>
                            <FormControlLabel
                                checked={enableSchoolExtensionDawn}
                                onChange={handleMonthlyToggle("dawn")}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtensionDawn}/>
                            <FormControlLabel
                                checked={enableSchoolExtensionTech}
                                onChange={handleMonthlyToggle("tech")}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtensionTech}/>
                            <FormControlLabel
                                checked={enableSchoolExtensionVisual}
                                onChange={handleMonthlyToggle("visual")}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtensionVisual}/>
                            <FormControlLabel
                                checked={enableSchoolExtensionQM}
                                onChange={makeExtHandler(setEnableSchoolExtensionQM, 'enableSchoolExtensionQM')}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableSchoolExtensionQM}/>
                            <FormControlLabel
                                checked={enableExtensionChaosMedia}
                                onChange={makeExtHandler(setEnableExtensionChaosMedia, 'enableExtensionChaosMedia')}
                                disabled={ctx.numPlayers < 3}
                                control={<Checkbox/>} label={i18n.chain.setting.enableExtensionChaosMedia}/>
                            <FormControlLabel
                                checked={disableUndo}
                                onChange={makeExtHandler(setDisableUndo, 'disableUndo')}
                                control={<Checkbox/>} label={i18n.chain.setting.disableUndo}/>
                            <FormControlLabel
                                checked={testModeCinema}
                                onChange={makeExtHandler(setTestModeCinema, 'testModeCinema')}
                                control={<Checkbox/>} label={i18n.chain.setting.testModeCinema || '【可选】电影院：+1资源，+1声望'}/>
                            <FormControlLabel
                                checked={testModeEnd180}
                                onChange={makeExtHandler(setTestModeEnd180, 'testModeEnd180')}
                                control={<Checkbox/>} label={i18n.chain.setting.testModeEnd180 || '【可选】游戏结束：180分'}/>

                            {/* ====== DIY 扩展（从注册中心自动生成） ====== */}
                            {registeredExtensions.length > 0 && (
                                <>
                                    {registeredExtensions.map(ext => (
                                        <FormControlLabel
                                            key={ext.id}
                                            checked={enabledExtensions.includes(ext.id)}
                                            onChange={(_e, checked) => handleDiyExtToggle(ext.id, checked)}
                                            disabled={ctx.numPlayers < 3}
                                            control={<Checkbox/>}
                                            label={`${ext.name}`}
                                        />
                                    ))}
                                </>
                            )}
                        </FormControl>

                        <FormControl component="fieldset" style={{ marginTop: 8 }}>
                            <FormLabel component="legend">{i18n.chain.setting.extensionMode}</FormLabel>
                            <RadioGroup row aria-label={i18n.chain.setting.extensionMode} name="extension" value={extensionMode}
                                        onChange={handleExtensionModeChange}>
                                <FormControlLabel value={ExtensionMode.NONE} control={<Radio/>} label={i18n.chain.setting.extensionMode_none}/>
                                <FormControlLabel
                                    disabled={ctx.numPlayers < 3}
                                    value={ExtensionMode.FOUR} control={<Radio/>} label={i18n.chain.setting.extensionMode_four}/>
                            </RadioGroup>
                        </FormControl>
                    </div>
                </Collapse>
            </div>
            {/* 推荐设置常驻：移动端位于展示牌列上方 */}
            {isMobile && (
                <div style={{ width: '100%', marginBottom: 12 }}>
                    {renderRecommendSettings(false)}
                </div>
            )}
        </Grid>
    );
}
