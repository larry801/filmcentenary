import {createI18n, I18n, Locale} from '@i18n-chain/core';
import zh_CN from './locales/zh_CN';
import en from "./locales/en";

// `@i18n-chain/core` is dependency free; `@i18n-chain/react` only adds the
// `use` binding and a React peer on top of it. This module is also bundled
// into the server, and the runtime image installs production dependencies
// only, so React is not installed there: `use` is bound to the React element
// constructor, which the bundler injects once for the whole client bundle.
export interface AppI18n extends I18n<typeof zh_CN, Locale<typeof zh_CN>> {
    use(): AppI18n;
}

const i18n = createI18n({
    defaultLocale: {
        key: 'zh_CN',
        values: zh_CN,
    },
}) as AppI18n;
i18n.define('en', en);


// const i18n = createI18n({
//     defaultLocale: {
//         key: 'en',
//         values: en,
//     },
// });
i18n.define('zh_CN', zh_CN);

i18n.use = function use(element: unknown, _props: unknown, _children: unknown) {
    return element;
} as AppI18n['use'];

export default i18n;
