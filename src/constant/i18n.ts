import {createI18n} from '@i18n-chain/react';
import zh_CN from './locales/zh_CN';
import en from "./locales/en";

const i18n = createI18n({
    defaultLocale: {
        key: 'zh_CN',
        values: zh_CN,
    },
})
i18n._.define('en', en);


// const i18n = createI18n({
//     defaultLocale: {
//         key: 'en',
//         values: en,
//     },
// });
// i18n._.define('zh_CN', zh_CN);

export default i18n;
