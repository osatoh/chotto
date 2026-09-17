// UI strings. No i18n library: a typed dictionary is enough.
export const LOCALES = ["en", "ja"] as const;
export type Locale = (typeof LOCALES)[number];

type Messages = {
  inputPlaceholder: string;
  settings: string;
  close: string;
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
    close: "Done (Esc)",
    theme: "Theme",
    language: "Language",
    pin: "Keep on top",
    on: "On",
    off: "Off",
    localeLabel: "English",
    shortcuts: [
      { keys: "⌘⇧Space", description: "Show or hide chotto" },
      { keys: "Enter", description: "Start a new line below" },
      { keys: "⌘Enter", description: "Check the line off" },
      { keys: "↑ ↓", description: "Move between lines" },
      { keys: "⌘↑ ⌘↓", description: "Move the line itself" },
      { keys: "⌫", description: "On an empty line, remove it" },
      { keys: "⌘⌫", description: "Remove the line" },
      { keys: "Tab ⇧Tab", description: "Indent or outdent" },
      { keys: "⌘K", description: "Next theme" },
      { keys: "⌘L", description: "Next language" },
      { keys: "⌘P", description: "Keep on top" },
      { keys: "⌘,", description: "Settings" },
      { keys: "Esc", description: "Close settings, or hide chotto" },
    ],
  },
  ja: {
    inputPlaceholder: "ちょっとメモ…",
    settings: "設定",
    close: "閉じる (Esc)",
    theme: "テーマ",
    language: "言語",
    pin: "常に手前に表示",
    on: "オン",
    off: "オフ",
    localeLabel: "日本語",
    shortcuts: [
      { keys: "⌘⇧Space", description: "chotto の表示 / 非表示" },
      { keys: "Enter", description: "下に新しい行" },
      { keys: "⌘Enter", description: "チェックを切り替え" },
      { keys: "↑ ↓", description: "行を移動" },
      { keys: "⌘↑ ⌘↓", description: "行そのものを並び替え" },
      { keys: "⌫", description: "空行なら、その行を削除" },
      { keys: "⌘⌫", description: "行を削除" },
      { keys: "Tab ⇧Tab", description: "インデントを下げる / 上げる" },
      { keys: "⌘K", description: "次のテーマ" },
      { keys: "⌘L", description: "次の言語" },
      { keys: "⌘P", description: "常に手前に表示" },
      { keys: "⌘,", description: "設定" },
      { keys: "Esc", description: "設定を閉じる / chotto を隠す" },
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
