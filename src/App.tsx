import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  createTask,
  deleteTask,
  listTasks,
  renameTask,
  reorder,
  setIndent,
  toggleTask,
  type Task,
} from "./lib/db";
import {
  ACTIONS,
  DEFAULT_KEYMAP,
  GLOBAL_ACTION,
  actionFor,
  chordOf,
  formatChord,
  loadKeymap,
  saveKeymap,
  toAccelerator,
  type Action,
  type Keymap,
} from "./lib/keymap";
import {
  LOCALES,
  loadLocale,
  messages,
  saveLocale,
  type Locale,
} from "./lib/i18n";
import "./styles/themes.css";
import "./styles/app.css";

const THEMES = ["flexoki-light", "flexoki-dark", "dracula", "nord"] as const;
type Theme = (typeof THEMES)[number];

const THEME_KEY = "chotto.theme";

function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return THEMES.includes(saved as Theme) ? (saved as Theme) : "flexoki-light";
}

function next<T>(values: readonly T[], current: T): T {
  return values[(values.indexOf(current) + 1) % values.length];
}

/** A line may sit at most one level deeper than the line above it */
function maxIndent(previous: Task | undefined): number {
  return previous ? previous.indent + 1 : 0;
}

/** A line together with everything indented under it */
function blockOf(tasks: Task[], index: number): Task[] {
  let end = index;
  while (end + 1 < tasks.length && tasks[end + 1].indent > tasks[index].indent) {
    end += 1;
  }
  return tasks.slice(index, end + 1);
}

/** Position for a line inserted between two others; REAL leaves room forever */
function positionBetween(before: Task, after: Task | undefined): number {
  return after ? (before.position + after.position) / 2 : before.position + 1;
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focused, setFocused] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [pinned, setPinned] = useState(false);
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<number | null>(null);
  const [keymap, setKeymap] = useState<Keymap>(loadKeymap);
  const [capturing, setCapturing] = useState<Action | null>(null);
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const composing = useRef(false);
  const composedAt = useRef(0);
  const t = messages(locale);

  const report = (cause: unknown) => setError(String(cause));

  /** Ask for the caret to land at the end of a line */
  const focusLine = useCallback((id: number) => {
    setFocused(id);
    setPendingFocus(id);
  }, []);

  // A line added by Enter has no input element until React commits it, so the
  // caret is moved here rather than at the point the line is created
  useEffect(() => {
    if (pendingFocus === null) return;
    const input = inputs.current.get(pendingFocus);
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    setPendingFocus(null);
  }, [pendingFocus, tasks]);

  // chotto is never empty: an empty list still shows one line to type on
  const load = useCallback(async () => {
    const loaded = await listTasks();
    if (loaded.length > 0) {
      setTasks(loaded);
      return;
    }
    const id = await createTask(1, 0);
    setTasks(await listTasks());
    focusLine(id);
  }, [focusLine]);

  useEffect(() => {
    void load().catch(report);
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    saveLocale(locale);
  }, [locale]);

  // The Rust side starts on the default; hand it the saved binding once the
  // webview is up, and again whenever it changes
  useEffect(() => {
    void invoke("set_global_shortcut", {
      accelerator: toAccelerator(keymap[GLOBAL_ACTION]),
    }).catch(report);
  }, [keymap]);

  // Return to the line that was being typed every time the popup comes back
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: shown }) => {
      const id = focused ?? tasks[0]?.id;
      if (shown && id !== undefined) focusLine(id);
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [focused, tasks, focusLine]);

  const rebind = (action: Action, chord: string) => {
    const taken = ACTIONS.find(
      (other) => other !== action && keymap[other] === chord,
    );
    if (taken) {
      setError(t.keyTaken);
      return;
    }
    const updated = { ...keymap, [action]: chord };
    setKeymap(updated);
    saveKeymap(updated);
  };

  const resetKeys = () => {
    setKeymap({ ...DEFAULT_KEYMAP });
    saveKeymap({ ...DEFAULT_KEYMAP });
  };

  const togglePin = async () => {
    const pin = !pinned;
    setPinned(pin);
    await invoke("set_pinned", { pinned: pin });
  };

  const changeTitle = (task: Task, title: string) => {
    setTasks((all) =>
      all.map((one) => (one.id === task.id ? { ...one, title } : one)),
    );
    void renameTask(task.id, title).catch(report);
  };

  const toggle = (task: Task) => {
    setTasks((all) =>
      all.map((one) => (one.id === task.id ? { ...one, done: !one.done } : one)),
    );
    void toggleTask(task.id, !task.done).catch(report);
  };

  /** Remove a line, keeping the last one as an empty line to type on */
  const removeLine = async (index: number) => {
    const task = tasks[index];
    if (tasks.length === 1) {
      changeTitle(task, "");
      return;
    }
    await deleteTask(task.id);
    const neighbour = tasks[index - 1] ?? tasks[index + 1];
    setTasks(tasks.filter((_, at) => at !== index));
    focusLine(neighbour.id);
  };

  /** Move a line and its children past the neighbouring line and its children */
  const moveBlock = async (index: number, direction: 1 | -1) => {
    const block = blockOf(tasks, index);
    const end = index + block.length - 1;
    let order: Task[];

    if (direction === 1) {
      const after = end + 1;
      if (after >= tasks.length) return;
      const neighbour = blockOf(tasks, after);
      order = [
        ...tasks.slice(0, index),
        ...neighbour,
        ...block,
        ...tasks.slice(after + neighbour.length),
      ];
    } else {
      if (index === 0) return;
      // The line above may be a child, so walk back to the top of its block
      let start = index - 1;
      while (start > 0 && tasks[start].indent > tasks[index].indent) start -= 1;
      order = [
        ...tasks.slice(0, start),
        ...block,
        ...tasks.slice(start, index),
        ...tasks.slice(end + 1),
      ];
    }

    await reorder(order.map((task) => task.id));

    // The block can land where its depth no longer has a parent above it
    const landed = order.findIndex((task) => task.id === block[0].id);
    const over = block[0].indent - maxIndent(order[landed - 1]);
    if (over > 0) {
      for (const task of block) {
        await setIndent(task.id, Math.max(0, task.indent - over));
      }
    }

    setTasks(await listTasks());
    // The caret follows the line that moved, not the row it used to sit on
    focusLine(block[0].id);
  };

  const runKeyDown = async (event: KeyboardEvent) => {
    // While the IME is composing, Enter confirms the conversion — not a line.
    // keyCode 229 and the composing ref cover WKWebView, where compositionend
    // can arrive before the keydown that caused it and isComposing reads false.
    if (event.isComposing || event.keyCode === 229 || composing.current) return;
    // The Enter that confirms a conversion is released just after
    // compositionend; treat that one as belonging to the IME too
    if (event.key === "Enter" && performance.now() - composedAt.current < 50) {
      return;
    }

    const chord = chordOf(event);
    if (!chord) return;

    // While waiting for a key, every chord means "bind me" except the escape
    if (capturing) {
      event.preventDefault();
      if (chord !== "Escape") rebind(capturing, chord);
      setCapturing(null);
      return;
    }

    const action = actionFor(keymap, chord);

    if (settingsOpen) {
      if (action === "hide" || action === "settings") {
        event.preventDefault();
        setSettingsOpen(false);
      }
      return;
    }

    const index = tasks.findIndex((task) => task.id === focused);
    const current = tasks[index];

    // ⌫ on an empty line is an editing rule rather than a binding: it has to
    // read the caret, and on a line with text it must stay a plain backspace
    if (
      event.code === "Backspace" &&
      !action &&
      current &&
      !current.title &&
      (event.target as HTMLInputElement).selectionStart === 0
    ) {
      event.preventDefault();
      await removeLine(index);
      return;
    }

    switch (action) {
      case "settings":
        event.preventDefault();
        setSettingsOpen(true);
        return;

      case "hide":
        event.preventDefault();
        await getCurrentWindow().hide();
        return;

      case "newLine": {
        event.preventDefault();
        if (!current) return;
        const id = await createTask(
          positionBetween(current, tasks[index + 1]),
          current.indent,
        );
        setTasks(await listTasks());
        focusLine(id);
        return;
      }

      case "toggleDone":
        event.preventDefault();
        if (current) toggle(current);
        return;

      case "removeLine":
        event.preventDefault();
        if (current) await removeLine(index);
        return;

      case "moveUp":
      case "moveDown": {
        event.preventDefault();
        if (!current) return;
        const step = action === "moveDown" ? 1 : -1;
        const target = Math.max(0, Math.min(index + step, tasks.length - 1));
        if (target !== index) focusLine(tasks[target].id);
        return;
      }

      case "moveLineUp":
      case "moveLineDown":
        event.preventDefault();
        if (!current) return;
        await moveBlock(index, action === "moveLineDown" ? 1 : -1);
        return;

      case "indent":
      case "outdent": {
        event.preventDefault();
        if (!current) return;
        const limit = maxIndent(tasks[index - 1]);
        const indent = Math.max(
          0,
          Math.min(current.indent + (action === "indent" ? 1 : -1), limit),
        );
        if (indent === current.indent) return;
        await setIndent(current.id, indent);
        setTasks((all) =>
          all.map((one) => (one.id === current.id ? { ...one, indent } : one)),
        );
        return;
      }

      case "nextTheme":
        // Cycling for now; a command palette comes later
        event.preventDefault();
        setTheme(next(THEMES, theme));
        return;

      case "nextLanguage":
        event.preventDefault();
        setLocale(next(LOCALES, locale));
        return;

      case "togglePin":
        event.preventDefault();
        await togglePin();
        return;
    }
  };

  useEffect(() => {
    const onStart = () => {
      composing.current = true;
    };
    const onEnd = () => {
      composing.current = false;
      composedAt.current = performance.now();
    };
    window.addEventListener("compositionstart", onStart);
    window.addEventListener("compositionend", onEnd);
    return () => {
      window.removeEventListener("compositionstart", onStart);
      window.removeEventListener("compositionend", onEnd);
    };
  }, []);

  // Listen on the window, not on the popup: the settings panel has nothing
  // focusable, so a handler on an element would never see Esc there.
  // Re-registered on every render so the handler always reads fresh state.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Nothing else reports failures, so a swallowed rejection would look
      // like a key that simply does nothing
      setError(null);
      void runKeyDown(event).catch(report);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="popup" data-tauri-drag-region>
      {settingsOpen ? (
        <div className="settings" data-tauri-drag-region>
          <h1 className="settings__title">{t.settings}</h1>

          <button
            type="button"
            className="settings__row"
            onClick={() => setTheme(next(THEMES, theme))}
          >
            <span>{t.theme}</span>
            <span className="settings__value">{theme}</span>
          </button>

          <button
            type="button"
            className="settings__row"
            onClick={() => setLocale(next(LOCALES, locale))}
          >
            <span>{t.language}</span>
            <span className="settings__value">{t.localeLabel}</span>
          </button>

          <button
            type="button"
            className="settings__row"
            onClick={() => void togglePin()}
          >
            <span>{t.pin}</span>
            <span className="settings__value">{pinned ? t.on : t.off}</span>
          </button>

          <h2 className="settings__title settings__title--section">{t.keys}</h2>
          {ACTIONS.map((action) => (
            <button
              type="button"
              key={action}
              className="settings__row"
              onClick={() => setCapturing(action)}
            >
              <span>{t.actions[action]}</span>
              <span className="settings__value">
                {capturing === action ? t.pressKey : formatChord(keymap[action])}
              </span>
            </button>
          ))}

          <p className="settings__note">{t.emptyLineHint}</p>
          <button type="button" className="settings__reset" onClick={resetKeys}>
            {t.resetKeys}
          </button>
        </div>
      ) : (
        <ul className="list" data-tauri-drag-region>
          {tasks.map((task) => (
            <li
              key={task.id}
              className="task"
              style={{ paddingLeft: `${16 + task.indent * 22}px` }}
            >
              <span
                className={`checkbox${task.done ? " checkbox--checked" : ""}`}
                onClick={() => toggle(task)}
              >
                {/* Drawn rather than a ✓ glyph: the stroke can be rounded,
                    and it can be animated on its way in */}
                <svg className="checkbox__tick" viewBox="0 0 16 16">
                  <path d="M3.5 8.5 L6.6 11.5 L12.5 4.8" />
                </svg>
              </span>
              <input
                ref={(input) => {
                  if (input) inputs.current.set(task.id, input);
                  else inputs.current.delete(task.id);
                }}
                className={`task__input${task.done ? " task__input--done" : ""}`}
                value={task.title}
                placeholder={tasks.length === 1 ? t.inputPlaceholder : ""}
                onChange={(event) => changeTitle(task, event.target.value)}
                onFocus={() => setFocused(task.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}
