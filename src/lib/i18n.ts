import type { Action } from "./keymap";

// UI strings. No i18n library: a typed dictionary is enough.
export const LOCALES = ["en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

type Messages = {
  inputPlaceholder: string;
  settings: string;
  theme: string;
  language: string;
  pin: string;
  on: string;
  off: string;
  localeLabel: string;
  keys: string;
  pressKey: string;
  keyTaken: string;
  resetKeys: string;
  emptyLineHint: string;
  /** What each bindable action does, shown next to its key */
  actions: Record<Action, string>;
};

const MESSAGES: Record<Locale, Messages> = {
  en: {
    inputPlaceholder: "Capture a task…",
    settings: "Settings",
    theme: "Theme",
    language: "Language",
    pin: "Keep on top",
    on: "On",
    off: "Off",
    localeLabel: "English",
    keys: "Keys",
    pressKey: "Press a key…",
    keyTaken: "That key is already taken",
    resetKeys: "Reset keys",
    emptyLineHint: "⌫ on an empty line removes it",
    actions: {
      toggleWindow: "Show or hide chotto",
      newLine: "Start a new line below",
      toggleDone: "Check the line off",
      moveUp: "Move to the line above",
      moveDown: "Move to the line below",
      moveLineUp: "Move the line up",
      moveLineDown: "Move the line down",
      indent: "Indent",
      outdent: "Outdent",
      removeLine: "Remove the line",
      nextTheme: "Next theme",
      nextLanguage: "Next language",
      togglePin: "Keep on top",
      settings: "Settings",
      hide: "Hide",
    },
  },
  ja: {
    inputPlaceholder: "ちょっとメモ…",
    settings: "設定",
    theme: "テーマ",
    language: "言語",
    pin: "常に手前に表示",
    on: "オン",
    off: "オフ",
    localeLabel: "日本語",
    keys: "キー",
    pressKey: "キーを押してください…",
    keyTaken: "そのキーは既に使われています",
    resetKeys: "キーを初期値に戻す",
    emptyLineHint: "空行での ⌫ はその行を削除します",
    actions: {
      toggleWindow: "chotto の表示 / 非表示",
      newLine: "下に新しい行",
      toggleDone: "チェックを切り替え",
      moveUp: "上の行へ移動",
      moveDown: "下の行へ移動",
      moveLineUp: "行を上へ移動",
      moveLineDown: "行を下へ移動",
      indent: "インデントを下げる",
      outdent: "インデントを上げる",
      removeLine: "行を削除",
      nextTheme: "次のテーマ",
      nextLanguage: "次の言語",
      togglePin: "常に手前に表示",
      settings: "設定",
      hide: "隠す",
    },
  },
};

const LOCALE_KEY = "chotto.locale";

/** Use the saved preference, otherwise fall back to English */
export function loadLocale(): Locale {
  const saved = localStorage.getItem(LOCALE_KEY);
  return LOCALES.includes(saved as Locale) ? (saved as Locale) : "en";
}

export function saveLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_KEY, locale);
}

export function messages(locale: Locale): Messages {
  return MESSAGES[locale];
}
