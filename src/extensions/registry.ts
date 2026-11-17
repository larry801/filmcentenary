/**
 * src/extensions/registry.ts
 * 扩展注册中心
 * 
 * 所有扩展通过 registerExtension() 注册到此中心，
 * 核心代码通过此模块查询已注册的扩展。
 */
import { IExtension, ICardEffectDef } from "./types";
import { IG } from "../types/setup";
import { INormalOrLegendCard } from "../types/core";

/** 全局扩展注册表 */
const _registry: Map<string, IExtension> = new Map();

/**
 * 注册一个扩展。通常在扩展的入口文件中调用。
 * 重复注册同一 id 会抛出错误。
 */
export function registerExtension(ext: IExtension): void {
    if (_registry.has(ext.id)) {
        console.warn(`[ExtensionRegistry] Extension "${ext.id}" already registered, skipping.`);
        return;
    }
    _registry.set(ext.id, ext);
    console.log(`[ExtensionRegistry] Registered extension: "${ext.id}" (${ext.name})`);
}

/**
 * 根据 id 获取扩展
 */
export function getExtension(id: string): IExtension | undefined {
    return _registry.get(id);
}

/**
 * 获取所有已注册的扩展
 */
export function getAllExtensions(): IExtension[] {
    return [..._registry.values()];
}

/**
 * 获取当前游戏中所有启用的扩展
 * 默认启用规则：G.enabledExtensions 包含扩展的 id
 */
export function getEnabledExtensions(G: IG): IExtension[] {
    return getAllExtensions().filter(ext => {
        try {
            if (ext.isEnabled) {
                return ext.isEnabled(G);
            }
            // 默认：检查 G.enabledExtensions 数组
            return G.enabledExtensions && G.enabledExtensions.includes(ext.id);
        } catch {
            return false;
        }
    });
}

/**
 * 获取所有扩展的 UI 选项信息（用于渲染 checkbox）
 */
export interface IExtensionUIOption {
    id: string;
    labelCh: string;
    labelEn: string;
    enabled: boolean;
}

export function getAllExtensionUIOptions(G: IG): IExtensionUIOption[] {
    return getAllExtensions().map(ext => {
        const enabled = (() => {
            try {
                if (ext.isEnabled) return ext.isEnabled(G);
                return G.enabledExtensions && G.enabledExtensions.includes(ext.id);
            } catch { return false; }
        })();
        return {
            id: ext.id,
            labelCh: ext.label?.ch ?? ext.name,
            labelEn: ext.label?.en ?? ext.name,
            enabled,
        };
    });
}

/**
 * 聚合所有启用扩展的卡牌数据
 * 若多个扩展定义了同一 ID，后注册的覆盖先注册的
 */
export function getAllExtensionCards(G: IG): Record<string, INormalOrLegendCard> {
    const all: Record<string, INormalOrLegendCard> = {};
    for (const ext of getEnabledExtensions(G)) {
        if (ext.cards) {
            Object.assign(all, ext.cards);
        }
    }
    return all;
}

/**
 * 聚合所有启用扩展的卡牌效果
 * key = 卡牌 ID 的数字部分 (去掉 F/S/P 前缀)
 * 若多个扩展定义了同一 key，后注册的覆盖先注册的
 */
export function getAllExtensionEffects(G: IG): Record<string, ICardEffectDef> {
    const all: Record<string, ICardEffectDef> = {};
    for (const ext of getEnabledExtensions(G)) {
        if (ext.effects) {
            Object.assign(all, ext.effects);
        }
    }
    return all;
}

/**
 * 聚合所有启用扩展的事件效果
 */
export function getAllExtensionEventEffects(G: IG): Record<string, any> {
    const all: Record<string, any> = {};
    for (const ext of getEnabledExtensions(G)) {
        if (ext.eventEffects) {
            Object.assign(all, ext.eventEffects);
        }
    }
    return all;
}

/**
 * 执行所有启用扩展的 onSetup 钩子
 */
export function runExtensionSetups(G: IG, ctx: any): void {
    for (const ext of getEnabledExtensions(G)) {
        if (ext.onSetup) {
            try {
                ext.onSetup(G, ctx);
            } catch (e) {
                console.error(`[ExtensionRegistry] Error in onSetup of "${ext.id}":`, e);
            }
        }
    }
}

/**
 * 检查某张卡牌 ID 是否属于某个启用的扩展
 */
export function isExtensionCard(G: IG, cardId: string): boolean {
    const extCards = getAllExtensionCards(G);
    return cardId in extCards;
}
