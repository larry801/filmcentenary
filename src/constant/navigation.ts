import i18n from "./i18n";

export interface NavItem {
    to: string;
    label: string;
}

export interface NavGroup {
    key: string;
    title: string;
    items: NavItem[];
}

/**
 * Single source of truth for the app's navigation. The home page renders these
 * groups as cards and the app-bar drawer renders them as a list. Call it on
 * every render so the labels follow the active locale.
 */
export const getNavGroups = (): NavGroup[] => {
    const drawer = i18n.chain.drawer;
    return [
        {
            key: 'film',
            title: drawer.section.film,
            items: [
                {to: '/film', label: drawer.film.multiplayer},
                {to: '/local2p', label: drawer.film.local2p},
                {to: '/local3p', label: drawer.film.local3p},
                {to: '/local4p', label: drawer.film.local4p},
                // 每个游戏都有自己的卡表；规则和帮助目前仅适用于电影百年。
                {to: '/cards', label: drawer.cards},
                {to: '/about', label: drawer.about},
            ],
        },
        {
            key: 'songJinn',
            title: drawer.section.songJinn,
            items: [
                {to: '/songJinn', label: drawer.songJinn.multiplayer},
                {to: '/local', label: drawer.songJinn.local},
                {to: '/cards/songJinn', label: drawer.cards},
            ],
        },
        {
            key: 'imperialElegy',
            title: drawer.section.imperialElegy,
            items: [
                {to: '/imperialElegy', label: drawer.imperialElegy.multiplayer},
                {to: '/localIE?solo=1', label: drawer.imperialElegy.solo},
                {to: '/localIE', label: drawer.imperialElegy.local},
                {to: '/cards/imperialElegy', label: drawer.cards},
            ],
        },
        {
            key: 'virginQueen',
            title: drawer.section.virginQueen,
            items: [
                {to: '/virginQueen', label: drawer.virginQueen.multiplayer},
                {to: '/localVQ', label: drawer.virginQueen.local},
                {to: '/localVQ/tutorial', label: drawer.virginQueen.tutorial},
                {to: '/cards/virginQueen', label: drawer.cards},
            ],
        },
    ];
};
