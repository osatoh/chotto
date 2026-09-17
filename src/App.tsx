import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import {
  addTask,
  deleteTask,
  listTasks,
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

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [draft, setDraft] = useState("");
  const [selected, setSelected] = useState(0);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [pinned, setPinned] = useState(false);
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = messages(locale);

  const reload = useCallback(async () => {
    setTasks(await listTasks());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
    saveLocale(locale);
  }, [locale]);

  // Return focus to the input every time the popup is shown again
  useEffect(() => {
    const unlisten = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
    });
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const clampSelection = (index: number) =>
    Math.max(0, Math.min(index, tasks.length - 1));

  const togglePin = async () => {
    const pin = !pinned;
    setPinned(pin);
    await invoke("set_pinned", { pinned: pin });
  };

  const handleKeyDown = async (event: React.KeyboardEvent) => {
    const meta = event.metaKey;
    const current = tasks[selected];

    switch (event.key) {
      case ",":
        if (meta) {
          event.preventDefault();
          setSettingsOpen((open) => !open);
        }
        return;

      case "Escape":
        event.preventDefault();
        // Esc closes the settings panel first, then hides the window
        if (settingsOpen) {
          setSettingsOpen(false);
        } else {
          await getCurrentWindow().hide();
        }
        return;

      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const target = clampSelection(selected + delta);
        // ⌘↑↓ reorders the selected task
        if (meta && current && target !== selected) {
          await swapPositions(current, tasks[target]);
          await reload();
        }
        setSelected(target);
        return;
      }

      case "Enter":
        event.preventDefault();
        if (draft.trim()) {
          await addTask(draft.trim());
          setDraft("");
          await reload();
        } else if (current) {
          await toggleTask(current.id, !current.done);
          await reload();
        }
        return;

      case "Backspace":
        if (meta && current) {
          event.preventDefault();
          await deleteTask(current.id);
          setSelected(clampSelection(selected - 1));
          await reload();
        }
        return;

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

  const toggleSelected = async (task: Task) => {
    await toggleTask(task.id, !task.done);
    await reload();
  };

  return (
    <div className="popup" onKeyDown={handleKeyDown}>
      {settingsOpen ? (
        <div className="settings">
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
        <ul className="list">
          {tasks.map((task, index) => (
            <li
              key={task.id}
              className={`task${index === selected ? " task--selected" : ""}`}
              onClick={() => setSelected(index)}
            >
              <span
                className={`checkbox${task.done ? " checkbox--checked" : ""}`}
                onClick={() => void toggleSelected(task)}
              />
              <span className={task.done ? "task__title--done" : undefined}>
                {task.title}
              </span>
            </li>
          ))}

          {/* The last line is the input: a task starts as an empty checkbox */}
          <li className="task task--draft">
            <span className="checkbox" />
            <input
              ref={inputRef}
              className="task__input"
              placeholder={t.inputPlaceholder}
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
            />
          </li>
        </ul>
      )}
    </div>
  );
}
