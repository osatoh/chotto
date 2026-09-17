import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  createTask,
  deleteTask,
  listTasks,
  renameTask,
  setIndent,
  swapPositions,
  toggleTask,
  type Task,
} from "./lib/db";
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
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const t = messages(locale);

  const report = (cause: unknown) => setError(String(cause));

  /** Put the caret at the end of a line once it has been rendered */
  const focusLine = useCallback((id: number) => {
    setFocused(id);
    requestAnimationFrame(() => {
      const input = inputs.current.get(id);
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }, []);

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

  const runKeyDown = async (event: KeyboardEvent) => {
    // While the IME is composing, Enter confirms the conversion — not a line
    if (event.isComposing) return;

    const meta = event.metaKey;

    if (settingsOpen) {
      if (event.key === "Escape" || (meta && event.key === ",")) {
        event.preventDefault();
        setSettingsOpen(false);
      }
      return;
    }

    const index = tasks.findIndex((task) => task.id === focused);
    const current = tasks[index];

    switch (event.key) {
      case ",":
        if (meta) {
          event.preventDefault();
          setSettingsOpen(true);
        }
        return;

      case "Escape":
        event.preventDefault();
        await getCurrentWindow().hide();
        return;

      case "Enter": {
        event.preventDefault();
        if (!current) return;
        if (meta) {
          toggle(current);
          return;
        }
        const id = await createTask(
          positionBetween(current, tasks[index + 1]),
          current.indent,
        );
        setTasks(await listTasks());
        focusLine(id);
        return;
      }

      case "Backspace": {
        if (!current) return;
        // ⌘⌫ deletes outright; a bare ⌫ only collapses an empty line
        const caretAtStart =
          (event.target as HTMLInputElement).selectionStart === 0;
        if (meta || (caretAtStart && !current.title)) {
          event.preventDefault();
          await removeLine(index);
        }
        return;
      }

      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!current) return;
        const step = event.key === "ArrowDown" ? 1 : -1;
        const target = Math.max(0, Math.min(index + step, tasks.length - 1));
        if (target === index) return;
        if (meta) {
          await swapPositions(current, tasks[target]);
          setTasks(await listTasks());
        }
        focusLine(tasks[target].id);
        return;
      }

      case "Tab": {
        event.preventDefault();
        if (!current) return;
        const limit = maxIndent(tasks[index - 1]);
        const indent = Math.max(
          0,
          Math.min(current.indent + (event.shiftKey ? -1 : 1), limit),
        );
        if (indent === current.indent) return;
        await setIndent(current.id, indent);
        setTasks((all) =>
          all.map((one) => (one.id === current.id ? { ...one, indent } : one)),
        );
        return;
      }

      case "k":
        if (meta) {
          // ⌘K: cycles themes for now (command palette comes later)
          event.preventDefault();
          setTheme(next(THEMES, theme));
        }
        return;

      case "l":
        if (meta) {
          event.preventDefault();
          setLocale(next(LOCALES, locale));
        }
        return;

      case "p":
        if (meta) {
          event.preventDefault();
          await togglePin();
        }
        return;
    }
  };

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
          <header className="settings__header">
            <h1 className="settings__title">{t.settings}</h1>
            <button
              type="button"
              className="settings__close"
              onClick={() => setSettingsOpen(false)}
            >
              {t.close}
            </button>
          </header>

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

          <dl className="shortcuts">
            {t.shortcuts.map((shortcut) => (
              <div className="shortcuts__row" key={shortcut.keys}>
                <dt className="shortcuts__keys">{shortcut.keys}</dt>
                <dd className="shortcuts__description">{shortcut.description}</dd>
              </div>
            ))}
          </dl>
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
              />
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
