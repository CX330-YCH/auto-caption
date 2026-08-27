import { createI18n } from 'vue-i18n';

import zh from './lang/zh.ts';
import en from './lang/en.ts';
import ja from './lang/ja.ts';

export const i18n = createI18n({
    legacy: false,
    locale: 'zh',
    messages: {
        zh,
        en,
        ja
    }
});

export function translate(key: string): string {
    return i18n.global.t(key)
}

export * from './config/theme.ts'
export * from './config/linebreak.ts'
export * from './config/logMenu.ts'
