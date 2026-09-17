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
  /** Keyboard shortcuts shown in the settings panel, in display order */
  shortcuts: { keys: string; description: string }[];
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
    shortcuts: [
      { keys: "⌘⇧Space", description: "Show or hide chotto" },
      { keys: "Enter", description: "Add a task, or toggle the selected one" },
      { keys: "↑ ↓", description: "Move the selection" },
      { keys: "⌘↑ ⌘↓", description: "Reorder the selected task" },
      { keys: "⌘⌫", description: "Delete the selected task" },
      { keys: "⌘K", description: "Next theme" },
      { keys: "⌘L", description: "Next language" },
      { keys: "⌘P", description: "Keep on top" },
      { keys: "⌘,", description: "Settings" },
      { keys: "Esc", description: "Hide" },
    ],
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
    shortcuts: [
      { keys: "⌘⇧Space", description: "chotto の表示 / 非表示" },
      { keys: "Enter", description: "追加、または選択中のチェック切替" },
      { keys: "↑ ↓", description: "選択を移動" },
      { keys: "⌘↑ ⌘↓", description: "選択中のタスクを並び替え" },
      { keys: "⌘⌫", description: "選択中のタスクを削除" },
      { keys: "⌘K", description: "次のテーマ" },
      { keys: "⌘L", description: "次の言語" },
      { keys: "⌘P", description: "常に手前に表示" },
      { keys: "⌘,", description: "設定" },
      { keys: "Esc", description: "隠す" },
    ],
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
