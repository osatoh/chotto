// UI strings. No i18n library: a typed dictionary is enough.
export const LOCALES = ["en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

type Messages = {
  inputPlaceholder: string;
  empty: string;
  hints: string;
  pin: string;
  pinned: string;
  localeLabel: string;
};

const MESSAGES: Record<Locale, Messages> = {
  en: {
    inputPlaceholder: "Capture a task…",
    empty: "No tasks yet",
    hints: "⌘↑↓ reorder / ⌘⌫ delete / ⌘K theme / ⌘L language",
    pin: "pin ⌘P",
    pinned: "📌 pinned",
    localeLabel: "EN",
  },
  ja: {
    inputPlaceholder: "ちょっとメモ…",
    empty: "タスクはまだありません",
    hints: "⌘↑↓ 並び替え / ⌘⌫ 削除 / ⌘K テーマ / ⌘L 言語",
    pin: "ピン ⌘P",
    pinned: "📌 ピン中",
    localeLabel: "日本語",
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
