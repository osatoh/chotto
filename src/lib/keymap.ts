/**
 * Key bindings.
 *
 * A binding is a chord string such as "Super+Shift+Space": zero or more
 * modifiers in a fixed order, then a KeyboardEvent.code. Codes rather than
 * characters, so a binding survives a keyboard layout change.
 */
export const ACTIONS = [
  "toggleWindow",
  "newLine",
  "toggleDone",
  "moveUp",
  "moveDown",
  "moveLineUp",
  "moveLineDown",
  "indent",
  "outdent",
  "removeLine",
  "nextTheme",
  "nextLanguage",
  "togglePin",
  "settings",
  "hide",
] as const;

export type Action = (typeof ACTIONS)[number];

/** The only action the system hears while chotto is in the background */
export const GLOBAL_ACTION: Action = "toggleWindow";

export type Keymap = Record<Action, string>;

export const DEFAULT_KEYMAP: Keymap = {
  toggleWindow: "Super+Shift+Space",
  newLine: "Enter",
  toggleDone: "Super+Enter",
  moveUp: "ArrowUp",
  moveDown: "ArrowDown",
  moveLineUp: "Super+ArrowUp",
  moveLineDown: "Super+ArrowDown",
  indent: "Tab",
  outdent: "Shift+Tab",
  removeLine: "Super+Backspace",
  nextTheme: "Super+KeyK",
  nextLanguage: "Super+KeyL",
  togglePin: "Super+KeyP",
  settings: "Super+Comma",
  hide: "Escape",
};

const KEYMAP_KEY = "chotto.keymap";

/** Modifier order is fixed so a chord has exactly one spelling */
export function chordOf(event: KeyboardEvent): string | null {
  // A modifier on its own is not a chord yet
  if (/^(Meta|Shift|Alt|Control)/.test(event.code)) return null;

  const parts: string[] = [];
  if (event.ctrlKey) parts.push("Control");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Super");
  parts.push(event.code);
  return parts.join("+");
}

const SYMBOLS: Record<string, string> = {
  Control: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Super: "⌘",
  Enter: "Enter",
  Escape: "Esc",
  Backspace: "⌫",
  Delete: "⌦",
  Tab: "Tab",
  Space: "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
};

/** "Super+Shift+Space" reads as "⌘⇧Space" */
export function formatChord(chord: string): string {
  return chord
    .split("+")
    .map((part) => {
      if (SYMBOLS[part]) return SYMBOLS[part];
      if (part.startsWith("Key")) return part.slice(3);
      if (part.startsWith("Digit")) return part.slice(5);
      return part;
    })
    .join("");
}

/** Tauri parses the same modifier names, so only the order has to hold */
export function toAccelerator(chord: string): string {
  return chord;
}

/** Unknown actions fall back to their default, so a new action is never unbound */
export function loadKeymap(): Keymap {
  try {
    const saved = JSON.parse(localStorage.getItem(KEYMAP_KEY) ?? "{}");
    const keymap = { ...DEFAULT_KEYMAP };
    for (const action of ACTIONS) {
      if (typeof saved[action] === "string") keymap[action] = saved[action];
    }
    return keymap;
  } catch {
    return { ...DEFAULT_KEYMAP };
  }
}

export function saveKeymap(keymap: Keymap): void {
  localStorage.setItem(KEYMAP_KEY, JSON.stringify(keymap));
}

/** The action a chord triggers, or undefined when nothing is bound to it */
export function actionFor(keymap: Keymap, chord: string): Action | undefined {
  return ACTIONS.find(
    (action) => action !== GLOBAL_ACTION && keymap[action] === chord,
  );
}
